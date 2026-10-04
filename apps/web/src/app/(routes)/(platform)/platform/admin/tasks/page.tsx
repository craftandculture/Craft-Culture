import { redirect } from 'next/navigation';

import getUserOrRedirect from '@/app/_auth/data/getUserOrRedirect';
import TeamTasksClient from '@/app/_teamTasks/components/TeamTasksClient';
import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Team Tasks
 *
 * The team's shared job list, replacing the weekly PDF. Every member of staff
 * can add, edit, reassign, close and reopen any job; #tasks in Slack is told
 * when a job opens or closes. C&C staff only.
 */
const TeamTasksPage = async ({ searchParams }: { searchParams: Promise<{ job?: string }> }) => {
  const user = await getUserOrRedirect();

  if (!isTeamMember(user)) {
    redirect('/platform');
  }

  const { job } = await searchParams;

  return (
    <main className="container space-y-5 py-6">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Team tasks</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1">
            Who is doing what, and by when. New and closed jobs are posted to #tasks.
          </p>
        </Typography>
      </div>
      <TeamTasksClient initialJobId={job} />
    </main>
  );
};

export default TeamTasksPage;
