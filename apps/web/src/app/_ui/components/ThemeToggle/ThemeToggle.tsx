'use client';

import { IconMoon, IconSun } from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';

/**
 * Floating theme toggle button that switches between light and dark modes
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
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          variant="primary"
          size="lg"
          shape="circle"
          className="shadow-lg"
        >
          <ButtonContent>
            <div className="size-5" />
          </ButtonContent>
        </Button>
      </div>
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
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        variant="primary"
        size="lg"
        shape="circle"
        onClick={handleToggle}
        className="shadow-lg transition-transform hover:scale-105"
      >
        <ButtonContent>
          <Icon icon={isDark ? IconSun : IconMoon} size="lg" />
        </ButtonContent>
      </Button>
    </div>
  );
};

export default ThemeToggle;
