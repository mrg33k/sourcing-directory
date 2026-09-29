"""Ben's 2026-09-28 Completed.xlsx -> db.json table `completed_rounds` (Deal Bank > Completed).
Idempotent: rows are keyed by a stable uuid5 of company+round+month. Run with /usr/bin/python3
(Homebrew python's expat is broken on this Mac)."""
import json, os, re, sys, uuid
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))
from _xlsx_stdlib import read

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, 'data/os-snapshot/db.json')
SRC = os.path.join(ROOT, 'data/ben-2026-09-28/Completed.xlsx')

def month(s):
    s = (s or '').strip()
    for fmt in ('%b %Y', '%B %Y', '%b. %Y'):
        try: return datetime.strptime(s, fmt).strftime('%Y-%m-01')
        except ValueError: pass
    m = re.search(r'(\d{4})-(\d{2})', s)
    return f'{m.group(1)}-{m.group(2)}-01' if m else None

def clean(v):
    v = (v or '').strip()
    return None if not v or v.lower().startswith('not disclosed') and len(v) < 26 else v

rows = list(read(SRC).values())[0]
hdr = rows[0]
out = []
for r in rows[1:]:
    company = (r.get('A') or '').strip()
    if not company: continue
    rnd, when = (r.get('B') or '').strip(), (r.get('C') or '').strip()
    amount = (r.get('D') or '').strip()
    out.append({
        'id': str(uuid.uuid5(uuid.NAMESPACE_URL, f'completed:{company}|{rnd}|{when}')),
        'company': company,
        'round': rnd or None,
        'date': month(when),
        'amount_raised': None if amount.lower() in ('undisclosed', 'not disclosed', '') else amount,
        'notes': clean(r.get('E')),
        'source_url': (r.get('F') or '').strip() or None,
        'source': 'ben-2026-09-28',
    })

D = json.load(open(DB))
D['tables']['completed_rounds'] = out
json.dump(D, open(DB, 'w'), separators=(',', ':'))
print(f'completed_rounds: {len(out)} rows, undated: {sum(1 for o in out if not o["date"])}')
