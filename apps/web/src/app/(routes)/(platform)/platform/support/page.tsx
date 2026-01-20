'use client';

import {
  IconChartDots,
  IconCreditCard,
  IconHelp,
  IconMail,
  IconRocket,
  IconShoppingCart,
  IconTimeline,
} from '@tabler/icons-react';
import Link from 'next/link';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

import FAQAccordion from './FAQAccordion';
import HelpNavigation from './HelpNavigation';
import HelpSection from './HelpSection';

const faqItems = [
  {
    question: 'How long does account approval take?',
    answer:
      'Account approval typically takes 1-2 hours during business hours. You will receive an email notification once your account has been approved and you can access the full platform.',
  },
  {
    question: 'Can I modify a quote after submitting it?',
    answer:
      'Once a quote is submitted for review, you cannot modify it directly. If changes are needed, our team may request a revision, which will allow you to update the quote. For urgent changes, contact our support team.',
  },
  {
    question: 'What currencies are supported?',
    answer:
      'All prices are displayed in both USD (US Dollars) and AED (UAE Dirhams). You can toggle between currencies using the currency switch in the quote builder. Payments are typically processed in AED.',
  },
  {
    question: 'How do I track my order?',
    answer:
      'You can track your order status in the "My Quotes" section. Each quote shows its current status, from submission through delivery. You will also receive email notifications at key stages of your order.',
  },
  {
    question: 'What if a product is out of stock?',
    answer:
      'If a product becomes unavailable, our team will contact you with alternatives during the review process. We source from a global network, so we can often find similar products or alternative vintages.',
  },
  {
    question: 'What payment methods are accepted?',
    answer:
      'We accept bank transfers to our licensed UAE entity. Payment details are provided once your quote is confirmed. A payment link option may also be available for certain orders.',
  },
  {
    question: 'How long does delivery take?',
    answer:
      'Delivery times depend on your location within the GCC region. Most orders within the UAE are delivered within 3-5 business days after payment confirmation. Cross-border deliveries may take longer.',
  },
  {
    question: 'Is there a minimum order quantity?',
    answer:
      'There is no strict minimum order quantity for individual buyers. However, some products may have minimum case requirements. These will be shown in the product details.',
  },
];

