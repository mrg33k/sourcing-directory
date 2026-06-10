"""
Seed deal_bank_investors from INveostrs SR.csv
Loads 116 investor records directly into the DB with status='approved'
so they're visible on spacerising.org when the Investors tab is clicked.

Run from sourcing-directory root:
  python3 scripts/seed-investors-from-csv.py
"""

import csv, json, os, re, sys
import urllib.request

CSV_PATH = "/Users/aom-inhouse/Documents/Corner/files/shared:space-rising/projects/space-rising/Uploads/INveostrs SR.csv"
SUPABASE_URL = "https://kzzvjtthknsozktmpvak.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6enZqdHRoa25zb3prdG1wdmFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY3NDAxMSwiZXhwIjoyMDkxMjUwMDExfQ.yGfEFCLjqn_NtDbELcevG6CGdSSUGHQOkuDb_D3HfvQ"

INVESTOR_TYPE_MAP = {
    "VC_PARTNERS":  "VC",
    "ANGELS":       "Angel",
    "FAMILY_OFFICE":"Family Office",
    "PE":           "PE",
    "ACCELERATOR":  "Accelerator",
    "CVC":          "CVC",
}


def extract_social(links_str, prefix):
    """Pull a URL from a semicolon-separated 'KEY:url' string."""
    if not links_str:
        return None
    for part in links_str.split(";"):
        part = part.strip()
        if part.upper().startswith(prefix.upper() + ":"):
            return part[len(prefix) + 1:].strip()
    return None


def parse_row(row):
    investor_type = row.get("investorType", "").strip()
    deal_type = INVESTOR_TYPE_MAP.get(investor_type, investor_type.replace("_", " ").title()) if investor_type else None

    stages = [s.strip() for s in row.get("investmentStages", "").split(";") if s.strip()]
    stage_str = ", ".join(stages) if stages else ""

    description = row.get("investorDescription", "").strip()
    criteria = description
    if stage_str:
        criteria = f"{description}\n\nStages: {stage_str}" if description else f"Stages: {stage_str}"

    social_links = row.get("socialLinks", "")
    linkedin = extract_social(social_links, "LINKEDIN")
    website  = extract_social(social_links, "WEBSITE")

    try:
        check_min = int(float(row.get("investorMinInvestment", "0") or 0))
    except (ValueError, TypeError):
        check_min = None

    try:
        check_max = int(float(row.get("investorMaxInvestment", "0") or 0))
    except (ValueError, TypeError):
        check_max = None

    return {
        "firm_name":              row.get("investorName", "").strip(),
        "website":                website,
        "criteria":               criteria or None,
        "check_size_min":         check_min,
        "check_size_max":         check_max,
        "deal_types":             [deal_type] if deal_type else [],
        "linkedin_url":           linkedin,
        "contact_email_internal": row.get("investorEmail", "").strip() or None,
        "status":                 "approved",
    }


def upsert_batch(records):
    """POST to Supabase REST upsert endpoint (ignores duplicates on firm_name)."""
    url = f"{SUPABASE_URL}/rest/v1/deal_bank_investors"
    payload = json.dumps(records).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "apikey":        SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type":  "application/json",
            "Prefer":        "resolution=ignore-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    print(f"Reading CSV: {CSV_PATH}")
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [r for r in reader if r.get("investorName", "").strip()]

    print(f"Found {len(rows)} investor rows")

    records = [parse_row(r) for r in rows]

    # Insert in batches of 25
    BATCH = 25
    inserted = 0
    for i in range(0, len(records), BATCH):
        batch = records[i:i + BATCH]
        status, err = upsert_batch(batch)
        if status in (200, 201):
            inserted += len(batch)
            print(f"  ✅ Batch {i//BATCH + 1}: {len(batch)} rows (total {inserted})")
        else:
            print(f"  ❌ Batch {i//BATCH + 1} failed (HTTP {status}): {err}")
            sys.exit(1)

    print(f"\n✅ Done — {inserted} investors loaded into deal_bank_investors (status=approved)")
    print(f"   Visible at: https://spacerising.org  → Deal Bank → Investors tab")


if __name__ == "__main__":
    main()
