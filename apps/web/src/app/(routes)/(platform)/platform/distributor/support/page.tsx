'use client';

import {
  IconBox,
  IconChartDots,
  IconCreditCard,
  IconHelp,
  IconMail,
  IconRocket,
  IconTimeline,
  IconTruck,
  IconUserCheck,
} from '@tabler/icons-react';
import Link from 'next/link';

import DistributorNav from '@/app/_privateClientOrders/components/DistributorNav';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

import DistributorHelpNavigation from './DistributorHelpNavigation';
import FAQAccordion from '../../support/FAQAccordion';
import HelpSection from '../../support/HelpSection';

const faqItems = [
  {
    question: 'What is Craft & Culture?',
    answer:
      'Craft & Culture (C&C) connects wine partners with the UAE and GCC market. As a distributor, you handle the final stage of each Private Client Order: client verification, payment collection and delivery.',
  },
  {
    question: 'What is a PCO?',
    answer:
      'A Private Client Order: an order a wine partner places on behalf of an individual client for personal use in the UAE. C&C reviews and approves it, then assigns it to you.',
  },
  {
    question: 'When does an order appear in my portal?',
    answer:
      'As soon as C&C approves it and assigns it to you. If you verify clients, it arrives at the verification stage; otherwise it arrives ready for client payment.',
  },
  {
    question: 'Why can I not confirm client payment?',
    answer:
      'Two things must be on the order first: your invoice to the client (uploaded on the order page) and, if you sell each order as a bundle, the bundle SKU. The button explains which one is missing.',
  },
  {
    question: 'What is the bundle SKU?',
    answer:
      'If you list each PCO as one bundle product named after the PCO number, its SKU is recorded on the order. It is usually filled in automatically from your stock feed; if not, enter it in the SKU card at the top of the order page. It cannot be changed once the client has paid.',
  },
  {
    question: 'When do I pay Craft & Culture?',
    answer:
      'After the client has paid you. Mark the order Awaiting Distributor Payment while your payment is being raised, then Confirm Payment to C&C once it is sent. C&C releases the stock to you after that payment is received.',
  },
  {
    question: 'How long does fulfilment take?',
    answer:
      'From your payment to C&C: stock already in the UAE usually reaches you within one to two weeks; stock shipped from abroad takes longer, depending on the route. The Stock Tracking panel on each order shows where every item is.',
  },
  {
    question: 'An order says "2 bottles", not "2 cases". Why?',
    answer:
      'Wine can be sold by the case or as single bottles. Single bottles are now shown as bottles everywhere, and cases show how many bottles they hold, for example "1 case · 6 btl". Prices say whether they are per case or per bottle.',
  },
  {
    question: 'What if a client cannot be verified?',
    answer:
      'Click Not Verified on the order, then add a note on the order explaining why. The order is suspended, and C&C and the wine partner resolve it with you. If the client registers later, click Client Verified - Unlock Order on the same page.',
  },
  {
    question: 'Who contacts the client?',
    answer:
      'You do, for verification, payment, delivery scheduling and customer service. The wine partner contacts the client only where verification needs it.',
  },
];

