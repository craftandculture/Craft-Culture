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
            Last Updated: October 2025
          </Typography>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              1. Introduction
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              Craft & Culture Index (&quot;Craft & Culture,&quot; &quot;we,&quot; &quot;our,&quot; or
              &quot;us&quot;) is committed to protecting the personal data of individuals with whom we
              deal. This Privacy Policy describes how we collect, use, disclose, store and protect your
              personal data when you access or use our wine & spirits trading platform, associated
              websites and services (&quot;Platform&quot;).
            </Typography>
            <Typography variant="bodySm">
              By using our Platform you acknowledge you have read, understood and consent to the data
              practices described here in accordance with the PDPL and other applicable UAE laws.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              2. Scope and Application
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              This Policy applies to all personal data we process in the United Arab Emirates (onshore)
              and also to any processing of personal data of UAE residents (even if some processing
              occurs outside the UAE) in line with the extraterritorial scope of the PDPL.
            </Typography>
            <Typography variant="bodySm">
              If you are located in a UAE free zone jurisdiction (for example DIFC Data Protection
              Commissioner&apos;s Office / ADGM Data Protection Regulator) whose own data-protection
              regime applies, you may need to review additional or alternative privacy policies.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              3. Information We Collect
            </Typography>
            <Typography variant="bodyMd" className="font-medium mb-2">
              3.1 Personal Data (Data Subject to the PDPL):
            </Typography>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>
                <Typography variant="bodySm">
                  <strong>Contact details:</strong> full name, email address, phone number
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Company / Business details (for B2B accounts):</strong> company name,
                  registration number, business address
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Payment, billing and trade information:</strong> bank or payment-card details,
                  invoicing data, order history, transaction records
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Trade / transactional data:</strong> orders placed, shipping and delivery
                  details, correspondence and service communications
                </Typography>
              </li>
            </ul>
            <Typography variant="bodyMd" className="font-medium mb-2">
              3.2 Automatically Collected Data:
            </Typography>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>
                <Typography variant="bodySm">
                  IP address, device type, operating system, browser type/version
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  Date/time of access, pages visited, user behaviour / navigation within the Platform
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  Use of cookies and other tracking technologies (see Section 8)
                </Typography>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              4. Purposes & Lawful Basis of Processing
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              We process your personal data for the following purposes, relying on one or more lawful
              bases under the PDPL:
            </Typography>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>
                <Typography variant="bodySm">
                  <strong>Account setup and management</strong> – to create and maintain your user account
                  (lawful basis: performance of contract / consent)
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Order, transaction and trade execution</strong> – to process purchases, sales,
                  deliveries and invoicing (lawful basis: performance of contract)
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Customer support</strong> – to respond to your queries, complaints and service
                  requests (lawful basis: legitimate interest / consent)
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Transactional communications</strong> – to send you order confirmations, updates
                  and related communications (lawful basis: performance of contract)
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Platform improvement and analytics</strong> – to enhance our services, monitor
                  usage and improve user experience (lawful basis: legitimate interest)
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Legal & regulatory compliance</strong> – to fulfill obligations under UAE law
                  (such as anti-money-laundering, customs, bonded logistics) (lawful basis: legal
                  obligation)
                </Typography>
              </li>
            </ul>
            <Typography variant="bodySm">
              We collect only the personal data necessary (&quot;data minimisation&quot;) and use it only
              for the purposes communicated to you (&quot;purpose limitation&quot;) in line with PDPL
              principles.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              5. Sharing and Disclosure of Personal Data
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              We do not sell or trade your personal data. We may, however, share data in the following
              circumstances:
            </Typography>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>
                <Typography variant="bodySm">
                  <strong>Service providers</strong> – third-party processors acting on our behalf
                  (hosting, payments, analytics, shipping) under contractual obligations to protect your
                  data
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Business partners</strong> – such as licensed suppliers, bonded-warehouse
                  operators or logistics providers, as necessary for trade execution
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Legal/regulatory authorities</strong> – where required by UAE law, or to protect
                  our legal rights and interests
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Corporate transactions</strong> – in the event of a merger, acquisition or sale
                  of our business/assets, your personal data may be transferred to the successor entity,
                  subject to confidentiality and compliance
                </Typography>
              </li>
            </ul>
            <Typography variant="bodySm">
              We ensure that any sharing／transfer of personal data is done in compliance with the
              PDPL&apos;s rules on cross-border transfers (see Section 9).
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              6. Data Security & Retention
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              We adopt appropriate technical and organisational measures to ensure the confidentiality,
              integrity and availability of your personal data, including encryption, access controls,
              secure storage and regular review of our security practices.
            </Typography>
            <Typography variant="bodySm">
              We will retain your personal data only for as long as necessary to fulfil the purposes set
              out in this Policy, or for other legitimate and lawful purposes (such as legal or tax
              retention obligations).
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              7. Your Rights under UAE Law
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              Under the PDPL you have the following rights in relation to your personal data:
            </Typography>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>
                <Typography variant="bodySm">
                  <strong>Access:</strong> you may request a copy of the personal data we hold about you,
                  along with information about its processing
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Rectification / Correction:</strong> you may request we correct inaccurate or
                  incomplete personal data
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Erasure / Deletion:</strong> you may request deletion of your personal data,
                  subject to legal or contractual retention obligations
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Restriction of Processing:</strong> you may ask us to restrict processing where
                  data is inaccurate, or objectionable
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Portability:</strong> you may request your personal data in a structured,
                  machine-readable format and transmit it to another controller
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Objection to certain processing:</strong> you may object to processing for
                  direct marketing or automated decision-making
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  <strong>Withdraw consent:</strong> where processing is based on consent, you may
                  withdraw it at any time (this will not affect processing already carried out lawfully)
                </Typography>
              </li>
            </ul>
            <Typography variant="bodySm">
              To exercise any of these rights, please contact us at{' '}
              <a href="mailto:privacy@craftandculture.com" className="text-text-brand">
                privacy@craftandculture.com
              </a>
              . We may require verification of your identity prior to actioning a request.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              8. Cookies & Tracking Technologies
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              We use cookies, pixel tags and other similar technologies to:
            </Typography>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>
                <Typography variant="bodySm">Enable the core functionality of our Platform</Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  Analyse user behaviour, traffic and usage patterns
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  Provide personalised content and promotional communications (where you have opted-in)
                </Typography>
              </li>
            </ul>
            <Typography variant="bodySm">
              You can control the use of cookies via your browser settings. Disabling certain cookies
              may affect your ability to use certain parts of the Platform.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              9. International & Cross-Border Data Transfers
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              Personal data collected under this Policy may be transferred to and stored in
              jurisdictions outside the UAE. We ensure that any such transfer is carried out in
              accordance with the PDPL&apos;s requirements:
            </Typography>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>
                <Typography variant="bodySm">
                  Transfer is permitted to a country deemed to offer an adequate level of protection for
                  personal data
                </Typography>
              </li>
              <li>
                <Typography variant="bodySm">
                  If no adequacy decision exists, transfers may occur if: appropriate safeguards (such as
                  contractual terms) are in place; or you have given your explicit consent; or the
                  transfer is necessary for performance of a contract, or for judicial cooperation, or
                  not contrary to UAE public interest
                </Typography>
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              10. Children&apos;s Privacy
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              Our Platform is not intended for individuals under 21 years of age (or the legal drinking
              age in your jurisdiction). We do not knowingly collect personal information from minors.
            </Typography>
            <Typography variant="bodySm">
              If we become aware that we have collected information from a minor, we will promptly
              delete such information. If you believe we have collected information from a minor, please
              contact us immediately.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              11. Changes to This Privacy Policy
            </Typography>
            <Typography variant="bodySm">
              We may update this Privacy Policy from time to time to reflect changes in our practices,
              legal requirements or technology. We will publish the updated version on our Platform and
              update the &quot;Last Updated&quot; date. Continued use of the Platform after the changes
              constitutes acceptance of the revised Policy.
            </Typography>
          </section>

          <section className="mb-8">
            <Typography variant="bodyLg" className="font-semibold mb-4">
              12. Contact Us
            </Typography>
            <Typography variant="bodySm" className="mb-4">
              If you have any questions, requests or concerns regarding this Privacy Policy or our
              data-protection practices, please contact us:
            </Typography>
            <Typography variant="bodySm" className="mb-2">
              <strong>Craft & Culture Index</strong>
              <br />
              Email:{' '}
              <a href="mailto:support@craftandculture.com" className="text-text-brand">
                support@craftandculture.com
              </a>
              <br />
              Attn: Data Protection Officer (DPO)
            </Typography>
            <Typography variant="bodySm">
              <strong>Business Address:</strong>
              <br />
              Craft & Culture FZE
              <br />
              PO BOX 50365
              <br />
              Fujairah Free Zone
              <br />
              Fujairah, UAE
              <br />
              Phone: +971 9 228 1170
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
