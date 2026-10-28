import { describe, expect, it } from 'vitest';

import buildMatchQuery from './buildMatchQuery';

describe('buildMatchQuery', () => {
  it('puts producer, name and vintage together', () => {
    expect(buildMatchQuery({ producer: 'Tormaresca', name: 'Bocca di Lupo', vintage: '2019' })).toBe(
      'Tormaresca Bocca di Lupo 2019',
    );
  });

  it('does not repeat a producer or vintage the name already has', () => {
    expect(
      buildMatchQuery({ producer: 'Francois Thienpont', name: 'Francois Thienpont Terre Elysse  2021', vintage: '2021' }),
    ).toBe('Francois Thienpont Terre Elysse 2021');
  });

  it('leaves out the non-vintage placeholder', () => {
    expect(buildMatchQuery({ producer: null, name: 'Krug Grande Cuvée', vintage: '1000' })).toBe('Krug Grande Cuvée');
  });
});
