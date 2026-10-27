import { client } from '@/database/client';

/**
 * SQL condition: the line belongs to one programme and is not frozen
 *
 * For bulk edits keyed on a code (unmap, set aside, move). A code is not unique
 * across clients, so an edit made for one client must not touch another's
 * lines; and lines in a locked period were signed off as they are.
 *
 * @example
 *   await client`
 *     UPDATE tri_import_lines SET status = 'unmapped'
 *     WHERE normalized_code = ${code}
 *       AND ${editableLinesInProgramme(programmeId)}
 *   `;
 *
 * @param programmeId - The programme whose lines may be changed
 * @returns A fragment to drop into a WHERE clause on tri_import_lines
 */
const editableLinesInProgramme = (programmeId: string) => client`
  import_id IN (
    SELECT ei.id
    FROM tri_imports ei
    LEFT JOIN tri_periods ep ON ep.id = ei.period_id
    WHERE ei.programme_id = ${programmeId}
      AND COALESCE(ep.status::text, 'open') <> 'locked'
  )
`;

export default editableLinesInProgramme;
