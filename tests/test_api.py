"""Exercise real learning transitions against isolated database copies."""
import json
import shutil
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.main import app
from app import db
from pipeline import db as pipeline_db

ROOT = Path(__file__).resolve().parent.parent


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.template = self.root / 'vocab.sqlite'
        with sqlite3.connect(str(ROOT/'data/vocab.sqlite')) as source, sqlite3.connect(str(self.template)) as destination:
            source.backup(destination)
        self.patches = [patch.object(db, 'PROFILES_DIR', self.root/'profiles'),
                        patch.object(pipeline_db, 'DEFAULT_DB', self.template),
                        patch('app.feed.reflect.recommend_next_topic', return_value=None)]
        for item in self.patches:
            item.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        for item in reversed(self.patches):
            item.stop()
        self.tmp.cleanup()

    def login(self):
        self.assertEqual(self.client.post('/api/profile', json={'name': 'Test Learner'}).status_code, 200)
        self.assertEqual(self.client.post('/api/onboarding', json={'level': 'A2'}).status_code, 200)

    def keep(self):
        card = self.client.get('/api/matcher').json()['card']
        self.assertIsNotNone(card)
        payload = {key: card[key] for key in ('word_id', 'activity_id', 'sentence_id')}
        result = self.client.post('/api/matcher', json={**payload, 'action': 'keep'})
        self.assertEqual(result.status_code, 200, result.text)
        return card, payload, result.json()

    def plant_fixture(self):
        """Set up existing plants for tests unrelated to first-review planting."""
        with db.open_app_db('test_learner') as conn:
            count = conn.execute("UPDATE swipes SET planted_at=datetime('now') WHERE action='keep' AND planted_at IS NULL").rowcount
            conn.commit()
        return {'planted': count}

    def test_profile_and_onboarding(self):
        self.assertEqual(self.client.get('/api/session').status_code, 401)
        self.login()
        session = self.client.get('/api/session').json()
        self.assertEqual(session['user']['level'], 'A2')
        self.assertEqual(session['user']['name'], 'Test Learner')
        self.assertNotIn('activities', session)
        self.assertEqual(set(session['user']), {'name', 'level'})
        self.assertGreater(len(self.client.get('/api/activities').json()), 10)
        self.assertEqual(self.client.post('/api/profile', json={'existing': '../vocab'}).status_code, 404)
        self.assertEqual(self.client.delete('/api/profile').status_code, 200)
        self.assertEqual(self.client.get('/api/session').status_code, 401)

    def test_keep_plant_review_and_flashcards(self):
        self.login()
        card, payload, result = self.keep()
        self.assertEqual(len(result['bag']), 1)
        duplicate = self.client.post('/api/matcher', json={**payload, 'action': 'keep'})
        self.assertEqual(duplicate.status_code, 409)
        practice = self.client.get('/api/practice?scope=bag').json()
        self.assertEqual(practice['words'][0]['id'], card['word_id'])
        # Viewing practice and flashcards must not create review history.
        self.client.get('/api/flashcards?scope=bag')
        with db.open_app_db('test_learner') as conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM reviews').fetchone()[0], 0)
        self.assertEqual(self.plant_fixture()['planted'], 1)
        home = self.client.get('/api/garden').json()
        self.assertEqual(home['summary']['planted_total'], 1)
        self.assertEqual(home['bag'], [])
        catalog = self.client.get('/api/topics/' + card['activity_id']).json()['words']
        self.assertEqual(catalog[0]['id'], card['word_id'])
        self.assertEqual(catalog[0]['status'], 'planted')
        self.assertEqual(catalog[0]['growth'], 0)
        self.assertGreater(len(catalog), 1)
        plotted_words = [word for plot in home['plots'] for word in plot['words']]
        self.assertTrue(any(word['id'] == card['word_id'] for word in plotted_words))
        self.assertTrue(all(word['growth'] == 0 for word in plotted_words))
        for plot in home['plots']:
            self.assertEqual(len(plot['words']), len({word['id'] for word in plot['words']}))
        review = self.client.get('/api/review').json()['card']
        response = self.client.post('/api/review', json={'word_id': review['word_id'], 'grade': 3})
        self.assertEqual(response.status_code, 200, response.text)
        with db.open_app_db('test_learner') as conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM reviews').fetchone()[0], 1)
            self.assertEqual(conn.execute('SELECT reps FROM word_srs').fetchone()[0], 1)
        learned = self.client.post('/api/flashcards/learned', json={'word_id': card['word_id']})
        self.assertEqual(learned.status_code, 410)
        self.assertEqual(self.client.post('/api/review/learned', json={'word_id': card['word_id']}).status_code, 409)
        with db.open_app_db('test_learner') as conn:
            conn.execute("UPDATE word_srs SET interval_days=60,state='graduated',production=? WHERE word_id=?", (json.dumps(dict(ease=2.5,interval_days=60,reps=8,lapses=0,state='graduated',due_at='2099-01-01')),card['word_id']))
            conn.commit()
        self.assertEqual(self.client.post('/api/review/learned', json={'word_id': card['word_id']}).status_code, 200)
        self.assertEqual([w['id'] for w in self.client.get('/api/flashcards').json()['cards']], [card['word_id']])
        self.assertIsNone(self.client.get('/api/review').json()['card'])
        self.assertEqual(self.client.get('/api/practice').json()['words'][0]['growth'], 5)
        # Changing discovery level must never hide plants already in the garden.
        self.client.post('/api/onboarding', json={'level': 'B1'})
        plotted_words = [word for plot in self.client.get('/api/garden').json()['plots'] for word in plot['words']]
        self.assertTrue(any(word['id'] == card['word_id'] and word['growth'] == 5 for word in plotted_words))

    def test_topic_catalog_and_manual_add(self):
        self.login()
        card = self.client.get('/api/matcher').json()['card']
        topic = card['activity_id']
        payload = {key: card[key] for key in ('word_id', 'activity_id', 'sentence_id')}
        self.client.post('/api/matcher', json={**payload, 'action': 'not_now'})
        url = '/api/topics/' + topic
        words = self.client.get(url).json()['words']
        with db.open_app_db('test_learner') as conn:
            count = conn.execute('SELECT COUNT(*) FROM word_activities WHERE activity_id=?', (topic,)).fetchone()[0]
        self.assertEqual(len(words), count)
        self.assertEqual(next(w for w in words if w['id'] == card['word_id'])['status'], 'not_now')
        add_url = url + '/words/' + card['word_id'] + '/keep'
        response = self.client.post(add_url, json={})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()['added'])
        self.assertFalse(self.client.post(add_url, json={}).json()['added'])
        words = self.client.get(url).json()['words']
        self.assertEqual(next(w for w in words if w['id'] == card['word_id'])['status'], 'bag')
        self.assertEqual(self.client.post(url + '/words/invalid/keep', json={}).status_code, 422)
        with db.open_app_db('test_learner') as conn:
            learned_id = next(w['id'] for w in words if w['id'] != card['word_id'])
            conn.execute('INSERT OR IGNORE INTO known_words (word_id) VALUES (?)', (learned_id,))
            conn.commit()
        words = self.client.get(url).json()['words']
        self.assertEqual(next(w for w in words if w['id'] == learned_id)['status'], 'learned')
        self.assertEqual(self.client.post(url + '/words/' + learned_id + '/keep', json={}).status_code, 409)
        # History is preserved; learned words cannot return to the seed bag.
        with db.open_app_db('test_learner') as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM swipes WHERE word_id=? AND action='drop'", (card['word_id'],)).fetchone()[0], 1)
            self.assertIsNotNone(conn.execute('SELECT 1 FROM known_words WHERE word_id=?', (learned_id,)).fetchone())

    def test_topic_overview_categories(self):
        self.login()
        card, _, _ = self.keep()
        topic = card['activity_id']
        self.client.post('/api/onboarding', json={'level': card['level']})

        def counts():
            topics = self.client.get('/api/garden').json()['topics']
            for item in topics:
                with db.open_app_db('test_learner') as conn:
                    expected = conn.execute('SELECT COUNT(*) FROM word_activities wa JOIN words w ON w.id=wa.word_id WHERE wa.activity_id=? AND w.level=?', (item['id'], card['level'])).fetchone()[0]
                self.assertEqual(sum(item['overview'].values()), expected)
            return next(item['overview'] for item in topics if item['id'] == topic)

        initial = counts()
        self.assertEqual(initial['seeds'], 1)
        self.assertEqual(initial['grown'], 0)
        self.plant_fixture()
        planted = counts()
        self.assertEqual(planted['seeds'], 0)
        self.assertEqual(planted['planted'], 1)
        with db.open_app_db('test_learner') as conn:
            conn.execute('INSERT INTO flashcard_learned (word_id) VALUES (?)', (card['word_id'],))
            conn.commit()
        grown = counts()
        self.assertEqual(grown['planted'], 0)
        self.assertEqual(grown['grown'], 1)
        self.assertEqual(grown['unseen'], initial['unseen'])

    def test_review_due_colors_match_topic_overview(self):
        self.login()
        card, _, _ = self.keep()
        self.plant_fixture()
        self.client.post('/api/review', json={'word_id': card['word_id'], 'grade': 3})
        topic = card['activity_id']
        self.client.post('/api/onboarding', json={'level': card['level']})

        def word():
            return next(w for w in self.client.get('/api/topics/' + topic).json()['words']
                        if w['id'] == card['word_id'])

        def garden_word():
            return next(w for plot in self.client.get('/api/garden').json()['plots']
                        for w in plot['words'] if w['id'] == card['word_id'])

        self.assertFalse(word()['review_due'])
        self.assertFalse(garden_word()['review_due'])
        self.assertEqual(word()['visual_stage'], 'planted')
        with db.open_app_db('test_learner') as conn:
            conn.execute("UPDATE word_srs SET due_at=datetime('now', '-1 day') WHERE word_id=?", (card['word_id'],))
            conn.commit()
        self.assertTrue(word()['review_due'])
        self.assertTrue(garden_word()['review_due'])
        self.assertEqual(word()['visual_stage'], 'due')
        overview = next(t['overview'] for t in self.client.get('/api/garden').json()['topics'] if t['id'] == topic)
        self.assertEqual(overview['due'], 1)
        self.assertEqual(overview['planted'], 0)
        with db.open_app_db('test_learner') as conn:
            conn.execute('INSERT INTO flashcard_learned (word_id) VALUES (?)', (card['word_id'],))
            conn.commit()
        self.assertFalse(word()['review_due'])
        self.assertFalse(garden_word()['review_due'])
        self.assertEqual(word()['visual_stage'], 'grown')
        overview = next(t['overview'] for t in self.client.get('/api/garden').json()['topics'] if t['id'] == topic)
        self.assertEqual(overview['due'], 0)
        self.assertEqual(overview['grown'], 1)

    def test_manual_add_full_bag_requires_review(self):
        self.login()
        with db.open_app_db('test_learner') as conn:
            rows = conn.execute('SELECT word_id, MIN(activity_id) AS topic FROM word_activities GROUP BY word_id LIMIT 21').fetchall()
        for row in rows[:20]:
            response = self.client.post('/api/topics/' + row['topic'] + '/words/' + row['word_id'] + '/keep', json={})
            self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(self.client.get('/api/garden').json()['bag']), 20)
        last = rows[20]
        url = '/api/topics/' + last['topic'] + '/words/' + last['word_id'] + '/keep'
        self.assertEqual(self.client.post(url, json={}).status_code, 409)
        self.assertEqual(self.client.get('/api/garden').json()['summary']['planted_total'], 0)
        first = rows[0]
        self.assertEqual(self.client.post('/api/review', json={'scope': 'bag', 'word_id': first['word_id'], 'grade': 3}).status_code, 200)
        self.assertEqual(self.client.post(url, json={}).status_code, 200)

    def test_rating_previews_match_saved_outcomes_without_writes(self):
        from app import garden
        self.login()
        card, _, _ = self.keep()
        self.plant_fixture()
        review_card = self.client.get('/api/review').json()['card']
        self.assertEqual(review_card['growth'], 0)
        initial = review_card['rating_options']
        self.assertEqual([option['next_review_seconds'] for option in initial], [60, 600, 86400, 345600])
        self.assertEqual([option['growth'] for option in initial], [0, 0, 1, 1])
        with db.open_app_db('test_learner') as conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM word_srs').fetchone()[0], 0)
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM reviews').fetchone()[0], 0)
        for state, interval, reps in [('learning', 0, 0), ('relearning', .01, 0),
                                      ('review', 7, 3), ('review', 40, 6), ('graduated', 65, 8)]:
            for grade in range(1, 5):
                with self.subTest(state=state, grade=grade):
                    with db.open_app_db('test_learner') as conn:
                        conn.execute('DELETE FROM word_srs')
                        conn.execute('INSERT INTO word_srs (word_id, state, interval_days, reps, ease, lapses) VALUES (?, ?, ?, ?, 2.3, 1)',
                                     (card['word_id'], state, interval, reps))
                        conn.commit()
                        before = dict(conn.execute('SELECT * FROM word_srs').fetchone())
                        count = conn.execute('SELECT COUNT(*) FROM reviews').fetchone()[0]
                        preview = garden.next_review_card(conn, 'all')['rating_options'][grade - 1]
                        self.assertEqual(dict(conn.execute('SELECT * FROM word_srs').fetchone()), before)
                        self.assertEqual(conn.execute('SELECT COUNT(*) FROM reviews').fetchone()[0], count)
                        garden.grade_word(conn, card['word_id'], grade)
                        saved = dict(conn.execute('SELECT * FROM word_srs').fetchone())
                        self.assertEqual(preview['next_review_seconds'], int(saved['interval_days'] * 86400))
                        self.assertEqual(preview['growth'], garden.growth_stage(saved))

    def test_discovery_learned_words_appear_as_grown_plants(self):
        self.login()
        card = self.client.get('/api/matcher').json()['card']
        payload = {key: card[key] for key in ('word_id', 'activity_id', 'sentence_id')}
        response = self.client.post('/api/matcher', json={**payload, 'action': 'learned'})
        self.assertEqual(response.status_code, 200)
        home = self.client.get('/api/garden').json()
        plot = next(p for p in home['plots'] if p['id'] == card['activity_id'])
        word = next(w for w in plot['words'] if w['id'] == card['word_id'])
        self.assertTrue(word['learned'])
        self.assertEqual(word['growth'], 5)
        detail = self.client.get('/api/topics/' + card['activity_id']).json()
        word = next(w for w in detail['words'] if w['id'] == card['word_id'])
        self.assertEqual(word['status'], 'learned')
        self.assertEqual(word['growth'], 5)
        self.assertTrue(word['learned'])
        # Displaying learned flowers must not turn them into new keeps.
        self.assertEqual(home['bag'], [])
        self.assertEqual(home['summary']['planted_total'], 0)
        with db.open_app_db('test_learner') as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM swipes WHERE action='keep'").fetchone()[0], 0)

    def test_review_remaining_tracks_new_due_and_scope(self):
        self.login()
        first, _, _ = self.keep()
        self.keep()
        self.assertEqual(self.client.get('/api/review?scope=bag').json()['remaining'], 2)
        self.assertEqual(self.client.get('/api/review').json()['counts'], {'plants': 0, 'seeds': 2})
        self.assertEqual(self.client.get('/api/review').json()['remaining'], 0)
        self.assertEqual(self.client.get('/api/garden').json()['summary']['due_now'], 0)
        self.plant_fixture()
        self.assertEqual(self.client.get('/api/review').json()['remaining'], 2)
        self.assertEqual(self.client.get('/api/garden').json()['summary']['due_now'], 2)
        result = self.client.post('/api/review', json={'word_id': first['word_id'], 'grade': 3})
        self.assertEqual(result.json()['remaining'], 1)
        self.assertEqual(result.json()['counts'], {'plants': 1, 'seeds': 0})
        self.assertEqual(self.client.get('/api/garden').json()['summary']['due_now'], 1)
        # An early repeat is rejected without changing either schedule.
        result = self.client.post('/api/review', json={'word_id': first['word_id'], 'grade': 3})
        self.assertEqual(result.status_code, 409)
        self.assertEqual(self.client.get('/api/garden').json()['summary']['due_now'], 1)
        with db.open_app_db('test_learner') as conn:
            conn.execute("UPDATE word_srs SET due_at=datetime('now', '-1 minute')")
            conn.commit()
        self.assertEqual(self.client.get('/api/review').json()['remaining'], 2)
        self.assertEqual(self.client.get('/api/garden').json()['summary']['due_now'], 2)
        self.assertEqual(self.client.get('/api/review?scope=bag').json()['remaining'], 0)

    def test_review_finishes_after_last_due_word(self):
        self.login()
        seed, _, _ = self.keep()
        self.plant_fixture()
        topic_query = '/api/review?scope=topic&topic=' + seed['activity_id']
        self.assertEqual(self.client.get(topic_query).json()['card']['word_id'], seed['word_id'])
        result = self.client.post('/api/review', json={
            'word_id': seed['word_id'], 'grade': 3,
            'scope': 'topic', 'topic': seed['activity_id'],
        }).json()
        self.assertEqual(result['remaining'], 0)
        self.assertIsNone(result['card'])
        for url in ['/api/review', topic_query]:
            result = self.client.get(url).json()
            self.assertEqual(result['remaining'], 0)
            self.assertIsNone(result['card'])
        with db.open_app_db('test_learner') as conn:
            conn.execute("UPDATE word_srs SET due_at=datetime('now', '-1 minute')")
            conn.commit()
        result = self.client.get('/api/review').json()
        self.assertEqual(result['remaining'], 1)
        self.assertEqual(result['card']['word_id'], seed['word_id'])

    def test_practice_exposes_seeds_before_any_planting(self):
        self.login()
        seed, _, _ = self.keep()
        practice = self.client.get('/api/practice').json()
        self.assertEqual(practice['words'], [])
        self.assertEqual(practice['counts'], {'plants': 0, 'seeds': 1})
        self.assertEqual(self.client.get('/api/practice/summary?scope=bag').json(),
                         {'word_count': 1, 'counts': {'plants': 0, 'seeds': 1}})
        self.assertEqual(self.client.get('/api/practice/summary').json()['word_count'], 0)
        self.assertEqual(len(self.client.get('/api/practice?scope=bag').json()['words']), 1)
        self.client.post('/api/review', json={'word_id': seed['word_id'], 'scope': 'bag', 'grade': 3})
        practice = self.client.get('/api/practice').json()
        self.assertEqual(self.client.get('/api/practice?scope=bag').json()['words'], [])
        self.assertEqual(len(practice['words']), 1)
        self.assertEqual(practice['counts'], {'plants': 1, 'seeds': 0})
        self.assertEqual(self.client.get('/api/practice/summary').json(),
                         {'word_count': 1, 'counts': {'plants': 1, 'seeds': 0}})

    def test_full_bag_does_not_plant_without_review(self):
        self.login()
        for _ in range(20):
            _, _, result = self.keep()
        self.assertEqual(len(result['bag']), 20)
        self.assertEqual(self.client.get('/api/garden').json()['summary']['planted_total'], 0)
        card = self.client.get('/api/matcher').json()['card']
        payload = {key: card[key] for key in ('word_id', 'activity_id', 'sentence_id')}
        self.assertEqual(self.client.post('/api/matcher', json={**payload, 'action': 'keep'}).status_code, 409)

    def test_each_seed_rating_plants_only_that_seed(self):
        self.login()
        seeds = [self.keep()[0] for _ in range(4)]
        # Browsing and revealing via GET must not plant anything.
        self.client.get('/api/review?scope=bag')
        self.client.get('/api/flashcards?scope=bag')
        self.assertEqual(self.client.get('/api/garden').json()['summary']['planted_total'], 0)
        for grade, seed in enumerate(seeds, 1):
            response = self.client.post('/api/review', json={'word_id': seed['word_id'], 'grade': grade, 'scope': 'bag'})
            self.assertEqual(response.status_code, 200, response.text)
            home = self.client.get('/api/garden').json()
            self.assertEqual(home['summary']['planted_total'], grade)
            self.assertEqual(len(home['bag']), 4 - grade)
            self.assertEqual(response.json()['remaining'], 4 - grade)
            if grade == 4:
                self.assertIsNone(response.json()['card'])
            # A retry cannot grade the now-planted word as a bag seed again.
            self.assertEqual(self.client.post('/api/review', json={'word_id': seed['word_id'], 'grade': grade, 'scope': 'bag'}).status_code, 409)
        self.assertIn(self.client.post('/api/plant', json={}).status_code, (404, 405))

    def test_discovery_actions_and_validation(self):
        self.login()
        card = self.client.get('/api/matcher').json()['card']
        payload = {key: card[key] for key in ('word_id', 'activity_id', 'sentence_id')}
        self.assertEqual(self.client.post('/api/matcher', json={**payload, 'action': 'invalid'}).status_code, 422)
        self.assertEqual(self.client.post('/api/matcher', json={**payload, 'action': 'learned'}).status_code, 200)
        with db.open_app_db('test_learner') as conn:
            self.assertIsNotNone(conn.execute('SELECT 1 FROM known_words WHERE word_id=?', (card['word_id'],)).fetchone())
        self.assertEqual(self.client.get('/api/practice?scope=topic&topic=unknown').status_code, 422)
        self.assertEqual(self.client.post('/api/review', json={'word_id': card['word_id'], 'grade': 5}).status_code, 422)

    def test_overlapping_page_load_requests(self):
        # Use one shared ASGI event loop, like uvicorn. Without the context
        # manager TestClient creates separate portals and hides thread handoffs.
        with self.client:
            self.login()
            self.keep()
            self.plant_fixture()

            def fetch(path):
                if path == '/api/heartbeat':
                    response = self.client.post(path, json={})
                else:
                    response = self.client.get(path)
                return path, response.status_code, response.json()

            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(fetch, ['/api/garden', '/api/heartbeat', '/api/session'] * 10))
            for path, status, data in results:
                self.assertEqual(status, 200, (path, data))
                if path == '/api/garden':
                    self.assertEqual(data['summary']['planted_total'], 1)

    def test_ai_modes_use_scoped_words(self):
        self.login()
        self.keep()
        with patch('app.main.learn.generate_reading', return_value={'setting': 'Test', 'de': 'Hallo.', 'en': 'Hello.'}):
            result = self.client.post('/api/reading', json={'scope': 'bag'})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(len(result.json()['targets']), 1)
        with patch('app.main.learn.chat_opener', return_value='Hallo!'):
            start = self.client.post('/api/chat', json={'scope': 'bag'}).json()
        with patch('app.main.learn.chat_turn', return_value=[{'role': 'assistant', 'content': 'Gut!'}]):
            result = self.client.post('/api/chat', json={'scope': 'bag', 'message': 'Hallo',
                                      'target_ids': [w['id'] for w in start['targets']], 'history': start['history']})
            self.assertEqual(result.status_code, 200, result.text)
        word = self.client.get('/api/practice?scope=bag').json()['words'][0]
        with patch('app.main.learn.grammar_generate', return_value={'de': 'Hallo.', 'en': 'Hello.', 'focus': 'Test'}):
            self.assertEqual(self.client.post('/api/grammar', json={'word_id': word['id']}).status_code, 200)


if __name__ == '__main__':
    unittest.main()
