import escapeSlackText from '@/lib/slack/escapeSlackText';

import { LOW_COVER_DAYS } from './assessReorder';
import canSendReorderLine from './canSendReorderLine';
import type { ReorderLine } from '../data/getOutletReorderList';

/** Every wine, not just the first few — linked from the post */
const FULL_LIST_URL = 'https://wine.craftculture.xyz/platform/admin/reorder-watch';

/** How many wines the To source section names before "+N more" */
const SOURCE_NAMED = 15;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' });

/** "1 cs of 6", or "2 btl" when a case would outlast two months of sales */
const orderOf = (line: ReorderLine) =>
  line.unit === 'case'
    ? `${line.suggestCases} cs of ${line.pack}`
    : `${line.suggestBottles} btl`;

/** What can be sent, in one phrase */
const supplyOf = (line: ReorderLine) => {
  const s = line.supply;
  const parts: string[] = [];
  if (s?.stock) parts.push(`✅ ${s.stock} at C&C`);
  if (s?.consignor) parts.push(`🤝 ${s.consignor} ${escapeSlackText(s.consignorName ?? 'consignor')} at C&amp;C`);
  if (s?.inbound) {
    parts.push(`🚚 ${s.inbound} inbound${s.inboundEta ? ` ${shortDate(s.inboundEta)}` : ''}`);
  }
  if (parts.length > 0) {
    // Less than the order can be filled from what is held and coming
    const partial =
      line.available < line.suggestBottles ? ` · ⚠️ only ${line.available} of ${line.suggestBottles}` : '';
    return `${parts.join(' · ')}${partial}`;
  }
  // Another vintage is a substitution City Drinks has to agree to
  return `🔁 ${line.alternatives
    .map((a) => `${a.vintage} (${a.stock ? `${a.stock} btl` : 'inbound'})`)
    .join(', ')} — confirm vintage`;
};

/** One wine to send: sales, shelf, what to send, from where */
const sendLineOf = (line: ReorderLine) => {
  const shelf =
    line.status === 'oos'
      ? `0 left${line.inTransit ? ` (${line.inTransit} coming)` : ''}`
      : `${line.held} left (~${line.daysCover}d)`;
  return `${line.status === 'oos' ? '🔴' : '🟠'} *${escapeSlackText(line.wine)}* · ${line.sold30}/30d · ${shelf} → ${orderOf(line)} · ${supplyOf(line)}`;
};

/** One wine nobody holds, or a one-off */
const sourceLineOf = (line: ReorderLine) =>
  line.status === 'oneoff'
    ? `• ${escapeSlackText(line.wine)} · ${line.sold90}/90d · one-off · ${escapeSlackText(line.owner)}`
    : `• *${escapeSlackText(line.wine)}* · ${line.sold30}/30d · ${line.held ? `${line.held} left` : 'out'} · ${escapeSlackText(line.owner)}`;

/**
 * The reorder watch as a Slack message, grouped by who has to act
 *
 * Each owner — C&C first, then each consignor — lists only the wines that can
 * be sent now: held at C&C, the consignor's stock at C&C, inbound, or a vintage
 * within three years. Everything else goes to one To source section at the
 * end: wines selling now that nobody holds, best sellers first, then one-offs
 * (library bottles and single parcels that sold this quarter but not this
 * month). One line per wine, the action first, so it reads on a phone.
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
  const asOf = takenAt
    ? new Date(takenAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Dubai',
      })
    : 'unknown';

  const header = `*${escapeSlackText(outletName)} — reorder watch* · stock as of ${asOf}`;

  const toSend = lines.filter(canSendReorderLine);
  const toSource = lines.filter((l) => !canSendReorderLine(l));

  if (toSend.length === 0 && toSource.length === 0) {
    return { text: `${header}\n✅ Nothing out of stock or under ${LOW_COVER_DAYS} days of cover.` };
  }

  const summary = `📦 *${toSend.length} to send* · 🔎 ${toSource.length} to source · 🔴 out · 🟠 under ${LOW_COVER_DAYS} days · <${FULL_LIST_URL}|full list>`;

  const owners = [...new Set(toSend.map((l) => l.owner))].sort((a, b) =>
    a === 'C&C' ? -1 : b === 'C&C' ? 1 : a.localeCompare(b),
  );

  const sections = owners.map((owner) =>
    [
      `*${owner === 'C&C' ? 'C&amp;C — we send' : `${escapeSlackText(owner)} — prompt ${escapeSlackText(owner)}`}*`,
      ...toSend.filter((l) => l.owner === owner).map(sendLineOf),
    ].join('\n'),
  );

  if (toSource.length > 0) {
    const named = toSource.slice(0, SOURCE_NAMED).map(sourceLineOf);
    const more = toSource.length - named.length;
    sections.push(
      [
        `*🔎 To source* — selling but nobody holds it, then one-offs`,
        ...named,
        ...(more > 0 ? [`_+${more} more, slower — <${FULL_LIST_URL}|see the full list>_`] : []),
      ].join('\n'),
    );
  }

  // Slack caps a section block at 3,000 characters
  const blocks: { type: 'section'; text: { type: 'mrkdwn'; text: string } }[] = [
    { type: 'section', text: { type: 'mrkdwn', text: `${header}\n${summary}` } },
  ];
  for (const section of sections) {
    let current = '';
    for (const row of section.split('\n')) {
      if (current.length + row.length + 1 > 2800) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: current } });
        current = '';
      }
      current += `${current ? '\n' : ''}${row}`;
    }
    if (current) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: current } });
  }

  return { text: `${header}\n${summary}`, blocks };
};

export default formatReorderForSlack;
