#!/usr/bin/env python3
"""Merge Ben's 2026-09-22 spreadsheets into the Space OS snapshot (data/os-snapshot/db.json).

Ben (email "Sourcing.Directory Live data for us. menu by menu item labled."):
  Jobs.xlsx         -> Jobs          (directory_listings, category=job)
  Events.xlsx       -> Events        (directory_listings, category=event)
  Articles.xlsx     -> Articles      (directory_listings, category=article)
  Reports.xlsx      -> Reports       (directory_reports)
  Investors.xlsx    -> skipped: all 110 were already live (emails never imported)
  Accelerators.xlsm -> Deal Bank / Accelerators (new `accelerators` table)
  grants-research.json (verified research, 2026-09-24) -> Grants (category=grant)

Idempotent: every row it adds carries source='ben-2026-09-22' (or 'research-2026-09-24')
and is removed before re-adding.
"""
import json, os, re, uuid
from datetime import datetime

import openpyxl

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'data', 'ben-2026-09-22')
DB_PATH = os.path.join(ROOT, 'data', 'os-snapshot', 'db.json')
TENANT = '91dac63a-9ae2-49ea-b15d-4209c55f225f'  # space-rising
TAG = 'ben-2026-09-22'
RTAG = 'research-2026-09-24'
NS = uuid.UUID('6f1c1d8e-0b7a-4b8e-9d7e-2b0f5a1c9e22')


def uid(*parts):
    return str(uuid.uuid5(NS, '|'.join(str(p) for p in parts)))


def fix(s):
    """Repair Mac-Roman mojibake like 'Co‚ÄëFounder' and tidy whitespace."""
    if s is None:
        return None
    s = str(s)
    if re.search(r'[‚Ä√Ã]', s):
        try:
            s = s.encode('mac_roman').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    s = s.strip()
    return s or None


def rows(fname, sheet=None):
    wb = openpyxl.load_workbook(os.path.join(SRC, fname), read_only=True, data_only=True)
    ws = wb[sheet] if sheet else wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    head = [fix(h) for h in next(it)]
    for r in it:
        if not any(c not in (None, '') for c in r):
            continue
        yield {h: (fix(v) if isinstance(v, str) else v) for h, v in zip(head, r) if h}


MONTHS = {m: i for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], 1)}


def mnum(tok):
    return MONTHS.get(tok[:3].lower())


def parse_dates(s):
    """'Dec 8–9, 2025' | 'May 19, 2026' | 'Oct 30 – Nov 1, 2026' | 'Sep 14, 2026' -> (start, end) ISO dates."""
    if s is None:
        return None, None
    if isinstance(s, datetime):
        d = s.date().isoformat()
        return d, d
    t = str(s).replace('–', '-').replace('—', '-').replace(',', ' ')
    t = re.sub(r'\s+', ' ', t).strip()
    m = re.match(r'([A-Za-z]+)\.? (\d{1,2})(?: ?- ?(?:([A-Za-z]+)\.? )?(\d{1,2}))? (\d{4})', t)
    if not m or not mnum(m.group(1)):
        return None, None
    y = int(m.group(5)); m1 = mnum(m.group(1)); d1 = int(m.group(2))
    m2 = mnum(m.group(3)) if m.group(3) else m1
    d2 = int(m.group(4)) if m.group(4) else d1
    return f'{y:04d}-{m1:02d}-{d1:02d}', f'{y:04d}-{m2:02d}-{d2:02d}'


def ts(date_iso, hour='09:00:00'):
    return f'{date_iso}T{hour}-07:00' if date_iso else None


def listing(**kw):
    base = {'tenant_id': TENANT, 'status': 'active', 'vertical': 'space', 'remote': False,
            'company_id': None, 'source': TAG}
    base.update(kw)
    return base


