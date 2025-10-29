import { PropsWithChildren } from 'react';

import Logo from '@/app/_ui/components/Logo/Logo';

const AuthLayout = async ({ children }: PropsWithChildren) => {
  return (
    <div className="bg-background-muted flex h-screen flex-col">
      <main className="flex min-h-screen flex-1 items-center justify-center">
        <div className="container mx-auto flex w-full max-w-sm flex-col items-center gap-8">
          <div>
            <Logo className="h-24 w-auto" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
