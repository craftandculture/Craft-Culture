import { IconClock, IconMail } from '@tabler/icons-react';
import { headers } from 'next/headers';
import Link from 'next/link';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Logo from '@/app/_ui/components/Logo/Logo';
import Typography from '@/app/_ui/components/Typography/Typography';
import authServerClient from '@/lib/better-auth/server';

/**
 * Pending approval page shown to users waiting for admin approval
 *
 * This page is shown to both pending and rejected users (same message for softer UX)
 */
const PendingApprovalPage = async () => {
  const session = await authServerClient.api.getSession({
    headers: await headers(),
  });

  const user = session?.user;

  return (
    <div className="bg-background-primary flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo height={32} />
        </div>

        {/* Main Card */}
        <Card>
          <CardContent className="space-y-6 p-8">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="bg-surface-secondary text-text-muted flex h-16 w-16 items-center justify-center rounded-full">
                <IconClock className="h-8 w-8" />
              </div>
            </div>

            {/* Heading */}
            <div className="space-y-2 text-center">
              <Typography variant="headingLg" className="font-semibold">
                Account Pending Approval
              </Typography>
              <Typography variant="bodyMd" className="text-text-secondary">
                Thank you for signing up, {user?.name || 'there'}!
              </Typography>
            </div>

            {/* Message */}
            <div className="bg-surface-muted space-y-3 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <IconMail className="text-text-muted mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <Typography variant="bodySm" className="text-text-primary font-medium">
                    Your account is being reviewed
                  </Typography>
                  <Typography variant="bodySm" className="text-text-secondary">
                    Our team will review your account and send you an email once you&apos;ve
                    been approved. This usually takes 1-2 business days.
                  </Typography>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="space-y-2 text-center">
              <Typography variant="bodyXs" className="text-text-muted">
                Your email: <span className="font-medium">{user?.email}</span>
              </Typography>
              <Typography variant="bodyXs" className="text-text-muted">
                Questions? Contact us at{' '}
                <a
                  href="mailto:support@craftculture.xyz"
                  className="text-text-primary underline hover:no-underline"
                >
                  support@craftculture.xyz
                </a>
              </Typography>
            </div>

            {/* Sign Out Button */}
            <form action={async () => {
              'use server';
              await authServerClient.api.signOut({
                headers: await headers(),
              });
            }}>
              <Button type="submit" variant="outline" className="w-full">
                <ButtonContent>Sign Out</ButtonContent>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center">
          <Link
            href="/"
            className="text-text-secondary hover:text-text-primary text-sm underline hover:no-underline"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PendingApprovalPage;
