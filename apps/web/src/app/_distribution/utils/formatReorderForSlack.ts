import { LOW_COVER_DAYS, TARGET_COVER_DAYS } from './assessReorder';
import type { ReorderLine } from '../data/getOutletReorderList';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' });

/** "2 cases (12 btl)", or "3 bottles" for singles */
const orderOf = (line: ReorderLine) =>
  line.pack > 1
    ? `${plural(line.suggestCases, 'case')} (${line.suggestBottles} btl)`
    : plural(line.suggestBottles, 'bottle');

/** What C&C can do about it, in one phrase */
const supplyOf = (line: ReorderLine) => {
  const s = line.supply;
  const parts: string[] = [];
  if (s?.stock) parts.push(`✅ ${s.stock} btl at C&C`);
  if (s?.consignor) parts.push(`🤝 ${s.consignor} btl ${s.consignorName ?? 'consignor'}`);
  if (s?.inbound) {
    parts.push(`🚚 ${s.inbound} btl inbound${s.inboundEta ? ` (ETA ${shortDate(s.inboundEta)})` : ''}`);
  }
  if (parts.length > 0) return parts.join(' · ');
  if (line.alternatives.length > 0) {
    return `🔁 none of this vintage — ${line.alternatives
      .map((a) => `${a.vintage}${a.stock ? ` (${a.stock} btl)` : ' (inbound)'}`)
      .join(', ')}`;
  }
  return '🔎 not held — source';
};

/** One wine as a Slack line */
const lineOf = (line: ReorderLine) => {
  const position =
    line.status === 'oos'
      ? `0 on shelf${line.inTransit ? ` · ${line.inTransit} in transit` : ''} · sold ${line.sold30} in 30d`
      : `${line.held} left · ~${line.daysCover} days · sold ${line.sold30} in 30d`;
  return `• *${line.wine}* — ${position}\n    Order ${orderOf(line)} · ${supplyOf(line)}`;
};

/**
 * The reorder list as a Slack message for the C&C team
 *
 * Out of stock first, then low; each wine says how fast it sells, what to send
 * and whether we can — at C&C now, with a consignor, inbound with its ETA, or
 * another vintage when this one is gone. Long lists are split under Slack's
 * 3,000-character block limit.
 *
 * @param outletName - The distributor, e.g. City Drinks
 * @param takenAt - When their stock was read
 * @param lines - From getOutletReorderList
 */
const formatReorderForSlack = (
  outletName: string,
  takenAt: Date | null,
  lines: ReorderLine[],
) => {
  const oos = lines.filter((l) => l.status === 'oos');
  const low = lines.filter((l) => l.status === 'low');
  const asOf = takenAt
    ? new Date(takenAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Dubai',
      })
    : 'unknown';

  const header = `*${outletName} — reorder watch* · stock as of ${asOf} Dubai`;

  if (lines.length === 0) {
    return {
      text: `${header}\n✅ Nothing out of stock or under ${LOW_COVER_DAYS} days of cover.`,
    };
  }

  const canSupply = lines.filter(
    (l) => (l.supply?.stock ?? 0) + (l.supply?.consignor ?? 0) + (l.supply?.inbound ?? 0) > 0,
  ).length;

  const summary = `🔴 ${plural(oos.length, 'wine')} out of stock · 🟠 ${low.length} under ${LOW_COVER_DAYS} days · we can supply ${canSupply} of ${lines.length}. Orders top up to ${TARGET_COVER_DAYS} days.`;

  const sections = [
    ...(oos.length ? [`*🔴 Out of stock*`, ...oos.map(lineOf)] : []),
    ...(low.length ? [`*🟠 Running low*`, ...low.map(lineOf)] : []),
  ];

  // Slack caps a section block at 3,000 characters
  const chunks: string[] = [];
  let current = '';
  for (const part of sections) {
    if (current.length + part.length + 1 > 2800) {
      chunks.push(current);
      current = '';
    }
    current += `${current ? '\n' : ''}${part}`;
  }
  if (current) chunks.push(current);

  return {
    text: `${header}\n${summary}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `${header}\n${summary}` } },
      ...chunks.map((chunk) => ({ type: 'section', text: { type: 'mrkdwn', text: chunk } })),
    ],
  };
};

export default formatReorderForSlack;
