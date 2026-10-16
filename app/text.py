"""Shared text helpers for the app."""

from __future__ import annotations

import html
import re


def _lemma_variants(lemma: str) -> list[str]:
    """Rough inflection stems for a lemma: strip common endings so we match
    conjugated/declined forms with a prefix regex."""
    low = lemma.lower()
    stems = {low}
    for ending in ("en", "ern", "eln", "e", "n"):
        if low.endswith(ending) and len(low) - len(ending) >= 3:
            stems.add(low[: -len(ending)])
    return sorted(stems, key=len, reverse=True)


def highlight(sentence: str, lemma: str) -> str:
    """Return HTML with the target word (any inflected form) wrapped in <strong>."""
    return highlight_many(sentence, [lemma])


def highlight_many(text: str, lemmas: list[str]) -> str:
    """Return HTML with every inflected form of any lemma wrapped in <strong>."""
    escaped = html.escape(text)
    stems: list[str] = []
    for l in lemmas:
        stems.extend(_lemma_variants(l))
    stems = sorted(set(stems), key=len, reverse=True)
    if not stems:
        return escaped
    pattern = re.compile(
        r"\b(" + "|".join(re.escape(s) for s in stems) + r")(\w*)",
        re.IGNORECASE,
    )
    return pattern.sub(lambda m: f"<strong>{m.group(0)}</strong>", escaped)


def used_lemmas(user_text: str, lemmas: list[str]) -> set[str]:
    """Which lemmas appear (in any inflected form) in `user_text`."""
    low = user_text.lower()
    found: set[str] = set()
    for l in lemmas:
        for stem in _lemma_variants(l):
            if re.search(r"\b" + re.escape(stem) + r"\w*", low):
                found.add(l); break
    return found
