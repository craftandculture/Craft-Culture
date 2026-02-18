import Link from 'next/link';

import WarehouseDataFeed from '@/app/_warehouse/components/WarehouseDataFeed';
import parseChangelog from '@/utils/parseChangelog';

export interface BrandedFooterProps {
  customerType: 'b2b' | 'b2c' | 'private_clients';
  partnerType?: 'wine_partner' | 'distributor' | null;
}

/**
 * Footer component with conditional branding based on customer type
 *
 * @param props - The footer props including customerType
 */
const BrandedFooter = ({ customerType, partnerType }: BrandedFooterProps) => {
  const currentYear = new Date().getFullYear();
  const versions = parseChangelog();
  const latestVersion = versions[0]?.version ?? '1.0.0';

  const isB2C = customerType === 'b2c';
  const isWinePartner = customerType === 'private_clients' && partnerType === 'wine_partner';
  const isDistributor = customerType === 'b2b' || partnerType === 'distributor';

  // Route to appropriate support page based on user type
  const getSupportHref = () => {
    if (isWinePartner) return '/platform/partner/support';
    if (isDistributor) return '/platform/distributor/support';
    return '/platform/support';
  };
  const supportHref = getSupportHref();

  return (
    <footer className="border-border-primary mt-auto border-t bg-fill-secondary/30">
      <WarehouseDataFeed />

      <div className="container py-6 md:py-8">
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {/* Company Info - Conditional */}
          <div className="space-y-2">
            <h3 className="text-text-primary text-sm font-semibold">
              Craft & Culture
            </h3>
            <p className="text-text-muted text-xs leading-relaxed">
              {isB2C
                ? 'The region\'s first professional wine pricing tool. Built around bottle integrity, fair market pricing, and trusted expertise.'
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
                href={supportHref}
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                Help Center
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
