'use client';

import {
  IconArrowsExchange,
  IconBuildingWarehouse,
  IconHelp,
  IconMail,
  IconPlaneDeparture,
  IconShip,
  IconTruckDelivery,
  IconUsers,
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
      'It is held against your account, kept separate from anybody else’s, and moves only on your instruction.',
  },
  {
    question: 'Do I pay duty while wine is stored?',
    answer:
      'No. The warehouse is licensed and bonded by UAE customs, so no duty is due while wine is stored here. Duty and VAT are only payable if the wine is delivered into the UAE, and never if it is exported.',
  },
  {
    question: 'What do you need from me before a shipment arrives?',
    answer:
      'A commercial invoice and packing list. We use them to record what is coming, match each line to the wine it is, and prepare the customs entry. Send them before the wine travels: an entry cannot be prepared without them, and a shipment that arrives ahead of its paperwork waits.',
  },
  {
    question: 'Can I combine purchases from several suppliers into one shipment?',
    answer:
      'Yes. Where lead times allow, we consolidate consignments before they travel so you pay one freight cost and clear one entry rather than several.',
  },
  {
    question: 'How accurate is what I see in my inventory?',
    answer:
      'It is the warehouse record itself, not a report compiled from it. Every receipt, move, pick and dispatch is written against the case as it happens, so what you read is what stands on the shelf.',
  },
  {
    question: 'What if a bottle is damaged or goes missing?',
    answer:
      'While your wine is in our warehouse it is insured, and a breakage or shortfall there is ours to make good. Damage found on arrival is recorded against the receipt and raised with the sender, as it happened before the wine reached us.',
  },
  {
    question: 'How do I arrange a delivery, a shipment or an export?',
    answer:
      'For a client, place the order under Client orders. For anything else, email us. We confirm what we have understood before anything moves, so the right case always goes out.',
  },
  {
    question: 'Can I send part of a case?',
    answer:
      'Yes. A sealed case can be opened and a part quantity picked. The remaining bottles stay recorded against you, so a broken case is not a lost case.',
  },
  {
    question: 'What does it cost to deliver wine in the UAE?',
    answer:
      'Duty and clearance, VAT, the transfer out of the free zone, licensed distribution and delivery. Duty and VAT are set by UAE customs and applied at the rate in force on the day the entry is cleared, so we quote each delivery rather than publishing a percentage here.',
  },
  {
    question: 'Can wine leave the country without paying UAE duty?',
    answer:
      'Yes. Wine exported straight from the bonded warehouse pays no UAE duty. We raise the re-export entry, and the reference is held against the stock so the movement can be evidenced later.',
  },
  {
    question: 'How quickly can wine be delivered?',
    answer:
      'We pick the same or next working day once an instruction is confirmed. After that it depends on customs clearance and the distributor for a UAE delivery, or the route and carrier for an export. We confirm dates as they are booked.',
  },
];

