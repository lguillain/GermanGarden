"""Learn page: four modes for practicing kept vocabulary.

- Flashcards: cycle through random kept words; no LLM needed.
- Chat: short conversation in German where the LLM steers toward the
  learner's target words. State lives in the HTML form (hidden JSON).
- Reading: LLM generates a short passage that uses the target words.
- Grammar playground: pick one kept word, choose a POS-tailored grammar
  config (case/number for nouns, tense/person for verbs, degree/declension
  for adjectives), then generate one example sentence or submit your own
  for a config-focused correction.
"""

from __future__ import annotations

import sqlite3

from pipeline.llm import (
    LLMUnavailable, MODEL_WRITE, Prompt, available, complete, extract_json,
)

FLASHCARDS_N = 10
TARGETS_N = 5

# Vocabulary ceilings for generated text / chat. The learner only sees German
# at or below their declared CEFR level; above-level target words are the one
# exception (they're the whole point of the practice).
LEVEL_GUIDANCE = {
    "A1": "ONLY the simplest A1-level German vocabulary (the ~700 most common "
          "everyday words). Short present-tense sentences. No subordinate "
          "clauses with complex connectors. No Konjunktiv.",
    "A2": "ONLY A1- and A2-level German vocabulary (~2000 most common words). "
          "Simple present and perfect tenses. Short sentences. Basic "
          "subordinate clauses (weil, dass, wenn) are fine.",
    "B1": "ONLY A1-, A2-, and B1-level German vocabulary (~4000 most common "
          "words). Natural sentence structure, past tenses, subordinate "
          "clauses, modal verbs are fine. No rare, academic, or technical words.",
}


def _level_rule(level: str) -> str:
    return LEVEL_GUIDANCE.get(level, LEVEL_GUIDANCE["A2"])


def mark_learned(conn: sqlite3.Connection, word_id: str) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO flashcard_learned (word_id) VALUES (?)", (word_id,)
    )


# ---------------------------- reading ----------------------------


READ_SYSTEM = (
    "You generate short reading passages in German for language learners "
    "at CEFR level {level}.\n\n"
    "VOCABULARY RULE — this is strict: use {level_rule}\n"
    "The ONLY exception is the target words below; if any target word is "
    "above level {level}, use it anyway (it's the point of the practice) "
    "— but every OTHER word in the passage must be at level {level} or "
    "below. If you're not sure a word is at or below {level}, pick a "
    "simpler synonym.\n\n"
    "Write a 90–130-word passage in natural German that uses each target "
    "word at least once (any inflected form counts). Pick a plausible "
    "context (diary entry, email, overheard conversation, notice, etc.). "
    "Avoid padding — the words should fit naturally.\n\n"
    "Reply with STRICT JSON: "
    '{{"setting": "<2–4 word label>", "de": "<German>", "en": "<faithful English>"}}'
    "\nNo prose outside the JSON."
)


def generate_reading(level: str, targets: list[dict]) -> dict:
    """targets: dicts with 'lemma', 'english', 'article'. Returns {setting,de,en}."""
    if not available():
        raise LLMUnavailable("set ANTHROPIC_API_KEY to use reading mode")
    target_lines = "\n".join(
        f"- {(t.get('article') + ' ') if t.get('article') else ''}"
        f"{t['lemma']} ({t['english']}) [level {t.get('level','?')}]"
        for t in targets
    )
    out = complete(Prompt(
        system=READ_SYSTEM.format(level=level, level_rule=_level_rule(level)),
        user=f"Target words:\n{target_lines}",
        model=MODEL_WRITE, max_tokens=900, temperature=0.7,
    ))
    data = extract_json(out)
    return {
        "setting": str(data.get("setting", "")).strip(),
        "de": str(data.get("de", "")).strip(),
        "en": str(data.get("en", "")).strip(),
    }


# ---------------------------- chat ----------------------------


