import type { DailyOutletSales } from './buildDailySales';

const PAGE_URL = 'https://wine.craftculture.xyz/platform/admin/daily-sales';

const money = (value: number, currency: string | null) =>
  `${currency ? `${currency} ` : ''}${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(value)}`;

const dayName = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

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

  const total = day.consigned.bottles + day.bought.bottles;
  const totalValue = day.consigned.value + day.bought.value;
  const heading = `${sales.outletName} sales — ${dayName(day.salesDate)}`;

  const summary =
    total === 0
      ? 'No sales recorded.'
      : [
          `*${total} bottles* · *${money(totalValue, sales.currency)}*`,
          `Consigned: ${day.consigned.bottles} bottles · ${money(day.consigned.value, sales.currency)}`,
          `Bought: ${day.bought.bottles} bottles · ${money(day.bought.value, sales.currency)}`,
        ].join('\n');

  const top = day.lines.slice(0, 10).map((line) => {
    const owner = line.ownerName ? ` · ${line.ownerName}` : '';
    const worth = line.value !== null ? ` · ${money(line.value, line.currency)}` : '';

    return `• ${line.sold} × ${line.productName}${owner}${worth}`;
  });

  if (day.lines.length > 10) top.push(`…and ${day.lines.length - 10} more wines`);

  const owners = new Map<string, number>();

  for (const line of day.lines) {
    const name = line.ownerName ?? 'Not linked';
    owners.set(name, (owners.get(name) ?? 0) + line.sold);
  }

  const byOwner = [...owners.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, bottles]) => `${name}: ${bottles}`)
    .join(' · ');

  const notes: string[] = [];

  if (day.spanHours > 30) {
    notes.push(`This covers ${Math.round(day.spanHours / 24)} days: a daily stock pull was missed.`);
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

  if (top.length > 0) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*What sold*\n${top.join('\n')}` } });
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `By owner — ${byOwner}` }] });
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
