#!/bin/bash
# =============================================================================
# FitMyCV - Database Fresh Setup Script
# =============================================================================
# Usage: ./scripts/db-setup-fresh.sh
#
# This script sets up a fresh database with:
# 1. Prisma client generation
# 2. Migration deployment
# 3. Seed data population
# =============================================================================

set -e

echo "=== FitMyCV Database Setup ==="
echo ""

# Check if DATABASE_URL is set
if [[ -z "$DATABASE_URL" ]]; then
    echo "⚠️  WARNING: DATABASE_URL not set, using .env file"
fi

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
echo "You can now run: npm run dev"
