"""Remove the malformed duplicate from the offline vocabulary only.

Cloud learner data is merged by 202611030002_merge_geburtsjahr.sql. Refuse to
modify legacy SQLite learner databases; they must be imported before merging.
"""
from .db import session

OLD = 'other_geburts_jahr'
NEW = 'noun_geburtsjahr'


def run(conn):
    if not conn.execute('SELECT 1 FROM words WHERE id=?', (OLD,)).fetchone():
        return 0
    if not conn.execute('SELECT 1 FROM words WHERE id=?', (NEW,)).fetchone():
        raise ValueError('Missing canonical Geburtsjahr')
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    for table in ('swipes', 'reviews', 'known_words', 'flashcard_learned', 'word_srs'):
        if table in tables and conn.execute(f'SELECT 1 FROM {table} WHERE word_id=?', (OLD,)).fetchone():
            raise ValueError('Import legacy learner progress before merging vocabulary')
    conn.execute('''INSERT INTO word_activities SELECT ?,activity_id,relevance
        FROM word_activities WHERE word_id=?
        ON CONFLICT(word_id,activity_id) DO UPDATE SET relevance=max(relevance,excluded.relevance)''', (NEW, OLD))
    conn.execute('UPDATE sentences SET word_id=? WHERE word_id=?', (NEW, OLD))
    for wid, rid, rank in conn.execute('SELECT word_id,related_id,rank FROM word_associations WHERE word_id=? OR related_id=?', (OLD, OLD)).fetchall():
        wid, rid = (NEW if wid == OLD else wid), (NEW if rid == OLD else rid)
        if wid != rid:
            conn.execute('''INSERT INTO word_associations VALUES (?,?,?)
                ON CONFLICT(word_id,related_id) DO UPDATE SET rank=min(rank,excluded.rank)''', (wid, rid, rank))
    conn.execute('''INSERT OR IGNORE INTO verb_objects SELECT verb_id,?,phrase
        FROM verb_objects WHERE noun_id=?''', (NEW, OLD))
    # Explicit cleanup also works for callers with SQLite foreign keys disabled.
    conn.execute('DELETE FROM word_activities WHERE word_id=?', (OLD,))
    conn.execute('DELETE FROM word_associations WHERE word_id=? OR related_id=?', (OLD, OLD))
    conn.execute('DELETE FROM verb_objects WHERE noun_id=?', (OLD,))
    conn.execute('DELETE FROM words WHERE id=?', (OLD,))
    return 1


if __name__ == '__main__':
    with session() as conn:
        print(f'Merged {run(conn)} duplicate noun')
