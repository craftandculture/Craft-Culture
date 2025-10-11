import { PropsWithChildren } from 'react';

import Footer from '@/app/_website/shared/components/Footer';

const AuthLayout = async ({ children }: PropsWithChildren) => {
  return (
    <div className="bg-background-muted flex h-screen flex-col">
      <main className="flex min-h-screen flex-1 items-center justify-center">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default AuthLayout;
