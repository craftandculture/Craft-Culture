import escapeSlackText from '@/lib/slack/escapeSlackText';

import shortDate from './shortDate';

/** Who decides; a job waiting on one of them is a decision, not a blocker */
export const DECISION_MAKERS = ['kevin', 'sophie'];

export interface EndOfDayInput {
  today: string;
  nextDay: string;
  closed: { title: string }[];
  opened: number;
  partsTicked: number;
  waiting: { title: string; waitingOn: string }[];
  overdue: { title: string; what: string; due: string; owner: string }[];
  dueNext: { title: string; what: string; owner: string }[];
  appUrl: string;
}

const LIMIT = 10;

/** Bullets for a section, cut at ten with a count of the rest */
const bullets = (lines: string[]) =>
  [...lines.slice(0, LIMIT), ...(lines.length > LIMIT ? [`…and ${lines.length - LIMIT} more`] : [])]
    .map((l) => (l.startsWith('…') ? l : `• ${l}`))
    .join('\n');

const isDecision = (waitingOn: string) =>
  DECISION_MAKERS.some((name) => new RegExp(`\\b${name}\\b`, 'i').test(waitingOn));

/**
 * The end-of-day report for #tasks, from Team Tasks alone
 *
 * Completed is the jobs closed today; decisions are jobs waiting on Kevin or
 * Sophie, and blocked is every other job waiting on someone. Empty sections are
 * left out, so a quiet day reads as a short post.
 *
 * @example
 *   buildEndOfDayReport({ today: '2026-10-19', nextDay: '2026-10-20', closed: [], ... });
 */
const buildEndOfDayReport = (input: EndOfDayInput) => {
  const t = (s: string) => escapeSlackText(s);
  const decisions = input.waiting.filter((w) => isDecision(w.waitingOn));
  const blocked = input.waiting.filter((w) => !isDecision(w.waitingOn));
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const sections: [string, string[]][] = [
    [`*Completed* (${input.closed.length})`, input.closed.map((c) => t(c.title))],
    [`*Decision needed* (${decisions.length})`, decisions.map((d) => `${t(d.title)}: waiting on ${t(d.waitingOn)}`)],
    [`*Blocked* (${blocked.length})`, blocked.map((b) => `${t(b.title)}: waiting on ${t(b.waitingOn)}`)],
    [`*Overdue* (${input.overdue.length})`, input.overdue.map((o) => `*${t(o.owner)}* · ${t(o.title)}: ${t(o.what)} (due ${shortDate(o.due)})`)],
    [`*Due ${shortDate(input.nextDay)}* (${input.dueNext.length})`, input.dueNext.map((d) => `*${t(d.owner)}* · ${t(d.title)}: ${t(d.what)}`)],
  ];

  return [
    `*End of day · ${shortDate(input.today)}*`,
    `${plural(input.closed.length, 'job')} closed · ${plural(input.partsTicked, 'step')} ticked · ${plural(input.opened, 'new job')}`,
    ...sections.filter(([, lines]) => lines.length > 0).map(([heading, lines]) => `${heading}\n${bullets(lines)}`),
    `<${input.appUrl}/platform/admin/tasks|Open Team Tasks>`,
  ].join('\n\n');
};

/** The next working day in the UAE (Monday to Friday) after a date */
export const nextWorkingDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
};

export default buildEndOfDayReport;
