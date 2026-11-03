"""Apply reviewed non-noun splits, classifications and aliases after enrichment."""
import json
from pathlib import Path
from .db import session
from .merge_geburtsjahr import run as merge


def repairs():
    return json.loads(Path(__file__).with_name('non-noun-repairs.json').read_text())


def run(conn):
    data = repairs()
    for wid, w in data['updates'].items():
        conn.execute('UPDATE words SET lemma=?,pos=?,english=? WHERE id=?', (w['lemma'],w['pos'],w['english'],wid))
    for w in data['additions']:
        if not conn.execute('SELECT 1 FROM words WHERE id=?', (w['from_id'],)).fetchone():
            continue
        conn.execute('INSERT OR IGNORE INTO words(id,lemma,pos,english,level) VALUES (?,?,?,?,?)',
                     tuple(w[k] for k in ('id','lemma','pos','english','level')))
        conn.execute('INSERT OR IGNORE INTO word_activities SELECT ?,activity_id,relevance FROM word_activities WHERE word_id=?', (w['id'],w['from_id']))
    for sid, wid in data['sentence_moves'].items():
        conn.execute('UPDATE sentences SET word_id=? WHERE id=?', (wid,int(sid)))
    for old, new in data['merges'].items():
        merge(conn, old, new)
    # Object-pair suggestions must still connect a verb and a noun.
    conn.execute("DELETE FROM verb_objects WHERE verb_id IN (SELECT id FROM words WHERE pos!='verb')")


if __name__ == '__main__':
    with session() as conn:
        run(conn)
    print('Applied reviewed non-noun corrections')