def main():
    db = json.load(open(DB_PATH))
    T = db['tables']
    T['directory_listings'] = [r for r in T['directory_listings'] if r.get('source') not in (TAG, RTAG)]
    T['directory_reports'] = [r for r in T['directory_reports'] if r.get('source') != TAG]
    T['deal_bank_investors'] = [r for r in T['deal_bank_investors'] if r.get('source') != TAG]
    # never serve internal investor emails from the public snapshot
    for r in T['deal_bank_investors']:
        r.pop('contact_email_internal', None)
    counts = {}

    # Jobs
    n = 0
    for r in rows('Jobs.xlsx', 'Space Jobs'):
        if not r.get('Job Title'):
            continue
        loc = ', '.join(x for x in [r.get('City'), r.get('State')] if x)
        T['directory_listings'].append(listing(
            id=uid('job', r.get('Company'), r['Job Title'], loc), category='job',
            title=r['Job Title'], company_name=r.get('Company'), location=loc or None,
            remote=bool(re.search(r'remote', loc or '', re.I)), description=r.get('Mini Description'),
            apply_url=r.get('Job / Application Link'), job_type='full-time',
            created_at='2026-09-22T09:00:00-07:00'))
        n += 1
    counts['jobs'] = n

    # Events
    def norm(t):
        t = re.sub(r'[^a-z0-9 ]', '', (t or '').lower())
        return re.sub(r'\s+', ' ', re.sub(r'\b(20\d\d|the|conference|summit)\b', '', t)).strip()
    existing_events = {norm(r['title']) for r in T['directory_listings'] if r.get('category') == 'event'}
    n = 0; bad = []
    for r in rows('Events.xlsx', 'Events'):
        if not r.get('Conference'):
            continue
        if norm(r['Conference']) in existing_events:
            continue  # already listed (e.g. 'AMOS Conference 2026')
        start, end = parse_dates(r.get('Dates'))
        if not start:
            bad.append(r.get('Dates'))
        T['directory_listings'].append(listing(
            id=uid('event', r['Conference']), category='event', title=r['Conference'],
            description=r.get('Mini Description'), event_location=r.get('Location'),
            event_date=ts(start), event_end_date=ts(end, '17:00:00'), event_type='conference',
            apply_url=r.get('Conference Site'), created_at='2026-09-22T09:00:00-07:00'))
        n += 1
    counts['events'] = n
    if bad:
        print('events with unparsed dates:', bad)

    # Articles
    n = 0
    for r in rows('Articles.xlsx', 'Space News'):
        if not r.get('Headline'):
            continue
        d = r.get('Publication Date')
        d = d.date().isoformat() if isinstance(d, datetime) else (parse_dates(d)[0] or (str(d)[:10] if d else None))
        T['directory_listings'].append(listing(
            id=uid('article', r['Headline']), category='article', title=r['Headline'],
            author_name=r.get('Source'), description=r.get('Summary'), excerpt=r.get('Summary'),
            apply_url=r.get('Link'), created_at=ts(d) or '2026-09-22T09:00:00-07:00'))
        n += 1
    counts['articles'] = n

    # Reports (white papers)
    n = 0
    for r in rows('Reports.xlsx', 'White Papers'):
        title = r.get('Article / White Paper')
        if not title:
            continue
        d = r.get('Publication Date')
        d = d.date().isoformat() if isinstance(d, datetime) else parse_dates(d)[0]
        T['directory_reports'].append({
            'id': uid('report', title), 'tenant_id': TENANT, 'title': title, 'category': 'White Paper',
            'access': 'free', 'description': r.get('Summary'), 'file_url': r.get('Link'),
            'published_at': ts(d), 'created_at': '2026-09-22T09:00:00-07:00', 'source': TAG})
        n += 1
    counts['reports'] = n

    # Investors: all 110 were already in the live data (loaded earlier), so
    # they are NOT re-imported. Kept here for reference only.
    SKIP_INVESTORS = True
    STAGE = {'PRE_SEED': 'Pre-Seed', 'SEED': 'Seed', 'SERIES_A': 'Series A', 'SERIES_B': 'Series B',
             'SERIES_C': 'Series C', 'SERIES_D': 'Series D', 'GROWTH': 'Growth', 'LATE_STAGE': 'Late Stage'}
    n = 0
    for i, r in enumerate([] if SKIP_INVESTORS else rows('Investors.xlsx')):
        name = r.get('investorName')
        if not name:
            continue
        links = r.get('socialLinks') or ''
        li = re.search(r'LINKEDIN:(\S+)', links)
        web = re.search(r'(?:WEBSITE|HOMEPAGE):(\S+)', links)
        stages = [STAGE.get(s.strip(), s.strip().replace('_', ' ').title()) for s in (r.get('investmentStages') or '').split(';') if s.strip()]
        title = r.get('investorFirm')
        focus = ' '.join(x for x in [f'{title}.' if title else None, r.get('investorDescription')] if x)

        def num(v):
            try:
                return int(float(v))
            except (TypeError, ValueError):
                return None
        T['deal_bank_investors'].append({
            'id': uid('investor', name, title), 'firm_name': name, 'criteria': focus or None,
            'check_size_min': num(r.get('investorMinInvestment')), 'check_size_max': num(r.get('investorMaxInvestment')),
            'deal_types': stages, 'deals_last_18mo': None,
            'linkedin_url': li.group(1).rstrip(';,') if li else None,
            'website': web.group(1).rstrip(';,') if web else None,
            'industries': [s.strip() for s in (r.get('industries') or '').split(';') if s.strip()],
            'city': r.get('investorCity'), 'country': r.get('locationCountry'),
            'status': 'approved', 'created_at': f'2026-09-22T09:{i // 60:02d}:{i % 60:02d}-07:00', 'source': TAG})
        n += 1
    counts['investors'] = n

    # Accelerators (new table)
    acc = []
    for r in rows('Accelerators.xlsm', 'All'):
        name = r.get('Accelerator Name')
        if not name:
            continue
        try:
            inv = int(float(r.get('Number of Investments') or 0))
        except ValueError:
            inv = 0
        founded = re.search(r'(\d{4})', str(r.get('Founded Date') or ''))
        acc.append({
            'id': uid('accelerator', name, r.get('Website')), 'name': name,
            'location': (r.get('Location') or '').replace(',', ', ') or None,
            'website': r.get('Website'), 'short_description': r.get('Short Description'),
            'long_description': r.get('Long Description'), 'linkedin_url': r.get('LinkedIn URL'),
            'facebook_url': r.get('Facebook URL'), 'investments': inv,
            'founded_year': int(founded.group(1)) if founded else None, 'source': TAG})
    T['accelerators'] = acc
    counts['accelerators'] = len(acc)

    # Grants (verified research, optional)
    gpath = os.path.join(SRC, 'grants-research.json')
    if os.path.exists(gpath):
        n = 0
        for g in json.load(open(gpath)):
            T['directory_listings'].append(listing(
                id=uid('grant', g['title'], g.get('agency')), category='grant', source=RTAG,
                title=g['title'], grant_agency=g.get('agency'), description=g.get('description'),
                salary_min=g.get('grant_amount_min'), salary_max=g.get('grant_amount_max'),
                grant_amount_min=g.get('grant_amount_min'), grant_amount_max=g.get('grant_amount_max'),
                deadline=ts(g.get('deadline'), '23:59:00') if g.get('deadline') else None,
                grant_type=g.get('program_type'), apply_url=g.get('url'),
                location=g.get('location'), vertical='Federal' if (g.get('location') or 'National') == 'National' else 'State',
                created_at='2026-09-24T09:00:00-07:00'))
            n += 1
        counts['grants'] = n

    json.dump(db, open(DB_PATH, 'w'), separators=(',', ':'), default=str)
    print(counts)


if __name__ == '__main__':
    main()
