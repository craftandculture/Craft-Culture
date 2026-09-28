import { z } from 'zod';

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import addNoteSchema from '../schemas/addNoteSchema';
import addOrderNote from '../utils/addOrderNote';

/**
 * C&C adds a note to any order: shared with partner and distributor, or
 * internal (C&C only)
 */
const adminAddNote = wmsOperatorProcedure
  .input(addNoteSchema.extend({ internal: z.boolean().default(false) }))
  .mutation(({ input, ctx }) =>
    addOrderNote(input, { userId: ctx.user.id, name: ctx.user.name, party: 'admin' }),
  );

export default adminAddNote;
