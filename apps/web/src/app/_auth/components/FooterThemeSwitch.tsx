'use client';

import { IconMoon, IconSun } from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';

const FooterThemeSwitch = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      shape="circle"
      size="sm"
      onClick={() => (theme === 'dark' ? setTheme('light') : setTheme('dark'))}
    >
      <ButtonContent>
        <Icon icon={theme === 'dark' ? IconSun : IconMoon} colorRole="muted" />
      </ButtonContent>
    </Button>
  );
};

export default FooterThemeSwitch;
