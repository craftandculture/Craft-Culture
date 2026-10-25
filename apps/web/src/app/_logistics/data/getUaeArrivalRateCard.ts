import db from '@/database/client';

import uaeArrivalRateCardSchema from '../schemas/uaeArrivalRateCardSchema';
import defaultUaeArrivalRateCard from '../utils/defaultUaeArrivalRateCard';
import uaeArrivalRateCardKey from '../utils/uaeArrivalRateCardKey';

/**
 * The UAE arrival rate card as saved, or the GAC defaults when none is
 *
 * @example
 *   const card = await getUaeArrivalRateCard();
 *
 * @returns The rate card, and whether it is the unedited default
 */
const getUaeArrivalRateCard = async () => {
  const row = await db.query.settings.findFirst({
    where: { key: uaeArrivalRateCardKey },
  });

  if (row) {
    try {
      const parsed = uaeArrivalRateCardSchema.safeParse(JSON.parse(row.value));
      if (parsed.success) return { ...parsed.data, isDefault: false };
    } catch (error) {
      console.error('Unreadable UAE arrival rate card', { error });
    }
  }

  return { ...defaultUaeArrivalRateCard, isDefault: true };
};

export default getUaeArrivalRateCard;
