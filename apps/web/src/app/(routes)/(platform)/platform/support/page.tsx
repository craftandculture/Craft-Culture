import {
  IconBuildingWarehouse,
  IconChartLine,
  IconMail,
  IconPackage,
  IconTruck,
} from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

const SupportPage = () => {
  return (
    <main className="container py-8 md:py-16">
      <Card className="mx-auto w-full max-w-4xl">
        <CardContent>
          <CardProse>
            <CardTitle>Support & Information</CardTitle>
            <CardDescription colorRole="muted">
              Comprehensive information about our products, infrastructure, and operational
              capabilities
            </CardDescription>
          </CardProse>

          <div className="mt-8 space-y-8">
            {/* Product Sourcing */}
            <section className="rounded-lg border border-border-muted bg-fill-secondary/30 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-fill-accent/10 p-2">
                  <Icon icon={IconPackage} size="md" colorRole="brand" />
                </div>
                <Typography variant="headingMd" className="font-semibold">
                  Product Sourcing
                </Typography>
              </div>
              <Typography variant="bodyMd" colorRole="muted" className="mb-4 leading-relaxed">
                All products in our catalogue are sourced through Craft & Culture&apos;s extensive
                global network of trusted partners across the wine and spirits industry.
              </Typography>
              <Typography variant="bodyMd" colorRole="muted" className="mb-4 leading-relaxed">
                We work directly with brands and producers to secure authentic, high-quality
                products tailored for the GCC region. Every item we handle undergoes a rigorous
                sourcing and verification process — including provenance checks, quality assurance,
                and full compliance with regional import and distribution regulations.
              </Typography>
              <Typography variant="bodyMd" colorRole="muted" className="leading-relaxed">
                This approach ensures not only the integrity and traceability of every bottle but
                also delivers the consistency and confidence our partners expect when operating in
                tightly regulated markets such as the UAE and wider Gulf region.
              </Typography>
            </section>

            {/* Warehouse & Storage */}
            <section className="rounded-lg border border-border-muted bg-fill-secondary/30 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-fill-accent/10 p-2">
                  <Icon icon={IconBuildingWarehouse} size="md" colorRole="brand" />
                </div>
                <Typography variant="headingMd" className="font-semibold">
                  Warehouse & Storage Facilities
                </Typography>
              </div>

              {/* Warehouse Monitoring System Image */}
              <div className="mb-6 overflow-hidden rounded-lg border border-border-muted">
                <Image
                  src="https://craft-and-culture.gitbook.io/accessmiddleeast/~gitbook/image?url=https%3A%2F%2F1032101154-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FzevGLhW4lSYr4ZX17ksK%252Fuploads%252Fc0fflvuLeHTye4jxs7zm%252FScreenshot%25202025-08-07%2520at%252010.44.45.png%3Falt%3Dmedia%26token%3D6ffe9e93-57b6-40b0-8479-24f0e322f325&width=768&dpr=4&quality=100&sign=9ce3d136&sv=2"
                  alt="Warehouse monitoring system dashboard showing real-time temperature, humidity, and environmental controls"
                  width={768}
                  height={432}
                  className="h-auto w-full"
                  unoptimized
                />
              </div>

              <Typography variant="bodyMd" colorRole="muted" className="mb-4 leading-relaxed">
                All products are stored within Craft & Culture&apos;s state-of-the-art bonded
                warehouse facility in the United Arab Emirates, purpose-built for the optimal storage
                and handling of fine wines and premium spirits.
              </Typography>
              <Typography variant="bodyMd" colorRole="muted" className="mb-4 leading-relaxed">
                Our infrastructure combines advanced technology with meticulous environmental control
                to ensure the highest standards of product integrity, featuring:
              </Typography>
              <ul className="mb-4 ml-6 list-disc space-y-2 text-sm text-text-secondary">
                <li>
                  Precision temperature-controlled environments calibrated for long-term wine
                  preservation
                </li>
                <li>Humidity-regulated storage zones to maintain label and cork condition</li>
                <li>
                  Real time data dashboard featuring multi zone air temperature, liquid temperature,
                  humidity, air quality and motion detection
                </li>
                <li>
                  24/7 on-site security and monitoring systems ensuring full asset protection
                </li>
                <li>
                  Bonded warehouse status for seamless customs compliance and duty-suspended storage
                </li>
                <li>
                  Advanced inventory and tracking systems providing real-time visibility and control
                </li>
                <li>
                  Integrated logistics infrastructure enabling efficient movement and regional
                  distribution
                </li>
              </ul>
              <Typography variant="bodyMd" colorRole="muted" className="mb-4 leading-relaxed">
                This modern facility forms the backbone of our regional operations — ensuring that
                every product is stored, managed, and delivered to the highest international
                standards.
              </Typography>
              <div className="mt-4 rounded-md bg-fill-muted p-4">
                <Typography variant="bodySm" colorRole="muted" className="mb-2">
                  For detailed warehouse specifications, including capacity, certifications, and
                  technical details, please visit:
                </Typography>
                <Link
                  href="https://craft-and-culture.gitbook.io/accessmiddleeast/logistic-and-freight-management/warehouse-specifications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-text-brand transition-colors hover:text-text-brand-hover hover:underline"
                >
                  Warehouse Specifications Documentation
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </Link>
              </div>
            </section>

            {/* Logistics Data Logging */}
            <section className="rounded-lg border border-border-muted bg-fill-secondary/30 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-fill-accent/10 p-2">
                  <Icon icon={IconChartLine} size="md" colorRole="brand" />
                </div>
                <Typography variant="headingMd" className="font-semibold">
                  Logistics Data Logging
                </Typography>
              </div>
              <Typography variant="bodyMd" colorRole="muted" className="mb-4 leading-relaxed">
                We log temperature data end-to-end to ensure full cold chain integrity throughout the
                entire supply journey.
              </Typography>
              <Typography variant="bodyMd" colorRole="muted" className="mb-4 leading-relaxed">
                From the moment products leave our bonded warehouse facility until delivery to our
                partners, comprehensive temperature monitoring is maintained to protect the quality
                and condition of fine wines and premium spirits.
              </Typography>
              <Typography variant="bodyMd" colorRole="muted" className="leading-relaxed">
                This continuous data logging provides complete traceability and accountability,
                ensuring that every shipment maintains optimal storage conditions and arrives in
                perfect condition — a critical requirement for premium wine logistics in the GCC
                climate.
              </Typography>
            </section>

            {/* B2B & B2C Sales Models */}
            <section className="rounded-lg border border-border-muted bg-fill-secondary/30 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-fill-accent/10 p-2">
                  <Icon icon={IconTruck} size="md" colorRole="brand" />
                </div>
                <Typography variant="headingMd" className="font-semibold">
                  B2B & B2C Sales Models
                </Typography>
              </div>
              <Typography variant="bodyMd" colorRole="muted" className="mb-4 leading-relaxed">
                All products are sourced and sold through our fully licensed entity in the UAE,
                ensuring complete regulatory compliance and authenticity. We operate dual sales
                models to serve different market segments:
              </Typography>

              <div className="space-y-4">
                {/* B2B Section */}
                <div className="rounded-md border border-border-muted bg-background-primary p-4">
                  <Typography variant="bodySm" className="mb-2 font-semibold">
                    B2B (Business-to-Business)
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                    Serving licensed retailers, hotels, restaurants, bars, and hospitality venues
                    across the GCC region.
                  </Typography>
                  <ul className="ml-6 list-disc space-y-1.5 text-sm text-text-secondary">
                    <li>Bulk ordering and wholesale pricing</li>
                    <li>Dedicated account management</li>
                    <li>Flexible payment terms for qualified partners</li>
                    <li>Custom product selection and sourcing</li>
                    <li>Regular inventory replenishment programs</li>
                  </ul>
                </div>

                {/* B2C Section */}
                <div className="rounded-md border border-border-muted bg-background-primary p-4">
                  <Typography variant="bodySm" className="mb-2 font-semibold">
                    B2C (Business-to-Consumer)
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                    Direct sales to individual consumers through licensed retail channels in
                    compliance with local regulations.
                  </Typography>
                  <ul className="ml-6 list-disc space-y-1.5 text-sm text-text-secondary">
                    <li>Retail pricing for individual purchases</li>
                    <li>Home delivery in permitted jurisdictions</li>
                    <li>Age verification and compliance checks</li>
                    <li>Personal wine collections and recommendations</li>
                    <li>Special orders and rare bottle sourcing</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-md bg-fill-accent/10 p-4">
                <Typography variant="bodySm" className="font-medium text-text-brand">
                  Licensed Entity Operations
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-2 leading-relaxed">
                  All sales are conducted through our licensed trading entity with full compliance
                  to UAE and GCC alcohol trading regulations, including proper permits, customs
                  clearance, and age-restricted sales protocols.
                </Typography>
              </div>
            </section>

            {/* Logistics & Distribution */}
            <section className="rounded-lg border border-border-muted bg-fill-secondary/30 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-fill-accent/10 p-2">
                  <Icon icon={IconTruck} size="md" colorRole="brand" />
                </div>
                <Typography variant="headingMd" className="font-semibold">
                  Logistics & Distribution
                </Typography>
              </div>
              <Typography variant="bodyMd" colorRole="muted" className="mb-4 leading-relaxed">
                We provide comprehensive logistics solutions for wine and spirits distribution
                across the GCC region, including:
              </Typography>
              <ul className="ml-6 list-disc space-y-2 text-sm text-text-secondary">
                <li>Temperature-controlled transport for wine products</li>
                <li>Customs clearance and compliance management</li>
                <li>Last-mile delivery to retail and hospitality partners</li>
                <li>Real-time shipment tracking and updates</li>
                <li>Specialized handling for premium and fine wine collections</li>
              </ul>
            </section>

            {/* Contact Support */}
            <section className="rounded-lg border border-border-primary bg-fill-muted p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-fill-accent/10 p-2">
                  <Icon icon={IconMail} size="md" colorRole="brand" />
                </div>
                <Typography variant="headingMd" className="font-semibold">
                  Contact Support
                </Typography>
              </div>
              <Typography variant="bodyMd" colorRole="muted" className="mb-4 leading-relaxed">
                Have questions about our products, sourcing, logistics, or need technical support
                with the platform? Our team is here to help.
              </Typography>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="mailto:support@craftculture.xyz"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-fill-brand px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-fill-brand-hover"
                >
                  <Icon icon={IconMail} size="sm" />
                  Email Support
                </Link>
                <Typography variant="bodySm" colorRole="muted">
                  support@craftculture.xyz
                </Typography>
              </div>
            </section>

            {/* Additional Resources */}
            <section className="border-t border-border-primary pt-6">
              <Typography variant="headingSm" className="mb-4 font-semibold">
                Additional Resources
              </Typography>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="https://craftculture.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border-muted bg-surface-primary p-4 transition-colors hover:border-border-brand hover:bg-fill-muted"
                >
                  <Typography variant="bodySm" className="mb-1 font-medium">
                    About Craft & Culture
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Learn more about our company and mission
                  </Typography>
                </Link>
                <Link
                  href="/platform/terms-of-use"
                  className="rounded-lg border border-border-muted bg-surface-primary p-4 transition-colors hover:border-border-brand hover:bg-fill-muted"
                >
                  <Typography variant="bodySm" className="mb-1 font-medium">
                    Terms of Use
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Platform terms and conditions
                  </Typography>
                </Link>
              </div>
            </section>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default SupportPage;
