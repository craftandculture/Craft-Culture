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

  it('gives each wine one line with its sizes together, and the shared producer and vintage once', () => {
    const { lines } = formatReleaseStaffEmail(sunil);
    expect(lines).toContain('WINES · Hospice de Beaune 2023 · 2 wines · 32 bottles');
    expect(lines).toContain('Beaune 1er cru Cuvée M. Drouhin — 4 × 6 (75cl)');
    expect(lines).toContain('Savigny les Beaune 1er Cru Cuvée Arthur Girard — 5 btl (75cl), 1 × 3 (150cl)');
  });

  it('keeps the full name and vintage when the wines differ', () => {
    const { lines } = formatReleaseStaffEmail({
      ...sunil,
      items: [
        { name: 'Tignanello, Toscana', vintage: 2015, bottleSize: '75cl', caseConfig: 6, bottles: 6 },
        { name: 'Antoine Jobard, Meursault', vintage: 2020, bottleSize: '75cl', caseConfig: 6, bottles: 6 },
      ],
    });
    expect(lines).toContain('Tignanello, Toscana 2015 — 1 × 6 (75cl)');
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
