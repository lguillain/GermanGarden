"""Export noun dictionary forms only; never export learner data or replace IDs."""
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def migration(content: Path) -> str:
    with sqlite3.connect(f'file:{content.resolve()}?mode=ro', uri=True) as conn:
        rows = [dict(id=i, lemma=l, article=a, plural=p) for i, l, a, p in conn.execute(
            "SELECT id,lemma,article,plural FROM words WHERE pos='noun' ORDER BY id")]
    sql = ['-- Offline noun dictionary corrections. Stable IDs and learner progress are preserved.']
    for start in range(0, len(rows), 300):
        literal = "'" + json.dumps(rows[start:start+300], ensure_ascii=False).replace("'", "''") + "'::jsonb"
        sql.append("UPDATE public.words w SET lemma=a.lemma, pos='noun', article=a.article, plural=a.plural\n"
                   f"FROM jsonb_to_recordset({literal}) AS a(id text,lemma text,article text,plural text)\n"
                   "WHERE w.id=a.id AND (w.lemma,w.pos,w.article,w.plural) IS DISTINCT FROM (a.lemma,'noun',a.article,a.plural);")
    return '\n'.join(sql) + '\n'


if __name__ == '__main__':
    day = datetime.now(timezone.utc).strftime('%Y%m%d')
    folder = Path('supabase/migrations')
    number = max([int(p.name[8:12]) for p in folder.glob(f'{day}[0-9][0-9][0-9][0-9]_*.sql')], default=0) + 1
    target = folder / f'{day}{number:04d}_noun_forms_data.sql'
    target.write_text(migration(Path('data/vocab.sqlite')))
    print(target)
