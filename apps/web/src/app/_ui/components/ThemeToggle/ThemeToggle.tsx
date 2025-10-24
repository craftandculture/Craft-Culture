'use client';

import { IconMoon, IconSun } from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';

/**
 * Theme toggle button that switches between light and dark modes
 *
 * @example
 *   <ThemeToggle />
 */
const ThemeToggle = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        colorRole="muted"
        size="sm"
        shape="circle"
        className="shrink-0"
      >
        <ButtonContent>
          <div className="size-4" />
        </ButtonContent>
      </Button>
    );
  }

  const handleToggle = () => {
    if (theme === 'system') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    } else {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      colorRole="muted"
      size="sm"
      shape="circle"
      onClick={handleToggle}
      className="shrink-0"
    >
      <ButtonContent>
        <Icon icon={isDark ? IconSun : IconMoon} size="sm" />
      </ButtonContent>
    </Button>
  );
};

export default ThemeToggle;
