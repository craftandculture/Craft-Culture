import { adminProcedure } from '@/lib/trpc/procedures';

import getAttentionGroups from '../data/getAttentionGroups';

/**
 * What on the logistics board needs someone to act, grouped by reason
 *
 * See getAttentionGroups for the rules; the #logistics digest reads the same.
 */
const adminGetAttention = adminProcedure.query(() => getAttentionGroups());

export default adminGetAttention;
