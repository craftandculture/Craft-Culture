/**
 * Shipment documents a partner may see on a shipment that is wholly theirs
 *
 * Freight and agent invoices (`shipping_invoice`, `gac_invoice`) carry our
 * costs, and `other` can be anything, so they are left out.
 */
const partnerDocumentTypes = new Set([
  'bill_of_lading',
  'airway_bill',
  'commercial_invoice',
  'commercial_invoice_excel',
  'packing_list',
  'certificate_of_origin',
  'customs_declaration',
  'import_permit',
  'export_permit',
  'delivery_note',
  'health_certificate',
  'insurance_certificate',
  'proof_of_delivery',
  'transit_boe',
  're_export_boe',
  'cargo_photo',
]);

export default partnerDocumentTypes;
