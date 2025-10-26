import { Suspense } from 'react';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

import SettingsForm from './SettingsForm';

const SettingsAdminPage = () => {
  return (
    <main className="container space-y-8 py-8 md:py-16">
      <Card className="mx-auto w-full max-w-3xl">
        <CardContent>
          <CardProse>
            <CardTitle>Platform Settings</CardTitle>
            <CardDescription colorRole="muted">
              Configure global platform settings including lead times and delivery estimates
            </CardDescription>
          </CardProse>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <SettingsForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
};

export default SettingsAdminPage;
