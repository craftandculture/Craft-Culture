import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generate version file at build time
 */
const generateVersion = () => {
  try {
    // Get the most recent git tag
    const version = execSync('git describe --tags --abbrev=0', {
      encoding: 'utf-8',
      cwd: join(__dirname, '../../..'),
    }).trim();

    // Remove 'v' prefix if present
    const cleanVersion = version.startsWith('v') ? version.slice(1) : version;

    // Write to generated file
    const outputPath = join(__dirname, '../src/generated/version.ts');
    const content = `// Auto-generated file - do not edit manually
export const APP_VERSION = '${cleanVersion}';
`;

    writeFileSync(outputPath, content, 'utf-8');
    console.log(`✓ Generated version: ${cleanVersion}`);
  } catch {
    console.warn('⚠ Could not get git version, using fallback');
    // Write fallback version
    const outputPath = join(__dirname, '../src/generated/version.ts');
    const content = `// Auto-generated file - do not edit manually
export const APP_VERSION = '1.0.0';
`;
    writeFileSync(outputPath, content, 'utf-8');
  }
};

generateVersion();
