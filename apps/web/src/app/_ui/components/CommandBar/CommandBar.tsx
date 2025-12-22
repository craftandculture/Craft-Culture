'use client';

import { IconFileText, IconSearch, IconWine } from '@tabler/icons-react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Command bar component for quick navigation and search
 * Opens with Cmd+K (Mac) or Ctrl+K (Windows)
 *
 * @example
 *   <CommandBar />
 */
const CommandBar = () => {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = useCallback(
    (value: string) => {
      setOpen(false);
      router.push(value);
    },
    [router],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <Command className="[&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide">
          <div className="flex items-center border-b border-border-muted px-3">
            <IconSearch className="mr-2 h-4 w-4 shrink-0 text-text-muted" />
            <Command.Input
              placeholder="Search or type a command..."
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50"
            />
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border-muted bg-fill-muted px-1.5 font-mono text-[10px] font-medium text-text-muted sm:flex">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center">
              <Typography variant="bodySm" colorRole="muted">
                No results found.
              </Typography>
            </Command.Empty>

            <Command.Group heading="Navigation">
              <Command.Item
                value="quotes"
                onSelect={() => handleSelect('/platform/quotes')}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors aria-selected:bg-fill-muted aria-selected:text-text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <IconFileText className="h-4 w-4 text-text-muted" />
                <span>Quote Builder</span>
              </Command.Item>
              <Command.Item
                value="catalogue"
                onSelect={() => handleSelect('/platform/quotes#catalogue')}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors aria-selected:bg-fill-muted aria-selected:text-text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <IconWine className="h-4 w-4 text-text-muted" />
                <span>Product Catalogue</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Quick Actions">
              <Command.Item
                value="new quote"
                onSelect={() => handleSelect('/platform/quotes')}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors aria-selected:bg-fill-muted aria-selected:text-text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded bg-fill-brand/10 text-[10px] font-semibold text-text-brand">
                  +
                </span>
                <span>Create New Quote</span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t border-border-muted px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>Navigate with</span>
              <kbd className="rounded border border-border-muted bg-fill-muted px-1 font-mono text-[10px]">
                ↑
              </kbd>
              <kbd className="rounded border border-border-muted bg-fill-muted px-1 font-mono text-[10px]">
                ↓
              </kbd>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>Select with</span>
              <kbd className="rounded border border-border-muted bg-fill-muted px-1 font-mono text-[10px]">
                ↵
              </kbd>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

export default CommandBar;
