'use client';

import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme, forcedTheme } = useTheme();
  const pathname = usePathname();

  /*
    A member's pages have a tab bar along the bottom of a phone; notifications
    rise above it there instead of sliding in behind it.
  */
  const hasPhoneTabs = pathname?.startsWith('/platform/cellar') ?? false;

  return (
    <Sonner
      theme={(forcedTheme ?? theme) as ToasterProps['theme']}
      mobileOffset={hasPhoneTabs ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' } : undefined}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-surface-primary group-[.toaster]:text-text-primary group-[.toaster]:border-border-primary group-[.toaster]:shadow-xs',
          description: 'group-[.toast]:text-text-muted',
          actionButton:
            'group-[.toast]:bg-fill-primary group-[.toast]:text-text-primary',
          cancelButton:
            'group-[.toast]:bg-fill-primary group-[.toast]:text-text-primary',
        },
      }}
      {...props}
    />
  );
};

export default Toaster;
