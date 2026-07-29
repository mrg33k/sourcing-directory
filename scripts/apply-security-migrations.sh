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
set -euo pipefail

cd "$(dirname "$0")/.."
HOLD="$(mktemp -d)"
PENDING=(
  20260723000000_directory_listings_grant_columns.sql
  20260723120000_directory_site_content.sql
  20260723150000_directory_reports_cover_image_url.sql
)
STAGED=(
  supabase/migrations/20260728110000_security_hardening.sql
  supabase/migrations/20260728110001_contacts_rls.sql
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

echo "==> BEFORE: rows visible to an anonymous caller"
echo "    directory_members : $(probe directory_members)   <- 0-0/70 means the leak is open"
echo ""

echo "==> Moving the 3 unrelated pending migrations aside"
for f in "${PENDING[@]}"; do
  if [ -f "supabase/migrations/$f" ]; then
    mv "supabase/migrations/$f" "$HOLD/"
    echo "    held: $f"
  fi
done

echo ""
echo "==> Staging the two security migrations"
cp migrations/028_security_and_missing_tables.sql "${STAGED[0]}"
cp migrations/029_contacts_rls.sql               "${STAGED[1]}"

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
echo "==> Applying. Answer Y at the prompt."
npx supabase db push

echo ""
echo "==> AFTER: rows visible to an anonymous caller"
AFTER="$(probe directory_members)"
echo "    directory_members : ${AFTER:-<none returned>}"
echo ""
if [ -z "${AFTER:-}" ] || echo "${AFTER}" | grep -q '/0$'; then
  echo "    ✅ LEAK CLOSED — anonymous callers can no longer read the member list."
else
  echo "    ⚠️  STILL VISIBLE (${AFTER}). Production may carry an extra permissive policy"
  echo "        under a different name than the ones 028 drops. Tell Claude this number."
fi

echo ""
echo "==> Now check sign-in still works. This is the one thing that could regress:"
echo "    open https://os.spacerising.org/login and sign in."
echo "    If sign-in breaks, tell Claude immediately — the fix is a policy adjustment,"
echo "    not a rollback."
