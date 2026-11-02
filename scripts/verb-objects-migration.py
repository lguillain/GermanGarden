"""Export accepted vocabulary-only object phrases as an idempotent data migration."""
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone


def migration(content: Path) -> str:
    with sqlite3.connect(f'file:{content.resolve()}?mode=ro', uri=True) as conn:
        rows = [dict(verb_id=v, noun_id=n, phrase=p) for v, n, p in conn.execute(
            'SELECT verb_id, noun_id, phrase FROM verb_objects ORDER BY verb_id, noun_id')]
    sql = ['-- Generated from the offline verb/object vocabulary review.']
    for start in range(0, len(rows), 300):
        literal = "'" + json.dumps(rows[start:start+300], ensure_ascii=False).replace("'", "''") + "'::jsonb"
        sql.append('insert into public.verb_objects select a.* from jsonb_populate_recordset('
                   f'null::public.verb_objects, {literal}) a\n'
                   'where exists (select 1 from public.words w where w.id=a.verb_id and w.pos=\'verb\')\n'
                   'and exists (select 1 from public.words w where w.id=a.noun_id and w.pos=\'noun\')\n'
                   'on conflict (verb_id, noun_id) do update set phrase=excluded.phrase;')
    return '\n'.join(sql)+'\n'

if __name__ == '__main__':
    day = datetime.now(timezone.utc).strftime('%Y%m%d')
    folder = Path('supabase/migrations')
    number = max([int(p.name[8:12]) for p in folder.glob(f'{day}[0-9][0-9][0-9][0-9]_*.sql')], default=0)+1
    target = folder / f'{day}{number:04d}_verb_objects_data.sql'
    target.write_text(migration(Path('data/vocab.sqlite')))
    print(target)
