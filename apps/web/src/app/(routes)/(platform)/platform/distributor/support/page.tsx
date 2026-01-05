'use client';

import {
  IconBox,
  IconCreditCard,
  IconHelp,
  IconMail,
  IconRocket,
  IconTimeline,
  IconTruck,
  IconUserCheck,
} from '@tabler/icons-react';
import Link from 'next/link';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

import DistributorHelpNavigation from './DistributorHelpNavigation';
import FAQAccordion from '../../support/FAQAccordion';
import HelpSection from '../../support/HelpSection';

const faqItems = [
  {
    question: 'What is Craft & Culture?',
    answer:
      'Craft & Culture is a platform connecting wine partners with the UAE/GCC market. As a distributor, you handle the final mile - client verification, payment collection, and delivery for Private Client Orders (PCO).',
  },
  {
    question: 'What is a PCO order?',
    answer:
      'PCO stands for Private Client Order. These are orders created by wine partners for individual consumers who want to purchase wine for personal use in the UAE. You receive these orders for fulfillment.',
  },
  {
    question: 'How do I get assigned orders?',
    answer:
      'Wine partners create PCO orders which are assigned to you for fulfillment. Orders appear in your dashboard when they reach the verification stage.',
  },
  {
    question: 'What does client verification involve?',
    answer:
      'You need to verify the client can legally receive wine (21+ age, valid ID) and register them in your system. This is required before payment collection.',
  },
  {
    question: 'How long does fulfillment take?',
    answer:
      'After client payment: Local stock orders 1-2 weeks, shipped orders 3-6 weeks. Delivery scheduling happens once payment is confirmed and stock is available.',
  },
  {
    question: 'What payment methods do clients use?',
    answer:
      'Bank transfer is the primary method. You invoice the client for the full amount including duty and VAT, collect payment, then confirm in the system.',
  },
  {
    question: 'When do I pay Craft & Culture?',
    answer:
      'After order fulfillment. Typically 3-7 days after delivery. You pay C&C the duty-paid landed cost, retaining your margin.',
  },
  {
    question: 'What if a client cannot be verified?',
    answer:
      'Mark the order as "Verification Suspended" with notes explaining the issue. C&C and the wine partner will be notified to resolve the situation.',
  },
  {
    question: 'Can clients pay in AED?',
    answer:
      'Yes, client invoices are typically in AED. The AED is pegged to USD at 3.67, so conversion is straightforward.',
  },
  {
    question: 'Who contacts the client?',
    answer:
      'You handle all client communication for verification, payment collection, delivery scheduling, and customer service. The wine partner should not contact clients directly except for verification purposes.',
  },
];

