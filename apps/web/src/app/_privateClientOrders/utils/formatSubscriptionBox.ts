import { SUBSCRIPTION_TIERS } from '../constants';

interface SubscriptionBox {
  subscriptionTier: string | null;
  subscriptionCaseSize: number | null;
  subscriptionVariant: string | null;
}

/**
 * Name a subscription box the way it is written on the box tag
 *
 * @example
 *   formatSubscriptionBox({
 *     subscriptionTier: 'discovery',
 *     subscriptionCaseSize: 3,
 *     subscriptionVariant: 'Mix',
 *   }); // 'Discovery 3 · Mix'
 *
 * @param box - The order's subscription fields
 * @returns The box name, or null when the order is not a subscription box
 */
const formatSubscriptionBox = ({
  subscriptionTier,
  subscriptionCaseSize,
  subscriptionVariant,
}: SubscriptionBox) => {
  if (!subscriptionTier) return null;

  const tier =
    SUBSCRIPTION_TIERS.find((t) => t.value === subscriptionTier)?.label ??
    subscriptionTier;

  return [
    [tier, subscriptionCaseSize].filter(Boolean).join(' '),
    subscriptionVariant,
  ]
    .filter(Boolean)
    .join(' · ');
};

export default formatSubscriptionBox;
