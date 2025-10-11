'use client';

import { IconArrowLeft } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';

const ProfileBackButton = () => {
  const router = useRouter();

  return (
    <Button variant="ghost" onClick={() => router.back()}>
      <ButtonContent
        contentLeft={<Icon icon={IconArrowLeft} colorRole="muted" />}
      >
        Ga terug
      </ButtonContent>
    </Button>
  );
};

export default ProfileBackButton;
