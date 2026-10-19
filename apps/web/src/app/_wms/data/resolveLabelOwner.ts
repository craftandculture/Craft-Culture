import logger from '@/utils/logger';

import getHiddenLabelOwners from './getHiddenLabelOwners';
import labelOwnerText from '../utils/labelOwnerText';

/**
 * The owner text for a label printed on the server
 *
 * Loads who is hidden and applies the label rule. If that cannot be loaded the
 * label prints PRIVATE CLIENT rather than risk a name.
 *
 * @param owner - The stock owner, by id and/or name
 * @returns The text for the label's owner field
 */
const resolveLabelOwner = async (owner: {
  id?: string | null;
  name?: string | null;
}) => {
  try {
    return labelOwnerText(owner, await getHiddenLabelOwners());
  } catch (error) {
    logger.error('Could not load hidden label owners', { error });
    return labelOwnerText(owner, null);
  }
};

export default resolveLabelOwner;
