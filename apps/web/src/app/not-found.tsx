import { IconHome } from '@tabler/icons-react';
import Link from 'next/link';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Logo from '@/app/_ui/components/Logo/Logo';
import Typography from '@/app/_ui/components/Typography/Typography';

const NotFoundPage = () => {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background-muted px-4">
      <Logo className="mb-8" />
      <Typography variant="headingMd" className="mb-2">
        Page not found
      </Typography>
      <Typography variant="bodySm" colorRole="muted" className="mb-8 text-center">
        Sorry, we couldn&apos;t find the page you were looking for.
      </Typography>
      <Button variant="default" size="lg" asChild>
        <Link href="/">
          <ButtonContent iconLeft={IconHome}>Go Home</ButtonContent>
        </Link>
      </Button>
    </main>
  );
};

export default NotFoundPage;
