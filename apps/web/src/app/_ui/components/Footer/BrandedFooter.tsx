import Link from 'next/link';

import { resolveAccessProfile } from '@/app/_auth/constants/accessProfiles';
import CellarConditions from '@/app/_cellar/components/CellarConditions';
import WarehouseDataFeed from '@/app/_warehouse/components/WarehouseDataFeed';
import parseChangelog from '@/utils/parseChangelog';

export interface BrandedFooterProps {
  customerType: 'b2b' | 'b2c' | 'private_clients';
  partnerType?: 'wine_partner' | 'distributor' | 'private_collector' | null;
  /** C&C team member; only staff see the internal development log */
  isTeamMember?: boolean;
}

/**
 * Footer component with conditional branding based on customer type
 *
 * @param props - The footer props including customerType
 */
const BrandedFooter = ({
  customerType,
  partnerType,
  isTeamMember = false,
}: BrandedFooterProps) => {
  const currentYear = new Date().getFullYear();
  const versions = parseChangelog();
  const latestVersion = versions[0]?.version ?? '1.0.0';

  const isB2C = customerType === 'b2c';
  const access = resolveAccessProfile({ customerType, partnerType });
  const isWinePartner = access.can.ownsStock;
  const isDistributor = customerType === 'b2b' || partnerType === 'distributor';

  /*
    A collector owns stock, so the wine-partner branch below was catching them
    and sending them to help about sourcing and RFQs. Their help lives on the
    general route, which serves cellar content when the account is a
    collector.
  */
  const getSupportHref = () => {
    if (access.kind === 'collector') return '/platform/support';
    if (isWinePartner) return '/platform/partner/support';
    if (isDistributor) return '/platform/distributor/support';
    return '/platform/support';
  };
  const supportHref = getSupportHref();

  /*
    Staff were shown the trade marketing footer: a line about building bridges
    across the GCC and a link to a retired quote tool. They need the live
    sensor strip, help, the development log and the version, on one line.
  */
  if (isTeamMember) {
    return (
      <footer className="border-border-primary mt-auto border-t bg-fill-secondary/30">
        <WarehouseDataFeed />
        <div className="container flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4 text-xs text-text-muted">
          <span>© {currentYear} Craft & Culture</span>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href={supportHref} className="transition-colors hover:text-text-primary">
              Help Centre
            </Link>
            <Link
              href="/platform/development-log"
              className="transition-colors hover:text-text-primary"
            >
              Development Log
            </Link>
            <Link
              href="/platform/development-log"
              className="font-light transition-colors hover:text-text-primary"
            >
              v{latestVersion}
            </Link>
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-border-primary mt-auto border-t bg-fill-secondary/30">
      {/*
        A member gets one panel on where their wine is kept and the conditions
        it is in now. The raw sensor strip and a paragraph beneath it had run
        together with the footer into one grey band. Trade accounts keep the
        live strip, which is what they use.
      */}
      {access.kind === 'collector' ? (
        <div className="border-border-primary bg-surface-secondary/40 border-b">
          <CellarConditions />
        </div>
      ) : (
        <WarehouseDataFeed />
      )}

      <div className="container py-6 md:py-8">
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {/* Company Info - Conditional */}
          <div className="space-y-2">
            <h3 className="text-text-primary text-sm font-semibold">
              Craft & Culture
            </h3>
            {/*
              A collector was being told we build bridges for brands to scale
              across the GCC, which describes a business they are not in. What
              they bought was storage and access.
            */}
            <p className="text-text-muted text-xs leading-relaxed">
              {access.kind === 'collector'
                ? 'Private Cellar. Access international merchants, consolidate globally, and hold your collection in bond in the UAE.'
                : isB2C
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
              {access.can.raiseQuotes && (
                <Link
                  href="/platform/quotes"
                  className="text-text-muted hover:text-text-primary text-xs transition-colors"
                >
                  Quote Tool
                </Link>
              )}
              <Link
                href="https://craftculture.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                About Us
              </Link>
              {/* The marketing site has no /contact page; the address is the contact */}
              <a
                href="mailto:enquiries@craftculture.xyz"
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                enquiries@craftculture.xyz
              </a>
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
                Help Centre
              </Link>
              {/*
                A member consolidating a purchase or offering wine for resale
                needs a person, not a page. It belongs where someone already
                looks for a way to reach us.
              */}
              {access.kind === 'collector' && (
                <a
                  href="mailto:enquiries@craftculture.xyz"
                  className="text-text-muted hover:text-text-primary text-xs transition-colors"
                >
                  Email the cellar team
                </a>
              )}
              {isTeamMember && (
                <Link
                  href="/platform/development-log"
                  className="text-text-muted hover:text-text-primary text-xs transition-colors"
                >
                  Development Log
                </Link>
              )}
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
            {isTeamMember ? (
              <Link
                href="/platform/development-log"
                className="text-text-muted hover:text-text-primary text-xs font-light transition-colors"
              >
                v{latestVersion}
              </Link>
            ) : (
              <span className="text-text-muted text-xs font-light">
                v{latestVersion}
              </span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default BrandedFooter;
