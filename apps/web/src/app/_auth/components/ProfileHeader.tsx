import Link from 'next/link';
import { Suspense } from 'react';

import UserDropdown from '@/app/_shared-platform/components/UserDropdown';
import ButtonSkeleton from '@/app/_ui/components/Button/ButtonSkeleton';
import Logo from '@/app/_ui/components/Logo/Logo';

import ProfileBackButton from './ProfileBackButton';

const ProfileHeader = () => {
  return (
    <header className="border-border-primary bg-surface-primary sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b px-6">
      <div className="flex items-center justify-start gap-3">
        <Link href="/dashboard">
          <Logo iconOnly size="sm" colorRole="brand" className="shrink-0" />
        </Link>
        <div className="bg-border-primary h-6 w-px shrink-0 rounded-full" />
        <ProfileBackButton />
      </div>
      <Suspense
        fallback={<ButtonSkeleton size="md" className="size-9 rounded-full" />}
      >
        <UserDropdown />
      </Suspense>
    </header>
  );
};

export default ProfileHeader;
