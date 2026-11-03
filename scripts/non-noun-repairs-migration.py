"""Export reviewed word splits plus progress-preserving duplicate merges."""
import json
from pathlib import Path


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def migration():
    d = json.loads(Path('pipeline/non-noun-repairs.json').read_text())
    sql = ['-- Reviewed non-noun corrections; new split senses start unseen.', 'begin;']
    for wid, w in d['updates'].items():
        sql.append(f"UPDATE public.words SET lemma={literal(w['lemma'])},pos={literal(w['pos'])},english={literal(w['english'])} WHERE id={literal(wid)};")
    for w in d['additions']:
        sql.append('INSERT INTO public.words(id,lemma,pos,english,level) SELECT ' + ','.join(literal(w[k]) for k in ('id','lemma','pos','english','level')) + ' WHERE EXISTS (SELECT 1 FROM public.words WHERE id=' + literal(w['from_id']) + ') ON CONFLICT(id) DO NOTHING;')
        sql.append(f"INSERT INTO public.word_activities SELECT {literal(w['id'])},activity_id,relevance FROM public.word_activities WHERE word_id={literal(w['from_id'])} ON CONFLICT DO NOTHING;")
    for sid, wid in d['sentence_moves'].items():
        sql.append(f'UPDATE public.sentences SET word_id={literal(wid)} WHERE id={int(sid)};')
    template = Path('supabase/migrations/202611030002_merge_geburtsjahr.sql').read_text()
    for i, (old, new) in enumerate(d['merges'].items()):
        block = template.replace('begin;\n', '').replace('commit;\n', '')
        block = block.replace('other_geburts_jahr', old).replace('noun_geburtsjahr', new).replace('Geburtsjahr', new)
        block = block.replace('merged_users', f'merged_users_{i}').replace('merged_srs', f'merged_srs_{i}')
        block = block.replace('delete from public.words', f"insert into public.verb_objects select {literal(new)},noun_id,phrase from public.verb_objects where verb_id={literal(old)} on conflict do nothing;\ndelete from public.words")
        sql.append(block)
    sql += ["DELETE FROM public.verb_objects WHERE verb_id IN (SELECT id FROM public.words WHERE pos!='verb');", 'commit;']
    return '\n'.join(sql)+'\n'


if __name__ == '__main__':
    target = Path('supabase/migrations/202611030003_non_noun_repairs.sql')
    target.write_text(migration())
    print(target)
