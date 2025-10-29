import { Metadata } from 'next';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';

export const metadata: Metadata = {
  title: 'Privacy Policy | Craft & Culture Index',
  description: 'Privacy Policy for Craft & Culture Index wine and spirits trading platform',
};

/**
 * Privacy Policy page
 */
const PrivacyPage = () => {
  return (
    <main className="container py-8 md:py-16">
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="prose prose-sm max-w-none">
          <Typography variant="displaySm" className="mb-2">
            Privacy Policy
          </Typography>
          <Typography variant="bodySm" colorRole="muted" className="mb-8">
            Last Updated: January 2025
          </Typography>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              1. Introduction
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              Craft & Culture Index (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is
              committed to protecting your privacy. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our wine and spirits
              trading platform.
            </Typography>
            <Typography variant="bodySm">
              By using our Platform, you consent to the data practices described in this Privacy
              Policy.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              2. Information We Collect
            </Typography>
            <Typography variant="bodyMd" className="font-medium mb-2">
              Personal Information:
            </Typography>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>
                <Typography variant="bodySm">Name, email address, and phone number</Typography>
              </li>
              <li>
                <Typography variant="bodySm">Company information (for B2B accounts)</Typography>
              </li>
              <li>
                <Typography variant="bodySm">Payment and billing information</Typography>
              </li>
              <li>
                <Typography variant="bodySm">Transaction and order history</Typography>
              </li>
            </ul>
            <Typography variant="bodyMd" className="font-medium mb-2">
              Automatic Information:
            </Typography>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>
                <Typography variant="bodySm">IP address and device information</Typography>
              </li>
              <li>
                <Typography variant="bodySm">Browser type and usage data</Typography>
              </li>
              <li>
                <Typography variant="bodySm">Cookies and tracking technologies</Typography>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              3. How We Use Your Information
            </Typography>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>
                <Typography variant="bodySm">
                  To create and manage your account
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">To process orders and transactions</Typography>
              </li>
              <li>
                <Typography variant="bodySm">To provide customer support</Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  To send transactional emails and updates
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">To improve our Platform and services</Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  To comply with legal obligations
                </Typography>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              4. How We Share Your Information
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              We do not sell your personal information. We may share your information with:
            </Typography>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>
                <Typography variant="bodySm">
                  Service providers (hosting, payment processing, analytics)
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  Business partners (suppliers, shipping providers)
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  Legal authorities (when required by law)
                </Typography>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              5. Data Security
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              We implement appropriate security measures including encryption, access controls, and
              regular security assessments to protect your information. However, no internet
              transmission is 100% secure.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              6. Your Rights
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              You have the right to:
            </Typography>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>
                <Typography variant="bodySm">Access your personal information</Typography>
              </li>
              <li>
                <Typography variant="bodySm">Correct inaccurate information</Typography>
              </li>
              <li>
                <Typography variant="bodySm">Request deletion of your data</Typography>
              </li>
              <li>
                <Typography variant="bodySm">Opt-out of marketing communications</Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  Lodge a complaint with a supervisory authority
                </Typography>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              7. Cookies
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              We use cookies and similar technologies to enhance your experience, analyze usage, and
              provide personalized content. You can control cookies through your browser settings.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              8. International Data Transfers
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              Your information may be transferred to and stored on servers in different countries. We
              ensure appropriate safeguards are in place for international transfers.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              9. Contact Us
            </Typography>
            <Typography variant="bodySm">
              For questions about this Privacy Policy or to exercise your rights, contact us at{' '}
              <a href="mailto:privacy@craftandculture.com" className="text-text-brand">
                privacy@craftandculture.com
              </a>
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodySm" className="italic">
              For the complete Privacy Policy, please{' '}
              <a
                href="/PRIVACY_POLICY.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-brand"
              >
                download the full document
              </a>
              .
            </Typography>
          </section>
        </CardContent>
      </Card>
    </main>
  );
};

export default PrivacyPage;