CHAT_SYSTEM = (
    "You're a warm, patient native German speaker chatting with a language "
    "learner at CEFR level {level}.\n\n"
    "VOCABULARY RULE — strict: use {level_rule}\n"
    "If you're not sure a word is at or below level {level}, pick a simpler "
    "synonym. The learner may use words above their level; that's fine — "
    "just keep YOUR replies at level {level} or below.\n\n"
    "For the CURRENT user message (the LAST one in the conversation) you "
    "do TWO things:\n"
    "1. Check ONLY the current message for GENUINE mistakes — wrong "
    "article/case, wrong verb form, bad word order, non-idiomatic "
    "phrasing, misspelling. IGNORE anything in earlier turns; those have "
    "already been addressed and must NOT reappear in corrections. Skip "
    "casual typos that don't affect meaning. Don't be pedantic. If the "
    "current message is fine, return an empty corrections list. Every "
    "\"original\" string in corrections MUST appear verbatim in the "
    "current user message.\n"
    "2. Reply naturally in 1–2 sentences at level {level}. Don't translate "
    "or lecture — just converse. Steer gently toward the target words so "
    "the learner gets openings to use them; don't announce the targets.\n\n"
    "Reply with STRICT JSON only, no prose outside:\n"
    '{{"corrections": [{{"original": "<exact wrong fragment from their '
    'message>", "corrected": "<fixed version>", "note": "<one short '
    'sentence in English explaining the fix>"}}], "reply": "<your German '
    'reply>"}}\n'
    "Target words: {targets}"
)


def _chat_system(level: str, target_lemmas: list[str]) -> str:
    return CHAT_SYSTEM.format(
        level=level, level_rule=_level_rule(level),
        targets=", ".join(target_lemmas),
    )


def _api_history(history: list[dict]) -> list[dict]:
    """Strip app-only fields (e.g. 'corrections') before sending to the API."""
    return [{"role": m["role"], "content": m["content"]} for m in history]


def _parse_chat_json(raw: str, current_message: str = "") -> tuple[list[dict], str]:
    """Return (clean_corrections, reply_text). Falls back to raw-as-reply on
    parse failure so the chat keeps flowing even if the model skips JSON.

    Corrections whose `original` fragment isn't present verbatim in
    `current_message` are dropped — the model occasionally re-raises
    mistakes from earlier turns, which we don't want to surface again."""
    try:
        data = extract_json(raw)
    except Exception:
        return [], raw.strip()
    if not isinstance(data, dict):
        return [], raw.strip()
    reply = str(data.get("reply", "")).strip() or raw.strip()
    haystack = current_message.lower()
    cleaned: list[dict] = []
    for c in data.get("corrections") or []:
        if not isinstance(c, dict):
            continue
        orig = str(c.get("original", "")).strip()
        fixed = str(c.get("corrected", "")).strip()
        if not orig or not fixed or orig == fixed:
            continue
        if haystack and orig.lower() not in haystack:
            continue   # correction doesn't match the current message — drop it
        cleaned.append({
            "original": orig,
            "corrected": fixed,
            "note": str(c.get("note", "")).strip(),
        })
    return cleaned, reply


def chat_opener(level: str, target_lemmas: list[str]) -> str:
    if not available():
        raise LLMUnavailable("set ANTHROPIC_API_KEY to use chat mode")
    raw = complete(Prompt(
        system=_chat_system(level, target_lemmas),
        user="(Open the conversation with a greeting and a friendly question "
             "that gives the learner a chance to use one of the target words.)",
        model=MODEL_WRITE, max_tokens=250, temperature=0.7,
    ))
    _, reply = _parse_chat_json(raw)   # no current_message — opener has none
    return reply


