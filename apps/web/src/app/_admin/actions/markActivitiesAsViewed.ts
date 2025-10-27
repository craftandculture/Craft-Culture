'use server';

/**
 * Server action to mark all activities as viewed for the current user
 *
 * Note: Temporarily disabled - requires database migration to add lastViewedActivityAt column
 */
const markActivitiesAsViewed = async () => {
  // Temporarily disabled until database migration is complete
  return { success: true };
};

export default markActivitiesAsViewed;
