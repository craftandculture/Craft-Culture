'use client';

import {
  IconBottle,
  IconCoin,
  IconId,
  IconMail,
  IconTruckDelivery,
} from '@tabler/icons-react';
import Link from 'next/link';

import Typography from '@/app/_ui/components/Typography/Typography';

import FAQAccordion from './FAQAccordion';
import HelpSection from './HelpSection';

const faqItems = [
  {
    question: 'Do I pay duty on wine sitting in my cellar?',
    answer:
      'No. Wine held in bond is duty suspended. Duty, VAT and the cost of delivery become payable only when you call wines forward to the mainland, and are quoted to you for approval before anything moves.',
  },
  {
    question: 'What is included in the release cost?',
    answer:
      'Duty and clearance, VAT, transfer out of bond, licensed distribution, delivery to your address, and our handling. The wine itself is not included — you already own it. Duty is assessed on the declared import value, so a more valuable case costs more to release than a less valuable one of the same size.',
  },
  {
    question: 'Can I change a request after sending it?',
    answer:
      'Yes, until we have priced it. Open the request under "Requests in progress" to adjust quantities, remove a wine, or withdraw it entirely. Once we have issued costs the contents are fixed, because the figure you are holding is calculated against them.',
  },
  {
    question: 'Can I ask for part of a case?',
    answer:
      'Yes. Quantities are held in bottles, and the warehouse will open a sealed case to make up a part quantity. Where you request a full case it is picked sealed, from the exact parcel you selected.',
  },
  {
    question: 'How quickly can wine be delivered?',
    answer:
      'Once you accept the quotation the release enters the warehouse queue and is cleared for mainland delivery. Timing depends on customs and the licensed distributor; we will confirm a date with you directly.',
  },
  {
    question: 'Why do you need my Emirates ID?',
    answer:
      'The licensed partner delivering on the mainland has to establish who is receiving the wine. We hold it once, against your account, so it is not asked for on every delivery. It is visible only to you and the Craft & Culture team.',
  },
  {
    question: 'What happens if I go over my storage allowance?',
    answer:
      'Membership includes twenty cases. Beyond that, storage is charged per case per month and appears on your regular invoice. Nothing is refused or moved on your behalf.',
  },
  {
    question: 'Can I sell or move wine out of my cellar?',
    answer:
      'Yes. Wine in bond can be sold, transferred, or shipped onward through the Craft & Culture network without duty being triggered. Contact us and we will set it up.',
  },
];

/**
 * Help written for a private cellar member
 *
 * The general help centre explains quotes, purchase orders and product
 * sourcing — a collector has none of those. What they have is wine in bond,
 * a way to call it forward, and questions about what that costs. Answering
 * the wrong ones is worse than answering none: it tells a member this
 * platform is built for somebody else.
 */
const CellarHelp = () => {
  return (
    <main className="container py-6 md:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6">
          <Typography
            variant="bodyXs"
            className="text-text-brand mb-1.5 block font-semibold uppercase tracking-[0.18em]"
          >
            C&amp;C Private Cellar
          </Typography>
          <Typography variant="headingLg" className="mb-2">
            Help and support
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Your wine, how to call it forward, and what it costs to do so
          </Typography>
        </div>

        <div className="space-y-6">
          <HelpSection id="your-cellar" icon={IconBottle} title="Your cellar">
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Everything you own with us is held in bond at Craft &amp;
              Culture, Ras Al Khaimah, at twelve to fourteen degrees with
              controlled humidity. Because it is in bond, no duty has been paid
              on it and none becomes payable while it stays there.
            </Typography>
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Your cellar shows each wine, the parcels it is held in, the lot
              it arrived on, and what it was declared at on import. That figure
              is the declared import value, not a market valuation &mdash; we
              do not price your collection.
            </Typography>
          </HelpSection>

          <HelpSection
            id="releasing"
            icon={IconTruckDelivery}
            title="Calling wines forward"
          >
            <ol className="space-y-3">
              {[
                {
                  title: 'Choose what you want',
                  detail:
                    'Add a case or individual bottles from any wine. You can add from several wines; they travel as one delivery.',
                },
                {
                  title: 'See the estimate',
                  detail:
                    'The request prices itself against your rate card as you build it, so you know the scale of the cost before asking.',
                },
                {
                  title: 'Send the request',
                  detail:
                    'We check availability and confirm the figure. You can still change or withdraw the request until we have priced it.',
                },
                {
                  title: 'Approve the cost',
                  detail:
                    'Nothing leaves bond until you accept. On acceptance the release is picked from the exact parcels you chose and cleared for delivery.',
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="bg-fill-brand flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white">
                    {index + 1}
                  </span>
                  <div>
                    <Typography variant="bodySm" className="font-medium">
                      {step.title}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      {step.detail}
                    </Typography>
                  </div>
                </li>
              ))}
            </ol>
          </HelpSection>

          <HelpSection id="costs" icon={IconCoin} title="What it costs">
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Storage is covered by your membership, which includes twenty
              cases. Beyond that, storage is charged per case per month on your
              regular invoice.
            </Typography>
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Releasing wine to the mainland carries duty and clearance, VAT,
              transfer out of bond, licensed distribution, delivery and our
              handling. The wine itself is never charged for again &mdash; it
              is already yours.
            </Typography>
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              A condition report is AED 150 per parcel. Each bottle is
              inspected &mdash; fill level, label, capsule and closure &mdash;
              and reported with photographs and written notes.
            </Typography>
          </HelpSection>

          <HelpSection id="your-details" icon={IconId} title="Your details">
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Your delivery address, access instructions and identification are
              held on your account, so they are not asked for on every request.
              You can change them at any time, and send an individual delivery
              elsewhere without altering your default address.
            </Typography>
            <Link
              href="/platform/cellar/profile"
              className="border-border-primary bg-fill-secondary/30 hover:bg-fill-secondary inline-block rounded-lg border p-4 transition-colors"
            >
              <Typography variant="bodySm" className="font-medium">
                Your details
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                Delivery address, access instructions and identification
              </Typography>
            </Link>
          </HelpSection>

          <HelpSection id="faq" icon={IconMail} title="Common questions">
            <FAQAccordion items={faqItems} />
            <div className="border-border-primary bg-fill-secondary/30 rounded-lg border p-4">
              <Typography variant="bodySm" className="mb-1 font-medium">
                Anything else
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Write to{' '}
                <a
                  className="text-text-brand font-medium"
                  href="mailto:enquiries@craftculture.xyz"
                >
                  enquiries@craftculture.xyz
                </a>{' '}
                and we will come back to you directly.
              </Typography>
            </div>
          </HelpSection>
        </div>
      </div>
    </main>
  );
};

export default CellarHelp;