def chat_turn(level: str, target_lemmas: list[str],
              history: list[dict], user_message: str) -> list[dict]:
    """Return history + [user turn (optionally with corrections), assistant reply]."""
    if not available():
        raise LLMUnavailable("set ANTHROPIC_API_KEY to use chat mode")
    raw = complete(Prompt(
        system=_chat_system(level, target_lemmas),
        user=user_message,
        model=MODEL_WRITE, max_tokens=400, temperature=0.6,
        history=_api_history(history),
    ))
    corrections, reply = _parse_chat_json(raw, current_message=user_message)
    user_entry: dict = {"role": "user", "content": user_message}
    if corrections:
        user_entry["corrections"] = corrections
    return history + [user_entry, {"role": "assistant", "content": reply}]


# ---------------------------- grammar playground ----------------------------

# POS-tailored config dimensions surfaced to the UI. Keys line up with form
# field names in grammar_play.html.
GRAMMAR_CONFIG_OPTIONS: dict[str, dict[str, list[str]]] = {
    "noun": {
        "case":    ["Nominativ", "Akkusativ", "Dativ", "Genitiv"],
        "number":  ["Singular", "Plural"],
    },
    "verb": {
        "tense":   ["Präsens", "Perfekt", "Präteritum", "Plusquamperfekt",
                    "Futur I", "Konjunktiv II", "Imperativ"],
        "person":  ["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"],
    },
    "adj": {
        "degree":      ["Positiv", "Komparativ", "Superlativ"],
        "declension":  ["stark (no article)",
                        "schwach (der/die/das)",
                        "gemischt (ein/kein/mein)"],
    },
}


def kept_word(conn: sqlite3.Connection, word_id: str) -> sqlite3.Row | None:
    """One kept word by id, or None if the user never kept it."""
    return conn.execute(
        """
        SELECT w.id, w.lemma, w.article, w.plural, w.pos, w.english, w.level
        FROM words w
        WHERE w.id = ? AND EXISTS (
            SELECT 1 FROM swipes WHERE word_id = w.id AND action = 'keep'
        )
        """,
        (word_id,),
    ).fetchone()


def _word_label(word: dict) -> str:
    piece = f"{word['article']} {word['lemma']}" if word.get("article") else word["lemma"]
    return (f"{piece} ({word.get('english', '') or '—'}) "
            f"[{word.get('pos', '')}, level {word.get('level', '?')}]")


def _config_label(pos: str, config: dict) -> str:
    """Human-readable spec of the chosen config, fed verbatim to the LLM."""
    if pos == "noun":
        return "\n".join([
            f"- case: {config.get('case') or 'Nominativ'}",
            f"- number: {config.get('number') or 'Singular'}",
        ])
    if pos == "verb":
        return "\n".join([
            f"- tense/mood: {config.get('tense') or 'Präsens'}",
            f"- person: {config.get('person') or 'ich'}",
        ])
    if pos == "adj":
        return "\n".join([
            f"- degree: {config.get('degree') or 'Positiv'}",
            f"- declension: {config.get('declension') or 'stark (no article)'}",
        ])
    return "- no specific grammar configuration (use the word naturally in context)"


