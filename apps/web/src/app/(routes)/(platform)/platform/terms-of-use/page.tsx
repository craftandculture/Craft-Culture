import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Typography from '@/app/_ui/components/Typography/Typography';

const TermsOfUsePage = () => {
  return (
    <main className="container py-6 sm:py-8 md:py-12 lg:py-16">
      <Card className="mx-auto w-full max-w-5xl">
        <CardContent className="p-4 sm:p-6 md:p-8">
          <CardProse>
            <CardTitle>Terms Of Use</CardTitle>
            <CardDescription colorRole="muted">
              Important information about this platform
            </CardDescription>
          </CardProse>

          <div className="mt-6 space-y-6 sm:mt-8 md:space-y-8">
            {/* Platform Purpose */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                Platform Purpose
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                This is an internal quotation tool designed exclusively for authorized Craft &
                Culture team members and business partners. It is not a public-facing platform or
                e-commerce site.
              </Typography>
            </section>

            {/* Access and Authorization */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                Access and Authorization
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                Access to this platform is restricted to authorized users only. By using this
                tool, you confirm that you have been granted explicit permission by Craft &
                Culture to access and use the quotation system.
              </Typography>
            </section>

            {/* Intended Use */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                Intended Use
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                This platform is designed to:
              </Typography>
              <ul className="ml-6 space-y-2">
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Generate price quotations for wine and spirits products
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Browse and filter the Craft & Culture product catalogue
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Export quotations and inventory lists for business purposes
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Support B2B and B2C pricing models for GCC markets
                </Typography>
              </ul>
            </section>

            {/* Data and Pricing */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                Data and Pricing Information
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                All product information, pricing, and quotations generated through this platform
                are for internal business use only. Prices are subject to change and should be
                confirmed before finalizing any business transactions.
              </Typography>
            </section>

            {/* Confidentiality */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                Confidentiality
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                Information accessed through this platform, including pricing models, product
                details, and business data, is confidential and proprietary to Craft & Culture.
                Users agree not to share, distribute, or use this information outside of authorized
                business purposes.
              </Typography>
            </section>

            {/* Support */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                Support and Questions
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                For questions about platform usage, access, or technical support, please contact
                our team at{' '}
                <a
                  href="mailto:support@craftculture.xyz"
                  className="text-text-brand hover:text-text-brand-hover underline transition-colors"
                >
                  support@craftculture.xyz
                </a>
                .
              </Typography>
            </section>

            {/* Updates */}
            <section className="border-border-primary border-t pt-6">
              <Typography variant="bodySm" colorRole="muted" className="italic">
                These terms may be updated periodically. Continued use of the platform constitutes
                acceptance of any changes.
              </Typography>
            </section>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default TermsOfUsePage;
