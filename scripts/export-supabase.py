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
                    affinity_above=1)
    user = {key: original.get(key, default) for key, default in defaults.items()}
    swipes = rows(conn, 'swipes')
    for swipe in swipes:
        swipe['swiped_at'] = timestamp(swipe['swiped_at'])
        swipe['planted_at'] = timestamp(swipe.get('planted_at'))
    srs = {}
    for row in rows(conn, 'word_srs'):
        if row.get('production'):
            row['production'] = json.loads(row['production'])
            for field in ('due_at', 'last_review_at'):
                row['production'][field] = timestamp(row['production'].get(field))
        if row.get('production') is None:
            row.pop('production', None)
        row['due_at'] = timestamp(row['due_at'])
        row['last_review_at'] = timestamp(row.get('last_review_at'))
        srs[row.pop('word_id')] = row
    reviews = rows(conn, 'reviews')
    for review in reviews:
        if review.get('track') == 'recognition':
            review.pop('track')
        review['reviewed_at'] = timestamp(review['reviewed_at'])
    return dict(user=user, swipes=swipes, srs=srs, reviews=reviews,
                known=[r['word_id'] for r in rows(conn, 'known_words')],
                learned=[r['word_id'] for r in rows(conn, 'flashcard_learned')],
                weights={r['activity_id']: r['weight'] for r in rows(conn, 'activity_weights')})


def literal(value):
    return "'" + json.dumps(value, ensure_ascii=False).replace("'", "''") + "'::jsonb"


def content_statements(conn):
    statements = []
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    for table in ('words', 'activities', 'word_activities', 'word_associations', 'sentences'):
        # Older profile databases predate word_associations.
        data = rows(conn, table) if table in tables else []
        for start in range(0, len(data), 500):
            statements.append(f'INSERT INTO public.{table} SELECT * FROM jsonb_populate_recordset(NULL::public.{table}, {literal(data[start:start+500])}) ON CONFLICT DO NOTHING;')
    return statements


def export_many(content, profiles, skip_existing=False):
    """Import shared vocabulary and a list of (profile path, Auth UUID) pairs."""
    ids = [str(UUID(user_id)) for _, user_id in profiles]
    if len(ids) != len(set(ids)):
        raise ValueError('Each profile must have a separate account UUID')
    statements = ['BEGIN;', 'SET standard_conforming_strings = on;']
    with sqlite3.connect(f'file:{content.resolve()}?mode=ro', uri=True) as conn:
        conn.row_factory = sqlite3.Row
        statements.extend(content_statements(conn))
    for (profile, _), user_id in zip(profiles, ids):
        with sqlite3.connect(f'file:{profile.resolve()}?mode=ro', uri=True) as conn:
            conn.row_factory = sqlite3.Row
            statements.extend(content_statements(conn))
            statements.append(f"SELECT public.import_learner_progress('{user_id}', {literal(learner(conn))}, {'true' if skip_existing else 'false'});")
    statements.append('COMMIT;')
    return '\n'.join(statements) + '\n'


def export(content, profile=None, user_id=None):
    return export_many(content, [(profile, user_id)] if profile else [])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--content', type=Path, default=Path('data/vocab.sqlite'))
    parser.add_argument('--profile', type=Path)
    parser.add_argument('--profiles-map', type=Path, help='JSON object mapping local SQLite paths to account UUIDs')
    parser.add_argument('--skip-existing', action='store_true', help='Preserve existing progress when rerunning a bulk import')
    parser.add_argument('--user-id', help='UUID of the matching Supabase Auth user')
    parser.add_argument('--output', type=Path, required=True, help='Private output SQL file, preferably under data/')
    args = parser.parse_args()
    if bool(args.profile) != bool(args.user_id):
        parser.error('--profile and --user-id must be provided together')
    if args.output.suffix != '.sql' or args.output.resolve() in {args.content.resolve(), args.profile.resolve() if args.profile else None}:
        parser.error('--output must be a separate .sql file, never a source database')
    if args.profiles_map and (args.profile or args.user_id):
        parser.error('--profiles-map cannot be combined with --profile or --user-id')
    if args.skip_existing and not args.profiles_map:
        parser.error('--skip-existing requires --profiles-map')
    if args.profiles_map:
        mapping = json.loads(args.profiles_map.read_text())
        if not isinstance(mapping, dict) or not mapping:
            parser.error('--profiles-map must contain a nonempty object')
        sql = export_many(args.content, [(Path(path), uid) for path, uid in mapping.items()], args.skip_existing)
    else:
        sql = export(args.content, args.profile, args.user_id)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(sql, encoding='utf-8')
    args.output.chmod(0o600)
    print(f'Wrote {args.output}. Contains private data; do not commit it.')


if __name__ == '__main__':
    main()
