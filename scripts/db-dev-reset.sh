#!/bin/bash
# =============================================================================
# FitMyCV - Development Database Reset Script
# =============================================================================
# Usage: ./scripts/db-dev-reset.sh
#
# WARNING: This will DELETE all data in the dev database!
#
# This script resets the database with migrations and seed data.
# =============================================================================

set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== FitMyCV Dev Database Reset ==="
echo ""

# Load .env file from project root
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    echo "Loading .env from $PROJECT_ROOT/.env"
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
    echo ""
else
    echo "❌ ERROR: No .env file found at $PROJECT_ROOT/.env"
    exit 1
fi

# Validate DATABASE_URL_DEV
if [[ -z "$DATABASE_URL_DEV" ]]; then
    echo "❌ ERROR: DATABASE_URL_DEV is not set!"
    echo "   Add to .env: DATABASE_URL_DEV=\"postgresql://user:pass@host:port/fitmycv_dev\""
    exit 1
fi

# Extract database name for display
DEV_DB_NAME=$(echo "$DATABASE_URL_DEV" | sed -E 's/.*\/([^?]+).*/\1/')
echo "Target database: $DEV_DB_NAME"
echo ""

echo "⚠️  WARNING: This will DELETE all data in '$DEV_DB_NAME'!"
echo ""

# Confirmation
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""

# Export DATABASE_URL for Prisma (Prisma uses DATABASE_URL internally)
export DATABASE_URL="$DATABASE_URL_DEV"

# Reset database
echo "Resetting database (migrate reset)..."
npx prisma migrate reset --force
echo "    ✅ Database reset complete"
echo ""

echo "=== Dev database reset complete! ==="
echo ""
echo "You can now run: npm run dev"
