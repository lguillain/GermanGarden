"""Export local vocabulary and optional learner progress as transactional PostgreSQL SQL.

Reads SQLite in read-only mode. No credentials, uploads, or source-file changes.
Run the generated SQL with psql against a migrated Supabase database.
"""
import argparse
import json
import sqlite3
from pathlib import Path
from uuid import UUID


def rows(conn, table):
    return [dict(row) for row in conn.execute(f'SELECT * FROM {table}')]


def timestamp(value):
    return value.replace(' ', 'T') + 'Z' if value and 'T' not in value else value


def learner(conn):
    users = rows(conn, 'user_state')
    original = users[0] if users else {}
    defaults = dict(name='Learner', level=None, swipe_count=0, drop_streak=0,
                    cards_in_bucket=0, current_topic=None, affinity_below=1,
                    affinity_above=1, level_bias=0)
    user = {key: original.get(key, default) for key, default in defaults.items()}
    swipes = rows(conn, 'swipes')
    for swipe in swipes:
        swipe['swiped_at'] = timestamp(swipe['swiped_at'])
        swipe['planted_at'] = timestamp(swipe.get('planted_at'))
    srs = {}
    for row in rows(conn, 'word_srs'):
        row['due_at'] = timestamp(row['due_at'])
        row['last_review_at'] = timestamp(row.get('last_review_at'))
        srs[row.pop('word_id')] = row
    reviews = rows(conn, 'reviews')
    for review in reviews:
        review['reviewed_at'] = timestamp(review['reviewed_at'])
    sessions = rows(conn, 'sessions')
    for session in sessions:
        for key in ('started_at', 'last_beat_at'):
            session[key] = timestamp(session[key])
    return dict(user=user, swipes=swipes, srs=srs, reviews=reviews, sessions=sessions,
                known=[r['word_id'] for r in rows(conn, 'known_words')],
                learned=[r['word_id'] for r in rows(conn, 'flashcard_learned')],
                weights={r['activity_id']: r['weight'] for r in rows(conn, 'activity_weights')})


def literal(value):
    return "'" + json.dumps(value, ensure_ascii=False).replace("'", "''") + "'::jsonb"


def export(content, profile=None, user_id=None):
    statements = ['BEGIN;', 'SET standard_conforming_strings = on;']
    with sqlite3.connect(f'file:{content.resolve()}?mode=ro', uri=True) as conn:
        conn.row_factory = sqlite3.Row
        # Import the profile's vocabulary too: older profiles may have unique words/sentences.
        for table in ('words', 'activities', 'word_activities', 'sentences'):
            data = rows(conn, table)
            for start in range(0, len(data), 500):
                statements.append(f'INSERT INTO public.{table} SELECT * FROM jsonb_populate_recordset(NULL::public.{table}, {literal(data[start:start+500])}) ON CONFLICT DO NOTHING;')
    if profile:
        with sqlite3.connect(f'file:{profile.resolve()}?mode=ro', uri=True) as conn:
            conn.row_factory = sqlite3.Row
            for table in ('words', 'activities', 'word_activities', 'sentences'):
                data = rows(conn, table)
                for start in range(0, len(data), 500):
                    statements.append(f'INSERT INTO public.{table} SELECT * FROM jsonb_populate_recordset(NULL::public.{table}, {literal(data[start:start+500])}) ON CONFLICT DO NOTHING;')
            # Intentionally fail if progress already exists, instead of overwriting it.
            statements.append(f"INSERT INTO public.learner_state(user_id, data) VALUES ('{UUID(user_id)}', {literal(learner(conn))});")
    statements.append('COMMIT;')
    return '\n'.join(statements) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--content', type=Path, default=Path('data/vocab.sqlite'))
    parser.add_argument('--profile', type=Path)
    parser.add_argument('--user-id', help='UUID of the matching Supabase Auth user')
    parser.add_argument('--output', type=Path, required=True, help='Private output SQL file, preferably under data/')
    args = parser.parse_args()
    if bool(args.profile) != bool(args.user_id):
        parser.error('--profile and --user-id must be provided together')
    if args.output.suffix != '.sql' or args.output.resolve() in {args.content.resolve(), args.profile.resolve() if args.profile else None}:
        parser.error('--output must be a separate .sql file, never a source database')
    sql = export(args.content, args.profile, args.user_id)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(sql, encoding='utf-8')
    args.output.chmod(0o600)
    print(f'Wrote {args.output}. Contains private data; do not commit it.')


if __name__ == '__main__':
    main()
