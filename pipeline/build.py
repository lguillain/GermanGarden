"""Build the vocabulary dataset in data/vocab.sqlite.

Every step is idempotent and snapshot-backed: re-running only pays for rows
that are still missing, so this is the one command to run whenever the
inputs change (new Goethe JSON, edited activities.yaml, Tatoeba download)
or a previous run was interrupted. Free sources go first (Goethe, Tatoeba),
so the expensive generation step only fills the gaps they leave.

    python -m pipeline.build                # build the complete dataset
    python -m pipeline.build --dry-run      # show what the LLM steps would send
    python -m pipeline.build --skip-llm     # just the free steps
    python -m pipeline.build --limit 20     # cap each LLM step (smoke test)
"""

from __future__ import annotations

import argparse
import sys

from . import (activities, associations, enrich_sentences, goethe_json, seed, sentences,
               steps, tatoeba, translate, verify)
from .db import session
from .llm import available as llm_available


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="Count pending LLM work per step; make no LLM calls")
    ap.add_argument("--skip-llm", action="store_true", help="Skip all LLM-powered steps")
    ap.add_argument("--skip-tatoeba", action="store_true")
    ap.add_argument("--skip-generate", action="store_true", help="Skip LLM sentence generation")
    ap.add_argument("--limit", type=int, default=None, help="Max pending rows per LLM step")
    ap.add_argument("--seed", action="store_true",
                    help="Load the no-LLM sample dataset instead of a full build")
    args = ap.parse_args()

    if args.seed:
        seed.main()
        return

    steps.DRY_RUN = args.dry_run
    skip_llm = args.skip_llm or not (llm_available() or args.dry_run)
    if skip_llm and not args.skip_llm:
        print("No ANTHROPIC_API_KEY set — skipping LLM steps.")

    print("[1] Goethe words + example sentences")
    c = goethe_json.load()
    print(f"    {c['words']} words, {c['sentences']} new sentences")

    with session() as conn:
        print(f"[2] Activities: {activities.load_activities(conn)}")

        todo = []
        if not skip_llm:
            todo += [("English glosses", translate.run),
                     ("Word → activity tags", activities.run),
                     ("Associated words", associations.run)]
        if not args.skip_tatoeba:
            todo += [("Tatoeba sentences", lambda conn, limit: tatoeba.match(conn))]
        if not skip_llm:
            todo += [("Sentence translations + activities", enrich_sentences.run)]
            if not args.skip_generate:
                todo += [("Generated gap-fill sentences", sentences.run)]

        for i, (name, run) in enumerate(todo, 3):
            print(f"[{i}] {name}")
            print(f"    +{run(conn, limit=args.limit)}")

    if args.dry_run:
        print("\nDry run: no LLM calls made. Counts for later steps grow once "
              "earlier ones fill in (e.g. new word tags → new sentence gaps).")
        return

    verify.run()

    if steps.FAILURES:
        print(f"\n{len(steps.FAILURES)} LLM batch(es) failed — re-run to retry just those:")
        for f in steps.FAILURES:
            print(f"  {f}")
        sys.exit(1)
    print("done.")


if __name__ == "__main__":
    main()