/** Where a partner goes for each job, so the help page is also a way in */
const SHORTCUTS = [
  {
    href: '/platform/partner/stock',
    icon: IconBuildingWarehouse,
    title: 'Your stock',
    detail: 'What we hold for you, case by case',
    tone: 'border-emerald-100 from-emerald-50/60 dark:border-emerald-900/50 dark:from-emerald-500/10',
    iconTone: 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  {
    href: '/platform/private-orders',
    icon: IconUsers,
    title: 'Client orders',
    detail: 'Orders for your private clients',
    tone: 'border-violet-100 from-violet-50/60 dark:border-violet-900/50 dark:from-violet-500/10',
    iconTone: 'bg-violet-100/80 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  },
  {
    href: '/platform/partner/movements',
    icon: IconArrowsExchange,
    title: 'Movements',
    detail: 'Everything received, moved or sent',
    tone: 'border-amber-100 from-amber-50/60 dark:border-amber-900/50 dark:from-amber-500/10',
    iconTone: 'bg-amber-100/80 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  },
  {
    href: 'mailto:enquiries@craftculture.xyz',
    icon: IconMail,
    title: 'Contact us',
    detail: 'enquiries@craftculture.xyz',
    tone: 'border-slate-200 from-slate-50/60 dark:border-slate-700 dark:from-slate-500/10',
    iconTone: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
  },
];

const ORDER_STEPS = [
  {
    title: 'You create the order',
    detail:
      'Under Client orders, choose the wines, add your client’s details and submit. Drafts are saved, so an order can be finished later.',
  },
  {
    title: 'We review it',
    detail:
      'We check stock, pricing and the client details, and assign the licensed distributor who will deliver. If anything needs changing we send it back to you with a note.',
  },
  {
    title: 'Your client pays',
    detail:
      'The distributor collects payment from your client, including duty, VAT and delivery. These are paid by the client, not by you.',
  },
  {
    title: 'The wine is delivered',
    detail:
      'We pick the wine from your stock, clear it and hand it to the distributor, who delivers to your client.',
  },
  {
    title: 'You are paid',
    detail:
      'You receive your landed duty-free price for the wine, usually two to three weeks after the order is approved. Each order shows where its payment has reached.',
  },
];

const SHIPPING_STEPS = [
  {
    title: 'Tell us what is coming',
    detail:
      'Send the commercial invoice and packing list before the wine travels. They are what we record against and what the customs entry is built from.',
  },
  {
    title: 'We arrange collection and freight',
    detail:
      'Temperature-controlled where the route calls for it; sea freight where lead time allows, air where it does not.',
  },
  {
    title: 'Customs entry into bond',
    detail: 'We prepare and lodge the import entry. Nothing is payable at this point: the wine enters duty-free.',
  },
  {
    title: 'Received and recorded',
    detail:
      'Each case is checked against the paperwork, given a bay and added to your stock. Anything that does not match what was declared is raised with you.',
  },
];

const Steps = ({ steps }: { steps: { title: string; detail: string }[] }) => (
  <ol className="relative space-y-4">
    {steps.map((step, index) => (
      <li key={step.title} className="relative flex gap-3.5">
        {index < steps.length - 1 && (
          <span className="bg-border-muted absolute left-[13px] top-8 h-[calc(100%-12px)] w-px" aria-hidden />
        )}
        <span className="bg-text-primary text-surface-primary relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
          {index + 1}
        </span>
        <div className="pt-0.5">
          <p className="text-text-primary text-sm font-semibold">{step.title}</p>
          <p className="text-text-muted mt-0.5 text-sm leading-relaxed">{step.detail}</p>
        </div>
      </li>
    ))}
  </ol>
);

const Cards = ({ items }: { items: { title: string; detail: string }[] }) => (
  <div className="grid gap-3 sm:grid-cols-3">
    {items.map((item) => (
      <div key={item.title} className="border-border-muted bg-surface-secondary/40 rounded-xl border p-4">
        <p className="text-text-primary mb-1 text-sm font-semibold">{item.title}</p>
        <p className="text-text-muted text-xs leading-relaxed">{item.detail}</p>
      </div>
    ))}
  </div>
);

/**
 * Help for a partner whose wine we hold
 *
 * Organised around what a partner does here — check their stock, place orders
 * for their private clients, ship wine in, deliver or export it — with each
 * section pointing at the screen that does it. No internal order vocabulary:
 * a partner does not need to know what a PCO is to place one.
 */
const PartnerSupportPage = () => {
  return (
    <main className="container py-6 md:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6">
          <p className="text-text-muted mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]">
            Partner help
          </p>
          <Typography variant="headingLg" className="mb-2">
            How Craft &amp; Culture works for you
          </Typography>
          <Typography variant="bodySm" colorRole="muted" className="max-w-2xl leading-relaxed">
            We store your wine duty-free in the C&amp;C bonded warehouse, deliver it to your clients in the
            UAE through licensed distributors, and ship it onward when you need. Everything you see here reads from the
            warehouse record itself.
          </Typography>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {SHORTCUTS.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className={`group rounded-xl border bg-gradient-to-b to-transparent p-3.5 shadow-sm transition hover:-translate-y-px hover:shadow-md ${item.tone}`}
            >
              <span className={`mb-2 flex size-8 items-center justify-center rounded-lg ${item.iconTone}`}>
                <item.icon size={16} />
              </span>
              <span className="text-text-primary block text-sm font-semibold">{item.title}</span>
              <span className="text-text-muted block truncate text-xs">{item.detail}</span>
            </Link>
          ))}
        </div>

        <PartnerHelpNavigation />

        <div className="space-y-5">
          <HelpSection id="storing" icon={IconBuildingWarehouse} title="Storing your wine">
            <p className="text-text-muted text-sm leading-relaxed">
              Your wine is held in a facility licensed and bonded by UAE customs. While it is stored here no duty is
              paid on it; duty and VAT only become payable if it is delivered into the UAE, and never if it is exported.
            </p>
            <dl className="grid gap-2.5 sm:grid-cols-2">
              {[
                { term: 'Conditions', detail: '12–16°C, humidity controlled, continuously logged.' },
                { term: 'Security', detail: 'CCTV and restricted access within the bonded facility.' },
                { term: 'Ownership', detail: 'Held against your account and moved only on your instruction.' },
                {
                  term: 'Risk and insurance',
                  detail: 'Insured by us while in our warehouse. You do not need your own cover for wine held here.',
                },
              ].map((fact) => (
                <div key={fact.term} className="border-border-muted rounded-lg border px-3.5 py-3">
                  <dt className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">{fact.term}</dt>
                  <dd className="text-text-primary m-0 mt-0.5 text-sm leading-relaxed">{fact.detail}</dd>
                </div>
              ))}
            </dl>
            <p className="text-text-muted text-sm leading-relaxed">
              Every case is recorded on arrival against a numbered bay and keeps its own history: when it arrived,
              where it sits and every movement since. <strong className="text-text-primary">Your stock</strong> and{' '}
              <strong className="text-text-primary">Movements</strong> read from that record directly.
            </p>
          </HelpSection>

          <HelpSection id="orders" icon={IconUsers} title="Orders for your private clients">
            <p className="text-text-muted text-sm leading-relaxed">
              You sell to your clients; we handle the licensed side in the UAE. You place the order, and we see it
              through review, payment, clearance and delivery.
            </p>
            <Steps steps={ORDER_STEPS} />
            <Link
              href="/platform/private-orders"
              className="bg-text-primary text-surface-primary inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold"
            >
              Go to Client orders
            </Link>
          </HelpSection>

          <HelpSection id="shipping-in" icon={IconShip} title="Shipping wine in">
            <p className="text-text-muted text-sm leading-relaxed">
              Wine can come from a merchant, a producer, an auction house or another bonded warehouse. Where lead times
              allow, we combine several consignments into one shipment, so you pay one freight cost and clear one entry.
            </p>
            <Steps steps={SHIPPING_STEPS} />
          </HelpSection>

          <HelpSection id="delivering" icon={IconTruckDelivery} title="Delivering wine in the UAE">
            <p className="text-text-muted text-sm leading-relaxed">
              Wine delivered inside the UAE leaves the bonded warehouse, and that is when duty and VAT become payable.
              Alcohol may only be delivered on the mainland by a licensed distributor, so every delivery goes through
              one.
            </p>
            <Cards
              items={[
                {
                  title: 'What it costs',
                  detail:
                    'Duty and clearance, VAT, transfer out of the free zone, licensed distribution and delivery. Duty and VAT follow the UAE customs rates on the day, so each delivery is quoted.',
                },
                {
                  title: 'What you tell us',
                  detail:
                    'Which wines, how many bottles and where they are going. Part cases are fine: the rest of the case stays recorded against you.',
                },
                {
                  title: 'What happens next',
                  detail:
                    'The wine is reserved so it cannot be committed twice, then picked, cleared and handed to the distributor.',
                },
              ]}
            />
          </HelpSection>

          <HelpSection id="exporting" icon={IconPlaneDeparture} title="Exporting wine out of the UAE">
            <p className="text-text-muted text-sm leading-relaxed">
              Wine that leaves the country straight from the bonded warehouse pays no UAE duty. This is the route for a
              buyer abroad, another bonded warehouse, or a collection held elsewhere.
            </p>
            <Cards
              items={[
                {
                  title: 'Re-export entry',
                  detail:
                    'We raise the re-export declaration and keep its reference against the stock, so the movement can be evidenced later.',
                },
                {
                  title: 'Documents',
                  detail:
                    'A combined invoice and packing list showing what is in each case and the customs classification of each line.',
                },
                {
                  title: 'Provenance',
                  detail:
                    'Storage and movement records go with the wine — what a serious buyer at the other end will ask for.',
                },
              ]}
            />
          </HelpSection>

          <HelpSection id="faq" icon={IconHelp} title="Common questions">
            <FAQAccordion items={faqItems} />
          </HelpSection>

          <section
            id="contact"
            className="bg-text-primary text-surface-primary flex scroll-mt-32 flex-col gap-4 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div>
              <p className="text-base font-semibold">Anything else?</p>
              <p className="mt-1 text-sm opacity-75">
                For a shipment, a delivery, an export or a question not covered here, write to us and we will come back
                to you directly, usually the same working day.
              </p>
            </div>
            <a
              href="mailto:enquiries@craftculture.xyz"
              className="bg-surface-primary text-text-primary inline-flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold"
            >
              <IconMail size={16} /> enquiries@craftculture.xyz
            </a>
          </section>
        </div>
      </div>
    </main>
  );
};

export default PartnerSupportPage;
