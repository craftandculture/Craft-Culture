export type QuickDue = 'today' | 'tomorrow' | 'friday' | 'nextWeek';

/**
 * The date behind each quick-pick button on the job form
 *
 * Friday is this week's Friday (the next one from Saturday on). Next week is
 * the coming Monday.
 *
 * @param pick - Which button
 * @param today - Today in Dubai, YYYY-MM-DD
 * @returns The due date, YYYY-MM-DD
 */
const quickDue = (pick: QuickDue, today: string) => {
  const d = new Date(`${today}T12:00:00Z`);
  const day = d.getUTCDay();

  const add =
    pick === 'today' ? 0 : pick === 'tomorrow' ? 1 : pick === 'friday' ? (5 - day + 7) % 7 : ((1 - day + 7) % 7) || 7;

  d.setUTCDate(d.getUTCDate() + add);

  return d.toISOString().slice(0, 10);
};

export default quickDue;