const SupportPage = () => {
  return (
    <main className="container py-6 md:py-10">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <Typography variant="headingLg" className="mb-2">
            Help Center
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Everything you need to know about using Pocket Cellar
          </Typography>
        </div>

        {/* Flow Diagrams Link */}
        <Link
          href="/platform/support/flows"
          className="mb-6 flex items-center justify-between rounded-xl border border-border-brand bg-fill-brand/5 p-4 transition-colors hover:bg-fill-brand/10"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fill-brand/10">
              <Icon icon={IconChartDots} size="md" colorRole="brand" />
            </div>
            <div>
              <Typography variant="bodySm" className="font-semibold">
                Process Flow Diagrams
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                View visual guides for the order process
              </Typography>
            </div>
          </div>
          <Icon icon={IconChartDots} size="sm" colorRole="brand" />
        </Link>

        {/* Navigation */}
        <HelpNavigation />

        {/* Sections */}
        <div className="space-y-6">
          {/* Getting Started */}
          <HelpSection id="getting-started" icon={IconRocket} title="Getting Started">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Welcome to Pocket Cellar, your personal wine concierge for the GCC region. Here is how
              to get started:
            </Typography>

            <div className="space-y-3">
              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  1. Account Approval
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  After signing up, your account will be reviewed by our team. This typically takes
                  1-2 hours during business hours. You will receive an email once approved.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  2. Browse Products
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Once approved, you can browse our curated selection of wines and spirits. Use
                  filters to search by region, producer, country, or vintage.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  3. Create Quotes
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Add products to your quote, adjust quantities, and submit for review. Our team
                  will confirm availability and pricing.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  4. Complete Your Order
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Once confirmed, make your payment and we will handle the rest. Track your order
                  status in real-time.
                </Typography>
              </div>
            </div>
          </HelpSection>

          {/* Creating a Quote */}
          <HelpSection id="creating-quote" icon={IconShoppingCart} title="Creating a Quote">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Building a quote is simple. Follow these steps:
            </Typography>

            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                  1
                </span>
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Click &quot;Create Quote&quot;
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Start a new quote from the main navigation
                  </Typography>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                  2
                </span>
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Search for Products
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Use the search bar or browse by category. Filter by region, producer, vintage,
                    or country.
                  </Typography>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                  3
                </span>
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Add to Quote
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Click the add button on any product to include it in your quote
                  </Typography>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                  4
                </span>
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Adjust Quantities
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Set the quantity for each product. Prices update automatically.
                  </Typography>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                  5
                </span>
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Review Totals
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Check your quote total in USD or AED using the currency toggle
                  </Typography>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                  6
                </span>
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Submit for Review
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    When ready, submit your quote. Our team will review and confirm availability.
                  </Typography>
                </div>
              </li>
            </ol>

            <div className="mt-4 rounded-lg border border-border-brand bg-fill-brand/5 p-4">
              <Typography variant="bodyXs" className="font-medium text-text-brand">
                Tip: Save Your Quotes
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                You can save quotes as drafts and return to them later. Find your saved quotes in
                the &quot;My Quotes&quot; section.
              </Typography>
            </div>
          </HelpSection>

          {/* Order Process */}
          <HelpSection id="order-process" icon={IconTimeline} title="Order Process">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Your quote moves through several stages. Here is what each status means:
            </Typography>

            {/* Process Flow Diagram */}
            <div className="my-4 overflow-hidden rounded-lg border border-border-primary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/order-flow-diagram.svg"
                alt="Order process flow diagram showing the 8 stages from Draft to Delivered"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-gray-400" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Draft
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Your quote is saved but not yet submitted
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Pending Review
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Quote submitted and waiting for our team to review
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Under Review
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Our team is checking availability and confirming pricing
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-amber-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Needs Attention
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Changes requested - please review and resubmit
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Confirmed
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Quote approved - proceed to payment
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-amber-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Awaiting Payment
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Payment details sent - complete your payment
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Payment Received
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Payment confirmed - order being prepared
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-gray-400" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Shipping
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Your order is on its way
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-gray-400" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Delivered
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Order complete - thank you!
                  </Typography>
                </div>
              </div>
            </div>
          </HelpSection>

          {/* Payments */}
          <HelpSection id="payments" icon={IconCreditCard} title="Payments">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Once your quote is confirmed, here is how to complete your payment:
            </Typography>

            <div className="mt-3 rounded-lg border border-border-brand bg-fill-brand/5 p-4">
              <Typography variant="bodyXs" className="font-medium text-text-brand">
                Important Note
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-1 leading-relaxed">
                Craft & Culture does not directly handle transactions or process payments. All
                payments are processed through our licensed distribution partners who hold the
                appropriate licenses to sell alcoholic beverages.
              </Typography>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  Bank Transfer
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Transfer the total amount to our licensed partner&apos;s bank account. Bank
                  details are provided in your confirmed quote email and in the quote details page.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  Upload Payment Proof
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  After making your transfer, upload a screenshot or PDF of your payment
                  confirmation in the quote details page. This helps us verify your payment quickly.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  Verification
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Our team will verify your payment within 1 business day. Once confirmed, your
                  order will be prepared for shipping.
                </Typography>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <Typography variant="bodyXs" className="font-medium text-amber-800 dark:text-amber-200">
                Important
              </Typography>
              <Typography variant="bodyXs" className="mt-1 text-amber-700 dark:text-amber-300">
                Please use your quote reference number in the payment description to help us match
                your payment to your order.
              </Typography>
            </div>
          </HelpSection>

          {/* FAQ */}
          <HelpSection id="faq" icon={IconHelp} title="Frequently Asked Questions">
            <FAQAccordion items={faqItems} />
          </HelpSection>

          {/* Contact */}
          <HelpSection id="contact" icon={IconMail} title="Contact & Support">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Need help? Our support team is here to assist you.
            </Typography>

            <div className="mt-4 rounded-lg border border-border-brand bg-fill-brand/5 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Email Support
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                    We typically respond within 4-8 business hours
                  </Typography>
                </div>
                <Link
                  href="mailto:support@craftculture.xyz"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-fill-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-fill-brand-hover"
                >
                  <Icon icon={IconMail} size="sm" />
                  support@craftculture.xyz
                </Link>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link
                href="https://craftculture.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border-primary bg-fill-secondary/30 p-4 transition-colors hover:bg-fill-secondary"
              >
                <Typography variant="bodySm" className="font-medium">
                  About Us
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                  Learn more about Craft & Culture
                </Typography>
              </Link>

              <Link
                href="/platform/terms-of-use"
                className="rounded-lg border border-border-primary bg-fill-secondary/30 p-4 transition-colors hover:bg-fill-secondary"
              >
                <Typography variant="bodySm" className="font-medium">
                  Terms of Use
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                  Platform terms and conditions
                </Typography>
              </Link>
            </div>
          </HelpSection>
        </div>
      </div>
    </main>
  );
};

export default SupportPage;
