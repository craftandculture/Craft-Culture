import { execSync } from 'child_process';

/**
 * Get the current application version from git tags
 *
 * @returns The current version string (e.g., "1.31.2") or "0.0.0" if no tags exist
 */
const getAppVersion = () => {
  try {
    // Get the most recent git tag
    const version = execSync('git describe --tags --abbrev=0', {
      encoding: 'utf-8',
      cwd: process.cwd(),
    }).trim();

    // Remove 'v' prefix if present
    return version.startsWith('v') ? version.slice(1) : version;
  } catch {
    // Fallback if git tags don't exist or git is not available
    return '0.0.0';
  }
};

export default getAppVersion;
