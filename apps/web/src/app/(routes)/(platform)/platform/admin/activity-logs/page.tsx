import { Suspense } from 'react';

import ActivityLogsTable from '@/app/_admin/components/ActivityLogsTable';
import ActivityLogsTableSkeleton from '@/app/_admin/components/ActivityLogsTableSkeleton';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';

const ActivityLogsPage = () => {
  return (
    <main className="container py-8 md:py-16">
      <Card className="mx-auto w-full max-w-7xl">
        <CardContent>
          <CardProse>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription colorRole="muted">
              View all administrative actions performed in the system
            </CardDescription>
          </CardProse>
          <Suspense fallback={<ActivityLogsTableSkeleton />}>
            <ActivityLogsTable />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
};

export default ActivityLogsPage;
