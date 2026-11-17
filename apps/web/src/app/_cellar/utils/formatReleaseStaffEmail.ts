export interface ReleaseStaffEmailInput {
  event: 'submitted' | 'accepted';
  amended?: boolean;
  requestNumber: string;
  member: string;
  items: {
    name: string;
    vintage: number | null;
    bottleSize: string | null;
    caseConfig: number | null;
    bottles: number | null;
  }[];
  address: string | null;
  addressLabel?: string | null;
  preferred?: string | null;
  instructions?: string | null;
  gift?: { recipientName: string | null } | null;
  memberNotes?: string | null;
  orderNumber?: string | null;
  link: string;
  submittedAt?: Date | null;
}

/**
 * A wine's name without what its own columns already say
 *
 * Stock names carry the vintage, size and strength ("… 0.75L 14% (1x) 2023"),
 * which the email shows in their own places, so each line ran to three rows.
 */
const cleanName = (name: string, vintage: number | null) =>
  name
    .replace(/\(\d+x\)/gi, '')
    .replace(/\b\d{1,2}(?:\.\d)?\s?%/g, '')
    .replace(/\b\d(?:\.\d{1,2})?\s?(?:l|cl|ml)\b/gi, '')
    .replace(/\b0\.75\b/g, '')
    .replace(vintage ? new RegExp(`\\b${vintage}\\b`, 'g') : /$^/, '')
    .replace(/\s+-\s+-\s+/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s-]+$/, '')
    .trim();

/** 750 or "750ml" or "75cl" read as "75cl"; 1500 as "150cl" */
const sizeOf = (size: string | null) => {
  if (!size) return null;
  const n = Number(size.replace(/[^\d.]/g, ''));
  if (!n) return size;
  if (/cl/i.test(size)) return `${n}cl`;
  if (/l$/i.test(size.trim()) && !/ml/i.test(size)) return `${n * 100}cl`;
  return `${n / 10}cl`;
};

/** "4 × 6" when the bottles fill whole cases, "5 btl" when they do not */
const quantityOf = (bottles: number, caseConfig: number | null) =>
  caseConfig && caseConfig > 1 && bottles % caseConfig === 0
    ? `${bottles / caseConfig} × ${caseConfig}`
    : `${bottles} btl`;

/**
 * Subject and body lines for the team's release email
 *
 * Laid out as the Releases screen reads: who and what first, the action in one
 * sentence, then the wines one per line as quantity, wine, vintage, size, then
 * where it is going and when, and the link last. Plain lines only: the Loops
 * template prints each as a paragraph and cannot take HTML.
 *
 * @example
 *   formatReleaseStaffEmail({ event: 'submitted', requestNumber: 'REL-2026-0013', ... });
 *
 * @param input - The request, its wines and its delivery
 * @returns The subject and the body, one string per line ('' for a gap)
 */
const formatReleaseStaffEmail = (input: ReleaseStaffEmailInput) => {
  const bottles = input.items.reduce((sum, item) => sum + (item.bottles ?? 0), 0);

  const [subject, action] =
    input.event === 'accepted'
      ? [
          `Accepted: ${input.requestNumber} · ${input.member} · prepare the delivery`,
          `The member has accepted the quote${input.orderNumber ? ` and ${input.orderNumber} has been raised` : ''}. Please raise the sales order and pick list, and book the delivery.`,
        ]
      : input.amended
        ? [
            `Changed: ${input.requestNumber} · ${input.member} · re-check before quoting`,
            'The member has added wine to this request. Please re-check it before the quote goes out.',
          ]
        : [
            `New release: ${input.requestNumber} · ${input.member} · ${bottles} bottles to price`,
            'Please set the prices and send the quote.',
          ];

  const delivery = [
    input.address
      ? `${input.addressLabel ? `${input.addressLabel} · ` : ''}${input.address.replace(/\s+,/g, ',')}`
      : 'No delivery address given yet',
    ...(input.preferred ? [`Preferred: ${input.preferred} (not yet confirmed)`] : []),
    ...(input.instructions?.trim() ? [`Instructions: ${input.instructions.trim()}`] : []),
    ...(input.gift ? [`Gift${input.gift.recipientName ? ` for ${input.gift.recipientName}` : ''} · ID check on delivery`] : []),
  ];

  /*
    One line per wine, its sizes side by side. When every wine shares a
    producer and vintage ("Hospice de Beaune 2023 - …"), that goes in the
    heading once instead of opening every line.
  */
  const named = input.items.map((item) => ({ ...item, clean: cleanName(item.name, item.vintage) }));
  const prefixes = new Set(named.map((item) => item.clean.split(' - ')[0]));
  const vintages = new Set(named.map((item) => item.vintage ?? 'NV'));
  const shared =
    named.length > 1 && prefixes.size === 1 && vintages.size === 1 && named.every((item) => item.clean.includes(' - '))
      ? `${[...prefixes][0]} ${[...vintages][0]}`
      : null;

  const groups = new Map<string, { label: string; parts: string[] }>();
  for (const item of named) {
    const label = shared
      ? item.clean.split(' - ').slice(1).join(' - ')
      : `${item.clean} ${item.vintage ?? 'NV'}`;
    const size = sizeOf(item.bottleSize);
    const part = `${quantityOf(item.bottles ?? 0, item.caseConfig)}${size ? ` (${size})` : ''}`;
    const group = groups.get(label) ?? { label, parts: [] };
    group.parts.push(part);
    groups.set(label, group);
  }

  const wines = `${groups.size} ${groups.size === 1 ? 'wine' : 'wines'} · ${bottles} bottles`;

  const lines = [
    `${input.requestNumber} · ${input.member}`,
    action,
    '',
    shared ? `WINES · ${shared} · ${wines}` : `WINES · ${wines}`,
    ...[...groups.values()].map((group) => `${group.label} — ${group.parts.join(', ')}`),
    '',
    'DELIVERY',
    ...delivery,
    ...(input.memberNotes?.trim() ? ['', "MEMBER'S NOTE", input.memberNotes.trim()] : []),
    '',
    input.event === 'accepted' ? 'Open the request:' : 'Price it in the Index:',
    input.link,
    ...(input.submittedAt
      ? [
          '',
          `Submitted ${input.submittedAt.toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Dubai',
          })} (Dubai)`,
        ]
      : []),
  ];

  return { subject, lines };
};

export default formatReleaseStaffEmail;
