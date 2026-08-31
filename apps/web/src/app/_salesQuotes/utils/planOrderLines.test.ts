import { describe, expect, it } from 'vitest';

import planOrderLines from './planOrderLines';

const line = (over: Partial<Parameters<typeof planOrderLines>[0][number]> = {}) => ({
  lwin18: '1012781-2012-06-00750',
  wine: 'Chateau Margaux',
  vintage: '2012',
  size: 75,
  pack: 6,
  qty: 6,
  busd: 358,
  ...over,
});

describe('planOrderLines', () => {
  it('sells a whole case as the pack it was offered in', () => {
    const [planned] = planOrderLines([line()]);

    expect(planned?.soldPack).toBe(6);
    expect(planned?.cases).toBe(1);
    expect(planned?.lwin18).toBe('1012781-2012-06-00750');
    expect(planned?.isRepack).toBe(false);
  });

  it('turns a part case into a repack code', () => {
    const [planned] = planOrderLines([line({ qty: 3 })]);

    // Three bottles off a six is a three-pack, and the code has to say so —
    // this is the item a person creates in Zoho by hand today.
    expect(planned?.soldPack).toBe(3);
    expect(planned?.lwin18).toBe('1012781-2012-03-00750');
    expect(planned?.isRepack).toBe(true);
    expect(planned?.description).toBe('3x75cl');
  });

  it('prices the case from the bottle price', () => {
    const [planned] = planOrderLines([line({ qty: 3 })]);

    expect(planned?.ratePerCase).toBe(1074);
    expect(planned?.cases).toBe(1);
    expect(planned?.lineTotal).toBe(1074);
  });

  it('keeps the LPO pack when it disagrees with the quote', () => {
    const [planned] = planOrderLines([line({ qty: 6, soldPack: 3 })]);

    // Six bottles as two three-packs, because that is what was ordered.
    expect(planned?.soldPack).toBe(3);
    expect(planned?.cases).toBe(2);
    expect(planned?.isRepack).toBe(true);
  });

  it('takes multiple whole cases without repacking', () => {
    const [planned] = planOrderLines([line({ qty: 12 })]);

    expect(planned?.soldPack).toBe(6);
    expect(planned?.cases).toBe(2);
    expect(planned?.isRepack).toBe(false);
  });

  it('swaps only the pack segment of the code', () => {
    const [planned] = planOrderLines([
      line({ lwin18: '1011191-2001-06-06000', size: 600, qty: 1, pack: 6 }),
    ]);

    // The bottle size must survive: a 6L that becomes a 75cl is a different wine.
    expect(planned?.lwin18).toBe('1011191-2001-01-06000');
  });

  it('keeps a large-format single as one bottle, one case', () => {
    const [planned] = planOrderLines([
      line({ lwin18: '1011872-1983-01-01500', size: 150, pack: 1, qty: 1, busd: 1229 }),
    ]);

    expect(planned?.cases).toBe(1);
    expect(planned?.isRepack).toBe(false);
    expect(planned?.description).toBe('1x150cl');
  });

  it('drops a line ordered as nothing', () => {
    expect(planOrderLines([line({ qty: 0 })])).toHaveLength(0);
  });

  it('says when a code cannot be derived rather than inventing one', () => {
    const [planned] = planOrderLines([line({ lwin18: '' })]);

    expect(planned?.problem).toMatch(/LWIN/);
  });

  it('says when a quantity is not whole cases of the ordered pack', () => {
    const [planned] = planOrderLines([line({ qty: 5, soldPack: 2 })]);

    expect(planned?.problem).toMatch(/not a whole number of 2-packs/);
  });

  it('says when a line carries no price', () => {
    const [planned] = planOrderLines([line({ busd: 0 })]);

    expect(planned?.problem).toMatch(/No price/);
  });
});
