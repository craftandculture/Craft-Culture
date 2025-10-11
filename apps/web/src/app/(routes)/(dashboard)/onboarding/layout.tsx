import { PropsWithChildren } from 'react';

import SignOutButton from '@/app/_onboarding/components/SignOutButton';
import DashboardFooter from '@/app/_shared-platform/components/DashboardFooter';
import Logo from '@/app/_ui/components/Logo/Logo';

export const dynamic = 'force-dynamic';

const Layout = ({ children }: PropsWithChildren) => {
  return (
    <div className="bg-background-muted flex h-screen flex-col">
      <main className="my-24 flex flex-1 items-start justify-center">
        <div className="container mx-auto flex w-full max-w-lg flex-col gap-8">
          <Logo className="h-6" />
          {children}
          <SignOutButton />
        </div>
      </main>
      <DashboardFooter />
    </div>
  );
};

export default Layout;
