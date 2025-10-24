import Link from 'next/link';

import getAppVersion from '@/utils/getAppVersion';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const version = getAppVersion();

  return (
    <footer className="border-border-primary mt-auto border-t bg-fill-secondary/30">
      <div className="container py-6 md:py-8">
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {/* Company Info */}
          <div className="space-y-2">
            <h3 className="text-text-primary text-sm font-semibold">
              Craft & Culture
            </h3>
            <p className="text-text-muted text-xs leading-relaxed">
              Empowering wine & spirits brands to succeed in GCC markets with
              comprehensive services.
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

          {/* Legal & Support */}
          <div className="space-y-2">
            <h3 className="text-text-primary text-sm font-semibold">
              Support
            </h3>
            <nav className="flex flex-col space-y-1.5">
              <Link
                href="mailto:support@craftculture.xyz"
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                Support
              </Link>
              <Link
                href="https://craftculture.xyz/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="https://craftculture.xyz/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                Terms of Service
              </Link>
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-border-primary mt-6 flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row md:mt-8 md:pt-6">
          <p className="text-text-muted text-xs">
            © {currentYear} Craft & Culture. All rights reserved.
          </p>
          <Link
            href="https://github.com/craftandculture/Craft-Culture/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-tertiary hover:text-text-secondary font-mono text-xs transition-colors"
          >
            v{version}
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
