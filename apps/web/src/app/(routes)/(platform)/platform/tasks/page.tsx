import { redirect } from 'next/navigation';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import PartnerTasksClient from '@/app/_teamTasks/components/PartnerTasksClient';
import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Shared tasks, for partners
 *
 * The jobs Craft & Culture has shared with the partner: who is doing what, by
 * when, and a place to tick off their own parts and leave notes. C&C staff
 * use the full Team Tasks page instead.
 */
const PartnerTasksPage = async () => {
  const user = await getUserOrRedirect();

  if (isTeamMember(user)) {
    redirect('/platform/admin/tasks');
  }

  return (
    <main className="container max-w-3xl space-y-5 py-6">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Shared tasks</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1">Jobs we are working on together. Tick your part when it is done, or leave us a note.</p>
        </Typography>
      </div>
      <PartnerTasksClient />
    </main>
  );
};

export default PartnerTasksPage;
