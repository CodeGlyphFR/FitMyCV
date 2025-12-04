#!/bin/bash
# =============================================================================
# FitMyCV - Database Fresh Setup Script
# =============================================================================
# Usage: ./scripts/db-setup-fresh.sh [--env=dev|prod]
#
# Options:
#   --env=dev   Target development database (default)
#   --env=prod  Target production database
#
# This script sets up a fresh database with:
# 1. Prisma client generation
# 2. Migration deployment
# 3. Seed data population
# =============================================================================

set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments (default: dev)
TARGET_ENV="dev"
for arg in "$@"; do
    case $arg in
        --env=*)
            TARGET_ENV="${arg#*=}"
            shift
            ;;
    esac
done

echo "=== FitMyCV Database Setup ==="
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

# Determine which DATABASE_URL to use
if [[ "$TARGET_ENV" == "prod" ]]; then
    if [[ -z "$DATABASE_URL_PROD" ]]; then
        echo "❌ ERROR: DATABASE_URL_PROD is not set!"
        echo "   Add to .env: DATABASE_URL_PROD=\"postgresql://user:pass@host:port/fitmycv_prod\""
        exit 1
    fi
    export DATABASE_URL="$DATABASE_URL_PROD"
    DB_NAME=$(echo "$DATABASE_URL_PROD" | sed -E 's/.*\/([^?]+).*/\1/')
    echo "🔴 Target: PRODUCTION database ($DB_NAME)"
    echo ""
    echo "⚠️  WARNING: You are about to setup the PRODUCTION database!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 1
    fi
else
    if [[ -z "$DATABASE_URL_DEV" ]]; then
        echo "❌ ERROR: DATABASE_URL_DEV is not set!"
        echo "   Add to .env: DATABASE_URL_DEV=\"postgresql://user:pass@host:port/fitmycv_dev\""
        exit 1
    fi
    export DATABASE_URL="$DATABASE_URL_DEV"
    DB_NAME=$(echo "$DATABASE_URL_DEV" | sed -E 's/.*\/([^?]+).*/\1/')
    echo "🟢 Target: DEVELOPMENT database ($DB_NAME)"
fi

echo ""

# Step 1: Generate Prisma client
echo "1/3 Generating Prisma client..."
npx prisma generate
echo "    ✅ Prisma client generated"
echo ""

# Step 2: Apply migrations
echo "2/3 Applying migrations..."
npx prisma migrate deploy
echo "    ✅ Migrations applied"
echo ""

# Step 3: Seed data
echo "3/3 Seeding database..."
npx prisma db seed
echo "    ✅ Database seeded"
echo ""

echo "=== Setup complete! ==="
echo ""
echo "Database '$DB_NAME' is ready."
echo "You can now run: npm run dev"
