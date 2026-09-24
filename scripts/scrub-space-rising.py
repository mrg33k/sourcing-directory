#!/usr/bin/env python3
"""Remove Space Rising branding from the public snapshot (Patrik, 2026-09-24:
"Remove all space rising talk, it's Sourcing Directory now").

Run AFTER scripts/import-ben-2026-09-22.py (that script rebuilds from its own tags
and leaves this cleanup intact, but run this again after any re-import).

- Drops the Space Rising org + the "Space OS — Discovery Library" system anchor from
  companies / organizations / company profiles; listings they "posted" keep their
  content but lose the Space Rising credit.
- Drops promo listings about Space Rising's own event (Space Congress).
- Drops people whose only tie is Space Rising staff (spacerising.org emails).
- Rewrites any remaining "Space Rising" / "Space OS" wording to "Sourcing Directory"
  and blanks spacerising.org links + emails.
"""
import json, os, re

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'os-snapshot', 'db.json')
BRAND = re.compile(r'space\s?rising|space congress|spaceos|space os', re.I)
PROMO = re.compile(r'space congress|space rising', re.I)
SR_URL = re.compile(r'spacerising\.(org|com)', re.I)


def scrub_text(s):
    if not isinstance(s, str):
        return s
    if SR_URL.search(s) and (s.startswith('http') or '@' in s or s.startswith('www') or s.endswith('.org')):
        return None
    s = re.sub(r"Space Rising(?:™)?(?:'s)? Team", 'Sourcing Directory', s)
    s = re.sub(r"Space Rising(?:™)?'s strategic plan", 'The strategic plan', s)
    s = re.sub(r'Space Rising Interactive|Space Rising(?:™)? Arizona|Space Rising(?:™)?', 'Sourcing Directory', s)
    s = re.sub(r'Space OS|SpaceOS', 'Sourcing Directory', s)
    s = re.sub(r'\s*[-—–]\s*the definitive public blueprint presented at the 2026 Arizona Space Congress', '', s)
    s = re.sub(r'\s*presented at the (?:2026 )?Arizona Space Congress', '', s)
    return s


def scrub_obj(o):
    if isinstance(o, dict):
        return {k: scrub_obj(v) for k, v in o.items()}
    if isinstance(o, list):
        return [scrub_obj(v) for v in o]
    return scrub_text(o)


def main():
    db = json.load(open(DB))
    T = db['tables']
    before = {k: len(v) for k, v in T.items()}

    sr_companies = [c for c in T['directory_companies'] if BRAND.search(c.get('name') or '')]
    sr_ids = {c['id'] for c in sr_companies}
    sr_slugs = {c.get('slug') for c in sr_companies}
    T['directory_companies'] = [c for c in T['directory_companies'] if c['id'] not in sr_ids]
    for t in ('directory_company_profile', 'directory_certifications', 'directory_mission_scores'):
        if t in T:
            T[t] = [r for r in T[t] if r.get('company_id') not in sr_ids and r.get('entity_id') not in sr_ids]
    T['directory_organizations'] = [o for o in T.get('directory_organizations', []) if not BRAND.search(o.get('name') or '')]
    T['directory_listings'] = [l for l in T['directory_listings']
                               if not PROMO.search((l.get('title') or '') + ' ' + (l.get('description') or '')[:200])]
    for l in T['directory_listings']:
        if l.get('company_id') in sr_ids:
            l['company_id'] = None
    T['directory_people'] = [p for p in T.get('directory_people', [])
                             if not SR_URL.search(p.get('email') or '') and not BRAND.search(p.get('org_name') or '')]
    for t in [k for k in T if k.startswith('congress_')]:
        del T[t]  # Space Rising's own event tables (not shown on this site)
    for t in T:
        T[t] = scrub_obj(T[t])
    for slug in list(db['rpc'].get('get_company_profile', {})):
        if slug in sr_slugs:
            del db['rpc']['get_company_profile'][slug]
    db['rpc'] = scrub_obj(db['rpc'])

    json.dump(db, open(DB, 'w'), separators=(',', ':'), default=str)
    after = {k: len(v) for k, v in T.items()}
    print({k: f'{before[k]}->{after.get(k, 0)}' for k in before if before[k] != after.get(k, 0)})
    left = sum(len(BRAND.findall(json.dumps(v))) for v in T.values())
    print('remaining brand mentions in tables:', left)


if __name__ == '__main__':
    main()
