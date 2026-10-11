import { describe, expect, it } from 'vitest';

import parseZohoSku from './parseZohoSku';

describe('parseZohoSku', () => {
  it('keeps a dashed LWIN-18', () => {
    expect(parseZohoSku('1015362-2020-12-00750')).toEqual({ canonical: '1015362-2020-12-00750', form: 'dashed' });
  });

  it('adds dashes to a compact 18-digit code', () => {
    expect(parseZohoSku('101539120150600750')).toEqual({ canonical: '1015391-2015-06-00750', form: 'compact' });
  });

  it('re-dashes a code with the dashes in the wrong places', () => {
    expect(parseZohoSku('1014600-2021-0100-750')).toEqual({ canonical: '1014600-2021-01-00750', form: 'misdashed' });
  });

  it('reads a six-digit size as five', () => {
    expect(parseZohoSku('1006960201606000750').canonical).toBe('1006960-2016-06-00750');
  });

  it('accepts Crurated alphanumeric wine codes', () => {
    expect(parseZohoSku('WITEP3R20B-2020-06-00750').form).toBe('dashed');
    expect(parseZohoSku('WITEP3R20B20200600750').canonical).toBe('WITEP3R20B-2020-06-00750');
  });

  it('has no canonical form for brand codes, short codes and blanks', () => {
    expect(parseZohoSku('WKY-COM-700-BTL-UAE-ORC').canonical).toBeNull();
    expect(parseZohoSku('HK - Sass2020').canonical).toBeNull();
    expect(parseZohoSku('11031802016060075').canonical).toBeNull();
    expect(parseZohoSku('101539120110600750CARD').canonical).toBeNull();
    expect(parseZohoSku('').form).toBe('blank');
  });
});
