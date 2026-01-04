'use client';

import { IconMenu2, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Sheet from '@/app/_ui/components/Sheet/Sheet';
import SheetClose from '@/app/_ui/components/Sheet/SheetClose';
import SheetContent from '@/app/_ui/components/Sheet/SheetContent';
import SheetTitle from '@/app/_ui/components/Sheet/SheetTitle';
import SheetTrigger from '@/app/_ui/components/Sheet/SheetTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';

interface NavSection {
  title: string;
  links: { href: string; label: string }[];
}

interface MobileNavProps {
  sections: NavSection[];
}

/**
 * Mobile navigation drawer for the platform
 */
const MobileNav = ({ sections }: MobileNavProps) => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Icon icon={IconMenu2} size="md" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex h-14 items-center justify-between border-b border-border-muted px-4">
          <SheetTitle className="text-lg font-semibold">Menu</SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="sm">
              <Icon icon={IconX} size="sm" />
            </Button>
          </SheetClose>
        </div>
        <nav className="flex flex-col gap-2 p-4">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              <Typography variant="bodyXs" colorRole="muted" className="px-2 font-semibold uppercase tracking-wider">
                {section.title}
              </Typography>
              {section.links.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-fill-brand text-white'
                        : 'text-text-primary hover:bg-fill-muted'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
