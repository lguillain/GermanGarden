"""Thin wrapper around the Anthropic SDK.

- Model choice per workload (bulk tagging → Haiku, sentence/onboarding → Sonnet).
- Prompt caching on long system prompts (activity list, few-shot examples).
- Strict JSON extraction helper.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any

try:
    from anthropic import Anthropic
except ImportError:  # anthropic not installed yet — allow importing llm.py anyway
    Anthropic = None  # type: ignore[assignment]

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


class LLMUnavailable(RuntimeError):
    """Raised when a Claude call is attempted but no API key is configured."""


# Model IDs — keep in one place.
MODEL_BULK = "claude-haiku-4-5-20251001"   # per-word tagging, per-sentence tagging, reflection
MODEL_WRITE = "claude-sonnet-4-6"          # sentence generation, onboarding text parsing

_client = None


def available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY")) and Anthropic is not None


def client():
    global _client
    if _client is None:
        if Anthropic is None:
            raise LLMUnavailable("anthropic SDK is not installed; `pip install -r requirements.txt`")
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise LLMUnavailable(
                "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add a key, "
                "or run with the pre-seeded sample data (see README)."
            )
        _client = Anthropic(api_key=key)
    return _client


@dataclass
class Prompt:
    system: str              # cached
    user: str                # per-call (appended as the final user turn)
    model: str = MODEL_BULK
    max_tokens: int = 1024
    temperature: float = 0.3
    history: list[dict] | None = None   # prior turns for multi-turn chat


def complete(p: Prompt) -> str:
    """Single completion. System prompt is cached across calls. If `history`
    is set, it's prepended before the final user turn built from `user`."""
    messages = list(p.history or [])
    messages.append({"role": "user", "content": p.user})
    msg = client().messages.create(
        model=p.model,
        max_tokens=p.max_tokens,
        temperature=p.temperature,
        system=[{"type": "text", "text": p.system, "cache_control": {"type": "ephemeral"}}],
        messages=messages,
    )
    return "".join(block.text for block in msg.content if block.type == "text")


_JSON_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def extract_json(text: str) -> Any:
    """Pull a JSON object/array out of a model response, tolerating fences.

    Prefers whichever shape appears FIRST in the payload — so an
    `[{...}, {...}]` array isn't mis-parsed as just its first element.
    """
    m = _JSON_FENCE.search(text)
    payload = (m.group(1) if m else text).strip()

    first_obj = payload.find("{")
    first_arr = payload.find("[")
    if first_arr != -1 and (first_obj == -1 or first_arr < first_obj):
        order = [("[", "]"), ("{", "}")]
    else:
        order = [("{", "}"), ("[", "]")]

    for opener, closer in order:
        start = payload.find(opener)
        if start == -1:
            continue
        depth = 0
        for i in range(start, len(payload)):
            if payload[i] == opener:
                depth += 1
            elif payload[i] == closer:
                depth -= 1
                if depth == 0:
                    return json.loads(payload[start : i + 1])
    return json.loads(payload)
