'use client';

import {
  IconBox,
  IconCreditCard,
  IconHelp,
  IconMail,
  IconPackage,
  IconRocket,
  IconShoppingCart,
  IconTimeline,
} from '@tabler/icons-react';
import Link from 'next/link';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

import HelpNavigation from './HelpNavigation';
import FAQAccordion from '../../support/FAQAccordion';
import HelpSection from '../../support/HelpSection';

const faqItems = [
  {
    question: 'What is Craft & Culture?',
    answer:
      'Craft & Culture is a platform connecting wine partners with the UAE/GCC market. We handle the logistics of importing wine through licensed distributors, making it easy for you to sell to private clients and businesses in the region.',
  },
  {
    question: 'What is a PCO order?',
    answer:
      'PCO stands for Private Client Order. These are orders for individual consumers who want to purchase wine for personal use in the UAE.',
  },
  {
    question: 'What is local inventory?',
    answer:
      'Local inventory is wine already in the UAE Freezone warehouse. Ordering from local stock means faster delivery (1-2 weeks vs 3-6 weeks for shipped orders).',
  },
  {
    question: 'How long does an order take?',
    answer:
      'Typical timeline: Review 1-3 days, Payment processing 1-2 weeks, Delivery 1-3 weeks after payment. Total 3-6 weeks from submission to delivery. Airfreight orders are faster; ocean freight takes longer.',
  },
  {
    question: 'Can I cancel an order?',
    answer:
      'Before approval: Yes, you can cancel from the order page. After approval: Contact C&C - cancellation may not be possible if payment has been collected or stock has been shipped.',
  },
  {
    question: 'How is pricing calculated?',
    answer:
      'Your Landed Duty Free (LDF) price is the base. UAE costs are added: Import Duty (20%), Logistics (transfer from Freezone), VAT (5%). The client pays the final total.',
  },
  {
    question: 'What do I get paid?',
    answer:
      'You receive your LDF price for the products. The UAE costs (duty, VAT) are collected from the client but handled by the distributor.',
  },
  {
    question: 'When do I get paid?',
    answer:
      'After the distributor pays C&C (typically 2-3 weeks after client payment). Payments are typically in USD via bank transfer.',
  },
  {
    question: 'How do I add products to my catalog?',
    answer:
      'Products are synced from CultX. Contact C&C to add new products, update existing listings, or remove discontinued items.',
  },
  {
    question: 'Do I contact the client directly?',
    answer:
      'No - the distributor handles client communication for payment collection, delivery scheduling, and customer service. You may contact clients for verification purposes only.',
  },
];

