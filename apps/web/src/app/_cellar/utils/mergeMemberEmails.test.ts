import { describe, expect, it } from 'vitest';

import mergeMemberEmails, { finishEmailData } from './mergeMemberEmails';

const wine = (i: number) => ({ name: `Wine ${i}`, detail: 'Pauillac, Bordeaux', quantity: '6 bottles' });
const slot = new Date('2026-10-26T08:00:00Z');

const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  recipientUserId: 'u1',
  recipientEmail: 'member@example.com',
  kind: 'wineArrived',
  sendAt: slot,
  isMergeable: true,
  data: { subject: 'Your wine has arrived', wines: [wine(Number(id))], _bottles: 6 },
  ...overrides,
});

describe('mergeMemberEmails', () => {
  it('folds two arrivals at the same slot into one email', () => {
    const emails = mergeMemberEmails([row('1'), row('2')]);
    expect(emails).toHaveLength(1);
    expect(emails[0]!.carrierId).toBe('1');
    expect(emails[0]!.mergedIds).toEqual(['2']);
    expect(emails[0]!.data.listTitle).toBe('2 wines · 12 bottles');
  });

  it('keeps different members apart', () => {
    expect(mergeMemberEmails([row('1'), row('2', { recipientEmail: 'other@example.com' })])).toHaveLength(2);
  });

  it('keeps different slots apart', () => {
    expect(mergeMemberEmails([row('1'), row('2', { sendAt: new Date('2026-10-26T13:00:00Z') })])).toHaveLength(2);
  });

  it('never merges an email that is not mergeable', () => {
    expect(mergeMemberEmails([row('1', { isMergeable: false }), row('2', { isMergeable: false })])).toHaveLength(2);
  });

  it('never sends bookkeeping to Loops', () => {
    expect('_bottles' in mergeMemberEmails([row('1')])[0]!.data).toBe(false);
  });
});

describe('finishEmailData', () => {
  it('caps a long list at eight and says what is left', () => {
    const data = finishEmailData({ wines: Array.from({ length: 25 }, (_, i) => wine(i)), _bottles: 160 });
    expect((data.wines as unknown[]).length).toBe(8);
    expect(data.listMore).toBe('And 17 more wines. The full list is in your cellar.');
    expect(data.listTitle).toBe('25 wines · 160 bottles');
  });

  it('says one wine, one bottle', () => {
    const data = finishEmailData({ wines: [wine(1)], _bottles: 1 });
    expect(data.listTitle).toBe('1 wine · 1 bottle');
    expect(data.listMore).toBe('');
  });

  it('leaves an email without wines alone', () => {
    expect(finishEmailData({ subject: 'Hello' })).toEqual({ subject: 'Hello' });
  });
});
