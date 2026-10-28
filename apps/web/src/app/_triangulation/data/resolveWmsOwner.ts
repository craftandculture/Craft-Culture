import { client } from '@/database/client';

/**
 * The WMS owner name a programme's warehouse syncs match on
 *
 * The programme's own setting wins. The browser used to send whatever was in
 * the owner box (or remembered in local storage), so the same sync could read a
 * different owner's stock depending on who ran it. The value sent is only used
 * for a programme that has no owner configured yet.
 *
 * @example
 *   const owner = await resolveWmsOwner(programmeId, input.ownerName);
 *
 * @param programmeId - The programme being synced
 * @param requested - The owner name sent with the request, if any
 * @returns The owner name to match WMS stock against ('' when there is none)
 */
const resolveWmsOwner = async (
  programmeId: string,
  requested?: string | null,
) => {
  const [programme] = await client<{ wmsOwnerMatch: string | null }[]>`
    SELECT wms_owner_match AS "wmsOwnerMatch"
    FROM tri_programmes
    WHERE id = ${programmeId}
    LIMIT 1
  `;

  return programme?.wmsOwnerMatch?.trim() || requested?.trim() || '';
};

export default resolveWmsOwner;