const DistributorSupportPage = () => {
  return (
    <main className="container py-4 landscape:py-2 md:py-8">
      <DistributorNav />
      <div className="mx-auto mt-6 w-full max-w-3xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <Typography variant="headingLg" className="mb-2">
            Distributor Help Centre
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            How to verify clients, collect payment and deliver Private Client Orders
          </Typography>
        </div>

        {/* Flow Diagrams Link */}
        <Link
          href="/platform/support/flows"
          className="mb-6 flex items-center justify-between rounded-xl border border-text-primary bg-text-primary/5 p-4 transition-colors hover:bg-text-primary/10"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-text-primary/10">
              <Icon icon={IconChartDots} size="md" colorRole="brand" />
            </div>
            <div>
              <Typography variant="bodySm" className="font-semibold">
                PCO Process Flow Diagrams
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                View the complete end-to-end process flow for all parties
              </Typography>
            </div>
          </div>
          <Icon icon={IconChartDots} size="sm" colorRole="brand" />
        </Link>

        {/* Navigation */}
        <DistributorHelpNavigation />

        {/* Sections */}
        <div className="space-y-6">
          {/* Your Portal */}
          <HelpSection id="getting-started" icon={IconRocket} title="Your Portal">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Sign in at craftculture.xyz with your work email; a sign-in link is sent to your
              inbox. The portal has two screens.
            </Typography>

            <div className="space-y-3">
              {[
                {
                  title: 'Dashboard',
                  body: 'Opens on what is waiting on you: Verify client, Client payment, Pay C&C, Stock arriving and To deliver (plus SKU missing, if you record bundle SKUs). A tile turns amber when it has orders and reads "All clear" when it has none. Click a tile to see exactly those orders. Below it, the pipeline shows how many orders are at each stage, their value, and an "idle" badge for any order that has not moved in seven days.',
                },
                {
                  title: 'Assigned Orders',
                  body: 'Every order assigned to you. The tabs follow the same stages as the dashboard (Verification, Payment, Inbound, Delivery, Delivered). A filter opened from the dashboard appears as a chip; click its × to clear it. Choose 20 or 50 orders per page at the bottom of the list.',
                },
                {
                  title: 'An order',
                  body: 'Shows the bundle SKU (if you use one), the order progress, the actions for its current stage, the payment reference, the line items and the Stock Tracking panel. Download PDF gives the proforma for your finance team; Send to Finance emails it.',
                },
              ].map((step, index) => (
                <div key={step.title} className="rounded-lg bg-fill-secondary/50 p-4">
                  <Typography variant="bodySm" className="mb-2 font-medium">
                    {index + 1}. {step.title}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                    {step.body}
                  </Typography>
                </div>
              ))}
            </div>
          </HelpSection>

          {/* Client Verification */}
          <HelpSection id="verification" icon={IconUserCheck} title="Client Verification">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Before collecting payment, you must verify each client:
            </Typography>

            <div className="mt-4 rounded-lg border border-text-primary bg-text-primary/5 p-4">
              <Typography variant="bodyXs" className="font-medium text-text-primary">
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
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-text-primary text-xs font-medium text-surface-primary">
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
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-text-primary text-xs font-medium text-surface-primary">
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
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-text-primary text-xs font-medium text-surface-primary">
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
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-text-primary text-xs font-medium text-surface-primary">
                    4
                  </span>
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      Confirm in Portal
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Click Client Verified on the order to move it on to payment collection.
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
                If the client cannot be verified, click Not Verified on the order and add a note
                explaining why. The order is suspended, and C&C and the wine partner are notified.
              </Typography>
            </div>
          </HelpSection>

          {/* Payment */}
          <HelpSection id="payment" icon={IconCreditCard} title="Payment">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Once the client is verified, the order moves to Awaiting Client Payment. Payment then
              runs in this order:
            </Typography>

            <ol className="mt-4 space-y-3">
              {[
                {
                  title: 'Check the bundle SKU',
                  body: 'If you sell each PCO as a bundle, its SKU must be on the order. It is normally filled in from your stock feed; otherwise enter it in the SKU card at the top of the order page.',
                },
                {
                  title: 'Invoice the client',
                  body: 'Download the proforma (Download PDF) or send it to your finance team (Send to Finance). It lists every line with your cost and the client price. Invoice the client in AED for the full amount, quoting the payment reference shown on the order.',
                },
                {
                  title: 'Upload your invoice',
                  body: 'Upload the invoice on the order page. It is required before client payment can be confirmed.',
                },
                {
                  title: 'Confirm Client Payment',
                  body: 'When the client has paid, click Confirm Client Payment.',
                },
                {
                  title: 'Pay C&C',
                  body: 'Mark the order Awaiting Distributor Payment while your payment is raised, then Confirm Payment to C&C when it has been sent. C&C then releases the stock to you.',
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-text-primary text-xs font-medium text-surface-primary">
                    {index + 1}
                  </span>
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      {step.title}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                      {step.body}
                    </Typography>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-4 rounded-lg border border-border-primary p-4">
              <Typography variant="bodySm" className="mb-3 font-medium">
                What the Client Pays
              </Typography>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Wine</span>
                  <span>Client price per case or bottle</span>
                </div>
                <div className="flex justify-between text-sm">
                  {/*
                    No percentage printed. Duty and VAT rates change, a help
                    page is not where anyone thinks to update them, and a
                    stale rate in writing is worse than none — the invoice is
                    where the real figures are.
                  */}
                  <span className="text-text-muted">Import duty, logistics and VAT</span>
                  <span>Included in the client price</span>
                </div>
                <div className="border-t border-border-primary pt-2">
                  <div className="flex justify-between font-medium">
                    <span>Client Total</span>
                    <span>The Amount Due on the order</span>
                  </div>
                </div>
              </div>
            </div>
          </HelpSection>

          {/* Order Lifecycle */}
          <HelpSection id="order-lifecycle" icon={IconTimeline} title="Order Lifecycle">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              Orders move through four stages, the same ones shown on your dashboard and as tabs on
              Assigned Orders:
            </Typography>

            <div className="mt-4 space-y-2">
              {[
                {
                  stage: 'Verification',
                  who: 'Partner · you',
                  dot: 'bg-orange-400',
                  statuses: 'Awaiting Verification, Verification Suspended',
                  body: 'You check the client can legally receive wine.',
                },
                {
                  stage: 'Payment',
                  who: 'Client · you',
                  dot: 'bg-blue-500',
                  statuses: 'Awaiting Client Payment, Client Paid, Awaiting Distributor Payment',
                  body: 'The client pays you, then you pay C&C.',
                },
                {
                  stage: 'Inbound',
                  who: 'C&C',
                  dot: 'bg-violet-500',
                  statuses: 'Distributor Paid, Stock In Transit',
                  body: 'C&C prepares and sends the stock to you.',
                },
                {
                  stage: 'Delivery',
                  who: 'You',
                  dot: 'bg-amber-400',
                  statuses: 'With Distributor, Scheduling Delivery, Delivery Scheduled, Out for Delivery',
                  body: 'You confirm the stock has arrived and deliver it to the client.',
                },
                {
                  stage: 'Delivered',
                  who: '',
                  dot: 'bg-emerald-500',
                  statuses: 'Delivered',
                  body: 'The order is complete.',
                },
              ].map((row) => (
                <div key={row.stage} className="flex items-start gap-3 rounded-lg bg-fill-secondary/50 p-3">
                  <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${row.dot}`} />
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      {row.stage}
                      {row.who && (
                        <span className="ml-2 text-xs font-normal text-text-muted">{row.who}</span>
                      )}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                      {row.body} Statuses: {row.statuses}.
                    </Typography>
                  </div>
                </div>
              ))}
            </div>
          </HelpSection>

          {/* Stock & Delivery */}
          <HelpSection id="fulfillment" icon={IconTruck} title="Stock & Delivery">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              After your payment to C&C:
            </Typography>

            <div className="mt-4 space-y-3">
              {[
                {
                  title: 'C&C sends the stock',
                  body: 'The order moves to Stock In Transit and appears under Stock arriving on your dashboard. The Stock Tracking panel on the order shows where each item is: Sourcing, Confirmed, In Air, At C&C, To Distributor, At Distributor, Delivered.',
                },
                {
                  title: 'Confirm the stock has arrived',
                  body: 'When it reaches you, click Stock Received. Check the case labels: each carries the PCO number and the total for the order.',
                },
                {
                  title: 'Schedule and deliver',
                  body: 'Agree a delivery date with the client and record it with Schedule Delivery (or log Could Not Reach Client). When the delivery leaves, click Mark Out for Delivery; when the client has it, click Mark Delivered and upload the proof of delivery.',
                },
              ].map((step, index) => (
                <div key={step.title} className="rounded-lg bg-fill-secondary/50 p-4">
                  <Typography variant="bodySm" className="mb-2 font-medium">
                    {index + 1}. {step.title}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="leading-relaxed">
                    {step.body}
                  </Typography>
                </div>
              ))}
            </div>
          </HelpSection>

          {/* Cases & Bottles */}
          <HelpSection id="quantities" icon={IconBox} title="Cases & Bottles">
            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
              A line is sold either by the case or as single bottles, and the portal and proforma
              always say which:
            </Typography>

            <div className="mt-4 overflow-hidden rounded-lg border border-border-primary">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border-primary">
                  {[
                    ['2 cases', 'Case of 3 × 75cl · 6 btl', 'Two cases of three bottles; prices are /case'],
                    ['1 case', 'Case of 6 × 75cl · 6 btl', 'One case of six bottles; prices are /case'],
                    ['2 bottles', 'Bottle · 75cl', 'Two single bottles; prices are /btl'],
                  ].map(([qty, pack, meaning]) => (
                    <tr key={pack}>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{qty}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-text-muted">{pack}</td>
                      <td className="px-3 py-2 text-text-muted">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Typography variant="bodyXs" colorRole="muted" className="mt-3 leading-relaxed">
              Order totals count both, for example &ldquo;3 cases + 2 bottles · 17 btl&rdquo;. Your
              dashboard and order list count in bottles.
            </Typography>
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

            <div className="mt-4 rounded-lg border border-text-primary bg-text-primary/5 p-5">
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
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-text-primary px-4 py-2.5 text-sm font-medium text-surface-primary transition-colors hover:bg-text-primary/90"
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
