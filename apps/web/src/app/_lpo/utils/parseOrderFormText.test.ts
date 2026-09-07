import { describe, expect, it } from 'vitest';

import parseOrderFormText, { isOrderForm } from './parseOrderFormText';

/**
 * The "ORDER FORM" layout, exactly as `pdf-parse` returns it from the client's
 * PDF. The concatenation is not tidied: "6X75CL333911" is one token in the
 * real document, and separating it is the whole difficulty.
 */
const FIXTURE = [
  'Local Final LPO',
  'ORDER FORM',
  'SUPPLIER: CRAFT & CULTURE DUBAI',
  'Attn: KEVIN BRADFORD',
  'Contact # -',
  'Serial No:    8615',
  'Date:    07-Sep-2026',
  '[ WINES ]',
  'ProductPackingCode',
  'Supplier',
  'Code',
  'QTYFOCCURRENCYPrice (per Case)Sub-TotalRemarks',
  'Numanthia, Numanthia, Toro',
  'DO',
  '6X75CL333911',
  '0',
  'AED1,223.781,223.78',
  'Total1',
  '0',
  '1,223.78',
  'Total Quantity (Cases)1',
  'Sub-Total (AED)1,223.78',
  'VAT 5%61.19',
  'Grand Total (AED)1,284.97',
  'Term & Conditions',
  'THIS LPO EXPIRES 30 DAYS FROM THE LPO DATE SHOWN ABOVE1.',
  'INVOICES AND DELIVERY NOTES MUST REFLECT OUR LPO REFERENCE(S) AT ALL TIMES2.',
  'INVOICES MUST BE DELIVERED DIRECTLY TO OUR ACCOUNTS DEPARTMENT IN A SEALED ENVELOPE3.',
  'WITHIN 48 HOURS FROM DATE OF DELIVERY',
  'SIXTY (60) DAYS CREDIT TERMS4.',
  'DELIVERY SCHEDULE MUST BE COORDINATED AT LEAST ONE (1) DAY BEFORE DELIVERY5.',
  'Prepared By: ________________________Approved By: ________________________',
].join('\n');

describe('parseOrderFormText', () => {
  it('recognises the layout', () => {
    expect(isOrderForm(FIXTURE)).toBe(true);
    expect(isOrderForm('PO NO. LPOCON24082026\nBordeaux')).toBe(false);
  });

  it('reads the order line', () => {
    const result = parseOrderFormText(FIXTURE);

    expect(result.lines).toHaveLength(1);
    expect(result.skipped).toEqual([]);
  });

  it('separates the supplier code from the quantity by arithmetic', () => {
    const [line] = parseOrderFormText(FIXTURE).lines;

    // "6X75CL333911" is pack 6x75cl, code 33391, quantity 1 — and the only
    // thing that says where to cut is 1,223.78 / 1,223.78 = 1.
    expect(line?.supplierCode).toBe('33391');
    expect(line?.cases).toBe(1);
    expect(line?.pack).toBe(6);
  });

  /*
    The one field naming a party on this form is the supplier, and the supplier
    is us. Reading it as the client raised the order against ourselves, and
    Zoho — correctly — held no such customer.
  */
  it('takes no client from a form whose only named party is the supplier', () => {
    expect(parseOrderFormText(FIXTURE).client).toBeNull();
  });

  it('counts in bottles while remembering the client ordered cases', () => {
    const [line] = parseOrderFormText(FIXTURE).lines;

    expect(line?.bottles).toBe(6);
    expect(line?.sizeMl).toBe(750);
    expect(line?.unitPriceCaseAed).toBe(1223.78);
    expect(line?.unitPriceAed).toBeCloseTo(203.96, 2);
    expect(line?.lineTotalAed).toBe(1223.78);
    expect(line?.problem).toBeNull();
  });

  it('leaves the vintage unstated rather than inventing one', () => {
    const [line] = parseOrderFormText(FIXTURE).lines;

    expect(line?.vintage).toBe('');
    expect(line?.wine).toBe('Numanthia, Numanthia, Toro DO');
  });

  it('compares the lines to the sub-total, not the VAT-inclusive grand total', () => {
    const result = parseOrderFormText(FIXTURE);

    expect(result.computedTotalAed).toBe(1223.78);
    expect(result.declaredTotalAed).toBe(1223.78);
  });

  it('reads the header', () => {
    const result = parseOrderFormText(FIXTURE);

    expect(result.poNumber).toBe('8615');
    expect(result.poDate).toBe('07-Sep-2026');
  });

  it('skips a line whose quantity cannot be recovered', () => {
    const broken = FIXTURE.replace('AED1,223.781,223.78', 'AED0.000.00');

    expect(parseOrderFormText(broken).lines).toHaveLength(0);
    expect(parseOrderFormText(broken).skipped).toHaveLength(1);
  });
});
