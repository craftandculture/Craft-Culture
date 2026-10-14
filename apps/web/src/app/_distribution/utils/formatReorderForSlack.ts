import { LOW_COVER_DAYS, TARGET_COVER_DAYS } from './assessReorder';
import type { ReorderLine } from '../data/getOutletReorderList';


const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' });

/** How many of a not-held owner's wines to name before "+N more" */
const NOT_HELD_NAMED = 6;

/** "2 cs", or "3 btl" for singles */
const orderOf = (line: ReorderLine) =>
  line.pack > 1 ? `${line.suggestCases} cs` : `${line.suggestBottles} btl`;

/** Whether anything can be sent: stock, consignor stock, inbound or another vintage */
const canAct = (line: ReorderLine) =>
  (line.supply?.stock ?? 0) + (line.supply?.consignor ?? 0) + (line.supply?.inbound ?? 0) > 0 ||
  line.alternatives.length > 0;

/** What can be sent, in one phrase */
const supplyOf = (line: ReorderLine) => {
  const s = line.supply;
  const parts: string[] = [];
  if (s?.stock) parts.push(`✅ ${s.stock} btl at C&C`);
  if (s?.consignor) parts.push(`🤝 ${s.consignor} btl ${s.consignorName ?? 'consignor'} at C&C`);
  if (s?.inbound) {
    parts.push(`🚚 ${s.inbound} inbound${s.inboundEta ? ` (${shortDate(s.inboundEta)})` : ''}`);
  }
  if (parts.length > 0) return parts.join(' · ');
  return `🔁 other vintage: ${line.alternatives
    .map((a) => `${a.vintage}${a.stock ? ` (${a.stock} btl)` : ' (inbound)'}`)
    .join(', ')}`;
};

/** One wine that can be acted on */
const lineOf = (line: ReorderLine) => {
  const position =
    line.status === 'oos'
      ? `0 on shelf${line.inTransit ? ` (${line.inTransit} in transit)` : ''}`
      : `${line.held} left, ~${line.daysCover}d`;
  return `${line.status === 'oos' ? '🔴' : '🟠'} *${line.wine}* — ${position} · sold ${line.sold30}/30d → ${orderOf(line)} · ${supplyOf(line)}`;
};

/**
 * The reorder watch as a Slack message, grouped by who has to act
 *
 * C&C first — our wine, and anything they bought from us outright — then each
 * consignor, whose wine it is to send. Within an owner, the wines that can be
 * sent now (held, inbound, or another vintage) are listed; the ones nobody
 * holds fold into one line of sourcing ideas, best sellers first, so dead
 * lines do not bury the actionable ones.
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

  const header = `*${outletName} — reorder watch* · stock as of ${asOf} Dubai`;

  if (lines.length === 0) {
    return { text: `${header}\n✅ Nothing out of stock or under ${LOW_COVER_DAYS} days of cover.` };
  }

  const oos = lines.filter((l) => l.status === 'oos').length;
  const actionable = lines.filter(canAct).length;
  const summary = `🔴 ${oos} out · 🟠 ${lines.length - oos} low (under ${LOW_COVER_DAYS} days) · ${actionable} can be sent now. Orders top up to ${TARGET_COVER_DAYS} days.`;

  const owners = [...new Set(lines.map((l) => l.owner))].sort((a, b) =>
    a === 'C&C' ? -1 : b === 'C&C' ? 1 : a.localeCompare(b),
  );

  const sections = owners.map((owner) => {
    const mine = lines.filter((l) => l.owner === owner);
    const act = mine.filter(canAct);
    const notHeld = mine
      .filter((l) => !canAct(l))
      .sort((a, b) => b.sold30 - a.sold30);

    const who = owner === 'C&C' ? 'C&C — we act' : `${owner.toUpperCase()} — prompt ${owner}`;
    const parts = [`*${who}*`];
    if (act.length) parts.push(...act.map(lineOf));
    if (notHeld.length) {
      const named = notHeld
        .slice(0, NOT_HELD_NAMED)
        .map((l) => `${l.wine} (${l.sold30}/30d)`)
        .join(', ');
      const more = notHeld.length > NOT_HELD_NAMED ? ` +${notHeld.length - NOT_HELD_NAMED} more` : '';
      parts.push(`🔎 _Not held by anyone — source if wanted (${notHeld.length}):_ ${named}${more}`);
    }
    return parts.join('\n');
  });

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
