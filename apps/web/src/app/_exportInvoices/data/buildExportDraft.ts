import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { exportConsigneeProfiles } from '@/database/schema';
import { getContact } from '@/lib/zoho/contacts';
import type { ZohoContact } from '@/lib/zoho/types';

import {
  AED_PER_USD,
  COLLECTION_POINT,
  DEFAULT_DECLARATION,
  DEFAULT_TERMS,
  EXPORTER,
} from '../constants';
import fetchInvoicesForExport from './fetchInvoicesForExport';
import lookupOrigins from './lookupOrigins';
import resolveExportBoes from './resolveExportBoes';
import type { ExportDocument } from '../schemas/exportDocumentSchema';
import { exportOpSchema } from '../schemas/exportOpSchema';
import applyExportOps from '../utils/applyExportOps';
import buildExportLines from '../utils/buildExportLines';
import estimateGrossWeight from '../utils/estimateGrossWeight';

/**
 * The consignee block from Zoho, when no profile overrides it
 *
 * @param contact - The Zoho customer
 * @returns Address lines and tax number
 */
const consigneeFromContact = (contact: ZohoContact & { tax_reg_no?: string; vat_reg_no?: string }) => {
  const a = contact.shipping_address?.address ? contact.shipping_address : contact.billing_address;
  const lines = [a?.address, a?.street2, [a?.city, a?.state].filter(Boolean).join(', '), a?.country]
    .map((l) => l?.trim())
    .filter((l): l is string => Boolean(l));
  return {
    name: contact.company_name || contact.contact_name,
    addressLines: lines,
    trn: contact.tax_reg_no || contact.vat_reg_no || null,
  };
};

/**
 * Build a new export invoice from selected Zoho invoices
 *
 * Fetches the invoices live, finds origins and BOEs, packs PCO orders into
 * cartons, prices everything in the consignee's currency, then replays the
 * consignee's standing rules. A rule that no longer applies is reported back
 * rather than failing the build.
 *
 * @param input - The consignee and the invoices to include
 * @returns The draft document and what happened to each standing rule
 */
const buildExportDraft = async (input: { zohoCustomerId: string; zohoInvoiceIds: string[] }) => {
  const [profile] = await db
    .select()
    .from(exportConsigneeProfiles)
    .where(eq(exportConsigneeProfiles.zohoCustomerId, input.zohoCustomerId))
    .limit(1);

  const currency = profile?.currency === 'USD' ? 'USD' : 'AED';
  const rate = currency === 'USD' ? 1 : (profile?.rate ?? AED_PER_USD);

  const invoices = await fetchInvoicesForExport(input.zohoInvoiceIds);
  const lwins = invoices.flatMap((i) => i.lines.map((l) => l.lwin18).filter((l): l is string => Boolean(l)));
  const [originByLwin, boeByKey] = await Promise.all([lookupOrigins(lwins), resolveExportBoes(invoices)]);
  const { sections, lines } = buildExportLines(invoices, { rate, originByLwin, boeByKey });

  // A profile made only to hold a standing rule has no address of its own
  const consignee = profile?.addressLines?.length
    ? { name: profile.displayName, addressLines: profile.addressLines, trn: profile.trn }
    : consigneeFromContact(await getContact(input.zohoCustomerId));

  const today = new Date().toISOString().slice(0, 10);
  const origins = [...new Set(lines.flatMap((l) => l.origin.split(' / ')).filter(Boolean))];

  let document: ExportDocument = {
    header: {
      number: null,
      date: today,
      exporter: EXPORTER,
      consignee,
      collection: COLLECTION_POINT,
      terms: DEFAULT_TERMS,
      currency,
      rate,
      pallets: null,
      grossWeightKg: estimateGrossWeight(lines, null),
      grossWeightEstimated: true,
      casesOverride: null,
    },
    sources: invoices.map((i) => ({
      zohoInvoiceId: i.zohoInvoiceId,
      invoiceNumber: i.invoiceNumber,
      soNumber: i.soNumber,
      pcoNumber: i.pcoNumber,
      invoiceDate: i.invoiceDate,
      totalUsd: i.totalUsd,
    })),
    sections,
    lines,
    extraColumns: [],
    notes: [],
    declaration: origins.length
      ? `${DEFAULT_DECLARATION} The goods are of ${origins.join(', ')} origin.`
      : DEFAULT_DECLARATION,
  };

  const ruleResults: { text: string; applied: boolean; error?: string }[] = [];
  for (const rule of profile?.standingRules ?? []) {
    const parsed = exportOpSchema.array().safeParse(rule.ops);
    if (!parsed.success) {
      ruleResults.push({ text: rule.text, applied: false, error: 'The saved rule is not valid any more.' });
      continue;
    }
    try {
      document = applyExportOps(document, parsed.data);
      ruleResults.push({ text: rule.text, applied: true });
    } catch (error) {
      ruleResults.push({
        text: rule.text,
        applied: false,
        error: error instanceof Error ? error.message : 'Could not apply',
      });
    }
  }

  return { document, invoices, ruleResults };
};

export default buildExportDraft;
