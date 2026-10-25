import settingsUpdateController from '@/app/_admin/controllers/settingsUpdateController';
import { adminProcedure } from '@/lib/trpc/procedures';

import uaeArrivalRateCardSchema from '../schemas/uaeArrivalRateCardSchema';
import uaeArrivalRateCardKey from '../utils/uaeArrivalRateCardKey';

/** Save the UAE arrival rate card; every quote into the UAE reprices on it */
const adminSetUaeArrivalRateCard = adminProcedure
  .input(uaeArrivalRateCardSchema)
  .mutation(async ({ input }) => {
    await settingsUpdateController({
      key: uaeArrivalRateCardKey,
      value: JSON.stringify({ lines: input.lines, variables: input.variables }),
    });

    return { ok: true };
  });

export default adminSetUaeArrivalRateCard;
