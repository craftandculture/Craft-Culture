import type { ChangelogEntry, ChangelogVersion } from './parseChangelog';

export interface ChangelogDayEntry extends ChangelogEntry {
  version: string;
  scope: string | null;
}

export interface ChangelogDay {
  date: string;
  firstVersion: string;
  lastVersion: string;
  releaseCount: number;
  entries: ChangelogDayEntry[];
}

/**
 * Roll releases up into one group per day, newest first
 *
 * Every merged commit cuts its own release, so a busy day can hold dozens of
 * single-change versions. Grouping by day keeps the log readable.
 *
 * @example
 *   const days = groupChangelogByDay(parseChangelog());
 *   days[0].entries.length; // every change shipped on the latest day
 *
 * @param versions - Parsed changelog versions, newest first
 * @returns One group per date, newest first, entries newest first
 */
const groupChangelogByDay = (versions: ChangelogVersion[]) => {
  const days: ChangelogDay[] = [];

  for (const version of versions) {
    let day = days[days.length - 1];
    if (!day || day.date !== version.date) {
      day = {
        date: version.date,
        firstVersion: version.version,
        lastVersion: version.version,
        releaseCount: 0,
        entries: [],
      };
      days.push(day);
    }

    day.firstVersion = version.version;
    day.releaseCount += 1;

    for (const entry of version.entries) {
      if (entry.type === 'other') continue;
      const scopeMatch = entry.description.match(/^\*\*(.+?):\*\*\s*/);
      const text = scopeMatch ? entry.description.slice(scopeMatch[0].length) : entry.description;
      day.entries.push({
        ...entry,
        description: text.charAt(0).toUpperCase() + text.slice(1),
        scope: scopeMatch?.[1] ?? null,
        version: version.version,
      });
    }
  }

  return days;
};

export default groupChangelogByDay;
