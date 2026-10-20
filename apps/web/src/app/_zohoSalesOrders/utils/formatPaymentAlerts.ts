import escapeSlackText from '@/lib/slack/escapeSlackText';

export interface PaymentAlert {
  customerName: string;
  invoiceNumber: string;
  currency: string;
  paid: number;
  balance: number;
}

const LIMIT = 20;

const money = (amount: number, currency: string) =>
  `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The #payments-received post: who paid, how much, on which invoice, and what
 * is still owed, so no one chases a client who has already paid
 *
 * @example
 *   formatPaymentAlerts([{ customerName: 'JMK Trading LLC', invoiceNumber: 'INV-000419', currency: 'AED', paid: 11364.42, balance: 0 }]);
 */
const formatPaymentAlerts = (alerts: PaymentAlert[]) => {
  const lines = alerts.slice(0, LIMIT).map((a) => {
    const rest = a.balance <= 0.005 ? 'paid in full' : `${money(a.balance, a.currency)} still due`;
    return `• *${escapeSlackText(a.customerName)}* paid ${money(a.paid, a.currency)} on ${escapeSlackText(a.invoiceNumber)} · ${rest}`;
  });
  const more = alerts.length > LIMIT ? `\n…and ${alerts.length - LIMIT} more` : '';

  return `*Payment${alerts.length === 1 ? '' : 's'} received*\n${lines.join('\n')}${more}`;
};

export default formatPaymentAlerts;
