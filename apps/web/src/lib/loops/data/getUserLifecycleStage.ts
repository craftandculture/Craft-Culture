export type UserLifecycleStage =
  | 'lead'
  | 'trial'
  | 'trial_expired'
  | 'active'
  | 'canceled'
  | 'churned';

export interface GetUserLifecycleStageParams {
  user: {
    organizationsMembers: {
      organization: {
        subscriptions: {
          startDate: Date;
          endDate: Date | null;
        }[];
        trialEndsAt: Date;
        administrations: {
          id: number;
        }[];
      };
    }[];
  };
}

/**
 * Determines a user's lifecycle stage based on their organization memberships.
 *
 * Hierarchy (highest to lowest):
 *
 * - Active: User has at least one organization with active subscription
 * - Canceled: User has canceled subscription(s) that haven't expired yet
 * - Churned: User had subscription(s) that have now expired
 * - Trial: User has organization(s) in trial period
 * - Trial Expired: User's trial has expired, no subscription started
 * - Lead: User has no organizations
 *
 * This ensures users receive emails relevant to their most advanced state.
 */
const getUserLifecycleStage = ({
  user,
}: GetUserLifecycleStageParams): {
  lifecycleStage: UserLifecycleStage;
  organizationCount: number;
  administrationCount: number;
  lastTrialEndsAt?: Date;
} => {
  const now = new Date();
  const organizationCount = user.organizationsMembers.length;

  // No organizations = lead
  if (organizationCount === 0) {
    return {
      lifecycleStage: 'lead',
      organizationCount: 0,
      administrationCount: 0,
      lastTrialEndsAt: undefined,
    };
  }

  // Total administrations across all organizations
  const administrationCount = user.organizationsMembers.reduce(
    (total, member) => total + member.organization.administrations.length,
    0,
  );

  // Calculate latest trial end date across all organizations
  const trialDates = user.organizationsMembers
    .map((m) => m.organization.trialEndsAt)
    .filter((date): date is Date => date !== null);

  const lastTrialEndsAt =
    trialDates.length > 0
      ? trialDates.reduce((latest, current) =>
          current > latest ? current : latest,
        )
      : undefined;

  // Has at least one organization with active subscription = active
  const hasActiveSubscription = user.organizationsMembers.some((m) =>
    m.organization.subscriptions.some(
      (s) => s.startDate <= now && s.endDate === null,
    ),
  );

  if (hasActiveSubscription) {
    return {
      lifecycleStage: 'active',
      organizationCount,
      administrationCount,
      lastTrialEndsAt,
    };
  }

  // Has subscription that is canceled but not yet expired
  const hasCanceledSubscription = user.organizationsMembers.some((m) =>
    m.organization.subscriptions.some(
      (s) => s.endDate !== null && s.endDate > now,
    ),
  );

  if (hasCanceledSubscription) {
    return {
      lifecycleStage: 'canceled',
      organizationCount,
      administrationCount,
      lastTrialEndsAt,
    };
  }

  // Had subscription(s) that have now expired
  const hasChurnedSubscription = user.organizationsMembers.some((m) =>
    m.organization.subscriptions.some(
      (s) => s.endDate !== null && s.endDate < now,
    ),
  );

  if (hasChurnedSubscription) {
    return {
      lifecycleStage: 'churned',
      organizationCount,
      administrationCount,
      lastTrialEndsAt,
    };
  }

  // Has organization(s) currently in trial period
  const hasActiveTrialOrg = user.organizationsMembers.some(
    (m) => m.organization.trialEndsAt > now,
  );

  if (hasActiveTrialOrg) {
    return {
      lifecycleStage: 'trial',
      organizationCount,
      administrationCount,
      lastTrialEndsAt,
    };
  }

  // Trial has expired, no subscription started
  return {
    lifecycleStage: 'trial_expired',
    organizationCount,
    administrationCount,
    lastTrialEndsAt,
  };
};

export default getUserLifecycleStage;
