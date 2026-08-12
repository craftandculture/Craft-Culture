import { client } from '@/database/client';

/**
 * Give codeless lines a matching key derived from their description
 *
 * Some sources name a wine but give it no code. Those lines all shared the
 * empty string as a key, which lumped unrelated wines into a single mapping
 * group — and mapping that group would have assigned every one of them to the
 * same SKU. Keying on the normalised description keeps each distinct wine
 * separate and lets it be mapped exactly like a coded one.
 *
 * Only ever fills a key that is missing, so it is idempotent and a no-op once
 * the data is repaired.
 *
 * @param importId - Limit the repair to one import; omit to repair everything
 * @returns How many lines were given a key
 */
const backfillDescriptionKeys = async (importId?: string) => {
  const repaired = await client<{ id: string }[]>`
    UPDATE tri_import_lines
    SET normalized_code = UPPER(REGEXP_REPLACE(raw_description, '[^A-Za-z0-9]', '', 'g')),
        updated_at = NOW()
    WHERE COALESCE(normalized_code, '') = ''
      AND COALESCE(raw_description, '') <> ''
      ${importId ? client`AND import_id = ${importId}` : client``}
    RETURNING id
  `;

  return repaired.length;
};

export default backfillDescriptionKeys;
