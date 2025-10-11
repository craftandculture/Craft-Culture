import { Suspense } from 'react';

import MoneybirdAuthorizationCard from '@/app/_moneybird/components/MoneybirdAuthorizationCard';
import Logo from '@/app/_ui/components/Logo/Logo';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

export const dynamic = 'force-dynamic';

const Page = async (props: { params: Promise<{ code: string }> }) => {
  const params = await props.params;

  const { code } = params;

  return (
    <>
      <div className="container mx-auto flex w-full flex-col items-center gap-8">
        <Logo className="h-6" />
        <Suspense fallback={<Skeleton className="h-[437px] w-full max-w-lg" />}>
          <MoneybirdAuthorizationCard code={code} />
        </Suspense>
      </div>
    </>
  );
};

export default Page;