const PartnerSupportPage = () => {
  return (
    <main className="container py-6 md:py-10">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <Typography variant="headingLg" className="mb-2">
            Partner Help Center
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Everything you need to know about managing private client orders
          </Typography>
        </div>

        {/* Navigation */}
        <HelpNavigation />

        {/* Sections */}
        <div className="space-y-6">
          {/* Getting Started */}
          <HelpSection id="getting-started" icon={IconRocket} title="Getting Started">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Welcome to the Craft & Culture Partner Portal. Here is how to get started:
            </Typography>

            <div className="space-y-3">
              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  1. Sign In
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Go to craftculture.xyz, click Sign In, and enter your email. Check your inbox for
                  the magic link and click to access your dashboard. We use passwordless login for
                  security.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  2. Dashboard Overview
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Your dashboard shows active orders, pending quotes, and products listed. The
                  activity feed shows recent updates on your orders.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  3. Navigation
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Use the main menu to access: Dashboard (overview), Orders (create and manage PCO
                  orders), Products (your catalog), Inventory (local UAE stock), and Settings
                  (preferences).
                </Typography>
              </div>
            </div>
          </HelpSection>

          {/* Creating Orders */}
          <HelpSection id="creating-orders" icon={IconShoppingCart} title="Creating Orders">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Create Private Client Orders (PCO) to sell wine to clients in the UAE:
            </Typography>

            {/* Process Flow */}
            <div className="my-4 overflow-x-auto">
              <div className="flex min-w-max items-center justify-center gap-2 py-4">
                {['Client Details', 'Add Products', 'Review', 'Upload Invoice', 'Submit'].map(
                  (step, index) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                          {index + 1}
                        </div>
                        <span className="mt-1 text-xs text-text-muted">{step}</span>
                      </div>
                      {index < 4 && (
                        <div className="h-0.5 w-8 bg-border-primary" />
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>

            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                  1
                </span>
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Enter Client Details
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Provide client name, email, phone, and delivery address. Mark as new or existing
                    client.
                  </Typography>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                  2
                </span>
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Add Products
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Search your catalog, select products, and set quantities. Check Local Inventory
                    for faster delivery.
                  </Typography>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                  3
                </span>
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Review Order
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Verify all details, check pricing, and review totals before proceeding.
                  </Typography>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                  4
                </span>
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Upload Partner Invoice
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Attach your invoice (PDF or image). This is required for order processing.
                  </Typography>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                  5
                </span>
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Submit for Review
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Click Submit Order. C&C will review and process your order.
                  </Typography>
                </div>
              </li>
            </ol>
          </HelpSection>

          {/* Order Lifecycle */}
          <HelpSection id="order-lifecycle" icon={IconTimeline} title="Order Lifecycle">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Track your order through each stage from submission to delivery:
            </Typography>

            {/* Status Flow */}
            <div className="my-4 overflow-x-auto">
              <div className="flex min-w-max items-center justify-center gap-1 py-4">
                {[
                  { label: 'Submit', color: 'bg-blue-500' },
                  { label: 'Review', color: 'bg-blue-500' },
                  { label: 'Payment', color: 'bg-amber-500' },
                  { label: 'Fulfill', color: 'bg-blue-500' },
                  { label: 'Delivered', color: 'bg-green-500' },
                ].map((stage, index) => (
                  <div key={stage.label} className="flex items-center gap-1">
                    <div className="flex flex-col items-center">
                      <div
                        className={`h-3 w-3 rounded-full ${stage.color}`}
                      />
                      <span className="mt-1 text-[10px] text-text-muted">{stage.label}</span>
                    </div>
                    {index < 4 && <div className="h-0.5 w-6 bg-border-primary" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Pending C&C Review
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Order submitted, waiting for C&C to review
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-amber-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Revision Requested
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    C&C needs changes - check notes and update your order
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Pending Client Verification
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Waiting for client registration with distributor
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-amber-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Awaiting Client Payment
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Invoice sent to client, waiting for payment
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Client Paid
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Payment received, order being fulfilled
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-green-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Delivered / Partner Paid
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Order complete, your payment processed
                  </Typography>
                </div>
              </div>
            </div>
          </HelpSection>

          {/* Inventory */}
          <HelpSection id="inventory" icon={IconBox} title="Local Inventory">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              View available stock in UAE for faster delivery:
            </Typography>

            <div className="mt-4 rounded-lg border border-border-brand bg-fill-brand/5 p-4">
              <Typography variant="bodyXs" className="font-medium text-text-brand">
                Benefits of Local Stock
              </Typography>
              <ul className="mt-2 space-y-1">
                <li className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Faster delivery (1-2 weeks vs 3-6 weeks)
                </li>
                <li className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  No shipping wait - stock is already in UAE
                </li>
                <li className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Confirmed availability
                </li>
              </ul>
            </div>

            <div className="mt-4 space-y-2">
              <Typography variant="bodySm" className="font-medium">
                Stock Status Legend
              </Typography>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-lg bg-fill-secondary/50 p-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <Typography variant="bodyXs">In Stock - Ready to order</Typography>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-fill-secondary/50 p-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <Typography variant="bodyXs">Low Stock - Order soon</Typography>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-fill-secondary/50 p-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <Typography variant="bodyXs">Incoming - On the way</Typography>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-fill-secondary/50 p-2">
                  <div className="h-3 w-3 rounded-full bg-gray-400" />
                  <Typography variant="bodyXs">Reserved - Allocated</Typography>
                </div>
              </div>
            </div>
          </HelpSection>

          {/* Pricing & Payments */}
          <HelpSection id="pricing" icon={IconCreditCard} title="Pricing & Payments">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Understanding how pricing works and when you get paid:
            </Typography>

            {/* Price Breakdown */}
            <div className="mt-4 rounded-lg border border-border-primary p-4">
              <Typography variant="bodySm" className="mb-3 font-medium">
                Price Breakdown (Client Sees)
              </Typography>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Your LDF Price</span>
                  <span>Base price</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">+ Import Duty (20%)</span>
                  <span>UAE customs</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">+ Transfer Cost</span>
                  <span>Freezone → Mainland</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">+ VAT (5%)</span>
                  <span>UAE tax</span>
                </div>
                <div className="border-t border-border-primary pt-2">
                  <div className="flex justify-between font-medium">
                    <span>Client Total</span>
                    <span>Final price</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Flow */}
            <div className="mt-4 space-y-3">
              <Typography variant="bodySm" className="font-medium">
                Payment Flow
              </Typography>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                    1
                  </div>
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      Client Pays Distributor
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Full amount including all UAE costs
                    </Typography>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                    2
                  </div>
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      Distributor Pays C&C
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      After order fulfillment (3-7 days)
                    </Typography>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                    3
                  </div>
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      C&C Pays You
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Your LDF price via bank transfer (1-3 days)
                    </Typography>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <Typography variant="bodyXs" className="font-medium text-amber-800 dark:text-amber-200">
                Currency Note
              </Typography>
              <Typography variant="bodyXs" className="mt-1 text-amber-700 dark:text-amber-300">
                Payments are typically in USD. AED is pegged to USD at a fixed rate (3.67).
              </Typography>
            </div>
          </HelpSection>

          {/* Products */}
          <HelpSection id="products" icon={IconPackage} title="Products & Catalog">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Your product catalog syncs from CultX. Here is how to manage it:
            </Typography>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  Finding Products
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Use search to find by wine name, producer, or vintage. Filter by region, country,
                  colour, or type. Click a product to see full details.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  Request a Product
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  If you cannot find a product, use the Request Product feature when creating an
                  order. C&C will source it and provide pricing.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  Update Catalog
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Contact C&C to add new products, update existing listings, or remove discontinued
                  items from your catalog.
                </Typography>
              </div>
            </div>
          </HelpSection>

          {/* FAQ */}
          <HelpSection id="faq" icon={IconHelp} title="Frequently Asked Questions">
            <FAQAccordion items={faqItems} />
          </HelpSection>

          {/* Contact */}
          <HelpSection id="contact" icon={IconMail} title="Contact & Support">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Need help? The Craft & Culture team is here to assist.
            </Typography>

            <div className="mt-4 rounded-lg border border-border-brand bg-fill-brand/5 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Email Support
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                    We respond within 24 hours, Sunday-Thursday
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

            {/* Glossary */}
            <div className="mt-6">
              <Typography variant="bodySm" className="mb-3 font-medium">
                Glossary
              </Typography>
              <div className="rounded-lg border border-border-primary">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border-primary">
                    <tr>
                      <td className="px-3 py-2 font-medium">C&C</td>
                      <td className="px-3 py-2 text-text-muted">Craft & Culture</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">PCO</td>
                      <td className="px-3 py-2 text-text-muted">Private Client Order</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">LDF</td>
                      <td className="px-3 py-2 text-text-muted">
                        Landed Duty Free - price before UAE import costs
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">Freezone</td>
                      <td className="px-3 py-2 text-text-muted">
                        UAE tax-free zone where goods arrive
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">Mainland</td>
                      <td className="px-3 py-2 text-text-muted">
                        Regular UAE territory where clients receive goods
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">Distributor</td>
                      <td className="px-3 py-2 text-text-muted">
                        Licensed UAE company handling final delivery
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </HelpSection>
        </div>
      </div>
    </main>
  );
};

export default PartnerSupportPage;
