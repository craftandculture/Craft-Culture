# Database Migration Steps for Quotes Table

## Quick Fix

Run these commands from your terminal (make sure you're in the `apps/web` directory):

```bash
cd apps/web

# Generate the migration
pnpm drizzle-kit generate

# Push the migration to the database
pnpm drizzle-kit push
```

## What These Commands Do

1. **`drizzle-kit generate`** - Creates a SQL migration file based on the schema changes
2. **`drizzle-kit push`** - Applies the migration to your database

## Expected Output

You should see:
- Migration file created in `src/database/migrations/`
- Success message: "Everything is up to date"
- The `quotes` table will now exist in your database

## After Running

1. Try saving a quote again - it should work now!
2. You can delete this file after the migration succeeds

## Troubleshooting

If you get environment variable errors:
- Make sure your `.env` file has `DB_URL` set
- Make sure you're in the `apps/web` directory
- Check that your `.env` file is being loaded properly
