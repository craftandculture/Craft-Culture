import { describe, expect, it } from 'vitest';

import declareOrigins from './declareOrigins';
import type { ExportLine } from '../schemas/exportDocumentSchema';

const line = (origin: string) => ({ kind: 'single', origin, components: [] }) as unknown as ExportLine;

describe('declareOrigins', () => {
  it('names an origin typed in after the draft was built', () => {
    const before = 'We declare the particulars are true. The goods are of France origin.';
    expect(declareOrigins(before, [line('France'), line('Spain'), line('')])).toBe(
      'We declare the particulars are true. The goods are of France, Spain origin.',
    );
  });

  it('adds the sentence to a declaration written without one', () => {
    expect(declareOrigins('We declare.', [line('Italy / France')])).toBe(
      'We declare. The goods are of Italy, France origin.',
    );
  });

  it('drops the sentence when no line has an origin', () => {
    expect(declareOrigins('We declare. The goods are of France origin.', [line('')])).toBe('We declare.');
  });
});
