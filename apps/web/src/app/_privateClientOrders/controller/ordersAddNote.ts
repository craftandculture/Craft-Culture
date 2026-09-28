import { winePartnerProcedure } from '@/lib/trpc/procedures';

import addNoteSchema from '../schemas/addNoteSchema';
import addOrderNote from '../utils/addOrderNote';

/**
 * The wine partner adds a note to one of its orders, for C&C and the distributor
 */
const ordersAddNote = winePartnerProcedure
  .input(addNoteSchema)
  .mutation(({ input, ctx }) =>
    addOrderNote(
      input,
      { userId: ctx.user.id, name: ctx.user.name, party: 'partner', partnerId: ctx.partnerId },
      { partnerId: ctx.partnerId },
    ),
  );

export default ordersAddNote;
