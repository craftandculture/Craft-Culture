'use server';

import getCurrentUser from '@/app/_auth/data/getCurrentUser';
import isStaff from '@/app/_distribution/utils/isStaff';
import { MIN_MARGIN, MIN_SCORE } from '@/app/_logistics/constants/lwinMatching';
import askWinelabsForLine from '@/app/_logistics/data/askWinelabsForLine';
import searchRegister from '@/app/_logistics/data/searchRegister';
import decideLwinMatch from '@/app/_logistics/utils/decideLwinMatch';
import parseWineName from '@/app/_logistics/utils/parseWineName';

export interface SheetLine {
  /** The wine as the sheet wrote it */
  name: string;
  producer: string | null;
  vintage: string | null;
}

export interface SheetLineMatch {
  /** auto by Wine Labs, auto by the register, a suggestion to check, or nothing found */
  status: 'winelabs' | 'register' | 'check' | 'none';
  lwin7: string | null;
  wine: string | null;
  producer: string | null;
  region: string | null;
  country: string | null;
  /** Wine Labs' answer when it was not taken: a person decides */
  suggestion: { lwin7: string; name: string } | null;
  vintage: number | null;
  bottleSizeMl: number | null;
}

/** Lines a call takes, and how many are asked at once: about 10 seconds a call */
const MAX_LINES = 12;
const AT_ONCE = 4;

/**
 * Match one sheet line: Wine Labs first, our register behind it, by the same
 * rules as inbound shipments (decideLwinMatch)
 */
const matchLine = async (line: SheetLine): Promise<SheetLineMatch> => {
  const parsed = parseWineName(line.name);
  const yearInColumn = /\b(19|20)\d{2}\b/.exec(line.vintage ?? '')?.[0];
  const vintage = parsed.vintage ?? (yearInColumn ? Number(yearInColumn) : null);
  const empty = {
    lwin7: null,
    wine: null,
    producer: null,
    region: null,
    country: null,
    suggestion: null,
    vintage,
    bottleSizeMl: parsed.bottleSizeMl,
  };
  if (parsed.searchName.length < 3) return { status: 'none', ...empty };

  const producer = line.producer?.trim() ?? '';
  const withProducer =
    producer && !parsed.searchName.toLowerCase().includes(producer.toLowerCase())
      ? `${producer} ${parsed.searchName}`
      : parsed.searchName;

  const [candidates, winelabs] = await Promise.all([
    searchRegister(parsed.searchName, withProducer, Boolean(producer)),
    askWinelabsForLine(withProducer, line.name, vintage),
  ]);
  const best = candidates[0];
  const score = Number(best?.score ?? 0);
  const margin = score - Number(candidates[1]?.score ?? 0);
  const registerLwin7 = best && score >= MIN_SCORE && margin >= MIN_MARGIN ? best.lwin : null;

  const winelabsAnswer = winelabs?.name
    ? {
        lwin7: winelabs.lwin7,
        fit: winelabs.fit,
        // The register leaves some producers blank; its name then starts with one
        producer: winelabs.record?.producerName || winelabs.name.split(',')[0]?.trim() || null,
      }
    : null;
  const decision = decideLwinMatch(`${withProducer} ${line.name}`, winelabsAnswer, registerLwin7);

  if (!decision) {
    return winelabs
      ? { status: 'check', ...empty, suggestion: { lwin7: winelabs.lwin7, name: winelabs.name } }
      : { status: 'none', ...empty };
  }

  const record = decision.source === 'winelabs' ? winelabs?.record : candidates.find((c) => c.lwin === decision.lwin7);
  return {
    status: decision.source,
    ...empty,
    lwin7: decision.lwin7,
    wine: record?.displayName ?? winelabs?.name ?? null,
    producer: [record?.producerTitle, record?.producerName].filter(Boolean).join(' ') || null,
    region: [record?.region, record?.subRegion].filter(Boolean).join(', ') || null,
    country: record?.country ?? null,
  };
};

/**
 * Find the LWIN for lines read from a spreadsheet
 *
 * Wine Labs is asked first and our LWIN register stands behind it, under the
 * rules inbound shipments use: an answer is taken only when it reads as the
 * line and names its producer; otherwise Wine Labs' answer comes back as a
 * suggestion for a person to check. Nothing is written. About 8 credits a
 * line. The browser sends the sheet a few lines at a time, so each call stays
 * well inside the time limit.
 *
 * @param lines - Up to 12 lines
 * @returns One match per line, in order, and the error that stopped Wine Labs, if any
 */
const matchSheetLines = async (lines: SheetLine[]) => {
  const user = await getCurrentUser();
  if (!isStaff(user)) return { matches: [] as SheetLineMatch[], error: 'C&C staff only.' };

  const batch = lines.slice(0, MAX_LINES);
  const matches: SheetLineMatch[] = [];
  try {
    for (let i = 0; i < batch.length; i += AT_ONCE) {
      matches.push(...(await Promise.all(batch.slice(i, i + AT_ONCE).map(matchLine))));
    }
  } catch (error) {
    return { matches, error: error instanceof Error ? error.message : 'Wine Labs did not answer' };
  }
  return { matches, error: null as string | null };
};

export default matchSheetLines;
