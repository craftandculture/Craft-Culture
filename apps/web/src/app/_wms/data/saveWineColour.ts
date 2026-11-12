import db from '@/database/client';
import { productColours } from '@/database/schema';

import type { WineColour } from '../utils/wineColour';

/**
 * Record a wine's colour for every vintage and size of it, replacing any set
 * before; it wins over Liv-ex from then on
 */
const saveWineColour = async (key: string, colour: WineColour, userId: string) => {
  await db
    .insert(productColours)
    .values({ lwin7: key, colour, setBy: userId })
    .onConflictDoUpdate({
      target: productColours.lwin7,
      set: { colour, setBy: userId, updatedAt: new Date() },
    });
};

export default saveWineColour;
