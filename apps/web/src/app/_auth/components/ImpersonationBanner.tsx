'use client';

import { IconArrowLeft, IconEye } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

export interface ImpersonationBannerProps {
  userName: string | null;
  userEmail: string;
}

/**
 * Banner shown when an admin is impersonating a user
 *
 * Displays who is being impersonated and provides an exit button
 */
const ImpersonationBanner = ({
  userName,
  userEmail,
}: ImpersonationBannerProps) => {
  const router = useRouter();
  const api = useTRPC();
  const [isExiting, setIsExiting] = useState(false);

  const stopImpersonate = useMutation(
    api.users.stopImpersonate.mutationOptions({
      onSuccess: () => {
        // Redirect to login page after stopping impersonation
        router.push('/sign-in');
        router.refresh();
      },
      onError: (error) => {
        console.error('Failed to stop impersonation:', error);
        setIsExiting(false);
      },
    }),
  );

  const handleExit = () => {
    setIsExiting(true);
    stopImpersonate.mutate();
  };

  return (
    <div className="bg-amber-500 dark:bg-amber-600 text-amber-950 dark:text-amber-50 px-4 py-2 sticky top-0 z-50 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <IconEye size={20} />
        <Typography variant="bodySm" className="text-inherit font-semibold">
          Viewing as: {userName || 'Unknown'} ({userEmail})
        </Typography>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExit}
        isDisabled={isExiting}
        className="border-amber-700 text-amber-900 hover:bg-amber-400 dark:border-amber-400 dark:text-amber-50 dark:hover:bg-amber-700"
      >
        <ButtonContent>
          <IconArrowLeft size={16} />
          {isExiting ? 'Exiting...' : 'Exit Impersonation'}
        </ButtonContent>
      </Button>
    </div>
  );
};

export default ImpersonationBanner;
