"""Local JSON API for the React interface; learning logic comes from GermanMatch."""
from __future__ import annotations
from app import review_tracks

import random
import sqlite3
from dataclasses import asdict
from pathlib import Path
from typing import Dict, List, Literal, Optional

from fastapi import Query, Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from pipeline.llm import LLMUnavailable, available
from . import garden, learn, onboarding
from .db import COOKIE, RequiresProfile, create_profile, list_profiles, request_db
from .feed import best_topic_for_level, ensure_user_state, next_card, record_swipe, set_topic
from .practice import _flashcard_rows, _practice_scope_words
from .text import used_lemmas

app = FastAPI(title="Vocab Garden")
Db = Depends(request_db)
Scope = Literal['all', 'bag', 'topic']


@app.exception_handler(RequiresProfile)
async def no_profile(request: Request, exc: RequiresProfile):
    return JSONResponse({'detail': 'Choose a learner profile to continue.'}, status_code=401)


@app.exception_handler(LLMUnavailable)
async def no_llm(request: Request, exc: LLMUnavailable):
    return JSONResponse({'detail': 'AI practice needs ANTHROPIC_API_KEY in the local .env file.'}, status_code=503)


def word_exists(conn, word_id):
    row = conn.execute('SELECT * FROM words WHERE id = ?', (word_id,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Word not found.')
    return dict(row)


def validate_scope(conn, scope, topic):
    if scope == 'topic' and not conn.execute('SELECT 1 FROM activities WHERE id = ?', (topic,)).fetchone():
        raise HTTPException(422, 'Choose a valid topic.')


def user(conn):
    state = ensure_user_state(conn)
    return {'name': state['name'] or 'You', 'level': state['level'], 'swipes': state['swipe_count']}


def bag(conn):
    return [dict(row) for row in garden.seed_bag(conn)]


def matcher_data(conn):
    card = next_card(conn)
    return {'card': asdict(card) if card else None, 'bag': bag(conn)}


@app.get('/api/profiles')
def profiles():
    return list_profiles()


class ProfileInput(BaseModel):
    name: str = Field(default='', max_length=80)
    existing: str = ''


@app.post('/api/profile')
def select_profile(body: ProfileInput):
    valid = {p['slug'] for p in list_profiles()}
    if body.existing:
        if body.existing not in valid:
            raise HTTPException(404, 'Profile not found.')
        slug = body.existing
    elif body.name.strip():
        slug = create_profile(body.name)
    else:
        raise HTTPException(422, 'Enter your name.')
    response = JSONResponse({'ok': True})
    response.set_cookie(COOKIE, slug, max_age=60*60*24*365, httponly=True, samesite='lax')
    return response


@app.delete('/api/profile')
def sign_out():
    response = JSONResponse({'ok': True})
    response.delete_cookie(COOKIE)
    return response


@app.get('/api/session')
def session(conn: sqlite3.Connection = Db):
    profile = user(conn)
    return {'user': {'name': profile['name'], 'level': profile['level']}, 'ai_available': available()}


@app.get('/api/activities')
def activities(conn: sqlite3.Connection = Db):
    return [dict(r) for r in conn.execute('SELECT id, name FROM activities ORDER BY name')]


class OnboardingInput(BaseModel):
    level: Literal['A1', 'A2', 'B1', 'unsure']
    goals: str = Field(default='', max_length=3000)


@app.post('/api/onboarding')
def setup(body: OnboardingInput, conn: sqlite3.Connection = Db):
    # Match the original app's "not sure" flow while avoiding a null-level redirect loop.
    onboarding.set_level(conn, 'A1' if body.level == 'unsure' else body.level)
    if body.goals.strip():
        onboarding.steer(conn, body.goals)
    return user(conn)


@app.get('/api/garden')
def home(time_zone: str = 'UTC', conn: sqlite3.Connection = Db):
    try:
        garden.ZoneInfo(time_zone)
    except (garden.ZoneInfoNotFoundError, ValueError):
        raise HTTPException(422, 'Unknown time zone.')
    topics = garden.garden_topics(conn, None)
    overview = garden.topic_overview(conn, user(conn)['level'])
    # Show planted and learned words, including those outside the discovery level.
    plots = []
    for topic in topics:
        words = [{**dict(w), **review_tracks.details(conn, w['id'])}
                 for w in garden.topic_words(conn, topic.id)]
        if words:
            plots.append({'id': topic.id, 'name': topic.name, 'words': words})
    plots.sort(key=lambda plot: plot['name'].casefold())
    return {'topics': [{**asdict(t), 'planted_pct': t.planted_pct, 'grown_pct': t.grown_pct, 'overview': overview.get(t.id, dict(unseen=0, seeds=0, planted=0, due=0, grown=0))} for t in topics],
            'plots': plots,
            'summary': garden.home_summary(conn, user(conn)['level'], time_zone), 'bag': bag(conn)}


@app.get('/api/topics/{topic}')
def topic_detail(topic: str, conn: sqlite3.Connection = Db):
    validate_scope(conn, 'topic', topic)
    activity = conn.execute('SELECT * FROM activities WHERE id = ?', (topic,)).fetchone()
    rows = conn.execute('''
        SELECT w.*,
          EXISTS(SELECT 1 FROM word_srs r WHERE r.word_id=w.id
                 AND r.due_at <= datetime('now')) AS scheduled_due,
          EXISTS(SELECT 1 FROM swipes s WHERE s.word_id=w.id AND s.action='keep'
                 AND s.planted_at IS NULL) AS in_bag,
          EXISTS(SELECT 1 FROM swipes s WHERE s.word_id=w.id AND s.action='keep'
                 AND s.planted_at IS NOT NULL) AS planted,
          (EXISTS(SELECT 1 FROM known_words k WHERE k.word_id=w.id)
           OR EXISTS(SELECT 1 FROM flashcard_learned f WHERE f.word_id=w.id)) AS learned,
          EXISTS(SELECT 1 FROM swipes s WHERE s.word_id=w.id AND s.activity_id=?
                 AND s.action='drop' AND s.drop_reason='uninteresting') AS not_now
        FROM words w JOIN word_activities wa ON wa.word_id=w.id
        WHERE wa.activity_id=? ORDER BY w.lemma COLLATE NOCASE, w.id
    ''', (topic, topic)).fetchall()
    growth = {w['id']: garden.growth_stage(w) for w in garden.topic_words(conn, topic)}
    words = []
    for row in rows:
        word = dict(row)
        word['growth'] = growth.get(word['id'], 0)
        word['status'] = ('bag' if word['in_bag'] else 'planted' if word['planted']
                          else 'learned' if word['learned'] else 'not_now' if word['not_now'] else 'new')
        word.update(review_tracks.details(conn, word['id']))
        word['visual_stage'] = ('due' if word['review_due'] else 'grown' if word['learned'] or word['growth'] == 5
                                else 'planted' if word['planted'] else 'seeds' if word['in_bag'] else 'unseen')
        words.append(word)
    words.sort(key=lambda word: (not bool(word['planted']), word['lemma'].casefold(), word['id']))
    return {'activity': dict(activity), 'words': words}


@app.post('/api/topics/{topic}/words/{word_id}/keep')
def add_topic_word(topic: str, word_id: str, conn: sqlite3.Connection = Db):
    validate_scope(conn, 'topic', topic)
    if not conn.execute('SELECT 1 FROM word_activities WHERE word_id=? AND activity_id=?',
                        (word_id, topic)).fetchone():
        raise HTTPException(422, 'This word does not belong to this topic.')
    # Serialize duplicate clicks and preserve previous discovery / learning history.
    conn.execute('BEGIN IMMEDIATE')
    if review_tracks.learned(conn, word_id):
        conn.rollback()
        raise HTTPException(409, 'Learned words are permanently complete.')
    existing = conn.execute("SELECT 1 FROM swipes WHERE word_id=? AND action='keep'",
                            (word_id,)).fetchone()
    if existing:
        return {'added': False, 'word': next(w for w in topic_detail(topic, conn)['words'] if w['id'] == word_id)}
    if garden.seed_bag_count(conn) >= garden.SEED_BAG_CAP:
        raise HTTPException(409, 'Your seed bag is full. Review a seed to plant it and make room.')
    sentence = conn.execute('''SELECT id FROM sentences WHERE word_id=?
        AND (activity_id=? OR activity_id IS NULL)
        ORDER BY activity_id IS NULL, id LIMIT 1''', (word_id, topic)).fetchone()
    conn.execute("INSERT INTO swipes (word_id, activity_id, sentence_id, action) VALUES (?, ?, ?, 'keep')",
                 (word_id, topic, sentence['id'] if sentence else None))
    conn.commit()
    return {'added': True, 'word': next(w for w in topic_detail(topic, conn)['words'] if w['id'] == word_id)}


@app.get('/api/matcher')
def matcher(topic: str = '', conn: sqlite3.Connection = Db):
    if topic:
        validate_scope(conn, 'topic', topic)
        set_topic(conn, topic)
    return matcher_data(conn)


class GuideInput(BaseModel):
    topic: str = ''
    guidance: str = Field(default='', max_length=3000)


@app.post('/api/guide')
def guide(body: GuideInput, conn: sqlite3.Connection = Db):
    chosen = body.topic
    if chosen:
        validate_scope(conn, 'topic', chosen)
    elif body.guidance.strip():
        if not available():
            raise LLMUnavailable()
        onboarding.steer(conn, body.guidance)
        row = conn.execute('SELECT activity_id FROM activity_weights ORDER BY weight DESC LIMIT 1').fetchone()
        chosen = row['activity_id'] if row else ''
    if not chosen:
        chosen = best_topic_for_level(conn, user(conn)['level'] or 'A2')
    if chosen:
        set_topic(conn, chosen)
    return matcher_data(conn)


class SwipeInput(BaseModel):
    action: Literal['keep', 'not_now', 'learned']
    word_id: str
    activity_id: Optional[str] = None
    sentence_id: int


@app.post('/api/matcher')
def swipe(body: SwipeInput, conn: sqlite3.Connection = Db):
    word_exists(conn, body.word_id)
    if not conn.execute('SELECT 1 FROM sentences WHERE id = ? AND word_id = ?', (body.sentence_id, body.word_id)).fetchone():
        raise HTTPException(422, 'The example sentence does not match this word.')
    # Retried/double-submitted cards must not duplicate progress or feed weights.
    if conn.execute('SELECT 1 FROM swipes WHERE word_id = ?', (body.word_id,)).fetchone():
        raise HTTPException(409, 'This word has already been handled. Refresh to continue.')
    if body.activity_id:
        validate_scope(conn, 'topic', body.activity_id)
    if body.action == 'keep':
        conn.execute('BEGIN IMMEDIATE')
        if garden.seed_bag_count(conn) >= garden.SEED_BAG_CAP:
            raise HTTPException(409, 'Your seed bag is full. Review a seed to plant it and make room.')
    record_swipe(conn, body.word_id, body.activity_id or None, body.sentence_id,
                 'keep' if body.action == 'keep' else 'drop',
                 drop_reason=None if body.action == 'keep' else ('known' if body.action == 'learned' else 'uninteresting'))
    return matcher_data(conn)


def review_data(conn, scope, topic, excluded=()):
    return review_tracks.review(conn, scope, topic, excluded)


@app.get('/api/review')
def review(scope: Scope = 'all', topic: str = '', exclude: List[str] = Query(default=[]), conn: sqlite3.Connection = Db):
    validate_scope(conn, scope, topic)
    return review_data(conn, scope, topic, exclude)


class GradeInput(BaseModel):
    word_id: str
    grade: int = Field(ge=1, le=4)
    scope: Scope = 'all'
    topic: str = ''
    track: Literal['recognition', 'production'] = 'recognition'
    excluded: List[str] = Field(default_factory=list)


@app.post('/api/review')
def grade(body: GradeInput, conn: sqlite3.Connection = Db):
    validate_scope(conn, body.scope, body.topic)
    conn.execute('BEGIN IMMEDIATE')
    try:
        return review_tracks.grade(conn, body.word_id, body.grade, body.scope, body.topic, body.track, body.excluded)
    except ValueError as error:
        conn.rollback()
        raise HTTPException(409, str(error))


class GraduateInput(BaseModel):
    word_id: str


@app.post('/api/review/learned')
def graduate(body: GraduateInput, conn: sqlite3.Connection = Db):
    conn.execute('BEGIN IMMEDIATE')
    if not review_tracks.learned(conn, body.word_id) and not review_tracks.details(conn, body.word_id)['can_mark_learned']:
        conn.rollback()
        raise HTTPException(409, 'Both tracks must reach a 60-day interval first.')
    conn.execute('INSERT OR IGNORE INTO flashcard_learned(word_id) VALUES (?)', (body.word_id,))
    conn.commit()
    return review_tracks.details(conn, body.word_id)


@app.get('/api/practice/summary')
def practice_summary(scope: Scope = 'all', topic: str = '', conn: sqlite3.Connection = Db):
    validate_scope(conn, scope, topic)
    counts = conn.execute("""WITH decisions AS (
        SELECT s.word_id, s.planted_at FROM swipes s JOIN words w ON w.id=s.word_id
        WHERE s.action='keep' AND s.id=(SELECT MIN(first.id) FROM swipes first
            WHERE first.word_id=s.word_id AND first.action='keep')
    ), marks AS (SELECT word_id FROM known_words UNION SELECT word_id FROM flashcard_learned), kept AS (
        SELECT d.word_id,d.planted_at FROM decisions d WHERE d.word_id NOT IN (SELECT word_id FROM marks)
        UNION SELECT m.word_id,'1970-01-01' FROM marks m JOIN words w ON w.id=m.word_id
    ) SELECT COUNT(CASE WHEN planted_at IS NULL THEN 1 END) seeds,
        COUNT(CASE WHEN planted_at IS NOT NULL THEN 1 END) all_plants,
        COUNT(CASE WHEN planted_at IS NOT NULL AND (?='' OR EXISTS (
            SELECT 1 FROM word_activities wa WHERE wa.word_id=kept.word_id AND wa.activity_id=?))
            THEN 1 END) plants FROM kept""", (topic, topic)).fetchone()
    word_count = counts['seeds' if scope == 'bag' else 'plants' if scope == 'topic' else 'all_plants']
    return {'word_count': word_count, 'counts': {'plants': counts['plants'], 'seeds': counts['seeds']}}


@app.get('/api/practice')
def practice(scope: Scope = 'all', topic: str = '', conn: sqlite3.Connection = Db):
    validate_scope(conn, scope, topic)
    words = _practice_scope_words(conn, scope, topic or None)
    for word in words:
        word.update(review_tracks.details(conn, word['id']))
    return {'words': words, 'grammar_options': learn.GRAMMAR_CONFIG_OPTIONS,
            'counts': practice_summary(scope, topic, conn)['counts']}


@app.get('/api/flashcards')
def flashcards(scope: Scope = 'all', topic: str = '', conn: sqlite3.Connection = Db):
    validate_scope(conn, scope, topic)
    cards = _flashcard_rows(conn, scope, topic or None, learn.FLASHCARDS_N)
    return {'cards': [{**w, **review_tracks.details(conn, w['id'])} for w in cards]}


class LearnedInput(BaseModel):
    word_id: str


@app.post('/api/flashcards/learned')
def flashcard_learned(body: LearnedInput, conn: sqlite3.Connection = Db):
    raise HTTPException(410, 'Practice does not change growth. Mark mature words as Learned in review.')


class PracticeInput(BaseModel):
    scope: Scope = 'all'
    topic: str = ''


def targets_for(conn, body):
    validate_scope(conn, body.scope, body.topic)
    pool = _practice_scope_words(conn, body.scope, body.topic or None)
    if not pool:
        raise HTTPException(422, 'Keep or plant some words first.')
    random.shuffle(pool)
    return pool[:learn.TARGETS_N]


@app.post('/api/reading')
def reading(body: PracticeInput, conn: sqlite3.Connection = Db):
    targets = targets_for(conn, body)
    return {'targets': targets, 'text': learn.generate_reading(user(conn)['level'] or 'A2', targets)}


class Message(BaseModel):
    role: Literal['user', 'assistant']
    content: str = Field(max_length=20000)
    corrections: List[dict] = Field(default_factory=list)


class ChatInput(PracticeInput):
    message: str = Field(default='', max_length=3000)
    history: List[Message] = Field(default_factory=list, max_length=100)
    target_ids: List[str] = Field(default_factory=list, max_length=5)


@app.post('/api/chat')
def chat(body: ChatInput, conn: sqlite3.Connection = Db):
    level = user(conn)['level'] or 'A2'
    if not body.target_ids:
        targets = targets_for(conn, body)
        history = [{'role': 'assistant', 'content': learn.chat_opener(level, [w['lemma'] for w in targets])}]
    else:
        pool = {w['id']: w for w in _practice_scope_words(conn, body.scope, body.topic or None)}
        if any(wid not in pool for wid in body.target_ids):
            raise HTTPException(422, 'Choose words from the current practice set.')
        targets = [pool[wid] for wid in body.target_ids]
        if not body.message.strip():
            raise HTTPException(422, 'Write a message first.')
        history = learn.chat_turn(level, [w['lemma'] for w in targets], [m.model_dump() for m in body.history], body.message.strip())
    text = ' '.join(m['content'] for m in history if m['role'] == 'user')
    return {'targets': targets, 'history': history, 'used': list(used_lemmas(text, [w['lemma'] for w in targets]))}


class GrammarInput(BaseModel):
    word_id: str
    config: Dict[str, str] = Field(default_factory=dict)
    sentence: str = Field(default='', max_length=3000)
    action: Literal['generate', 'correct'] = 'generate'


@app.get('/api/grammar/options')
def grammar_options(conn: sqlite3.Connection = Db):
    return learn.GRAMMAR_CONFIG_OPTIONS


@app.post('/api/grammar')
def grammar(body: GrammarInput, conn: sqlite3.Connection = Db):
    row = conn.execute("""SELECT w.* FROM words w WHERE w.id=? AND (
        EXISTS (SELECT 1 FROM swipes s WHERE s.word_id=w.id AND s.action='keep')
        OR EXISTS (SELECT 1 FROM known_words k WHERE k.word_id=w.id)
        OR EXISTS (SELECT 1 FROM flashcard_learned f WHERE f.word_id=w.id))""", (body.word_id,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Kept word not found.')
    word = dict(row)
    options = learn.GRAMMAR_CONFIG_OPTIONS.get(word['pos'], {})
    config = {key: body.config.get(key, values[0]) for key, values in options.items()}
    if any(config[key] not in values for key, values in options.items()):
        raise HTTPException(422, 'Choose a valid grammar option.')
    level = user(conn)['level'] or 'A2'
    if body.action == 'correct':
        if not body.sentence.strip():
            raise HTTPException(422, 'Write a sentence first.')
        return learn.grammar_check(level, word, config, body.sentence.strip())
    return learn.grammar_generate(level, word, config)



# A built frontend can be served by the same local Python process.
DIST = Path(__file__).resolve().parent.parent / 'dist'
if DIST.exists():
    app.mount('/assets', StaticFiles(directory=DIST / 'assets'), name='assets')

    @app.get('/{path:path}')
    def frontend(path: str):
        if path.startswith('api/'):
            raise HTTPException(404, 'API endpoint not found.')
        return FileResponse(DIST / 'index.html')
