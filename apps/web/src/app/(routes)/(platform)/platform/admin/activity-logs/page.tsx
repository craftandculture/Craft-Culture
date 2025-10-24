import ActivityLogsTable from '@/app/_admin/components/ActivityLogsTable';
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
            <CardTitle>Activity Logs</CardTitle>
            <CardDescription colorRole="muted">
              View all administrative actions and user sessions in the system
            </CardDescription>
          </CardProse>
          <div className="mt-8">
            <ActivityLogsTable />
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default ActivityLogsPage;
