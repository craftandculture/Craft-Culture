import { sql } from 'drizzle-orm';

import db from '@/database/client';

/** A column pointing at `users.id`, and what Postgres does when that user goes */
export interface UserReference {
  table: string;
  column: string;
  /**
   * The database deals with these rows itself. Only true for cascade, or
   * set null on a column that can actually be null: SET NULL on a NOT NULL
   * column fails the delete (private_client_order_documents.uploaded_by did)
   */
  handledByDatabase: boolean;
  /** The column can be cleared, so the record survives without its author */
  nullable: boolean;
}

/** Postgres identifiers, as Postgres itself writes them */
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/**
 * Every single-column foreign key onto `users.id`, asked of Postgres
 *
 * Over a hundred "created by / approved by / activity log" columns point at a
 * user with no ON DELETE rule, so deleting anyone who had ever done anything
 * failed outright. The list grows with the schema, so it is read from the
 * catalogue rather than kept by hand.
 *
 * @returns Table/column pairs with their delete rule and nullability
 */
const userReferenceColumns = async () => {
  const rows = await db.execute<{
    table_name: string;
    column_name: string;
    del_type: string;
    not_null: boolean;
  }>(sql`
    SELECT cl.relname AS table_name,
           a.attname AS column_name,
           c.confdeltype AS del_type,
           a.attnotnull AS not_null
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND c.confrelid = 'public.users'::regclass
       AND n.nspname = 'public'
       AND array_length(c.conkey, 1) = 1
  `);

  return [...rows]
    .filter(
      (r) => SAFE_IDENTIFIER.test(r.table_name) && SAFE_IDENTIFIER.test(r.column_name),
    )
    .map(
      (r): UserReference => ({
        table: r.table_name,
        column: r.column_name,
        handledByDatabase:
          r.del_type === 'c' || (r.del_type === 'n' && !r.not_null),
        nullable: !r.not_null,
      }),
    );
};

export default userReferenceColumns;
