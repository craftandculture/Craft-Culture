import type { client } from '@/database/client';

/**
 * The shared postgres client, or a transaction opened from it
 *
 * Helpers that take one can run inside `client.begin(...)`, so a feed can be
 * swapped (old import out, new one in, lines mapped) in one step: a failure
 * part-way leaves the previous figures in place rather than none.
 */
export type SqlClient = typeof client;