const DistributorSupportPage = () => {
  return (
    <main className="container py-6 md:py-10">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <Typography variant="headingLg" className="mb-2">
            Distributor Help Center
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Everything you need to manage PCO orders, client verification, and fulfillment
          </Typography>
        </div>

        {/* Navigation */}
        <DistributorHelpNavigation />

        {/* Sections */}
        <div className="space-y-6">
          {/* Getting Started */}
          <HelpSection id="getting-started" icon={IconRocket} title="Getting Started">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Welcome to the Craft & Culture Distributor Portal. Here is how to get started:
            </Typography>

            <div className="space-y-3">
              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  1. Sign In
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Go to craftculture.xyz, click Sign In, and enter your email. Check your inbox for
                  the magic link and click to access your dashboard.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  2. Dashboard Overview
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Your dashboard shows assigned orders awaiting action, orders in progress, and
                  recently completed deliveries. The activity feed shows recent updates.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  3. Navigation
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Use the main menu to access: Dashboard (overview), Orders (manage assigned PCO
                  orders), and Settings (preferences).
                </Typography>
              </div>
            </div>
          </HelpSection>

          {/* Client Verification */}
          <HelpSection id="verification" icon={IconUserCheck} title="Client Verification">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Before collecting payment, you must verify each client:
            </Typography>

            <div className="mt-4 rounded-lg border border-border-brand bg-fill-brand/5 p-4">
              <Typography variant="bodyXs" className="font-medium text-text-brand">
                Why Verification Matters
              </Typography>
              <Typography variant="bodyXs" className="mt-1 text-text-muted">
                UAE law requires alcohol sales to licensed individuals. Verification protects your
                license and ensures compliance.
              </Typography>
            </div>

            {/* Verification Steps */}
            <div className="mt-4 space-y-3">
              <Typography variant="bodySm" className="font-medium">
                Verification Process
              </Typography>

              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                    1
                  </span>
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      Check Order Details
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Review client name, contact info, and delivery address on the order.
                    </Typography>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                    2
                  </span>
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      Contact Client
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Reach out via phone or email to collect ID and verify age (21+).
                    </Typography>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                    3
                  </span>
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      Register Client
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Add client to your system with verified details.
                    </Typography>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill-brand text-xs font-medium text-white">
                    4
                  </span>
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      Confirm in Portal
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Mark order as verified to proceed to payment collection.
                    </Typography>
                  </div>
                </li>
              </ol>
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <Typography variant="bodyXs" className="font-medium text-amber-800 dark:text-amber-200">
                Verification Issues?
              </Typography>
              <Typography variant="bodyXs" className="mt-1 text-amber-700 dark:text-amber-300">
                If client cannot be verified, mark as Verification Suspended with notes. C&C and the
                wine partner will be notified.
              </Typography>
            </div>
          </HelpSection>

          {/* Payment Collection */}
          <HelpSection id="payment" icon={IconCreditCard} title="Payment Collection">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              After verification, collect payment from the client:
            </Typography>

            {/* Payment Steps */}
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  1. Generate Client Invoice
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Create invoice with full amount including products, duty (20%), logistics, and VAT
                  (5%). Invoice in AED for local clients.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  2. Send Invoice to Client
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Email invoice with payment instructions. Include your bank details for transfer.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  3. Confirm Payment Received
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Once payment clears, mark order as Client Paid in the portal.
                </Typography>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="mt-4 rounded-lg border border-border-primary p-4">
              <Typography variant="bodySm" className="mb-3 font-medium">
                What the Client Pays
              </Typography>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Product Cost (LDF)</span>
                  <span>Base price</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">+ Import Duty (20%)</span>
                  <span>UAE customs</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">+ Logistics</span>
                  <span>Freezone → Delivery</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">+ VAT (5%)</span>
                  <span>UAE tax</span>
                </div>
                <div className="border-t border-border-primary pt-2">
                  <div className="flex justify-between font-medium">
                    <span>Client Total</span>
                    <span>Your invoice amount</span>
                  </div>
                </div>
              </div>
            </div>
          </HelpSection>

          {/* Order Lifecycle */}
          <HelpSection id="order-lifecycle" icon={IconTimeline} title="Order Lifecycle">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Track orders through each stage of the fulfillment process:
            </Typography>

            {/* Status Flow */}
            <div className="my-4 overflow-x-auto">
              <div className="flex min-w-max items-center justify-center gap-1 py-4">
                {[
                  { label: 'Assigned', color: 'bg-blue-500' },
                  { label: 'Verify', color: 'bg-blue-500' },
                  { label: 'Payment', color: 'bg-amber-500' },
                  { label: 'Schedule', color: 'bg-blue-500' },
                  { label: 'Deliver', color: 'bg-green-500' },
                ].map((stage, index) => (
                  <div key={stage.label} className="flex items-center gap-1">
                    <div className="flex flex-col items-center">
                      <div className={`h-3 w-3 rounded-full ${stage.color}`} />
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
                    Awaiting Distributor Verification
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Order assigned to you - verify the client
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-amber-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Verification Suspended
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Issue with client verification - awaiting resolution
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
                    Client verified, waiting for payment
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
                    Payment received, ready for fulfillment
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Scheduling Delivery
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Coordinate delivery date with client
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    With Distributor / Out for Delivery
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Stock collected, en route to client
                  </Typography>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-green-500" />
                <div>
                  <Typography variant="bodySm" className="font-medium">
                    Delivered
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    Order complete - proceed to settle with C&C
                  </Typography>
                </div>
              </div>
            </div>
          </HelpSection>

          {/* Delivery & Fulfillment */}
          <HelpSection id="fulfillment" icon={IconTruck} title="Delivery & Fulfillment">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              After payment is confirmed, fulfill the order:
            </Typography>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  1. Schedule Delivery
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Contact client to arrange a convenient delivery date and time. Update the order
                  status to Scheduling Delivery.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  2. Collect Stock
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  For local inventory: Collect from UAE Freezone warehouse. For shipped orders: Wait
                  for stock arrival notification.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  3. Complete Delivery
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  Deliver to client, obtain proof of delivery (signature/photo). Update order status
                  to Delivered.
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary/50 p-4">
                <Typography variant="bodySm" className="mb-2 font-medium">
                  4. Settle with C&C
                </Typography>
                <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                  After delivery, pay C&C the duty-paid landed cost. Typically within 3-7 days of
                  delivery.
                </Typography>
              </div>
            </div>
          </HelpSection>

          {/* Stock Status */}
          <HelpSection id="stock" icon={IconBox} title="Stock Status">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Understand stock availability for order fulfillment:
            </Typography>

            <div className="mt-4 space-y-2">
              <Typography variant="bodySm" className="font-medium">
                Stock Status Legend
              </Typography>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-lg bg-fill-secondary/50 p-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <Typography variant="bodyXs">Local Stock - Ready for collection</Typography>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-fill-secondary/50 p-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <Typography variant="bodyXs">In Transit - On the way to UAE</Typography>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-fill-secondary/50 p-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <Typography variant="bodyXs">Awaiting Shipment - Not yet dispatched</Typography>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-fill-secondary/50 p-2">
                  <div className="h-3 w-3 rounded-full bg-gray-400" />
                  <Typography variant="bodyXs">Reserved - Allocated to order</Typography>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border-brand bg-fill-brand/5 p-4">
              <Typography variant="bodyXs" className="font-medium text-text-brand">
                Delivery Timelines
              </Typography>
              <ul className="mt-2 space-y-1">
                <li className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Local stock: 1-2 weeks from payment
                </li>
                <li className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Air freight: 2-3 weeks from payment
                </li>
                <li className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Ocean freight: 4-6 weeks from payment
                </li>
              </ul>
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
                        UAE tax-free zone where goods arrive and are stored
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">Mainland</td>
                      <td className="px-3 py-2 text-text-muted">
                        Regular UAE territory where clients receive goods
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">Wine Partner</td>
                      <td className="px-3 py-2 text-text-muted">
                        Supplier who creates PCO orders for their clients
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

export default DistributorSupportPage;
