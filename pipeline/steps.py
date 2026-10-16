"""Shared plumbing for the LLM enrichment steps.

Every step has the same shape:
  1. restore what its snapshot already knows into the DB (free),
  2. collect what is still pending,
  3. send it to the LLM in fixed-size batches, rows numbered [0]..[n-1],
     answers keyed by row number (`{"0": ..., "1": ...}`) so the model
     never has to echo ids back (output tokens are the expensive ones),
  4. commit + save the snapshot after every batch, so a crash never pays
     for the same answer twice.
"""

from __future__ import annotations

import argparse
import sqlite3
from typing import Any, Callable, Iterable, Iterator, Sequence

from .db import session
from .llm import Prompt, complete, extract_json

# Set by `pipeline.build --dry-run`: report pending work instead of calling the LLM.
DRY_RUN = False
# "<step> <batch>/<n>: <error>" for every batch that failed this process; a re-run retries them.
FAILURES: list[str] = []


def label(row) -> str:
    """'der Arzt' for nouns, the bare lemma otherwise."""
    return f"{row['article']} {row['lemma']}" if row["article"] else row["lemma"]


def numbered(rows: Iterable, fmt: Callable[[Any], str]) -> str:
    return "\n".join(f"[{i}] {fmt(r)}" for i, r in enumerate(rows))


def indexed(data: dict, batch: Sequence) -> Iterator[tuple[Any, Any]]:
    """Yield (row, answer) pairs from a `{"<row number>": answer}` reply,
    dropping keys that aren't a valid row number."""
    for k, v in data.items():
        try:
            i = int(k)
        except (TypeError, ValueError):
            continue
        if 0 <= i < len(batch):
            yield batch[i], v


def restore(conn: sqlite3.Connection, sql: str, params: Iterable[tuple]) -> int:
    """Run one write per cached row; return how many DB rows it changed."""
    n = conn.executemany(sql, list(params)).rowcount
    conn.commit()
    return max(n, 0)


def run_batches(
    conn: sqlite3.Connection,
    name: str,
    pending: Sequence,
    size: int,
    prompt: Callable[[Sequence], Prompt],
    apply: Callable[[Sequence, dict], int],
    save: Callable[[], None],
) -> int:
    """Send `pending` to the LLM `size` rows at a time.

    `prompt(batch)` builds the request, `apply(batch, reply)` writes the
    parsed `{"<row>": ...}` reply to the DB (and the step's snapshot dict)
    and returns how many rows it filled; `save()` persists the snapshot.
    """
    n_batches = (len(pending) + size - 1) // size
    if DRY_RUN:
        print(f"  {name}: would send {len(pending)} rows in {n_batches} calls")
        return 0
    total = 0
    for b, start in enumerate(range(0, len(pending), size), 1):
        batch = pending[start : start + size]
        try:
            data = extract_json(complete(prompt(batch)))
        except Exception as e:
            data = e
        if not isinstance(data, dict):
            err = data if isinstance(data, Exception) else f"expected object, got {type(data).__name__}"
            FAILURES.append(f"{name} {b}/{n_batches}: {err}")
            print(f"  {FAILURES[-1]}")
            continue
        n = apply(batch, data)
        conn.commit()
        save()
        total += n
        print(f"  {name} {b}/{n_batches}: +{n}")
    return total


def cli(run: Callable[..., int], what: str) -> None:
    """`python -m pipeline.<step> [--limit N]` for any step with run(conn, limit)."""
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="only send the first N pending rows")
    args = ap.parse_args()
    with session() as conn:
        n = run(conn, limit=args.limit)
    print(f"{what}: {n}")
