'use client';

import {
  IconBuildingWarehouse,
  IconHelp,
  IconMail,
  IconPlaneDeparture,
  IconShip,
  IconTruckDelivery,
} from '@tabler/icons-react';
import Link from 'next/link';

import Typography from '@/app/_ui/components/Typography/Typography';

import PartnerHelpNavigation from './PartnerHelpNavigation';
import FAQAccordion from '../../support/FAQAccordion';
import HelpSection from '../../support/HelpSection';

const faqItems = [
  {
    question: 'Who owns the wine while it is with you?',
    answer:
      'You do. Stock is held against your account and is not ours to sell. It appears under your own inventory, separately from anybody else’s, and moves only on your instruction.',
  },
  {
    question: 'Do I pay duty while wine is stored?',
    answer:
      'No. The warehouse is licensed and bonded by UAE customs, so duty is suspended — not deferred — while wine remains in bond. It becomes payable only if the wine is released into the UAE, and never at all if it is exported onward.',
  },
  {
    question: 'What do you need from me before a shipment arrives?',
    answer:
      'A commercial invoice and packing list for the consignment. We use these to record what is coming, match each line to the wine it is, and prepare the customs entry. Sending them early is the single biggest thing that keeps a shipment moving.',
  },
  {
    question: 'Can I combine purchases from several suppliers into one shipment?',
    answer:
      'Yes. Where lead times allow, we consolidate consignments before they travel so you pay one freight cost and clear one entry rather than several.',
  },
  {
    question: 'How accurate is what I see in my inventory?',
    answer:
      'It is the warehouse record, not a report compiled afterwards. Every receipt, move, pick and dispatch is written against the case as it happens, so what you read is what stands on the shelf.',
  },
  {
    question: 'Can I take part of a case?',
    answer:
      'Yes. A sealed case can be opened and a part quantity picked. The remaining bottles stay recorded against you, so a broken case is not a lost case.',
  },
  {
    question: 'What does it cost to release wine into the UAE?',
    answer:
      'Duty and clearance, VAT, the transfer out of the free zone, licensed distribution and delivery. Duty and VAT are set by UAE customs and applied at the rate in force on the day the entry is cleared, so we quote the figure for each release rather than publishing a percentage here.',
  },
  {
    question: 'Can wine leave the country without paying UAE duty?',
    answer:
      'Yes. Wine exported while still in bond does not attract UAE duty. We raise the re-export entry, and the reference is held against the stock so the movement can be evidenced later.',
  },
  {
    question: 'How quickly can wine be delivered?',
    answer:
      'Picking is same or next working day once an instruction is confirmed. Delivery into the UAE depends on the customs entry and the licensed distributor; export timing depends on the route and the airline or vessel. We confirm dates as they are booked.',
  },
];

/**
 * Help for a partner whose wine we hold
 *
 * Rewritten away from internal order vocabulary. A partner does not need to
 * know what a PCO is or the stages a record passes through on our side; they
 * need to know how to get wine to us, what happens while we hold it, and how
 * to get it out again — whether that is into the UAE or back out of it.
 */
