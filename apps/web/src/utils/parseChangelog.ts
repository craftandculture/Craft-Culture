import fs from 'fs';
import path from 'path';

export interface ChangelogEntry {
  type: 'feature' | 'fix' | 'other';
  description: string;
}

export interface ChangelogVersion {
  version: string;
  date: string;
  entries: ChangelogEntry[];
}

/**
 * Parse the CHANGELOG.md file and extract version history
 *
 * @example
 *   const versions = parseChangelog();
 *   console.log(versions[0].version); // "1.0.0"
 *
 * @returns Array of parsed changelog versions
 */
const parseChangelog = (): ChangelogVersion[] => {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    console.error('CHANGELOG.md not found at:', changelogPath);
    return [];
  }

  const content = fs.readFileSync(changelogPath, 'utf-8');
  const lines = content.split('\n');
  const versions: ChangelogVersion[] = [];

  let currentVersion: ChangelogVersion | null = null;
  let currentSection: 'feature' | 'fix' | 'other' = 'other';

  for (const line of lines) {
    // Match version header: # 1.0.0 (2025-10-25)
    const versionMatch = line.match(/^#\s+([\d.]+)\s+\((\d{4}-\d{2}-\d{2})\)/);
    if (versionMatch) {
      if (currentVersion) {
        versions.push(currentVersion);
      }
      currentVersion = {
        version: versionMatch[1] ?? '',
        date: versionMatch[2] ?? '',
        entries: [],
      };
      continue;
    }

    // Match section headers
    if (line.startsWith('### Features')) {
      currentSection = 'feature';
      continue;
    }
    if (line.startsWith('### Bug Fixes')) {
      currentSection = 'fix';
      continue;
    }

    // Match list items: * description ([commit](url))
    if (line.startsWith('* ') && currentVersion) {
      // Remove the markdown link part ([commit](url))
      const description = line
        .substring(2)
        .replace(/\s*\(\[[a-f0-9]+\]\(.*?\)\)\s*$/, '')
        .trim();

      if (description) {
        currentVersion.entries.push({
          type: currentSection,
          description,
        });
      }
    }
  }

  // Push the last version
  if (currentVersion) {
    versions.push(currentVersion);
  }

  return versions;
};

export default parseChangelog;
