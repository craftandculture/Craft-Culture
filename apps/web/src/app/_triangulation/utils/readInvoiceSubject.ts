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
 * Both are read, standard field first. Any custom field whose label or API
 * name mentions a subject counts, since the label is typed by whoever built
 * the template and is not guaranteed to be exactly "Subject".
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

  if (typeof value !== 'string' || !value.trim()) return null;

  return value.trim();
};

export default readInvoiceSubject;