const PartnerSupportPage = () => {
  return (
    <main className="container py-6 md:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6">
          <Typography
            variant="bodyXs"
            className="text-text-brand mb-1.5 block font-semibold uppercase tracking-[0.18em]"
          >
            Craft &amp; Culture
          </Typography>
          <Typography variant="headingLg" className="mb-2">
            Help and support
          </Typography>
          <Typography variant="bodySm" colorRole="muted">
            Storing wine with us, shipping it in, and getting it out again
          </Typography>
        </div>

        <PartnerHelpNavigation />

        <div className="space-y-6">
          <HelpSection
            id="storing"
            icon={IconBuildingWarehouse}
            title="Storing wine"
          >
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Your wine is held at Craft &amp; Culture, Ras Al Khaimah, in a
              facility licensed and bonded by UAE customs. Because it is in
              bond, no duty has been paid on it and none becomes payable while
              it stays there.
            </Typography>

            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  term: 'Conditions',
                  detail:
                    'Twelve to fourteen degrees, humidity controlled, continuously logged rather than spot-checked.',
                },
                {
                  term: 'Security',
                  detail:
                    'CCTV and restricted access within the bonded facility.',
                },
                {
                  term: 'Ownership',
                  detail:
                    'Stock is held against your account and moves only on your instruction.',
                },
                {
                  term: 'Handling',
                  detail:
                    'Receiving, putaway, picking and dispatch are all done in house.',
                },
              ].map((fact) => (
                <div key={fact.term}>
                  <dt className="text-text-muted mb-0.5 text-[11px] font-semibold uppercase tracking-wider">
                    {fact.term}
                  </dt>
                  <dd className="text-text-primary m-0 text-sm leading-relaxed">
                    {fact.detail}
                  </dd>
                </div>
              ))}
            </dl>

            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Every case is recorded on arrival against a numbered bay and
              keeps its own history from that point: what arrived and when,
              where it sits, what has moved and what remains. Your inventory
              reads from that record directly, so it is the warehouse position
              rather than a statement prepared afterwards.
            </Typography>

            <Link
              href="/platform/partner/stock"
              className="border-border-primary bg-fill-secondary/30 hover:bg-fill-secondary inline-block rounded-lg border p-4 transition-colors"
            >
              <Typography variant="bodySm" className="font-medium">
                Your stock
              </Typography>
              <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                What is held, where it sits, and what has moved
              </Typography>
            </Link>
          </HelpSection>

          <HelpSection id="shipping-in" icon={IconShip} title="Shipping wine in">
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Wine can arrive from a merchant, a producer, an auction house or
              another bonded warehouse. Where lead times allow we consolidate
              several consignments before they travel, so you pay one freight
              cost and clear one entry rather than several.
            </Typography>

            <ol className="space-y-3">
              {[
                {
                  title: 'Tell us what is coming',
                  detail:
                    'Send the commercial invoice and packing list. These are what we record against, and what the customs entry is built from.',
                },
                {
                  title: 'We arrange collection and freight',
                  detail:
                    'Temperature-controlled where the route calls for it. Sea freight where lead time permits, air where it does not.',
                },
                {
                  title: 'Customs and clearance',
                  detail:
                    'We prepare and lodge the import entry into the bonded facility. Nothing is due at this point: the wine enters in bond.',
                },
                {
                  title: 'Received and recorded',
                  detail:
                    'Each case is checked against the paperwork, given a bay and written into your inventory. Anything that does not match what was declared is raised with you rather than quietly booked in.',
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

          <HelpSection
            id="releasing"
            icon={IconTruckDelivery}
            title="Releasing wine into the UAE"
          >
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Wine sold or delivered inside the UAE has to leave bond, and
              that is the point at which duty becomes payable. Alcohol may only
              be delivered on the mainland by a licensed partner, so a release
              moves through one rather than going direct.
            </Typography>

            <div className="space-y-3">
              {[
                {
                  title: 'What a release costs',
                  detail:
                    'Duty and clearance, VAT, the transfer out of the free zone, licensed distribution and delivery. Duty and VAT are set by UAE customs and applied at the rate in force on the day, so each release is quoted rather than priced from a published percentage.',
                },
                {
                  title: 'What you tell us',
                  detail:
                    'Which wines, how many bottles, and where they are going. Part cases are fine — a sealed case can be opened and the remainder stays recorded against you.',
                },
                {
                  title: 'What happens then',
                  detail:
                    'The stock is reserved against the instruction so it cannot be committed twice, picked, cleared, and handed to the licensed partner for delivery.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-fill-secondary/50 rounded-lg p-4"
                >
                  <Typography variant="bodySm" className="mb-1 font-medium">
                    {item.title}
                  </Typography>
                  <Typography
                    variant="bodyXs"
                    colorRole="muted"
                    className="leading-relaxed"
                  >
                    {item.detail}
                  </Typography>
                </div>
              ))}
            </div>
          </HelpSection>

          <HelpSection
            id="exporting"
            icon={IconPlaneDeparture}
            title="Exporting wine out of the UAE"
          >
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Wine that leaves the country while still in bond does not attract
              UAE duty at all. This is the route for a sale to a buyer abroad,
              a transfer to another bonded warehouse, or wine returning to a
              collection held elsewhere.
            </Typography>

            <div className="space-y-3">
              {[
                {
                  title: 'Re-export entry',
                  detail:
                    'We raise the re-export declaration and the reference is held against the stock it covers, so the movement can be evidenced afterwards without reconstructing it.',
                },
                {
                  title: 'Documents that travel',
                  detail:
                    'A combined invoice and packing list stating what is in each case, with the customs classification each line falls under.',
                },
                {
                  title: 'Condition and provenance',
                  detail:
                    'Storage and movement records stay with the wine and go with it, which is what a serious buyer at the other end will ask for.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-fill-secondary/50 rounded-lg p-4"
                >
                  <Typography variant="bodySm" className="mb-1 font-medium">
                    {item.title}
                  </Typography>
                  <Typography
                    variant="bodyXs"
                    colorRole="muted"
                    className="leading-relaxed"
                  >
                    {item.detail}
                  </Typography>
                </div>
              ))}
            </div>
          </HelpSection>

          <HelpSection id="faq" icon={IconHelp} title="Common questions">
            <FAQAccordion items={faqItems} />
          </HelpSection>

          <HelpSection id="contact" icon={IconMail} title="Anything else">
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              For a shipment, a release, an export, or anything not covered
              here, write to{' '}
              <a
                className="text-text-brand font-medium"
                href="mailto:enquiries@craftculture.xyz"
              >
                enquiries@craftculture.xyz
              </a>{' '}
              and we will come back to you directly.
            </Typography>
          </HelpSection>
        </div>
      </div>
    </main>
  );
};

export default PartnerSupportPage;
