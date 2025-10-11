import { PropsWithChildren } from 'react';

const Layout = ({ children }: PropsWithChildren) => {
  return (
    <div className="bg-background-muted md:bg-background-primary flex grow flex-col">
      <div className="bg-surface-muted hidden h-56 w-full md:block" />
      <main className="flex flex-1 items-start justify-center p-5 md:mt-24 md:-translate-y-56 md:p-0">
        {children}
      </main>
    </div>
  );
};

export default Layout;
