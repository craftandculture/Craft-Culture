import { redirect } from 'next/navigation';

/**
 * Activity logs page - redirects to the new activity feed page
 */
const ActivityLogsPage = () => {
  redirect('/platform/admin/activity');
};

export default ActivityLogsPage;
