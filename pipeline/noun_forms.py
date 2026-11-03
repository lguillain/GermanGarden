"""Check noun articles/plurals offline; preserve stable IDs and all learner data."""
from __future__ import annotations
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from . import snapshots, steps
from .llm import MODEL_WRITE, Prompt, complete, extract_json

SYSTEM = """Check German noun dictionary forms for a vocabulary learning app.
Return STRICT JSON keyed by the input row number. Each value must have exactly
article (der/die/das) and plural (the correctly spelled full plural, or null if
there is no ordinary plural in the supplied sense). Do not change the noun lemma.
Use the English meaning to distinguish senses. Never invent plurals for mass
nouns, languages, sports or abstract nouns when the plural would require an
unusual different meaning. Preserve plural-only nouns as their own plural form.
An unchanged plural MUST be spelled out: Lehrer -> Lehrer. Umlauts must be in
the stem: Haus -> Häuser, Baum -> Bäume, Bruder -> Brüder, Mutter -> Mütter,
Laden -> Läden. Give full forms, never suffix shorthand. For normal regional
variants give both separated by / only when necessary. No prose or explanations.
"""


def clean(value):
    if not isinstance(value, dict) or value.get('article') not in ('der', 'die', 'das'):
        raise ValueError('Missing noun article')
    if 'plural' not in value:
        raise ValueError('Missing plural field')
    plural = value['plural']
    if plural is not None and (not isinstance(plural, str) or not plural.strip() or len(plural) > 120 or '\n' in plural):
        raise ValueError('Invalid plural')
    return {'article': value['article'], 'plural': plural.strip() if plural else None}


def run(conn, limit=None):
    overrides = json.loads(Path(__file__).with_name('noun-form-overrides.json').read_text())
    cache = snapshots.load_noun_forms()
    if steps.DRY_RUN:
        rows = conn.execute("SELECT id FROM words WHERE pos='noun'").fetchall()
        pending = [r for r in rows if r['id'] not in cache and r['id'] not in overrides][:limit]
        print(f'  noun forms: would check {len(pending)} nouns')
        return 0
    # Correct malformed legacy entries in place; never rename their IDs.
    for wid, value in overrides.items():
        conn.execute("UPDATE words SET lemma=?, pos='noun', article=?, plural=? WHERE id=?", (value['lemma'], value['article'], value['plural'], wid))
        cache[wid] = clean(value)
    for wid, value in cache.items():
        v = clean(value)
        conn.execute("UPDATE words SET article=coalesce(article,?), plural=coalesce(?,plural) WHERE id=? AND pos='noun'", (v['article'], v['plural'], wid))
    conn.commit()
    rows = conn.execute("SELECT id,lemma,english FROM words WHERE pos='noun' ORDER BY id").fetchall()
    pending = [r for r in rows if r['id'] not in cache][:limit]
    batches = [pending[i:i+10] for i in range(0, len(pending), 10)]
    def check(batch):
        prompt = Prompt(system=SYSTEM, user=steps.numbered(batch, lambda r: f"{r['lemma']} — {r['english']}"), model=MODEL_WRITE, temperature=0, max_tokens=6000)
        for attempt in range(3):
            try:
                data = extract_json(complete(prompt))
                if not isinstance(data, dict):
                    raise ValueError('Expected object')
                checked = [(r, clean(v)) for r, v in steps.indexed(data, batch)]
                if len({r['id'] for r, _ in checked}) != len(batch):
                    raise ValueError('Incomplete noun forms')
                return checked
            except (ValueError, TypeError):
                if attempt == 2: raise
    count = 0
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(check, batch) for batch in batches]
        for i, future in enumerate(as_completed(futures), 1):
            try:
                checked = future.result()
            except Exception as error:
                steps.FAILURES.append(f'noun forms: {type(error).__name__}')
                print(f'  noun forms {i}/{len(batches)}: retry on next run ({type(error).__name__})', flush=True)
                continue
            for row, value in checked:
                cache[row['id']] = value
                conn.execute('UPDATE words SET article=coalesce(article,?),plural=coalesce(?,plural) WHERE id=?', (value['article'], value['plural'], row['id']))
                count += 1
            conn.commit()
            snapshots.save_noun_forms(cache)
            print(f'  noun forms {i}/{len(batches)}: {count} checked', flush=True)
    snapshots.save_noun_forms(cache)
    return count

if __name__ == '__main__':
    steps.cli(run, 'noun forms')