GRAMMAR_GEN_SYSTEM = (
    "You write a SINGLE short, natural German sentence that puts a target "
    "word into a specific grammatical configuration, for a language learner "
    "at CEFR level {level}.\n\n"
    "VOCABULARY RULE — strict: use {level_rule}\n"
    "The ONLY exception is the target word; if it's above level {level}, "
    "use it anyway. Every OTHER word in your sentence must be at level "
    "{level} or below. If unsure, pick a simpler synonym.\n\n"
    "GRAMMAR REFERENCE — case governance for nouns:\n"
    "  Dativ-only prepositions: aus, bei, mit, nach, seit, von, zu, "
    "    gegenüber. Also verbs like helfen, danken, folgen, gefallen, "
    "    gehören, antworten take dative.\n"
    "  Akkusativ-only prepositions: für, gegen, ohne, durch, um, bis. "
    "    Most transitive verbs take accusative direct objects.\n"
    "  Two-way prepositions (an, auf, in, über, unter, vor, hinter, "
    "    neben, zwischen): take Dativ for LOCATION ('wo?'), Akkusativ "
    "    for DIRECTION or TOPIC ('wohin? / worüber?'). CRITICAL: "
    "    'sprechen/reden/sich beschweren über + Akk' — these mean "
    "    'talk/complain ABOUT' and take Akkusativ, NOT Dativ.\n"
    "  Genitiv prepositions (B1+): wegen, trotz, während, (an)statt. "
    "    Possession: 'der Hut [des Mannes/der Frau/der Kinder]'.\n\n"
    "WORK ORDER — follow EXACTLY, do not skip or re-order:\n"
    "1. `case_trigger` (ONLY for nouns): write the single preposition OR "
    "   governing verb in your planned sentence that NATURALLY requires "
    "   the configured case (e.g. 'mit' for Dativ, 'für' for Akkusativ, "
    "   'wegen' for Genitiv). It MUST govern the configured case on its "
    "   own, no two-way-preposition ambiguity. For verbs/adjectives, "
    "   leave this empty.\n"
    "2. `expected_form`: the exact inflected form the target word must "
    "   take, including any required article (e.g. 'den Ängsten' for "
    "   Dativ Plural of 'die Angst').\n"
    "3. `de`: the German sentence. It MUST contain `expected_form` "
    "   verbatim, AND the surrounding context (preposition / verb / "
    "   article) must grammatically require that case/form on its own. "
    "   Do not force the form into a context that would normally take "
    "   a different case.\n"
    "4. `en` and `focus` as described.\n\n"
    "SELF-CHECK before replying: re-read your `de` as if you were a "
    "native German speaker. If anything sounds off — wrong case after a "
    "preposition, wrong gender/number agreement, unnatural phrasing — "
    "rewrite before replying.\n\n"
    "Reply with STRICT JSON only, no prose outside, fields in this order:\n"
    '{{"case_trigger": "<prep or verb; empty for non-nouns>", '
    '"expected_form": "<the inflected form, including any required '
    'article>", '
    '"de": "<German sentence containing expected_form verbatim>", '
    '"en": "<faithful English translation>", '
    '"focus": "<one short English sentence pointing out where/how the '
    'targeted grammar shows up in your sentence>"}}'
)


GRAMMAR_CHECK_SYSTEM = (
    "You check a learner's German sentence that was supposed to use a "
    "target word in a specific grammatical configuration. The learner is "
    "at CEFR level {level}.\n\n"
    "VOCABULARY RULE for the corrected forms you suggest — strict: use "
    "{level_rule} (exception: the target word).\n\n"
    "GRAMMAR REFERENCE — case governance for nouns:\n"
    "  Dativ-only prepositions: aus, bei, mit, nach, seit, von, zu, "
    "    gegenüber. Dative-governing verbs: helfen, danken, folgen, "
    "    gefallen, gehören, antworten.\n"
    "  Akkusativ-only prepositions: für, gegen, ohne, durch, um, bis.\n"
    "  Two-way prepositions (an, auf, in, über, unter, vor, hinter, "
    "    neben, zwischen): Dativ for location, Akkusativ for direction "
    "    OR topic. 'sprechen/reden/sich beschweren über' = Akkusativ.\n"
    "  Genitiv prepositions: wegen, trotz, während, (an)statt.\n\n"
    "WORK ORDER — follow EXACTLY, do not skip or re-order:\n"
    "1. `expected_form`: the exact inflected form the target word SHOULD "
    "   take in this configuration, including any required article "
    "   (e.g. 'den Ängsten' for Dativ Plural of 'die Angst').\n"
    "2. `meets_config`: true ONLY if the learner's sentence contains "
    "   the target word in a form matching `expected_form` (article "
    "   included). Otherwise false.\n"
    "3. `corrections`: GENUINE mistakes — wrong article/case, wrong "
    "   verb form, bad word order, non-idiomatic phrasing, misspellings. "
    "   Skip casual typos. Don't be pedantic. Every \"original\" string "
    "   MUST appear verbatim in the learner's sentence. If the target "
    "   word is in the wrong form, include that as a correction too. "
    "   Also flag case/preposition mismatches elsewhere in the sentence.\n"
    "4. `grammar_focus`: one or two short English sentences explaining "
    "   how the target word should appear for this configuration and "
    "   whether the learner got it right.\n\n"
    "SELF-CHECK: re-read the learner's sentence as a native German "
    "speaker. If a correction you'd like to make doesn't appear verbatim "
    "in the learner's text, drop it — don't invent misquotes.\n\n"
    "Reply with STRICT JSON only, no prose outside, fields in this order:\n"
    '{{"expected_form": "<the correct inflected form, including any '
    'required article>", '
    '"meets_config": true|false, '
    '"corrections": [{{"original": "<exact wrong fragment>", '
    '"corrected": "<fixed version>", "note": "<one short English sentence>"}}'
    "], "
    '"grammar_focus": "<one or two short English sentences>"}}'
)


