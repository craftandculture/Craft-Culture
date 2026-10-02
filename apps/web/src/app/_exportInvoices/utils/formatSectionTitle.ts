import type { ExportSection } from '../schemas/exportDocumentSchema';

/**
 * The heading printed above a section of lines
 *
 * Invoice numbers, with the PCO number where there is one — never the client
 * or the wine's owner, which customs have no use for and Kevin does not want
 * on the document. Several identical PCO orders share one heading.
 *
 * @example
 *   formatSectionTitle(section); // 'INV-000348 · PCO-2026-00061 | INV-000350 · PCO-2026-00062 — 2 × 6 btl, 4 cs'
 *
 * @param section - The section
 * @returns The heading text
 */
const formatSectionTitle = (section: ExportSection) => {
  const refs = section.refs
    .map((r) => (r.pcoNumber ? `${r.invoiceNumber} · ${r.pcoNumber}` : r.invoiceNumber))
    .join(' | ');
  return section.note ? `${refs} — ${section.note}` : refs;
};

export default formatSectionTitle;
