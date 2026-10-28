import PcoFlowsGuide from '@/app/(routes)/(platform)/platform/support/flows/PcoFlowsGuide';
import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';

/**
 * PCO process guide for partners and distributors
 *
 * Linked from the partner and distributor dashboards. It describes how C&C
 * works with distributors, so it is for signed-in accounts only.
 */
const PcoFlowsPage = async () => {
  const user = await getUserOrRedirect('next=/docs/pco-flows');

  return <PcoFlowsGuide showAdminTab={isTeamMember(user)} />;
};

export default PcoFlowsPage;
