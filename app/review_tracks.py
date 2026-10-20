"""Two-track review rules for the local backend; scheduler parity lives in garden."""
import json
from datetime import datetime, timedelta, timezone

from app import garden


def now():
    return datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')


def initial():
    return dict(ease=2.5, interval_days=0, reps=0, lapses=0, state='learning', due_at=now())


def schedules(conn, word_id):
    row = conn.execute('SELECT * FROM word_srs WHERE word_id=?', (word_id,)).fetchone()
    recognition = dict(row) if row else initial()
    production = recognition.pop('production', None)
    return recognition, json.loads(production) if production else None


def learned(conn, word_id):
    return bool(conn.execute('SELECT 1 FROM known_words WHERE word_id=? UNION ALL SELECT 1 FROM flashcard_learned WHERE word_id=?', (word_id, word_id)).fetchone())


def due(schedule):
    return not schedule or (schedule.get('due_at') or '') <= now()


def plant_growth(recognition, production):
    stage = garden.growth_stage(recognition)
    return 5 if stage == 5 and garden.growth_stage(production or {}) == 5 else min(4, stage)


def details(conn, word_id):
    recognition, production = schedules(conn, word_id)
    complete = learned(conn, word_id)
    planted = conn.execute("SELECT 1 FROM swipes WHERE word_id=? AND action='keep' AND planted_at IS NOT NULL", (word_id,)).fetchone()
    stage = 5 if complete else plant_growth(recognition, production)
    return dict(growth=stage, learned=complete, production_unlocked=complete or production is not None,
                production_growth=5 if complete else garden.growth_stage(production or {}),
                review_due=bool(planted and not complete and (due(recognition) or production and due(production))),
                can_mark_learned=not complete and stage == 5)


def outcome(recognition, production, grade, track):
    def rated(previous):
        result = garden.review_outcome(previous, grade)
        result.update(due_at=(datetime.now(timezone.utc) + timedelta(seconds=int(result['interval_days'] * 86400))).strftime('%Y-%m-%d %H:%M:%S'), last_grade=grade, last_review_at=now())
        return result
    if track == 'production':
        production = rated(production)
        if grade >= 3:
            recognition = rated(recognition)
    else:
        recognition = rated(recognition)
    if production is None and garden.growth_stage(recognition) >= 3:
        production = initial()
    return recognition, production


def eligible(conn, scope, topic='', excluded=()):
    rows = conn.execute("""SELECT w.*, min(s.id) first_keep, s.planted_at
      FROM words w JOIN swipes s ON s.word_id=w.id AND s.action='keep'
      GROUP BY w.id ORDER BY w.id""").fetchall()
    result = []
    for row in rows:
        word = dict(row)
        if word['id'] in excluded or learned(conn, word['id']):
            continue
        if (scope == 'bag') != (word['planted_at'] is None):
            continue
        if scope == 'topic' and not conn.execute('SELECT 1 FROM word_activities WHERE word_id=? AND activity_id=?', (word['id'], topic)).fetchone():
            continue
        recognition, production = schedules(conn, word['id'])
        if due(recognition) or production and due(production):
            word.update(word_id=word['id'], track='production' if production and due(production) else 'recognition')
            result.append(word)
    result.sort(key=lambda w: schedules(conn, w['id'])[0].get('due_at') or '')
    return result


def review(conn, scope, topic='', excluded=()):
    words = eligible(conn, scope, topic, excluded)
    card = words[0] if words else None
    if card:
        card.update(details(conn, card['id']))
        recognition, production = schedules(conn, card['id'])
        options = []
        for grade in range(1, 5):
            r, p = outcome(recognition, production, grade, card['track'])
            options.append(dict(grade=grade, growth=plant_growth(r, p), next_review_seconds=int((p if card['track'] == 'production' else r)['interval_days'] * 86400)))
        card['rating_options'] = options
        sentence = conn.execute('SELECT text de, english en FROM sentences WHERE word_id=? ORDER BY (activity_id=?) DESC, random() LIMIT 1', (card['id'], topic)).fetchone()
        if sentence:
            card.update(dict(sentence))
    return dict(card=card, remaining=len(words), counts=dict(plants=len(eligible(conn, 'topic' if topic else 'all', topic)), seeds=len(eligible(conn, 'bag'))))


def grade(conn, word_id, rating, scope, topic, track, excluded):
    if not any(w['id'] == word_id and w['track'] == track for w in eligible(conn, scope, topic, excluded)):
        raise ValueError('This word is no longer due in this review set. Refresh to continue.')
    recognition, production = outcome(*schedules(conn, word_id), rating, track)
    fields = ['ease', 'interval_days', 'reps', 'lapses', 'state', 'due_at', 'last_grade', 'last_review_at']
    conn.execute('INSERT OR IGNORE INTO word_srs(word_id) VALUES (?)', (word_id,))
    conn.execute('UPDATE word_srs SET ' + ','.join(f'{field}=?' for field in fields) + ',production=? WHERE word_id=?', [recognition.get(field) for field in fields] + [json.dumps(production) if production else None, word_id])
    conn.execute("UPDATE swipes SET planted_at=datetime('now') WHERE word_id=? AND action='keep' AND planted_at IS NULL", (word_id,))
    conn.execute('INSERT INTO reviews(word_id,grade,track) VALUES (?,?,?)', (word_id, rating, track))
    conn.commit()
    result = review(conn, scope, topic, [*excluded, word_id])
    result['graduated'] = None
    if details(conn, word_id)['can_mark_learned']:
        result['graduated'] = {**dict(conn.execute('SELECT * FROM words WHERE id=?', (word_id,)).fetchone()), **details(conn, word_id)}
    return result
