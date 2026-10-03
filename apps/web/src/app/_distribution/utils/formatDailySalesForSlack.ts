import type { DailyOutletSales } from './buildDailySales';
import formatSalesPeriod from './formatSalesPeriod';

const PAGE_URL = 'https://wine.craftculture.xyz/platform/admin/daily-sales';

const money = (value: number, currency: string | null) =>
  `${currency ? `${currency} ` : ''}${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(value)}`;

/**
 * The morning sales message for #cd-sales
 *
 * One day, the newest window: totals first, consigned before bought because
 * consignment is what is settled with owners, then the wines that moved and a
 * split by owner. Anything that needs a person, such as a restock we did not
 * invoice or a day a pull was missed, is said at the bottom rather than
 * buried in the numbers.
 *
 * @param sales - From `getDailyOutletSales`
 * @returns A Slack payload with plain-text fallback and blocks
 */
const formatDailySalesForSlack = (sales: DailyOutletSales) => {
  const day = sales.days[0];

  if (!day) {
    const text = `${sales.outletName}: no daily sales yet — at least two stock positions are needed.`;

    return { text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }] };
  }

  /*
    Bottles with no value are wines whose code is not linked to ours, so the
    value is unknown rather than nil. Saying USD 0 would read as a giveaway.
  */
  const worth = (bottles: number, value: number) =>
    bottles > 0 && value === 0 ? 'value not known (not linked)' : money(value, sales.currency);

  const total = day.consigned.bottles + day.bought.bottles;
  const totalValue = day.consigned.value + day.bought.value;
  const heading = `${sales.outletName} sales — ${formatSalesPeriod(day.salesDate, day.spanHours)}`;

  const summary =
    total === 0
      ? 'No sales recorded.'
      : [
          `*${total} bottles* · *${money(totalValue, sales.currency)}*`,
          `Consigned: ${day.consigned.bottles} bottles · ${worth(day.consigned.bottles, day.consigned.value)}`,
          `Bought: ${day.bought.bottles} bottles · ${worth(day.bought.bottles, day.bought.value)}`,
        ].join('\n');

  const lineText = (line: (typeof day.lines)[number]) => {
    const owner = line.ownerName ? ` · ${line.ownerName}` : '';
    const worth = line.value !== null ? ` · ${money(line.value, line.currency)}` : '';

    return `• ${line.sold} × ${line.productName}${owner}${worth}`;
  };

  /*
    Every wine, not the top ten. Slack refuses a text block over 3,000
    characters, so each list is cut into blocks under that, at line breaks.
  */
  const listBlocks = (title: string, lines: string[]) => {
    const out: unknown[] = [];
    let chunk = `*${title}*`;

    for (const line of lines) {
      if (chunk.length + line.length + 1 > 2900) {
        out.push({ type: 'section', text: { type: 'mrkdwn', text: chunk } });
        chunk = '';
      }
      chunk = chunk ? `${chunk}\n${line}` : line;
    }

    if (chunk) out.push({ type: 'section', text: { type: 'mrkdwn', text: chunk } });

    return out;
  };

  const consignedLines = day.lines.filter((line) => line.regime === 'consigned').map(lineText);
  const boughtLines = day.lines.filter((line) => line.regime === 'bought').map(lineText);

  const owners = new Map<string, number>();

  for (const line of day.lines) {
    const name = line.ownerName ?? 'Not linked';
    owners.set(name, (owners.get(name) ?? 0) + line.sold);
  }

  const TYPE_NAMES = { wine: 'Wine', sparkling: 'Sparkling', spirits: 'Spirits', rtd: 'RTD' } as const;
  const types = new Map<keyof typeof TYPE_NAMES, number>();
  for (const line of day.lines) types.set(line.category, (types.get(line.category) ?? 0) + line.sold);
  const byType = [...types.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, bottles]) => `${TYPE_NAMES[type]}: ${bottles}`)
    .join(' · ');

  // Not linked last: it is a to-do, not an owner
  const byOwner = [...owners.entries()]
    .sort((a, b) => (a[0] === 'Not linked' ? 1 : b[0] === 'Not linked' ? -1 : b[1] - a[1]))
    .map(([name, bottles]) => `${name}: ${bottles}`)
    .join(' · ');

  const notes: string[] = [];

  if (day.spanHours > 30) {
    notes.push(`This covers ${Math.round(day.spanHours / 24)} days: a daily stock pull was missed.`);
  }

  const unlinkedBottles = owners.get('Not linked') ?? 0;

  if (unlinkedBottles > 0) {
    notes.push(
      `${unlinkedBottles} bottles are wines not linked to our codes, so they show no owner or value — link them on Consignment & Distribution.`,
    );
  }

  if (day.restocks.length > 0) {
    notes.push(
      `${day.restocks.length} wine${day.restocks.length === 1 ? '' : 's'} rose by more than we delivered (restock not on our invoices).`,
    );
  }

  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: heading } },
    { type: 'section', text: { type: 'mrkdwn', text: summary } },
  ];

  if (day.lines.length > 0) {
    if (consignedLines.length > 0) {
      blocks.push(...listBlocks(`Consigned · ${consignedLines.length} wines`, consignedLines));
    }
    if (boughtLines.length > 0) {
      blocks.push(...listBlocks(`Bought · ${boughtLines.length} wines`, boughtLines));
    }
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `By owner — ${byOwner}` }] });
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `By type — ${byType}` }] });
  }

  if (notes.length > 0) {
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: notes.join('  ') }] });
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `Valued at our invoice price · <${PAGE_URL}|Open daily sales>` }],
  });

  return { text: `${heading}: ${total} bottles, ${money(totalValue, sales.currency)}`, blocks };
};

export default formatDailySalesForSlack;
