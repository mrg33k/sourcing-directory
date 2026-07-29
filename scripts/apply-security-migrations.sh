#!/usr/bin/env bash
#
# Applies ONLY the two security migrations to the live database:
#   migrations/028_security_and_missing_tables.sql   (Part 1 only — Part 2 stays off)
#   migrations/029_contacts_rls.sql
#
# It deliberately does NOT apply the three unrelated migrations that have been
# sitting pending in this repo (directory_listings_grant_columns,
# directory_site_content, directory_reports_cover_image_url). Those are moved
# aside for the duration and put back afterwards, whatever happens.
#
# What actually changes in production:
#   - directory_members stops being readable AND insertable by anonymous callers.
#     Right now anyone can read all 70 member records (name, email, role, status)
#     and can insert a row granting themselves admin. This is the fix.
#   - Adds the report columns that migrations 014/016 declared but never applied,
#     which is why api/sourcing/admin-reports.js 500s today.
#   - Revokes anonymous SELECT on directory_analytics.
#
# What does NOT change:
#   - Part 2 of 028 (the reports paywall) is guarded off. Members-only reports
#     will keep rendering as they do today. Turning it on makes those cards
#     vanish for logged-out visitors across 7 pages until the frontend is
#     repointed, so it waits.
#
# Run from the repo root:   bash scripts/apply-security-migrations.sh
#
set -uo pipefail

cd "$(dirname "$0")/.."

# Everything this script prints also goes to a log, so it can be diagnosed even
# if the terminal output is lost. Nothing secret is ever printed.
LOG="/tmp/spaceos-migrations-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1
echo "==> log: $LOG"
echo ""
HOLD="$(mktemp -d)"
PENDING=(
  20260723000000_directory_listings_grant_columns.sql
  20260723120000_directory_site_content.sql
  20260723150000_directory_reports_cover_image_url.sql
)
# Applied in this order. 035/036 go first: they close an exposure created today
# by seeding 73 real profiles, so they are the most recent thing to have gone
# wrong and the cheapest to put right.
STAGED=(
  supabase/migrations/20260728105000_people_email_privacy.sql
  supabase/migrations/20260728105001_person_email_gate.sql
  supabase/migrations/20260728110000_security_hardening.sql
  supabase/migrations/20260728110001_contacts_rls.sql
)
SOURCES=(
  migrations/035_people_email_privacy.sql
  migrations/036_person_email_gate.sql
  migrations/028_security_and_missing_tables.sql
  migrations/029_contacts_rls.sql
)

# Always put things back, even on failure or Ctrl-C.
cleanup() {
  rm -f "${STAGED[@]}" 2>/dev/null || true
  for f in "$HOLD"/*.sql; do
    [ -e "$f" ] && mv "$f" supabase/migrations/ 2>/dev/null || true
  done
  rmdir "$HOLD" 2>/dev/null || true
}
trap cleanup EXIT

probe() {
  # Prints the anon-visible row count for a table. Never prints the key.
  local table="$1"
  local anon
  anon="$(grep -h '^VITE_SUPABASE_ANON_KEY=' .env.production | head -1 | cut -d= -f2- | tr -d '"'"'"' ')"
  curl -s -D - -o /dev/null \
    -H "apikey: $anon" -H "Authorization: Bearer $anon" \
    -H "Range: 0-0" -H "Prefer: count=exact" \
    "https://kzzvjtthknsozktmpvak.supabase.co/rest/v1/${table}?select=id" \
    2>/dev/null | grep -i 'content-range' | tr -d '\r' | awk '{print $2}'
}

email_probe() {
  # Can an anonymous caller read a member's email address? Prints yes/no only.
  local anon
  anon="$(grep -h '^VITE_SUPABASE_ANON_KEY=' .env.production | head -1 | cut -d= -f2- | tr -d '"'"'"' ')"
  curl -s -H "apikey: $anon" -H "Authorization: Bearer $anon" \
    "https://kzzvjtthknsozktmpvak.supabase.co/rest/v1/directory_people?select=email&limit=1" \
    2>/dev/null | grep -qE '"email"[[:space:]]*:[[:space:]]*"[^"]+"' && echo "YES" || echo "no"
}

echo "==> BEFORE"
echo "    member list readable by anyone : $(probe directory_members)   <- 0-0/70 means open"
echo "    member emails readable by anyone: $(email_probe)              <- YES means open"
echo ""

echo "==> Moving the 3 unrelated pending migrations aside"
for f in "${PENDING[@]}"; do
  if [ -f "supabase/migrations/$f" ]; then
    mv "supabase/migrations/$f" "$HOLD/"
    echo "    held: $f"
  fi
done

echo ""
echo "==> Staging the four migrations"
for i in "${!STAGED[@]}"; do
  cp "${SOURCES[$i]}" "${STAGED[$i]}"
  echo "    $(basename "${SOURCES[$i]}")"
done

echo ""
echo "==> Dry run — this must list EXACTLY the two staged files and nothing else"
DRY="$(npx supabase db push --dry-run 2>&1 | sed -e 's/\x1b\[[0-9;]*m//g')"
echo "$DRY" | grep -A6 'Would push' || true

if echo "$DRY" | grep -qE 'directory_site_content|directory_listings_grant_columns|directory_reports_cover_image_url'; then
  echo ""
  echo "!! ABORTING: the dry run wants to apply one of the unrelated pending migrations."
  echo "!! Nothing has been changed. Tell Claude what this printed."
  exit 1
fi

echo ""
echo "==> Applying (auto-confirming the Y prompt so this cannot stall)"
if printf 'y\n' | npx supabase db push 2>&1; then
  echo "    push command returned 0"
else
  echo "!! push command returned non-zero — see the output above and the log."
fi

echo ""
echo "==> AFTER"
AFTER="$(probe directory_members)"
AFTER_EMAIL="$(email_probe)"
echo "    member list readable by anyone  : ${AFTER:-<none returned>}"
echo "    member emails readable by anyone: ${AFTER_EMAIL}"
echo ""
if [ -z "${AFTER:-}" ] || echo "${AFTER}" | grep -q '/0$'; then
  echo "    ✅ member list closed"
else
  echo "    ⚠️  member list STILL VISIBLE (${AFTER}). Production may carry an extra"
  echo "        permissive policy under a different name than the ones 028 drops."
  echo "        Tell Claude this number."
fi
if [ "$AFTER_EMAIL" = "no" ]; then
  echo "    ✅ member emails closed"
else
  echo "    ⚠️  member emails STILL READABLE. Tell Claude — 035 did not take."
fi

echo ""
echo "==> Now check sign-in still works. This is the one thing that could regress:"
echo "    open https://os.spacerising.org/login and sign in."
echo "    If sign-in breaks, tell Claude immediately — the fix is a policy adjustment,"
echo "    not a rollback."
