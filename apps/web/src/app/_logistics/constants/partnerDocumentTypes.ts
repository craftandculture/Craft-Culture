/**
 * Shipment documents C&C uploads that a partner may see, on a shipment that
 * is wholly theirs
 *
 * Only paperwork that carries no money of ours. Freight and agent invoices
 * carry our costs, and so can an air waybill or bill of lading (freight
 * charges), a customs declaration or BOE (CIF values, which include our
 * freight) and an insurance certificate (insured value). We mark freight up,
 * so none of those are shown. A partner always sees what their own people
 * uploaded, whatever its type.
 */
const partnerDocumentTypes = new Set([
  'packing_list',
  'certificate_of_origin',
  'health_certificate',
  'cargo_photo',
  'delivery_note',
  'proof_of_delivery',
]);

export default partnerDocumentTypes;
