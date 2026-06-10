#!/usr/bin/env python3
"""
purge-expired-events.py
-----------------------
Deletes all directory_listings rows where:
  - category = 'event'
  - event_end_date < now (UTC)

Scoped to a single tenant by default. Pass --all-tenants to run across every tenant.

Usage:
  python3 scripts/purge-expired-events.py                          # dry run
  python3 scripts/purge-expired-events.py --execute                # delete for Space Rising tenant
  python3 scripts/purge-expired-events.py --execute --all-tenants  # delete across all tenants

Scheduling (cron) — daily at 2am UTC:
  0 2 * * * cd /path/to/sourcing-directory && python3 scripts/purge-expired-events.py --execute >> /tmp/purge-events.log 2>&1
"""

import urllib.request
import json
import argparse
import sys
from datetime import datetime, timezone
from urllib.parse import quote

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = "https://kzzvjtthknsozktmpvak.supabase.co"

# Reads key from env if set, falls back to the service role key directly.
import os
SERVICE_KEY = os.environ.get(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6enZqdHRoa25zb3prdG1wdmFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY3NDAxMSwiZXhwIjoyMDkxMjUwMDExfQ.yGfEFCLjqn_NtDbELcevG6CGdSSUGHQOkuDb_D3HfvQ"
)

# Default tenant: Space Rising
DEFAULT_TENANT_ID = "91dac63a-9ae2-49ea-b15d-4209c55f225f"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def get(path, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}?{params}"
    req = urllib.request.Request(url, headers={**HEADERS, "Prefer": "count=exact"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        count_header = resp.headers.get("Content-Range", "0-0/0")
        total = int(count_header.split("/")[-1]) if "/" in count_header else len(data)
        return data, total


def delete(path, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}?{params}"
    req = urllib.request.Request(url, headers={**HEADERS, "Prefer": "count=exact"}, method="DELETE")
    with urllib.request.urlopen(req) as resp:
        count_header = resp.headers.get("Content-Range", "*/0")
        total = int(count_header.split("/")[-1]) if "/" in count_header else 0
        return total


# ── Core logic ────────────────────────────────────────────────────────────────

def purge_expired(tenant_id, execute=False, label=""):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    now_enc = quote(now)

    filter_params = (
        f"category=eq.event"
        f"&tenant_id=eq.{tenant_id}"
        f"&event_end_date=lt.{now_enc}"
    )

    # Preview
    rows, count = get(
        "directory_listings",
        f"{filter_params}&select=title,event_end_date&order=event_end_date.asc&limit=10"
    )

    tag = f"[{label}] " if label else ""
    print(f"{tag}Expired events found: {count}")

    if count == 0:
        print(f"{tag}Nothing to delete.")
        return 0

    # Show first 10
    for row in rows[:10]:
        end = row.get("event_end_date", "")[:10]
        title = row.get("title", "")
        print(f"  {end}  {title}")
    if count > 10:
        print(f"  ...and {count - 10} more")

    if not execute:
        print(f"{tag}DRY RUN — pass --execute to delete.")
        return 0

    deleted = delete("directory_listings", filter_params)
    print(f"{tag}Deleted {deleted} expired event(s).")
    return deleted


def get_all_tenant_ids():
    rows, _ = get("directory_tenants", "select=id,name&is_active=eq.true")
    return [(r["id"], r.get("name", r["id"])) for r in rows]


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Purge expired Space OS events.")
    parser.add_argument("--execute", action="store_true", help="Actually delete (default is dry run).")
    parser.add_argument("--all-tenants", action="store_true", help="Run across all active tenants.")
    args = parser.parse_args()

    print(f"{'[DRY RUN] ' if not args.execute else ''}Purge expired events — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print()

    if args.all_tenants:
        tenants = get_all_tenant_ids()
        total = 0
        for tid, name in tenants:
            total += purge_expired(tid, execute=args.execute, label=name)
        print(f"\nTotal deleted: {total}")
    else:
        purge_expired(DEFAULT_TENANT_ID, execute=args.execute, label="Space Rising")


if __name__ == "__main__":
    main()
