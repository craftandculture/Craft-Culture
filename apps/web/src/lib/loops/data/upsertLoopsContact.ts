import parse from 'another-name-parser';

import tryCatch from '@/utils/tryCatch';

import loops from '../client';

/**
 * Updates a contact in Loops, or creates if they don't exist.
 *
 * Loops automatically creates contacts if they don't exist when you call
 * updateContact. We use updateContact instead of createContact to make this
 * idempotent.
 *
 * Stores the Loops contact ID in our database for future reference.
 */
const upsertLoopsContact = async (
  email: string,
  properties?: {
    name?: string;
    lifecycleStage?:
      | 'lead'
      | 'trial'
      | 'trial_expired'
      | 'active'
      | 'churned'
      | 'canceled';
    trialEndsAt?: Date;
    subscriptionEndsAt?: Date;
    organizationCount?: number;
    administrationCount?: number;
    lastActiveAt?: Date | null;
  },
) => {
  const { first, last } = properties?.name
    ? parse(properties.name)
    : { first: undefined, last: undefined };

  const [response, error] = await tryCatch(
    loops.updateContact(email, {
      ...(first && { firstName: first }),
      ...(last && { lastName: last }),
      ...(properties?.lifecycleStage && {
        lifecycleStage: properties.lifecycleStage,
      }),
      ...(properties?.trialEndsAt && {
        trialEndsAt: properties.trialEndsAt.toISOString(),
      }),
      ...(properties?.subscriptionEndsAt && {
        subscriptionEndsAt: properties.subscriptionEndsAt.toISOString(),
      }),
      ...(properties?.organizationCount !== undefined && {
        organizationCount: properties.organizationCount,
      }),
      ...(properties?.administrationCount !== undefined && {
        administrationCount: properties.administrationCount,
      }),
      ...(properties?.lastActiveAt && {
        lastActiveAt: properties.lastActiveAt.toISOString(),
      }),
    }),
  );

  if (error) {
    throw new Error(error.message, {
      cause: error,
    });
  }

  return response.id;
};

export default upsertLoopsContact;
