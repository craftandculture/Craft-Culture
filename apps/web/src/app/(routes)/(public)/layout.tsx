import { PropsWithChildren } from 'react';

import Footer from '@/app/_website/shared/components/Footer';

const Layout = ({ children }: PropsWithChildren) => {
  return (
    <div className="bg-background-muted flex h-screen flex-col">
      <main className="my-24 flex flex-1 items-start justify-center">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
