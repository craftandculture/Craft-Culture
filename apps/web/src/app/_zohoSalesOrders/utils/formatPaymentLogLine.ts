import escapeSlackText from '@/lib/slack/escapeSlackText';

export interface PaymentLogEntry {
  direction: 'received' | 'made';
  party: string;
  amount: number;
  currency: string;
  date: string | null;
  documents: string | null;
  mode: string | null;
  reference: string | null;
  paymentNumber: string | null;
}

const money = (amount: number, currency: string) =>
  `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * One #payments-log line: which way the money went, who, how much, against
 * which invoices or bills, and the bank reference, so a payment can be matched
 * to the bank statement without opening Zoho
 *
 * @example
 *   formatPaymentLogLine({ direction: 'received', party: 'JMK Trading LLC', amount: 11364.42, currency: 'AED', date: '2026-11-10', documents: 'INV-000419', mode: 'Bank Transfer', reference: 'FT2531', paymentNumber: '412' });
 */
const formatPaymentLogLine = (entry: PaymentLogEntry) => {
  const parts = [
    entry.direction === 'received' ? ':arrow_down: *Received*' : ':arrow_up: *Paid out*',
    `*${escapeSlackText(entry.party)}*`,
    money(entry.amount, entry.currency),
    entry.documents ? escapeSlackText(entry.documents.replace(/,\s*/g, ', ')) : null,
    entry.mode ? escapeSlackText(entry.mode) : null,
    entry.reference ? `Ref ${escapeSlackText(entry.reference)}` : 'No bank reference in Zoho',
    entry.date,
    entry.paymentNumber ? `Payment ${escapeSlackText(entry.paymentNumber)}` : null,
  ];

  return parts.filter(Boolean).join(' · ');
};

export default formatPaymentLogLine;
