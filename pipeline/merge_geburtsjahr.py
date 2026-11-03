"""Remove the malformed duplicate from the offline vocabulary only.

Cloud learner data is merged by 202611030002_merge_geburtsjahr.sql. Refuse to
modify legacy SQLite learner databases; they must be imported before merging.
"""
from .db import session

OLD = 'other_geburts_jahr'
NEW = 'noun_geburtsjahr'


def run(conn, old=OLD, new=NEW):
    if not conn.execute('SELECT 1 FROM words WHERE id=?', (old,)).fetchone():
        return 0
    if not conn.execute('SELECT 1 FROM words WHERE id=?', (new,)).fetchone():
        raise ValueError(f'Missing canonical word: {new}')
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    for table in ('swipes', 'reviews', 'known_words', 'flashcard_learned', 'word_srs'):
        if table in tables and conn.execute(f'SELECT 1 FROM {table} WHERE word_id=?', (old,)).fetchone():
            raise ValueError('Import legacy learner progress before merging vocabulary')
    conn.execute('''INSERT INTO word_activities SELECT ?,activity_id,relevance
        FROM word_activities WHERE word_id=?
        ON CONFLICT(word_id,activity_id) DO UPDATE SET relevance=max(relevance,excluded.relevance)''', (new, old))
    conn.execute('UPDATE sentences SET word_id=? WHERE word_id=?', (new, old))
    for wid, rid, rank in conn.execute('SELECT word_id,related_id,rank FROM word_associations WHERE word_id=? OR related_id=?', (old, old)).fetchall():
        wid, rid = (new if wid == old else wid), (new if rid == old else rid)
        if wid != rid:
            conn.execute('''INSERT INTO word_associations VALUES (?,?,?)
                ON CONFLICT(word_id,related_id) DO UPDATE SET rank=min(rank,excluded.rank)''', (wid, rid, rank))
    conn.execute('''INSERT OR IGNORE INTO verb_objects SELECT verb_id,?,phrase
        FROM verb_objects WHERE noun_id=?''', (new, old))
    conn.execute('''INSERT OR IGNORE INTO verb_objects SELECT ?,noun_id,phrase
        FROM verb_objects WHERE verb_id=?''', (new, old))
    conn.execute('DELETE FROM verb_objects WHERE verb_id=?', (old,))
    # Explicit cleanup also works for callers with SQLite foreign keys disabled.
    conn.execute('DELETE FROM word_activities WHERE word_id=?', (old,))
    conn.execute('DELETE FROM word_associations WHERE word_id=? OR related_id=?', (old, old))
    conn.execute('DELETE FROM verb_objects WHERE noun_id=?', (old,))
    conn.execute('DELETE FROM words WHERE id=?', (old,))
    return 1


if __name__ == '__main__':
    with session() as conn:
        print(f'Merged {run(conn)} duplicate noun')
