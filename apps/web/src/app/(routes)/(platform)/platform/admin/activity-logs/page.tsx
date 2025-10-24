import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Typography from '@/app/_ui/components/Typography/Typography';

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
          <div className="mt-8 text-center">
            <Typography variant="bodySm" colorRole="muted">
              Activity logs feature is currently being updated. Please check
              back later.
            </Typography>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default ActivityLogsPage;
