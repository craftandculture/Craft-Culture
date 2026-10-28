'use client';

import { IconClock, IconMail, IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Logo from '@/app/_ui/components/Logo/Logo';
import Typography from '@/app/_ui/components/Typography/Typography';
import authBrowserClient from '@/lib/better-auth/browser';
import useTRPC from '@/lib/trpc/browser';

/**
 * Pending approval page shown to users waiting for admin approval
 *
 * This page is shown to both pending and rejected users (same message for softer UX)
 * It checks quietly every 10 seconds, and on request, and says so in plain
 * words rather than as a status readout.
 */
const PendingApprovalPage = () => {
  const api = useTRPC();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  const { data: user, refetch } = useQuery(api.users.getMe.queryOptions());

  // Auto-poll every 10 seconds to check if user is approved
  useEffect(() => {
    const interval = setInterval(() => {
      void refetch();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [refetch]);

  // Redirect to platform when approved
  useEffect(() => {
    if (user?.approvalStatus === 'approved') {
      router.push('/platform');
    }
  }, [user?.approvalStatus, router]);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    await refetch();
    setIsChecking(false);
  };

  const handleSignOut = () => {
    void authBrowserClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/sign-in');
        },
      },
    });
  };

  return (
    <div className="bg-background-primary flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo height={150} />
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
                Thank you{user?.name ? `, ${user.name}` : ''}
              </Typography>
              <Typography variant="bodyMd" className="text-text-secondary">
                We are reviewing your account.
              </Typography>
            </div>

            {/* Message */}
            <div className="bg-surface-muted space-y-3 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <IconMail className="text-text-muted mt-0.5 h-5 w-5 shrink-0" />
                <Typography variant="bodySm" className="text-text-secondary">
                  A member of our team will be in touch by email as soon as your
                  account is ready, usually within a couple of hours. This page
                  will open your account by itself once it is approved.
                </Typography>
              </div>
            </div>

            {/* Additional Info */}
            <div className="space-y-2 text-center">
              <Typography variant="bodyXs" className="text-text-muted">
                We will write to <span className="font-medium">{user?.email}</span>
              </Typography>
              <Typography variant="bodyXs" className="text-text-muted">
                If you have any questions, please write to{' '}
                <a
                  href="mailto:support@craftculture.xyz"
                  className="text-text-primary underline hover:no-underline"
                >
                  support@craftculture.xyz
                </a>
              </Typography>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleCheckStatus}
              isDisabled={isChecking}
            >
              <ButtonContent iconLeft={IconRefresh}>
                {isChecking ? 'Checking' : 'Check again'}
              </ButtonContent>
            </Button>

            {/* Sign Out Button */}
            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              <ButtonContent>Sign out</ButtonContent>
            </Button>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center">
          <Link
            href="/"
            className="text-text-secondary hover:text-text-primary text-sm underline hover:no-underline"
          >
            Back to the home page
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PendingApprovalPage;
