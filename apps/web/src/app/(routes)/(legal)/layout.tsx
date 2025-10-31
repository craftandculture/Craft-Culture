import Link from 'next/link';

import Footer from '@/app/_ui/components/Footer/Footer';
import Logo from '@/app/_ui/components/Logo/Logo';
import ThemeToggle from '@/app/_ui/components/ThemeToggle/ThemeToggle';

/**
 * Layout for legal pages (privacy policy, terms of service)
 *
 * Simple public layout with header and footer, no authentication required
 */
const LegalLayout = ({ children }: React.PropsWithChildren) => {
  return (
    <div className="bg-background-primary flex min-h-dvh flex-col">
      <header className="border-border-primary border-b">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Link href="/">
            <Logo height={144} />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
};

export default LegalLayout;
