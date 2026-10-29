import { Suspense } from 'react';

import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

import SettingsForm from './SettingsForm';

const SettingsAdminPage = () => {
  return (
    <main className="container space-y-8 py-8 md:py-16">
      <AdminPageHeader
        className="mx-auto w-full max-w-3xl"
        title="Platform Settings"
        description="Configure global platform settings including lead times and delivery estimates"
      />
      <Card className="mx-auto w-full max-w-3xl">
        <CardContent>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <SettingsForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
};

export default SettingsAdminPage;
