#!/bin/bash
# =============================================================================
# FitMyCV - Production to Development Database Sync Script
# =============================================================================
# Usage: ./scripts/db-sync-prod-to-dev.sh
#
# WARNING: This will COMPLETELY REPLACE all data in the dev database!
#
# Prerequisites:
# - .env file at project root with DATABASE_URL_PROD and DATABASE_URL_DEV
# - pg_dump and psql installed
# =============================================================================

set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== FitMyCV Prod → Dev Database Sync ==="
echo ""

# Load .env file from project root
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    echo "Loading .env from $PROJECT_ROOT/.env"
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
    echo ""
else
    echo "⚠️  No .env file found at $PROJECT_ROOT/.env"
    echo ""
fi

# Step 1: Validate environment variables
echo "1/4 Validating environment..."

if [[ -z "$DATABASE_URL_PROD" ]]; then
    echo "❌ ERROR: DATABASE_URL_PROD is not set!"
    echo "   Add to .env: DATABASE_URL_PROD=\"postgresql://user:pass@host:port/fitmycv_prod\""
    exit 1
fi

if [[ -z "$DATABASE_URL_DEV" ]]; then
    echo "❌ ERROR: DATABASE_URL_DEV is not set!"
    echo "   Add to .env: DATABASE_URL_DEV=\"postgresql://user:pass@host:port/fitmycv_dev\""
    exit 1
fi

# Check pg_dump and psql are available
if ! command -v pg_dump &> /dev/null; then
    echo "❌ ERROR: pg_dump not found!"
    echo "   Install PostgreSQL client tools."
    exit 1
fi

echo "    ✅ Environment validated"
echo ""

# Remove query parameters from URLs (pg_dump doesn't support ?schema=public)
PROD_URL=$(echo "$DATABASE_URL_PROD" | sed -E 's/\?.*//')
DEV_URL=$(echo "$DATABASE_URL_DEV" | sed -E 's/\?.*//')

# Extract database names for display
PROD_DB_NAME=$(echo "$PROD_URL" | sed -E 's/.*\/([^?]+).*/\1/')
DEV_DB_NAME=$(echo "$DEV_URL" | sed -E 's/.*\/([^?]+).*/\1/')

echo "    Source (prod): $PROD_DB_NAME"
echo "    Target (dev):  $DEV_DB_NAME"
echo ""

# Step 2: Warning and confirmation
echo "⚠️  WARNING: This will COMPLETELY REPLACE all data in '$DEV_DB_NAME'!"
echo "   All existing data in the dev database will be LOST."
echo ""

read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""

# Step 3: Export from production
echo "2/4 Exporting production database..."
DUMP_FILE="/tmp/fitmycv_prod_dump_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$PROD_URL" --no-owner --no-acl --clean --if-exists > "$DUMP_FILE"
echo "    ✅ Export complete: $DUMP_FILE"
echo "    Size: $(du -h "$DUMP_FILE" | cut -f1)"
echo ""

# Step 4: Import into dev
echo "3/4 Importing into development database..."
psql "$DEV_URL" < "$DUMP_FILE"
echo "    ✅ Import complete"
echo ""

# Step 5: Cleanup
echo "4/4 Cleaning up..."
rm -f "$DUMP_FILE"
echo "    ✅ Temporary dump file removed"
echo ""

echo "=== Sync complete! ==="
echo ""
echo "Development database '$DEV_DB_NAME' now mirrors production '$PROD_DB_NAME'"
echo ""
echo "You can now run: npm run dev"
