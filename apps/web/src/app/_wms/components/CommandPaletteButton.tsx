'use client';

import { IconSearch } from '@tabler/icons-react';
import { usePathname } from 'next/navigation';

import { OPEN_COMMAND_PALETTE } from './CommandPalette';

/**
 * Opens the admin command palette by touch, where there is no ⌘K
 *
 * Shown below lg and only on admin pages, where the palette is mounted.
 */
const CommandPaletteButton = () => {
  const pathname = usePathname();

  if (!pathname.startsWith('/platform/admin')) return null;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE))}
      aria-label="Search"
      className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-muted lg:hidden"
    >
      <IconSearch className="h-5 w-5" />
    </button>
  );
};

export default CommandPaletteButton;
