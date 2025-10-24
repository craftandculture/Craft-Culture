import Link from 'next/link';

import Typography from '@/app/_ui/components/Typography/Typography';
import packageJson from '@root/package.json';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border-primary mt-auto border-t">
      <div className="container py-6 md:py-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Company Info */}
          <div className="space-y-3">
            <Typography variant="headingSm" className="font-semibold">
              Craft & Culture
            </Typography>
            <Typography variant="bodySm" colorRole="muted">
              Empowering wine & spirits brands to succeed in GCC markets with
              comprehensive services.
            </Typography>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <Typography variant="headingSm" className="font-semibold">
              Quick Links
            </Typography>
            <nav className="flex flex-col space-y-2">
              <Link
                href="/platform/quotes"
                className="text-text-muted hover:text-text-primary text-sm transition-colors"
              >
                Quote Tool
              </Link>
              <Link
                href="https://craftculture.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text-primary text-sm transition-colors"
              >
                About Us
              </Link>
              <Link
                href="https://craftculture.xyz/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text-primary text-sm transition-colors"
              >
                Contact
              </Link>
            </nav>
          </div>

          {/* Legal & Support */}
          <div className="space-y-3">
            <Typography variant="headingSm" className="font-semibold">
              Support
            </Typography>
            <nav className="flex flex-col space-y-2">
              <Link
                href="mailto:support@craftculture.xyz"
                className="text-text-muted hover:text-text-primary text-sm transition-colors"
              >
                Support
              </Link>
              <Link
                href="https://craftculture.xyz/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text-primary text-sm transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="https://craftculture.xyz/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text-primary text-sm transition-colors"
              >
                Terms of Service
              </Link>
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-border-primary mt-8 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row">
          <Typography variant="bodySm" colorRole="muted">
            © {currentYear} Craft & Culture. All rights reserved.
          </Typography>
          <Typography
            variant="monoSm"
            colorRole="muted"
            className="text-text-subtle"
          >
            v{packageJson.version}
          </Typography>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
