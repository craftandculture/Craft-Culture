import type { ProductUpdateAudience } from '../types';

/**
 * Which updates a stock owner sees: the one place an account becomes an audience
 *
 * @example
 *   audienceForPartnerType('private_collector'); // 'collector'
 *
 * @param partnerType - The type of the partner the member belongs to
 * @returns The audience whose published updates they are shown
 */
const audienceForPartnerType = (partnerType: string | null | undefined): ProductUpdateAudience =>
  partnerType === 'private_collector' ? 'collector' : 'wine_partner';

export default audienceForPartnerType;
