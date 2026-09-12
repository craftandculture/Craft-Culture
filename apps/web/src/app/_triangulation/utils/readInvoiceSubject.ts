import type { ZohoInvoice } from '@/lib/zoho/types';

/**
 * Find the subject line on a Zoho invoice, wherever it is kept
 *
 * Zoho Books gives an invoice no standard subject, so a "Subject" printed on
 * the document may be a custom field and absent from `subject` altogether. The
 * consignment tag lives on that line, so reading only the standard field found
 * nothing on every invoice, attributed every one of them to nobody, and left
 * each client's feed empty while Crurated absorbed the lot.
 *
 * Three places are read, in order of how deliberate each is.
 *
 * `subject` and a subject-ish custom field come first, for the day Zoho starts
 * returning either. Neither does today: across seventy City Drinks invoices
 * both were empty on every one, and the heading rows Zoho's own docs allow
 * (`item_type: header`) are dropped on read as well. Every carrier the
 * document prints is invisible to the API.
 *
 * So the reference number is read too. It is the one field that arrives
 * intact — it already holds the sales order, `SO-00105` — and a tag appended
 * to it, `SO-00105 CONSIGNMENT_CULT`, reaches us where nothing else does.
 * Reading it costs nothing while it is absent, so this works the day someone
 * starts writing it and not before.
 *
 * @param invoice - The invoice as Zoho returns it
 * @returns The subject line, or null if the invoice carries none
 */
const readInvoiceSubject = (invoice: ZohoInvoice) => {
  if (invoice.subject?.trim()) return invoice.subject.trim();

  const field = invoice.custom_fields?.find((entry) => {
    const name = `${entry.label ?? ''} ${entry.api_name ?? ''}`.toLowerCase();

    return name.includes('subject');
  });

  const value = field?.value;

  if (typeof value === 'string' && value.trim()) return value.trim();

  /*
    The reference number carries the sales order, so only the consignment tag
    within it is taken — returning the whole string would make "SO-00105" look
    like a subject that simply named no owner.
  */
  const tagged = /CONSIGNMENT_[A-Z]+/i.exec(invoice.reference_number ?? '');

  return tagged?.[0]?.toUpperCase() ?? null;
};

export default readInvoiceSubject;
