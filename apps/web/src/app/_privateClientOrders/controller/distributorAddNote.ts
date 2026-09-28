import { distributorProcedure } from '@/lib/trpc/procedures';

import addNoteSchema from '../schemas/addNoteSchema';
import addOrderNote from '../utils/addOrderNote';

/**
 * The distributor adds a note to an order assigned to it, for C&C and the partner
 */
const distributorAddNote = distributorProcedure
  .input(addNoteSchema)
  .mutation(({ input, ctx }) =>
    addOrderNote(
      input,
      { userId: ctx.user.id, name: ctx.user.name, party: 'distributor', partnerId: ctx.partnerId },
      { distributorId: ctx.partnerId },
    ),
  );

export default distributorAddNote;
