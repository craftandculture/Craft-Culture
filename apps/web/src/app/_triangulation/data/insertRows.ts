import { client } from '@/database/client';

export interface InsertRowsOptions {
  /** Columns to serialise as JSON before binding, e.g. jsonb payloads */
  jsonbColumns?: string[];
  /** Conflict clause without the leading keyword, e.g. `(w_code) DO NOTHING` */
  onConflict?: string;
  /** Columns to return, e.g. `id` */
  returning?: string;
}

/** Postgres refuses a statement with more than 65535 bind parameters */
const MAX_PARAMETERS = 60000;

/**
 * Insert many rows in as few statements as the parameter limit allows
 *
 * A month of City Drinks sales is thousands of rows, so inserting one at a
 * time is not viable. Chunk sizes are derived from the column count rather
 * than fixed, so a wide table cannot silently blow the bind-parameter cap.
 *
 * @param table - The target table name
 * @param columns - Column names, in the order the row objects are read
 * @param rows - Row objects keyed by column name
 * @param options - JSON columns, a conflict clause and a returning clause
 * @returns The returned rows when `returning` is set, otherwise an empty array
 */
const insertRows = async <T extends Record<string, unknown>>(
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
  options?: InsertRowsOptions,
) => {
  if (rows.length === 0 || columns.length === 0) {
    return [] as T[];
  }

  const jsonbColumns = new Set(options?.jsonbColumns ?? []);
  const chunkSize = Math.max(1, Math.floor(MAX_PARAMETERS / columns.length));
  const returned: T[] = [];

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);

    const placeholders = chunk
      .map((_, rowIndex) => {
        const cells = columns.map((column, columnIndex) => {
          const position = rowIndex * columns.length + columnIndex + 1;

          return jsonbColumns.has(column) ? `$${position}::jsonb` : `$${position}`;
        });

        return `(${cells.join(', ')})`;
      })
      .join(', ');

    const parameters = chunk.flatMap((row) =>
      columns.map((column) => {
        const value = row[column] ?? null;

        if (jsonbColumns.has(column)) {
          return value === null ? null : JSON.stringify(value);
        }

        return value as string | number | boolean | null;
      }),
    );

    const statement = [
      `INSERT INTO ${table} (${columns.join(', ')})`,
      `VALUES ${placeholders}`,
      options?.onConflict ? `ON CONFLICT ${options.onConflict}` : '',
      options?.returning ? `RETURNING ${options.returning}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const result = await client.unsafe(statement, parameters);

    if (options?.returning) {
      returned.push(...(result as unknown as T[]));
    }
  }

  return returned;
};

export default insertRows;
