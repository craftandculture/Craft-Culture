import { describe, expect, it } from 'vitest';

import formatPaymentAlerts from './formatPaymentAlerts';

describe('formatPaymentAlerts', () => {
  it('says paid in full or what is still due', () => {
    const text = formatPaymentAlerts([
      { customerName: 'JMK Trading LLC', invoiceNumber: 'INV-000419', currency: 'AED', paid: 11364.42, balance: 0 },
      { customerName: 'Cru Wine', invoiceNumber: 'INV-000400', currency: 'USD', paid: 5000, balance: 2100 },
    ]);

    expect(text).toBe(
      '*Payments received*\n' +
        '• *JMK Trading LLC* paid AED 11,364.42 on INV-000419 · paid in full\n' +
        '• *Cru Wine* paid USD 5,000.00 on INV-000400 · USD 2,100.00 still due',
    );
  });
});
