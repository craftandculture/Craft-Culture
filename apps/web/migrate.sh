#!/bin/bash

# Simple script to run database migrations
# This ensures you're in the right directory and have clear output

echo "🔄 Running database migration..."
echo ""

# Check if DB_URL is set
if [ -z "$DB_URL" ]; then
    echo "❌ Error: DB_URL environment variable is not set"
    echo ""
    echo "Please set your database connection string:"
    echo "  export DB_URL='your-neon-database-url'"
    echo ""
    echo "Or create a .env file in apps/web/ with:"
    echo "  DB_URL=your-neon-database-url"
    echo ""
    exit 1
fi

# Run the migration
pnpm drizzle-kit push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Test saving a quote - should work now"
    echo "  2. Create Loops email templates"
    echo "  3. Test the complete workflow"
else
    echo ""
    echo "❌ Migration failed. Please check the error above."
    exit 1
fi
