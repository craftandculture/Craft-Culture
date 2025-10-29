import { Metadata } from 'next';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Craft & Culture Index',
  description: 'Terms and Conditions for using Craft & Culture Index wine and spirits trading platform',
};

/**
 * Terms and Conditions page
 */
const TermsPage = () => {
  return (
    <main className="container py-8 md:py-16">
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="prose prose-sm max-w-none">
          <Typography variant="displaySm" className="mb-2">
            Terms and Conditions
          </Typography>
          <Typography variant="bodySm" colorRole="muted" className="mb-8">
            Last Updated: January 2025
          </Typography>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              1. Introduction
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              Welcome to Craft & Culture Index (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;).
              These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of our wine
              and spirits trading platform (the &quot;Platform&quot; or &quot;Service&quot;).
            </Typography>
            <Typography variant="bodySm">
              By creating an account or using our Platform, you agree to be bound by these Terms. If
              you do not agree to these Terms, please do not use our Service.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              2. Eligibility and Account Registration
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              You must be at least 21 years of age (or the legal drinking age in your jurisdiction,
              whichever is higher) to create an account and use our Platform.
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              You must provide accurate, current, and complete information during registration. You
              are responsible for maintaining the confidentiality of your account credentials and
              agree to immediately notify us of any unauthorized use of your account.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              3. Products and Pricing
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              All prices are quoted in the currency specified (USD or AED) and are subject to change
              without notice. Quotes generated through the Platform are valid for the period
              specified (typically 7 days unless otherwise stated).
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              Quotes are price estimates only and do not constitute binding purchase orders. Orders
              are subject to acceptance, inventory availability, and payment verification.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              4. Payment Terms
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              Payment terms and methods will be specified in individual agreements or invoices. B2B
              customers may be eligible for credit terms subject to credit approval.
            </Typography>
            <Typography variant="bodySm">
              You are responsible for all taxes, duties, and fees associated with your purchases.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              5. Alcohol Compliance
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              You represent that you are legally permitted to purchase and possess alcoholic
              beverages in your jurisdiction. You agree to comply with all applicable laws regarding
              the purchase, possession, and consumption of alcohol.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              6. Limitation of Liability
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              THE PLATFORM IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS
              WITHOUT WARRANTIES OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              7. Governing Law
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the
              United Arab Emirates. Any legal action or proceeding relating to these Terms shall be
              brought exclusively in the courts of Dubai, UAE.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              8. Contact Information
            </Typography>
            <Typography variant="bodySm">
              For questions about these Terms, please contact us at{' '}
              <a href="mailto:support@craftandculture.com" className="text-text-brand">
                support@craftandculture.com
              </a>
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodySm" className="italic">
              For the complete Terms and Conditions, please{' '}
              <a
                href="/TERMS_AND_CONDITIONS.md"
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

export default TermsPage;
