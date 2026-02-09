'use client';

import { IconArrowLeft, IconLogout, IconMenu2, IconUser } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import ThemeToggle from '@/app/_ui/components/ThemeToggle/ThemeToggle';
import Typography from '@/app/_ui/components/Typography/Typography';

interface WMSHeaderProps {
  userName: string;
}

/**
 * Minimal header for WMS warehouse mode
 * Shows back button, warehouse title, and user info
 */
const WMSHeader = ({ userName }: WMSHeaderProps) => {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Determine if we're on the WMS dashboard or a sub-page
  const isWMSDashboard = pathname === '/platform/admin/wms';

  return (
    <header className="border-border-primary sticky top-0 z-50 border-b bg-background-primary">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left side - Back button or Menu */}
        <div className="flex items-center gap-3">
          {isWMSDashboard ? (
            // On dashboard, show link back to admin
            <Link
              href="/platform/admin"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-text-muted transition-colors hover:bg-fill-secondary hover:text-text-primary"
            >
              <IconArrowLeft className="h-5 w-5" />
              <span className="hidden text-sm font-medium sm:inline">Admin</span>
            </Link>
          ) : (
            // On sub-pages, show link back to WMS dashboard
            <Link
              href="/platform/admin/wms"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-text-muted transition-colors hover:bg-fill-secondary hover:text-text-primary"
            >
              <IconArrowLeft className="h-5 w-5" />
              <span className="hidden text-sm font-medium sm:inline">WMS</span>
            </Link>
          )}

          {/* Title */}
          <div className="flex items-center gap-2">
            <Typography variant="headingSm" className="text-text-primary">
              Warehouse
            </Typography>
          </div>
        </div>

        {/* Right side - User info and menu */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* User dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-text-muted transition-colors hover:bg-fill-secondary hover:text-text-primary"
            >
              <Icon icon={IconUser} size="sm" />
              <span className="hidden text-sm font-medium sm:inline">{userName}</span>
              <Icon icon={IconMenu2} size="sm" className="sm:hidden" />
            </button>

            {menuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                {/* Dropdown menu */}
                <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border-primary bg-background-primary py-1 shadow-lg">
                  <div className="border-b border-border-primary px-4 py-2 sm:hidden">
                    <Typography variant="bodySm" className="font-medium">
                      {userName}
                    </Typography>
                  </div>
                  <Link
                    href="/platform/admin"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-text-muted hover:bg-fill-secondary hover:text-text-primary"
                    onClick={() => setMenuOpen(false)}
                  >
                    <IconArrowLeft className="h-4 w-4" />
                    Back to Admin
                  </Link>
                  <Link
                    href="/sign-out"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-text-muted hover:bg-fill-secondary hover:text-text-primary"
                    onClick={() => setMenuOpen(false)}
                  >
                    <IconLogout className="h-4 w-4" />
                    Sign Out
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default WMSHeader;
