import getCraftCulturePartnerId from './getCraftCulturePartnerId';

/**
 * Whether an order's partner record is Craft & Culture itself
 *
 * C&C places some orders as its own partner (every Private Cellar order is
 * raised under C&C), and those skip the partner's verification step. The name
 * alone decided that before, so any account renamed "Craft & Culture" would
 * have skipped it too. Now it must be the one record that is C&C: the oldest
 * active partner of that name, which is the same record new Private Cellar
 * orders are raised under (see `resolveOrderPartnerId`), and never a private
 * collector's record. Anything else goes through verification as normal.
 *
 * @param partnerId - The order's partner
 * @returns True only for C&C's own partner record
 */
const isCraftCulturePartner = async (partnerId: string | null) => {
  if (!partnerId) return false;

  return (await getCraftCulturePartnerId()) === partnerId;
};

export default isCraftCulturePartner;