def grammar_generate(level: str, word: dict, config: dict) -> dict:
    """Return {de, en, focus} for one sentence using `word` in `config`."""
    if not available():
        raise LLMUnavailable("set ANTHROPIC_API_KEY to use the grammar playground")
    raw = complete(Prompt(
        system=GRAMMAR_GEN_SYSTEM.format(level=level, level_rule=_level_rule(level)),
        user=(f"Target word: {_word_label(word)}\n"
              f"Configuration:\n{_config_label(word['pos'], config)}"),
        model=MODEL_WRITE, max_tokens=600, temperature=0.3,
    ))
    try:
        data = extract_json(raw)
    except Exception:
        return {"expected_form": "", "de": raw.strip(), "en": "", "focus": ""}
    return {
        "expected_form": str(data.get("expected_form", "")).strip(),
        "de": str(data.get("de", "")).strip(),
        "en": str(data.get("en", "")).strip(),
        "focus": str(data.get("focus", "")).strip(),
    }


def grammar_check(level: str, word: dict, config: dict, sentence: str) -> dict:
    """Return {corrections, meets_config, grammar_focus}."""
    if not available():
        raise LLMUnavailable("set ANTHROPIC_API_KEY to use the grammar playground")
    raw = complete(Prompt(
        system=GRAMMAR_CHECK_SYSTEM.format(level=level, level_rule=_level_rule(level)),
        user=(f"Target word: {_word_label(word)}\n"
              f"Required configuration:\n{_config_label(word['pos'], config)}\n"
              f"Learner's sentence: {sentence}"),
        model=MODEL_WRITE, max_tokens=800, temperature=0.2,
    ))
    try:
        data = extract_json(raw)
    except Exception:
        return {"expected_form": "", "corrections": [],
                "meets_config": None, "grammar_focus": raw.strip()}

    hay = sentence.lower()
    cleaned: list[dict] = []
    for c in data.get("corrections") or []:
        if not isinstance(c, dict):
            continue
        orig = str(c.get("original", "")).strip()
        fixed = str(c.get("corrected", "")).strip()
        if not orig or not fixed or orig == fixed:
            continue
        if orig.lower() not in hay:
            continue
        cleaned.append({
            "original": orig,
            "corrected": fixed,
            "note": str(c.get("note", "")).strip(),
        })

    raw_meets = data.get("meets_config")
    meets: bool | None
    if isinstance(raw_meets, bool):
        meets = raw_meets
    elif isinstance(raw_meets, str):
        meets = raw_meets.strip().lower() in ("true", "yes", "1")
    else:
        meets = None

    return {
        "expected_form": str(data.get("expected_form", "")).strip(),
        "corrections": cleaned,
        "meets_config": meets,
        "grammar_focus": str(data.get("grammar_focus", "")).strip(),
    }
