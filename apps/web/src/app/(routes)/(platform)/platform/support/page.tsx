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
    <main className="container py-6 sm:py-8 md:py-12 lg:py-16">
      <Card className="mx-auto w-full max-w-5xl">
        <CardContent className="p-4 sm:p-6 md:p-8">
          <CardProse>
            <CardTitle>Support & Information</CardTitle>
            <CardDescription colorRole="muted">
              Comprehensive information about our products, infrastructure, and operational
              capabilities
            </CardDescription>
          </CardProse>

          <div className="mt-6 space-y-6 sm:mt-8 sm:space-y-8">
            {/* Product Sourcing */}
            <section className="rounded-lg border border-border-muted bg-fill-secondary/30 p-4 sm:p-6">
              <div className="mb-4 flex items-start gap-3 sm:items-center">
                <div className="flex-shrink-0 rounded-lg bg-fill-accent/10 p-2">
                  <Icon icon={IconPackage} size="md" colorRole="brand" />
                </div>
                <Typography variant="headingMd" className="font-semibold">
                  Product Sourcing
                </Typography>
              </div>
              <div className="space-y-3">
                <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                  All products in our catalogue are sourced through Craft & Culture&apos;s extensive
                  global network of trusted partners across the wine and spirits industry.
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                  We work directly with brands and producers to secure authentic, high-quality
                  products tailored for the GCC region. Every item we handle undergoes a rigorous
                  sourcing and verification process — including provenance checks, quality
                  assurance, and full compliance with regional import and distribution regulations.
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                  This approach ensures not only the integrity and traceability of every bottle but
                  also delivers the consistency and confidence our partners expect when operating in
                  tightly regulated markets such as the UAE and wider Gulf region.
                </Typography>
              </div>
            </section>

            {/* Warehouse & Storage */}
            <section className="rounded-lg border border-border-muted bg-fill-secondary/30 p-4 sm:p-6">
              <div className="mb-4 flex items-start gap-3 sm:items-center">
                <div className="flex-shrink-0 rounded-lg bg-fill-accent/10 p-2">
                  <Icon icon={IconBuildingWarehouse} size="md" colorRole="brand" />
                </div>
                <Typography variant="headingMd" className="font-semibold">
                  Warehouse & Storage Facilities
                </Typography>
              </div>

              <Typography variant="bodySm" colorRole="muted" className="mb-5 leading-relaxed">
                All products are stored within Craft & Culture&apos;s state-of-the-art bonded
                warehouse facility in the United Arab Emirates, purpose-built for the optimal
                storage and handling of fine wines and premium spirits.
              </Typography>

              {/* Facility Overview */}
              <div className="mb-5 rounded-md bg-background-primary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-semibold">
                  Bonded Warehouse Facility
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Our bonded warehouse facility enables duty-free product storage until
                  distribution or sale, optimizing cash flow and minimizing upfront costs for our
                  partners across the GCC region.
                </Typography>
              </div>

              {/* Infrastructure & Design */}
              <div className="mb-5">
                <Typography variant="bodySm" className="mb-3 font-semibold">
                  Infrastructure & Design
                </Typography>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-border-muted bg-background-primary/50 p-3">
                    <Typography variant="bodyXs" className="mb-2 font-medium">
                      Modular Architecture
                    </Typography>
                    <ul className="ml-4 list-disc space-y-1 text-xs text-text-secondary">
                      <li>110mm insulated sandwich panels with interlocking joints</li>
                      <li>150 square meter modules</li>
                      <li>Scalable design for seamless expansion</li>
                    </ul>
                  </div>
                  <div className="rounded-md border border-border-muted bg-background-primary/50 p-3">
                    <Typography variant="bodyXs" className="mb-2 font-medium">
                      Climate Control
                    </Typography>
                    <ul className="ml-4 list-disc space-y-1 text-xs text-text-secondary">
                      <li>Target temperature: 13-14°C</li>
                      <li>Redundant chiller architecture</li>
                      <li>Optimal for fine wines and premium spirits</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Monitoring Systems */}
              <div className="mb-5">
                <Typography variant="bodySm" className="mb-3 font-semibold">
                  Advanced Monitoring Systems
                </Typography>
                <div className="space-y-3">
                  <div className="rounded-md border border-border-muted bg-background-primary/50 p-3">
                    <Typography variant="bodyXs" className="mb-2 font-medium">
                      Temperature & Humidity Monitoring
                    </Typography>
                    <ul className="ml-4 list-disc space-y-1 text-xs text-text-secondary">
                      <li>Real-time multi-position sensors</li>
                      <li>Automated alerts for parameter deviations</li>
                      <li>Humidity control for label and cork preservation</li>
                    </ul>
                  </div>
                  <div className="rounded-md border border-border-muted bg-background-primary/50 p-3">
                    <Typography variant="bodyXs" className="mb-2 font-medium">
                      Proprietary Liquid Monitoring
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-3 leading-relaxed">
                      In-house designed system tracking liquid temperature directly, ensuring
                      product authenticity and integrity for investment-grade wines.
                    </Typography>
                    <div className="overflow-hidden rounded-md border border-border-muted">
                      <Image
                        src="https://craft-and-culture.gitbook.io/accessmiddleeast/~gitbook/image?url=https%3A%2F%2F1032101154-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FzevGLhW4lSYr4ZX17ksK%252Fuploads%252F3R8NkKzhCBHMX9TP4D6Z%252FIMG_4210%25202.JPG%3Falt%3Dmedia%26token%3D00f96b1b-970b-4303-bbfb-8ec3f9ed5bf4&width=768&dpr=4&quality=100&sign=d4759cc7&sv=2"
                        alt="Proprietary liquid temperature monitoring system for wine storage"
                        width={768}
                        height={432}
                        className="h-auto w-full"
                        unoptimized
                      />
                    </div>
                  </div>
                  <div className="rounded-md border border-border-muted bg-background-primary/50 p-3">
                    <Typography variant="bodyXs" className="mb-2 font-medium">
                      Air Quality Control
                    </Typography>
                    <ul className="ml-4 list-disc space-y-1 text-xs text-text-secondary">
                      <li>Particle size counting at multiple levels</li>
                      <li>CO₂ monitoring systems</li>
                      <li>Comprehensive environmental tracking dashboard</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Security & Additional Features Grid */}
              <div className="mb-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Typography variant="bodySm" className="mb-3 font-semibold">
                    Security & Access Control
                  </Typography>
                  <ul className="ml-4 list-disc space-y-1 text-xs text-text-secondary">
                    <li>24/7 CCTV with HD cameras and PTZ tracking</li>
                    <li>Restricted personnel access protocols</li>
                    <li>Door sensors with audible alarms</li>
                    <li>Environmental deviation alerts</li>
                    <li>Full asset protection monitoring</li>
                  </ul>
                </div>
                <div>
                  <Typography variant="bodySm" className="mb-3 font-semibold">
                    Additional Features
                  </Typography>
                  <ul className="ml-4 list-disc space-y-1 text-xs text-text-secondary">
                    <li>Motion-activated LED lighting</li>
                    <li>Daily sanitation with food-safe products</li>
                    <li>Recorded cleaning logs</li>
                    <li>Configurable racking systems</li>
                    <li>Real-time inventory tracking</li>
                  </ul>
                </div>
              </div>

              {/* Monitoring Dashboard */}
              <div>
                <Typography variant="bodySm" className="mb-3 font-semibold">
                  Real-Time Monitoring Dashboard
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mb-3 leading-relaxed">
                  Our comprehensive monitoring dashboard provides real-time visibility into all
                  environmental parameters across multiple zones, including air temperature, liquid
                  temperature, humidity levels, air quality metrics, and motion detection — ensuring
                  complete oversight and rapid response to any deviations.
                </Typography>
                <div className="overflow-hidden rounded-lg border border-border-muted shadow-sm">
                  <Image
                    src="https://craft-and-culture.gitbook.io/accessmiddleeast/~gitbook/image?url=https%3A%2F%2F1032101154-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FzevGLhW4lSYr4ZX17ksK%252Fuploads%252Fc0fflvuLeHTye4jxs7zm%252FScreenshot%25202025-08-07%2520at%252010.44.45.png%3Falt%3Dmedia%26token%3D6ffe9e93-57b6-40b0-8479-24f0e322f325&width=768&dpr=4&quality=100&sign=9ce3d136&sv=2"
                    alt="Warehouse monitoring system dashboard showing real-time temperature, humidity, and environmental controls"
                    width={768}
                    height={432}
                    className="h-auto w-full"
                    unoptimized
                  />
                </div>
              </div>
            </section>

            {/* Logistics Data Logging */}
            <section className="rounded-lg border border-border-muted bg-fill-secondary/30 p-4 sm:p-6">
              <div className="mb-4 flex items-start gap-3 sm:items-center">
                <div className="flex-shrink-0 rounded-lg bg-fill-accent/10 p-2">
                  <Icon icon={IconChartLine} size="md" colorRole="brand" />
                </div>
                <Typography variant="headingMd" className="font-semibold">
                  Logistics Data Logging
                </Typography>
              </div>
              <div className="space-y-3">
                <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                  We log temperature data end-to-end to ensure full cold chain integrity throughout
                  the entire supply journey.
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                  From the moment products leave our bonded warehouse facility until delivery to
                  our partners, comprehensive temperature monitoring is maintained to protect the
                  quality and condition of fine wines and premium spirits.
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                  This continuous data logging provides complete traceability and accountability,
                  ensuring that every shipment maintains optimal storage conditions and arrives in
                  perfect condition — a critical requirement for premium wine logistics in the GCC
                  climate.
                </Typography>
              </div>
            </section>

            {/* B2B & B2C Sales Models */}
            <section className="rounded-lg border border-border-muted bg-fill-secondary/30 p-4 sm:p-6">
              <div className="mb-4 flex items-start gap-3 sm:items-center">
                <div className="flex-shrink-0 rounded-lg bg-fill-accent/10 p-2">
                  <Icon icon={IconTruck} size="md" colorRole="brand" />
                </div>
                <Typography variant="headingMd" className="font-semibold">
                  B2B & B2C Sales Models
                </Typography>
              </div>
              <Typography variant="bodySm" colorRole="muted" className="mb-4 leading-relaxed">
                All products are sourced and sold through our fully licensed entity in the UAE,
                ensuring complete regulatory compliance and authenticity. We operate dual sales
                models to serve different market segments:
              </Typography>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* B2B Section */}
                <div className="rounded-md border border-border-muted bg-background-primary p-4">
                  <Typography variant="bodySm" className="mb-2 font-semibold">
                    B2B (Business-to-Business)
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-3 leading-relaxed">
                    Serving licensed retailers, hotels, restaurants, bars, and hospitality venues
                    across the GCC region.
                  </Typography>
                  <ul className="ml-4 list-disc space-y-1 text-xs text-text-secondary">
                    <li>Bulk ordering and wholesale pricing</li>
                    <li>Dedicated account management</li>
                    <li>Flexible payment terms</li>
                    <li>Custom product sourcing</li>
                    <li>Inventory replenishment programs</li>
                  </ul>
                </div>

                {/* B2C Section */}
                <div className="rounded-md border border-border-muted bg-background-primary p-4">
                  <Typography variant="bodySm" className="mb-2 font-semibold">
                    B2C (Business-to-Consumer)
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-3 leading-relaxed">
                    Direct sales to individual consumers through licensed retail channels in
                    compliance with local regulations.
                  </Typography>
                  <ul className="ml-4 list-disc space-y-1 text-xs text-text-secondary">
                    <li>Retail pricing for individual purchases</li>
                    <li>Home delivery in permitted jurisdictions</li>
                    <li>Age verification and compliance</li>
                    <li>Personal wine recommendations</li>
                    <li>Special orders and rare bottle sourcing</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-md bg-fill-accent/10 p-3">
                <Typography variant="bodyXs" className="mb-1 font-medium text-text-brand">
                  Licensed Entity Operations
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  All sales are conducted through our licensed trading entity with full compliance
                  to UAE and GCC alcohol trading regulations, including proper permits, customs
                  clearance, and age-restricted sales protocols.
                </Typography>
              </div>
            </section>

            {/* Logistics & Distribution */}
            <section className="rounded-lg border border-border-muted bg-fill-secondary/30 p-4 sm:p-6">
              <div className="mb-4 flex items-start gap-3 sm:items-center">
                <div className="flex-shrink-0 rounded-lg bg-fill-accent/10 p-2">
                  <Icon icon={IconTruck} size="md" colorRole="brand" />
                </div>
                <Typography variant="headingMd" className="font-semibold">
                  Logistics & Distribution
                </Typography>
              </div>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                We provide comprehensive logistics solutions for wine and spirits distribution
                across the GCC region, including:
              </Typography>
              <ul className="ml-4 list-disc space-y-1.5 text-xs text-text-secondary sm:columns-2 sm:gap-4">
                <li>Temperature-controlled transport</li>
                <li>Customs clearance and compliance</li>
                <li>Last-mile delivery services</li>
                <li>Real-time shipment tracking</li>
                <li>Specialized premium wine handling</li>
              </ul>
            </section>

            {/* Contact Support */}
            <section className="rounded-lg border border-border-brand bg-fill-accent/5 p-4 sm:p-6">
              <div className="mb-4 flex items-start gap-3 sm:items-center">
                <div className="flex-shrink-0 rounded-lg bg-fill-accent/10 p-2">
                  <Icon icon={IconMail} size="md" colorRole="brand" />
                </div>
                <Typography variant="headingMd" className="font-semibold">
                  Contact Support
                </Typography>
              </div>
              <Typography variant="bodySm" colorRole="muted" className="mb-4 leading-relaxed">
                Have questions about our products, sourcing, logistics, or need technical support
                with the platform? Our team is here to help.
              </Typography>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="mailto:support@craftculture.xyz"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-fill-brand px-4 py-2.5 text-sm font-medium text-text-on-brand transition-colors hover:bg-fill-brand-hover"
                >
                  <Icon icon={IconMail} size="sm" />
                  Email Support
                </Link>
                <Typography variant="bodyXs" colorRole="muted">
                  support@craftculture.xyz
                </Typography>
              </div>
            </section>

            {/* Additional Resources */}
            <section className="border-t border-border-muted pt-6">
              <Typography variant="bodySm" className="mb-4 font-semibold">
                Additional Resources
              </Typography>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="https://craftculture.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border-muted bg-surface-primary p-4 transition-all hover:border-border-brand hover:bg-fill-muted hover:shadow-sm"
                >
                  <Typography variant="bodyXs" className="mb-1 font-medium">
                    About Craft & Culture
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="text-xs">
                    Learn more about our company and mission
                  </Typography>
                </Link>
                <Link
                  href="/platform/terms-of-use"
                  className="rounded-lg border border-border-muted bg-surface-primary p-4 transition-all hover:border-border-brand hover:bg-fill-muted hover:shadow-sm"
                >
                  <Typography variant="bodyXs" className="mb-1 font-medium">
                    Terms of Use
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="text-xs">
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
