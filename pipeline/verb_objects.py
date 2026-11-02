"""Validate existing noun–verb associations as typical direct-object phrases.

Snapshots retain accepted phrases and explicit rejections. No learner data is read.
Run python -m pipeline.verb_objects, then scripts/verb-objects-migration.py.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
import sqlite3
import re
import json
from pathlib import Path
from . import snapshots, steps
from .llm import MODEL_WRITE, Prompt, complete, extract_json

BATCH = 20
SYSTEM = """You are a conservative German lexicographer checking learning collocations.
For each proposed verb/noun pair, return a short natural German infinitive phrase
ONLY if the noun is a typical direct accusative or dative object of that verb in
its supplied meaning. Include the correct article/case where idiomatic; bare mass
nouns and plural objects are fine. Otherwise return null. Do not force a pairing.
The noun itself must be the object: no added prepositions, no extra content words,
no changing the verb's meaning, no subjects, agents, instruments, locations or
merely same-topic associations. Reject uncommon or contrived combinations even
if grammatically possible. Keep reflexive pronouns if the supplied verb needs one.
Good: Vertrag/unterschreiben -> einen Vertrag unterschreiben;
Vertrag/kündigen -> einen Vertrag kündigen; Wohnung/vermieten -> eine Wohnung vermieten;
Geld/sparen -> Geld sparen; Zeit/sparen -> Zeit sparen.
Bad: Vertrag/vermieten -> null (one rents out a property, not a contract);
Vertrag/garantieren -> null; Vertrag/vereinbaren -> null (prefer einen Vertrag abschließen);
Mieter/vermieten -> null (the tenant is not the object being rented out).
Return strict JSON keyed by input row number, values phrase strings or null.
"""


def clean(value):
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip() or len(value) > 160 or '\n' in value:
        raise ValueError('Expected a short phrase or null')
    phrase = value.strip()
    # A prepositional phrase is not a direct object, even if an LLM accepts it.
    if re.search(r'\b(am|ans|aufs|beim|im|ins|vom|vorm|an|auf|aus|bei|durch|für|gegen|hinter|in|mit|nach|neben|ohne|über|um|unter|von|vor|zu|zum|zur|zwischen)\b', phrase):
        return None
    return phrase


def candidates(conn):
    return conn.execute("""
        SELECT DISTINCT v.id verb_id, v.lemma verb, v.english verb_meaning,
               n.id noun_id, n.lemma noun, n.article, n.english noun_meaning
        FROM word_associations a
        JOIN words v ON v.id IN (a.word_id, a.related_id) AND v.pos='verb'
        JOIN words n ON n.id IN (a.word_id, a.related_id) AND n.pos='noun'
        ORDER BY v.id, n.id
    """).fetchall()


def run(conn: sqlite3.Connection, limit=None):
    cache = snapshots.load_verb_objects()
    cache.update(json.loads(Path(__file__).with_name('verb-object-overrides.json').read_text()))
    rows = candidates(conn)
    known = {r['id']: r['pos'] for r in conn.execute('SELECT id, pos FROM words')}
    def insert(verb, noun, phrase):
        if known.get(verb) != 'verb' or known.get(noun) != 'noun':
            return
        conn.execute('DELETE FROM verb_objects WHERE verb_id=? AND noun_id=?', (verb, noun))
        if phrase:
            conn.execute('INSERT INTO verb_objects VALUES (?, ?, ?)', (verb, noun, phrase))
    for key, phrase in cache.items():
        phrase = clean(phrase)
        cache[key] = phrase
        insert(*key.split('|'), phrase)
    conn.commit()
    snapshots.save_verb_objects(cache)
    pending = [r for r in rows if f"{r['verb_id']}|{r['noun_id']}" not in cache][:limit]
    batches = [pending[i:i+BATCH] for i in range(0, len(pending), BATCH)]
    if steps.DRY_RUN:
        print(f'  verb objects: would check {len(pending)} pairs in {len(batches)} calls')
        return 0
    def check(batch):
        prompt = Prompt(system=SYSTEM, user=steps.numbered(batch, lambda r:
            f"{r['verb']} ({r['verb_meaning']}) / {r['article'] or ''} {r['noun']} ({r['noun_meaning']})"),
            model=MODEL_WRITE, max_tokens=6000, temperature=0)
        for attempt in range(3):
            try:
                data = extract_json(complete(prompt))
                if not isinstance(data, dict):
                    raise ValueError('Expected an object keyed by row number')
                return data
            except (ValueError, TypeError):
                if attempt == 2:
                    raise
    accepted = 0
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(check, batch): batch for batch in batches}
        for i, future in enumerate(as_completed(futures), 1):
            batch = futures[future]
            try:
                data = future.result()
            except Exception as error:
                steps.FAILURES.append(f'verb objects: {type(error).__name__}')
                print(f'  verb objects {i}/{len(batches)}: retry on next run ({type(error).__name__})', flush=True)
                continue
            for row, value in steps.indexed(data, batch):
                phrase = clean(value)
                key = f"{row['verb_id']}|{row['noun_id']}"
                cache[key] = phrase
                insert(row['verb_id'], row['noun_id'], phrase)
                accepted += bool(phrase)
            conn.commit()
            snapshots.save_verb_objects(cache)
            print(f'  verb objects {i}/{len(batches)}: {accepted} accepted so far', flush=True)
    return accepted


if __name__ == '__main__':
    steps.cli(run, 'verb objects')
