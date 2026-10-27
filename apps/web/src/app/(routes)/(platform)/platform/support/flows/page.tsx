import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';

import PcoFlowsGuide from './PcoFlowsGuide';

/** PCO process guide inside the platform; same content as /docs/pco-flows */
const FlowDiagramsPage = async () => {
  const user = await getUserOrRedirect('next=/platform/support/flows');

  return <PcoFlowsGuide showAdminTab={isTeamMember(user)} />;
};

export default FlowDiagramsPage;
