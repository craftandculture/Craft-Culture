import { execSync } from 'child_process';

/**
 * Prebuild script that safely handles database migrations
 *
 * - Always generates version file
 * - Only runs migrations if DB_URL is available
 * - Prevents build failures due to missing database credentials
 */
const prebuild = () => {
  try {
    // Step 1: Generate version file
    console.log('→ Generating version file...');
    execSync('node scripts/generate-version.mjs', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    // Step 2: Run migrations if DB_URL is available
    if (process.env.DB_URL) {
      console.log('→ Running database migrations...');
      try {
        execSync('drizzle-kit push', {
          stdio: 'inherit',
          cwd: process.cwd(),
        });
        console.log('✓ Migrations completed successfully');
      } catch (error) {
        console.error('✗ Migration failed:', error.message);
        // Don't fail the build if migrations fail
        // This allows the build to continue even if DB is temporarily unavailable
        console.warn('⚠ Continuing build without migrations');
      }
    } else {
      console.log('⊘ Skipping migrations (DB_URL not configured)');
    }

    console.log('✓ Prebuild completed successfully');
  } catch (error) {
    console.error('✗ Prebuild failed:', error.message);
    process.exit(1);
  }
};

prebuild();
