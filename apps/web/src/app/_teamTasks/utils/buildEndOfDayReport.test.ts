import { describe, expect, it } from 'vitest';

import buildEndOfDayReport, { nextWorkingDay } from './buildEndOfDayReport';

const base = {
  today: '2026-10-19',
  nextDay: '2026-10-20',
  closed: [],
  opened: 0,
  partsTicked: 0,
  waiting: [],
  overdue: [],
  dueNext: [],
  appUrl: 'https://wine.craftculture.xyz',
};

describe('buildEndOfDayReport', () => {
  it('splits jobs waiting on Kevin or Sophie into decisions, the rest into blocked', () => {
    const text = buildEndOfDayReport({
      ...base,
      waiting: [
        { title: 'JMK pricing', waitingOn: 'Kevin' },
        { title: 'Wynn order', waitingOn: 'client confirmation' },
        { title: 'Rate card', waitingOn: 'Sophie to approve' },
      ],
    });

    expect(text).toContain('*Decision needed* (2)\n• JMK pricing: waiting on Kevin\n• Rate card: waiting on Sophie to approve');
    expect(text).toContain('*Blocked* (1)\n• Wynn order: waiting on client confirmation');
  });

  it('leaves out empty sections on a quiet day', () => {
    const text = buildEndOfDayReport(base);

    expect(text).toContain('0 jobs closed · 0 steps ticked · 0 new jobs');
    expect(text).not.toContain('*Completed*');
    expect(text).not.toContain('*Overdue*');
  });

  it('cuts a long section at ten with a count of the rest', () => {
    const closed = Array.from({ length: 13 }, (_, i) => ({ title: `Job ${i + 1}` }));
    const text = buildEndOfDayReport({ ...base, closed });

    expect(text).toContain('• Job 10\n…and 3 more');
    expect(text).not.toContain('Job 11');
  });
});

describe('nextWorkingDay', () => {
  it('skips the weekend from Friday to Monday', () => {
    expect(nextWorkingDay('2026-10-23')).toBe('2026-10-26');
    expect(nextWorkingDay('2026-10-19')).toBe('2026-10-20');
  });
});
