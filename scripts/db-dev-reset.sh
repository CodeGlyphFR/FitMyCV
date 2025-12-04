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

echo "=== FitMyCV Dev Database Reset ==="
echo ""

# Check DATABASE_URL is set
if [[ -z "$DATABASE_URL" ]]; then
    echo "⚠️  DATABASE_URL not set, using .env file"
fi

echo "⚠️  WARNING: This will DELETE all data in the dev database!"
echo ""

# Confirmation
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""

# Reset database
echo "Resetting database (migrate reset)..."
npx prisma migrate reset --force
echo "    ✅ Database reset complete"
echo ""

echo "=== Dev database reset complete! ==="
echo ""
echo "You can now run: npm run dev"
