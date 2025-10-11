'use client';

import { IconLogout } from '@tabler/icons-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import DropdownMenu from '@/app/_ui/components/DropdownMenu/DropdownMenu';
import DropdownMenuContent from '@/app/_ui/components/DropdownMenu/DropdownMenuContent';
import DropdownMenuContentWrapper from '@/app/_ui/components/DropdownMenu/DropdownMenuContentWrapper';
import DropdownMenuGroup from '@/app/_ui/components/DropdownMenu/DropdownMenuGroup';
import DropdownMenuItem from '@/app/_ui/components/DropdownMenu/DropdownMenuItem';
import DropdownMenuSeparator from '@/app/_ui/components/DropdownMenu/DropdownMenuSeparator';
import DropdownMenuTrigger from '@/app/_ui/components/DropdownMenu/DropdownMenuTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { User } from '@/database/schema';
import authBrowserClient from '@/lib/better-auth/browser';

export interface UserDropdownProps {
  user: User;
}

const UserDropdown = ({ user }: UserDropdownProps) => {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" shape="circle" className="p-0">
          <ButtonContent>
            <Image
              src={
                user.image ??
                `https://ui-avatars.com/api/?name=${user.name}&background=95E1D3&color=000000&size=64`
              }
              alt={user.name ?? 'User avatar'}
              width={32}
              height={32}
              className="size-8 rounded-full"
            />
          </ButtonContent>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup className="px-2.5 py-1.5">
          <Typography variant="bodySm">{user.name}</Typography>
          <Typography variant="bodySm" colorRole="muted">
            {user?.email}
          </Typography>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            void authBrowserClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  router.push('/sign-in');
                },
              },
            });
          }}
        >
          <DropdownMenuContentWrapper iconLeft={IconLogout} align="start">
            Sign out
          </DropdownMenuContentWrapper>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserDropdown;
