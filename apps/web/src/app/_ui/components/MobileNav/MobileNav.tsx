'use client';

import { IconChevronDown, IconMenu2, IconSearch, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

import { activeHref } from '@/app/_admin/constants/adminNav';
import Button from '@/app/_ui/components/Button/Button';
import Icon, { type IconProp } from '@/app/_ui/components/Icon/Icon';
import Sheet from '@/app/_ui/components/Sheet/Sheet';
import SheetClose from '@/app/_ui/components/Sheet/SheetClose';
import SheetContent from '@/app/_ui/components/Sheet/SheetContent';
import SheetTitle from '@/app/_ui/components/Sheet/SheetTitle';
import SheetTrigger from '@/app/_ui/components/Sheet/SheetTrigger';

export interface NavSection {
  title: string;
  icon?: IconProp;
  links: { href: string; label: string }[];
}

interface MobileNavProps {
  sections: NavSection[];
  /** Pinned below the links, e.g. the theme switch */
  footer?: React.ReactNode;
}

/** Enough links that finding one by name beats scrolling */
const SEARCH_FROM = 12;

const linkClass = (isActive: boolean) =>
  `flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
    isActive ? 'bg-text-primary text-white' : 'text-text-primary hover:bg-fill-muted active:bg-fill-muted'
  }`;

/**
 * The menu on phones and tablets: a drawer from the left
 *
 * It scrolls on its own, so a long admin menu is reachable in portrait; the
 * whole page is locked while it is open, which is what used to cut it off.
 * A section with several pages opens and closes, and the one you are in starts
 * open. With enough pages, a search filters them by name across every section.
 */
const MobileNav = ({ sections, footer }: MobileNavProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const pathname = usePathname();

  const current = activeHref(pathname, sections.flatMap((section) => section.links.map((link) => link.href)));
  const currentSection = sections.find((section) => section.links.some((link) => link.href === current))?.title;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const linkCount = sections.reduce((n, section) => n + section.links.length, 0);
  const term = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      term
        ? sections.flatMap((section) =>
            section.links
              .filter((link) => link.label.toLowerCase().includes(term) || section.title.toLowerCase().includes(term))
              .map((link) => ({ ...link, section: section.title })),
          )
        : [],
    [sections, term],
  );

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Each opening starts with only your own section open
      setQuery('');
      setExpanded(new Set(currentSection ? [currentSection] : []));
    }
  };

  const toggle = (title: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="lg:hidden" aria-label="Open menu">
          <Icon icon={IconMenu2} size="md" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-80 max-w-[85vw] flex-col gap-0 p-0">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-muted px-4">
          <SheetTitle className="text-lg font-semibold">Menu</SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="sm" aria-label="Close menu">
              <Icon icon={IconX} size="sm" />
            </Button>
          </SheetClose>
        </div>

        {linkCount >= SEARCH_FROM && (
          <div className="shrink-0 border-b border-border-muted p-3">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a page"
                aria-label="Find a page"
                className="h-11 w-full rounded-lg border border-border-muted bg-fill-primary pl-9 pr-3 text-base text-text-primary placeholder:text-text-muted focus:border-text-primary focus:outline-none sm:text-sm"
              />
            </div>
          </div>
        )}

        <nav className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 ${footer ? '' : 'pb-[calc(0.75rem+env(safe-area-inset-bottom))]'}`}>
          {term ? (
            matches.length ? (
              <ul className="space-y-0.5">
                {matches.map((link) => (
                  <li key={`${link.section}-${link.href}`}>
                    <Link href={link.href} onClick={close} className={`${linkClass(link.href === current)} justify-between gap-3`}>
                      <span>{link.label}</span>
                      <span className={`text-xs ${link.href === current ? 'text-white/80' : 'text-text-muted'}`}>{link.section}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-6 text-center text-sm text-text-muted">No page matches “{query.trim()}”</p>
            )
          ) : (
            <ul className="space-y-0.5">
              {sections.map((section) => {
                // A section of one page is that page, not a heading to open
                if (section.links.length === 1) {
                  const [link] = section.links;
                  return (
                    <li key={section.title}>
                      <Link href={link!.href} onClick={close} className={`${linkClass(link!.href === current)} gap-3`}>
                        {section.icon && <Icon icon={section.icon} size="sm" className={link!.href === current ? 'text-white' : 'text-text-muted'} />}
                        {section.title}
                      </Link>
                    </li>
                  );
                }

                const isOpen = expanded.has(section.title);
                const holdsCurrent = section.title === currentSection;
                return (
                  <li key={section.title}>
                    <button
                      type="button"
                      onClick={() => toggle(section.title)}
                      aria-expanded={isOpen}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-colors hover:bg-fill-muted active:bg-fill-muted ${
                        holdsCurrent ? 'text-text-primary' : 'text-text-primary'
                      }`}
                    >
                      {section.icon && <Icon icon={section.icon} size="sm" className={holdsCurrent ? 'text-text-primary' : 'text-text-muted'} />}
                      <span className="flex-1">{section.title}</span>
                      <IconChevronDown className={`h-4 w-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <ul className="mb-1 ml-5 space-y-0.5 border-l border-border-muted pl-2">
                        {section.links.map((link) => (
                          <li key={link.href}>
                            <Link href={link.href} onClick={close} className={linkClass(link.href === current)}>
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {footer && (
          <div className="flex shrink-0 items-center justify-between border-t border-border-muted px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
