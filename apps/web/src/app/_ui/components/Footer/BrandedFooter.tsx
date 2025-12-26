import Link from 'next/link';

import WarehouseDataFeed from '@/app/_warehouse/components/WarehouseDataFeed';
import fetchGitHubReleases from '@/utils/fetchGitHubReleases';

export interface BrandedFooterProps {
  customerType: 'b2b' | 'b2c';
}

/**
 * Footer component with conditional branding
 *
 * - B2C: Shows "Powered by Craft & Culture"
 * - B2B: Shows full Craft & Culture branding
 *
 * @param props - The footer props including customerType
 * @returns The branded footer
 */
const BrandedFooter = async ({ customerType }: BrandedFooterProps) => {
  const currentYear = new Date().getFullYear();
  const releases = await fetchGitHubReleases();
  const latestVersion = releases[0]?.version ?? '1.0.0';

  const isB2C = customerType === 'b2c';

  return (
    <footer className="border-border-primary mt-auto border-t bg-fill-secondary/30">
      <WarehouseDataFeed />

      <div className="container py-6 md:py-8">
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {/* Company Info - Conditional */}
          <div className="space-y-2">
            <h3 className="text-text-primary text-sm font-semibold">
              {isB2C ? 'Pocket Cellar' : 'Craft & Culture'}
            </h3>
            <p className="text-text-muted text-xs leading-relaxed">
              {isB2C
                ? 'The region\'s first professional wine application built specifically for sommeliers. It combines bottle integrity, fair market pricing, and tools that allow professional expertise to be applied consistently — creating value for clients and recognition for the sommelier behind the advice.'
                : 'Building the bridge for wine & spirits brands to access, activate, and scale across the GCC.'}
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <h3 className="text-text-primary text-sm font-semibold">
              Quick Links
            </h3>
            <nav className="flex flex-col space-y-1.5">
              <Link
                href="/platform/quotes"
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                Quote Tool
              </Link>
              <Link
                href="https://craftculture.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                About Us
              </Link>
              <Link
                href="https://craftculture.xyz/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                Contact
              </Link>
            </nav>
          </div>

          {/* Support */}
          <div className="space-y-2">
            <h3 className="text-text-primary text-sm font-semibold">Support</h3>
            <nav className="flex flex-col space-y-1.5">
              <Link
                href="/platform/support"
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                Support
              </Link>
              <Link
                href="/platform/development-log"
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                Development Log
              </Link>
              <Link
                href="/platform/terms-of-use"
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                Terms Of Use
              </Link>
            </nav>
          </div>
        </div>

        {/* Bottom Bar - Conditional */}
        <div className="border-border-primary mt-6 border-t pt-4 md:mt-8 md:pt-6">
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between">
            <p className="text-text-muted text-center text-xs">
              {isB2C ? (
                <>
                  Powered by{' '}
                  <Link
                    href="https://craftculture.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-text-primary transition-colors"
                  >
                    Craft & Culture
                  </Link>
                </>
              ) : (
                `© ${currentYear} Craft & Culture. All rights reserved.`
              )}
            </p>
            <Link
              href="/platform/development-log"
              className="text-text-muted hover:text-text-primary text-xs font-light transition-colors"
            >
              v{latestVersion}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default BrandedFooter;
