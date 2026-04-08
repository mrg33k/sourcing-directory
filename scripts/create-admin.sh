#!/bin/bash
# Create Patrik's admin account for the sourcing directory.
#
# Usage:
#   SETUP_SECRET=your-secret BASE_URL=https://sourcing.directory ./scripts/create-admin.sh
#
# Or locally (dev server must be running on port 3000):
#   SETUP_SECRET=your-secret ./scripts/create-admin.sh
#
# Required env vars:
#   SETUP_SECRET   - must match SETUP_SECRET set in Vercel/server env
#   BASE_URL       - production URL (defaults to http://localhost:3000)
#
# The SETUP_SECRET and SUPABASE_SERVICE_ROLE_KEY must be set in your Vercel project
# environment before running this against production.

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
EMAIL="${ADMIN_EMAIL:-patrik@aom.com}"
PASSWORD="${ADMIN_PASSWORD:-}"
FULL_NAME="${ADMIN_FULL_NAME:-Patrik}"

if [ -z "$SETUP_SECRET" ]; then
  echo "Error: SETUP_SECRET env var is required"
  echo "Set it in Vercel env vars and export it locally before running."
  exit 1
fi

if [ -z "$PASSWORD" ]; then
  echo "Error: ADMIN_PASSWORD env var is required"
  echo "Example: ADMIN_PASSWORD=yourpassword SETUP_SECRET=secret ./scripts/create-admin.sh"
  exit 1
fi

echo "Creating admin account for: $EMAIL"
echo "Target: $BASE_URL/api/sourcing/admin-setup"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-setup-secret: $SETUP_SECRET" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"full_name\": \"$FULL_NAME\"}" \
  "$BASE_URL/api/sourcing/admin-setup")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "Response ($HTTP_CODE):"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" = "200" ]; then
  echo ""
  echo "Admin account ready. Log in at: $BASE_URL/admin"
else
  echo ""
  echo "Setup failed with HTTP $HTTP_CODE"
  exit 1
fi
