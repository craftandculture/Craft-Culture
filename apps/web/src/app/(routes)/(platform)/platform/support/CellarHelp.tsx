'use client';

import {
  IconBottle,
  IconBuildingWarehouse,
  IconCoin,
  IconId,
  IconMail,
  IconTag,
  IconTruckDelivery,
} from '@tabler/icons-react';
import Link from 'next/link';

import { COMMISSION_RATES } from '@/app/_consignment/constants/commissionRates';
import Typography from '@/app/_ui/components/Typography/Typography';

import CellarHelpNavigation from './CellarHelpNavigation';
import FAQAccordion from './FAQAccordion';
import HelpSection from './HelpSection';

const faqItems = [
  {
    question: 'Do I pay duty on wine stored in my cellar?',
    answer:
      'No. Your wine is stored duty-free in the C&C bonded warehouse. Duty, VAT and the cost of delivery are only paid when you ask for wine to be delivered to you in the UAE, and we quote them for your approval before anything moves.',
  },
  {
    question: 'What does it cost to have wine delivered?',
    answer:
      'Duty and customs clearance, VAT, transfer out of the bonded warehouse, the licensed distributor, delivery to your address, and our handling. The wine itself is not charged again, as you already own it. Duty is assessed on the declared import value, so a more valuable case costs more to deliver than a less valuable one of the same size. Rates are set by UAE customs and applied as they stand on the day of clearance; your cellar estimates the cost as you build a delivery request, and we confirm it before anything moves.',
  },
  {
    question: 'Can I change a delivery request after sending it?',
    answer:
      'Yes, until we have priced it. Open the request under "Delivery requests" to adjust quantities, remove a wine, or withdraw it entirely. Once we have issued costs the contents are fixed, because the figure you are holding is calculated against them.',
  },
  {
    question: 'Can I ask for part of a case?',
    answer:
      'Yes. The warehouse will open a sealed case to make up a part quantity. Where you ask for a full case, it is sent to you sealed, exactly as you selected it.',
  },
  {
    question: 'How quickly can my wine be delivered?',
    answer:
      'Once you accept the quotation, your delivery is prepared by the warehouse and cleared through customs. Timing depends on customs and the licensed distributor; we will confirm a date with you directly.',
  },
  {
    question: 'Why do you need my Emirates ID?',
    answer:
      'The licensed partner delivering on the mainland has to establish who is receiving the wine. We hold it once, securely, so it is not asked for on every delivery. It is visible only to you and the Craft & Culture team.',
  },
  {
    question: 'What happens if I go over my storage allowance?',
    answer:
      'Your membership includes storage for twenty 12-bottle cases (a 6-bottle case counts as half). Storage beyond that is added to your regular invoice at the rate in your membership terms. Nothing is refused or moved on your behalf.',
  },
  {
    question: 'Who sees that a wine is mine when it is for sale?',
    answer:
      'Nobody. Wine you have offered appears on our lists as Craft & Culture stock, priced and sold by us. Buyers are not told whose wine it was, and other members browsing The Cellar List cannot tell your wine from anyone else\u2019s.',
  },
  {
    question: 'When am I paid for wine that sells?',
    answer:
      'On the monthly payment run, and only for sales the buyer has actually paid. We do not advance money against wine that has sold but not settled. Wine may also sell a few bottles at a time \u2014 you are paid for each part as it sells.',
  },
  {
    question: 'Can I take my wine back off the market?',
    answer:
      'While it is still in our warehouse, yes \u2014 withdraw it from the Selling tab and it returns to your cellar immediately. Once it has been placed with a distributor, duty has been paid and it has left the warehouse, so it can no longer be withdrawn. Placing wine is our decision and does not need your approval, so treat the moment you offer as the point of commitment.',
  },
  {
    question: 'Can I choose which distributor my wine goes to?',
    answer:
      'No. You consign to Craft & Culture, and where wine is placed is ours to decide \u2014 a distributor takes a selection they can sell, not a list a client has chosen. If we are placing something of yours we will usually talk to you about it first, but the decision is not one you make on the platform.',
  },
  {
    question: 'Can I move wine to someone else without selling it?',
    answer:
      'Yes. Wine in our warehouse can be transferred to another person or shipped abroad through the Craft & Culture network without paying duty. That is not something the platform does on its own \u2014 write to us and we will set it up.',
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
            Your wine, how to have it delivered, and what it costs
          </Typography>
        </div>

        <CellarHelpNavigation />

        <div className="space-y-6">
          <HelpSection id="your-cellar" icon={IconBottle} title="Your cellar">
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Everything you own with us is stored duty-free in the C&amp;C
              bonded warehouse, at twelve to sixteen degrees with
              controlled humidity. No duty or VAT is paid while it stays there;
              they are only paid when wine is delivered to you in the UAE.
            </Typography>
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Your cellar shows each wine, how many cases and bottles you hold,
              when it arrived, and what it was declared at on import. That figure
              is the declared import value, not a market valuation &mdash; we
              do not price your collection.
            </Typography>
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Cold-chain records are held against the wine itself &mdash; the
              conditions it was kept in, and the journey from producer to
              delivery &mdash; and travel with it when it is delivered. There is no
              charge for them.
            </Typography>
          </HelpSection>

          <HelpSection
            id="releasing"
            icon={IconTruckDelivery}
            title="Having wine delivered"
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
                    'Nothing leaves the warehouse until you accept. Your wine is then picked exactly as you chose it and cleared for delivery.',
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="bg-text-primary text-surface-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
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

          {/*
            Between calling wine forward and what it costs, because those are
            the two things a member does with wine they own and this is now the
            second of them. Written before the costs section so the order on the
            page matches the order of the decision.
          */}
          <HelpSection id="selling" icon={IconTag} title="Selling your wine">
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              You can ask us to sell any wine you hold. Press Sell on the wine
              in your cellar, choose how many bottles, and name what you want to
              receive for each one. You receive that figure in full &mdash; our
              commission is added on top of it, not taken out of it, so a buyer
              pays slightly more than your ask and you are unaffected by which
              buyer it turns out to be.
            </Typography>
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Commission is {COMMISSION_RATES.collector}% on a sale to another
              private collector and {COMMISSION_RATES.trade}% on trade and
              restaurant orders. Nothing else is deducted, and nothing is
              charged if the wine does not sell.
            </Typography>

            <ol className="space-y-3">
              {[
                {
                  title: 'You offer it to us',
                  detail:
                    'Choose the bottles and set your price. The wine stays in your cellar and nothing moves.',
                },
                {
                  title: 'We accept, or come back to you',
                  detail:
                    'If the price will not sell we send it back with a note and you can re-price it. We never change your figure ourselves.',
                },
                {
                  title: 'It goes on our lists',
                  detail:
                    'Offered to our trade clients, our private clients and other members here, as Craft & Culture stock, with no mention of whose it is.',
                },
                {
                  title: 'You are paid when it sells',
                  detail:
                    'On the monthly payment run, for sales the buyer has paid. Wine can sell a few bottles at a time, and you are paid for each part as it sells.',
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="bg-text-primary text-surface-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
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

            {/*
              The one thing a member must not discover afterwards. Placement is
              C&C's decision and needs no further approval, so the moment they
              offer is the moment the wine can be put beyond recall — not the
              moment we place it, which they neither see coming nor control.
              Saying it in a notification after the fact would be a nasty
              surprise dressed as an update.
            */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <Typography variant="bodySm" className="mb-1 font-semibold">
                Where the commitment becomes final
              </Typography>
              <Typography
                variant="bodyXs"
                colorRole="muted"
                className="leading-relaxed"
              >
                While your wine is in our warehouse you can withdraw it at any
                time and it returns to your cellar. To reach some buyers we
                place wine with a licensed distributor on the mainland, which
                pays the duty and takes it out of the building &mdash; and from
                that point it cannot be withdrawn. Which wine is placed, and
                with whom, is our decision and does not need your approval. So
                the point at which you commit is when you offer, not when we
                place: offer only wine you are content to sell.
              </Typography>
            </div>

            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Everything you have offered, and where each offer has got to, is
              on the Selling tab in your cellar.
            </Typography>
          </HelpSection>

          <HelpSection id="costs" icon={IconCoin} title="What it costs">
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Storage is covered by your membership, which includes twenty
              12-bottle cases (a 6-bottle case counts as half). Storage beyond
              that is added to your regular invoice at the rate set out in your
              membership terms.
            </Typography>
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Having wine delivered to you in the UAE carries duty and customs
              clearance, VAT, transfer out of the bonded warehouse, the licensed
              distributor, delivery and our handling. The wine itself is never charged for again &mdash; it
              is already yours.
            </Typography>
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Duty and VAT are set by UAE customs, not by us, and are applied
              at the rate in force on the day your delivery is cleared. No
              percentage is quoted here for that reason: a figure written into
              a help page is a figure nobody updates. Your cellar estimates
              the cost as you build a delivery request, and we confirm it before
              anything moves.
            </Typography>
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              A condition report is AED 150 per wine. Each bottle is
              inspected &mdash; fill level, label, capsule and closure &mdash;
              and reported with photographs and written notes.
            </Typography>
          </HelpSection>

          <HelpSection
            id="warehouse"
            icon={IconBuildingWarehouse}
            title="The warehouse"
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  term: 'Temperature',
                  detail:
                    'Twelve to sixteen degrees, continuously logged rather than spot-checked.',
                },
                {
                  term: 'Status',
                  detail:
                    'Licensed and bonded by UAE customs. Wine is stored duty-free; duty is only owed when wine is delivered to you in the UAE.',
                },
                {
                  term: 'Security',
                  detail:
                    'CCTV, humidity control and restricted access, within the bonded facility.',
                },
                {
                  term: 'Handling',
                  detail:
                    'Receiving, putaway, picking and dispatch are all done in house, by the team that holds the record.',
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
              Each case is recorded on arrival against a numbered bay, and
              keeps its own history from that point: what arrived and when,
              what was delivered and to whom, and what remains in the warehouse. This is
              the record the warehouse itself works from, not a statement
              prepared afterwards, so what you read is what stands on the
              shelf.
            </Typography>
          </HelpSection>

          <HelpSection id="your-details" icon={IconId} title="Your details">
            <Typography
              variant="bodySm"
              colorRole="muted"
              className="leading-relaxed"
            >
              Your delivery address, access instructions and identification are
              held securely once, so they are not asked for on every request.
              You can change them at any time, and send an individual delivery
              elsewhere without altering your default address.
            </Typography>
            <Link
              href="/platform/cellar/profile"
              className="border-border-primary bg-fill-secondary/30 hover:bg-fill-secondary block rounded-lg border p-4 transition-colors sm:inline-block"
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
                  className="text-text-primary break-all font-semibold underline underline-offset-2"
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
