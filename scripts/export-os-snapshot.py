#!/usr/bin/env python3
"""Export the Space OS data from a restored Supabase backup into one JSON file.

Supabase is gone (2026-09-23). The OS now answers reads from this snapshot via
/api/os-db. Only rows the public (anon role, row-level security on) could read
are exported; members, subscribers, contacts, tickets, analytics and audit
tables are skipped entirely.

Needs: the backup loaded into a local Postgres on /tmp:55432.
Output: data/os-snapshot/db.json (server-only, never under public/).
"""
import json, os, subprocess

OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'os-snapshot')
os.makedirs(OUT, exist_ok=True)


def q(sql, anon=True):
    pre = "begin; set local role anon; " if anon else "begin; "
    r = subprocess.run(['psql', '-h', '/tmp', '-p', '55432', '-U', 'postgres', '-At', '-c',
                        pre + sql + "; rollback;"], capture_output=True, text=True)
    if r.returncode:
        print('ERR', sql[:80], r.stderr[:200])
    return '\n'.join(l for l in r.stdout.splitlines() if l not in ('BEGIN', 'SET', 'ROLLBACK'))


def lit(s):
    return "'" + s.replace("'", "''") + "'"


SKIP = {'directory_members', 'srw_subscribers', 'admin_tickets', 'admin_ticket_comments',
        'directory_analytics', 'directory_audit', 'directory_contacts', 'congress_registrations'}

tables = q("select table_name from information_schema.tables where table_schema='public' "
           "and table_type='BASE TABLE' order by 1", anon=False).split()
db = {}
for t in tables:
    if t in SKIP:
        continue
    db[t] = json.loads(q(f'select coalesce(json_agg(x), \'[]\') from public."{t}" x') or '[]')

fks = json.loads(q("""select coalesce(json_agg(json_build_object('table',tc.table_name,'column',kcu.column_name,
  'ref',ccu.table_name,'refcol',ccu.column_name)),'[]')
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
  join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name
  where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'""", anon=False))

rpc = {'get_company_profile': {}, 'get_person_profile': {}, 'get_ecosystem_activity': {},
       'congress_event_stats': {}}
for c in db['directory_companies']:
    if c.get('slug'):
        rpc['get_company_profile'][c['slug']] = json.loads(q(f"select public.get_company_profile({lit(c['slug'])})") or 'null')
for p in db['directory_people']:
    if p.get('slug'):
        rpc['get_person_profile'][p['slug']] = json.loads(q(f"select public.get_person_profile({lit(p['slug'])})") or 'null')
for n in (5, 8, 10, 20):
    rpc['get_ecosystem_activity'][str(n)] = json.loads(
        q(f"select coalesce(json_agg(x),'[]') from public.get_ecosystem_activity({n}) x") or '[]')
for e in db['congress_events']:
    rpc['congress_event_stats'][e['id']] = json.loads(
        q(f"select to_json(x) from public.congress_event_stats({lit(e['id'])}) x") or 'null')

with open(os.path.join(OUT, 'db.json'), 'w') as f:
    json.dump({'tables': db, 'fks': fks, 'rpc': rpc, 'snapshot': '2026-09-14'}, f,
              separators=(',', ':'), default=str)
print({k: len(v) for k, v in db.items()})
print('fks', len(fks), {k: len(v) for k, v in rpc.items()})
