import { describe, expect, it } from 'vitest';

import formatReleaseStaffEmail from './formatReleaseStaffEmail';

const sunil = {
  event: 'submitted' as const,
  requestNumber: 'REL-2026-0013',
  member: 'Sunil Kaushal',
  items: [
    { name: 'Hospice de Beaune 2023 - Beaune 1er cru Cuvée M. Drouhin 0.75 13.5%', vintage: 2023, bottleSize: '75cl', caseConfig: 6, bottles: 24 },
    { name: 'Hospice de Beaune 2023 - Savigny les Beaune 1er Cru Cuvée Arthur Girard 0.75L 14% (1x)', vintage: 2023, bottleSize: '75cl', caseConfig: 1, bottles: 5 },
    { name: 'Hospice de Beaune 2023 - Savigny les Beaune 1er Cru Cuvée Arthur Girard 1.5L 14%', vintage: 2023, bottleSize: '150cl', caseConfig: 3, bottles: 3 },
  ],
  address: 'The Lakes , Villa 50 , Hattan 1, Near Emirates Golf Club',
  addressLabel: 'Home',
  preferred: 'Any day, morning',
  link: 'https://wine.craftculture.xyz/platform/admin/cellar-releases?open=x',
};

describe('formatReleaseStaffEmail', () => {
  it('puts the request, the action and the total in the subject', () => {
    expect(formatReleaseStaffEmail(sunil).subject).toBe('New release: REL-2026-0013 · Sunil Kaushal · 32 bottles to price');
  });

  it('writes each wine as quantity, name, vintage and size, without the name repeating them', () => {
    const { lines } = formatReleaseStaffEmail(sunil);
    expect(lines).toContain('4 × 6 · Hospice de Beaune - Beaune 1er cru Cuvée M. Drouhin · 2023 · 75cl');
    expect(lines).toContain('5 btl · Hospice de Beaune - Savigny les Beaune 1er Cru Cuvée Arthur Girard · 2023 · 75cl');
    expect(lines).toContain('1 × 3 · Hospice de Beaune - Savigny les Beaune 1er Cru Cuvée Arthur Girard · 2023 · 150cl');
  });

  it('gives the delivery its own block', () => {
    const { lines } = formatReleaseStaffEmail(sunil);
    expect(lines).toContain('Home · The Lakes, Villa 50, Hattan 1, Near Emirates Golf Club');
    expect(lines).toContain('Preferred: Any day, morning (not yet confirmed)');
  });

  it('names the order once the member accepts', () => {
    const { subject, lines } = formatReleaseStaffEmail({ ...sunil, event: 'accepted', orderNumber: 'PCO-2026-00113' });
    expect(subject).toBe('Accepted: REL-2026-0013 · Sunil Kaushal · prepare the delivery');
    expect(lines[1]).toContain('PCO-2026-00113 has been raised');
  });
});
