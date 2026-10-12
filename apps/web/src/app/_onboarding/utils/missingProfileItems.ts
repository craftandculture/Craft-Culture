interface MissingProfileItemsInput {
  phone?: string | null;
  deliveryAddress?: string | null;
  eidNumber?: string | null;
  documentTypes: string[];
}

/**
 * What a member has not given us yet, in the order worth asking for it
 *
 * Nothing here blocks sign-up. It drives the profile card, the admin's
 * "missing" column and the activation gate, so all three agree.
 *
 * @example
 *   missingProfileItems({ phone: null, documentTypes: [] });
 *   // ['Emirates ID', 'Mobile', 'Delivery address']
 */
const missingProfileItems = ({
  phone,
  deliveryAddress,
  eidNumber,
  documentTypes,
}: MissingProfileItemsInput) => {
  const missing: string[] = [];

  const idComplete =
    Boolean(eidNumber?.trim()) &&
    documentTypes.includes('emirates_id_front') &&
    documentTypes.includes('emirates_id_back');

  if (!idComplete) missing.push('Emirates ID');
  if (!phone?.trim()) missing.push('Mobile');
  if (!deliveryAddress?.trim()) missing.push('Delivery address');

  return missing;
};

export default missingProfileItems;
