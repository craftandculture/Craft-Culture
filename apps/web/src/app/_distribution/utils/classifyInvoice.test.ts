import { describe, expect, it } from 'vitest';

import classifyInvoice, { settles } from './classifyInvoice';

describe('classifyInvoice', () => {
  it('reads a tagged invoice as consignment', () => {
    expect(
      classifyInvoice({ taggedConsignment: true, isPco: false }).type,
    ).toBe('consignment');
  });

  it('reads an untagged invoice as an outright sale', () => {
    expect(
      classifyInvoice({ taggedConsignment: false, isPco: false }).type,
    ).toBe('outright');
  });

  /* A PCO invoice tagged by habit must never reach a partner statement */
  it('keeps a PCO invoice out of consignment however it was tagged', () => {
    expect(classifyInvoice({ taggedConsignment: true, isPco: true }).type).toBe(
      'pco',
    );
  });

  it('lets a person override the document', () => {
    const result = classifyInvoice({
      setByHand: 'prepaid',
      taggedConsignment: true,
      isPco: false,
    });

    expect(result.type).toBe('prepaid');
    expect(result.reason).toBe('Set by hand');
  });

  it('ignores a hand-set value it does not recognise', () => {
    expect(
      classifyInvoice({
        setByHand: 'whatever',
        taggedConsignment: true,
        isPco: false,
      }).type,
    ).toBe('consignment');
  });
});

describe('settles', () => {
  it('bills and pays only consignment', () => {
    expect(settles('consignment')).toBe(true);
    expect(settles('prepaid')).toBe(false);
    expect(settles('outright')).toBe(false);
    expect(settles('pco')).toBe(false);
  });

  /* Rows written before the type existed were all consignment */
  it('treats an untyped row as consignment', () => {
    expect(settles(null)).toBe(true);
  });
});

describe('the type set at release', () => {
  it('beats the tag on the invoice', () => {
    expect(
      classifyInvoice({ fromRelease: 'outright', taggedConsignment: true, isPco: false }),
    ).toEqual({ type: 'outright', reason: 'Set at release' });
  });

  it('gives way to a type set by hand', () => {
    expect(
      classifyInvoice({ setByHand: 'prepaid', fromRelease: 'consignment', taggedConsignment: true, isPco: false }).type,
    ).toBe('prepaid');
  });
});
