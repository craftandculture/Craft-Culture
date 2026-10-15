import { PRIVATE_CELLAR_TERMS_VERSION } from '@/app/_onboarding/constants/privateCellarTerms';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface PrivateCellarTermsDocumentProps {
  membershipFeeAed: number;
  includedCases: number;
  extraCaseMonthlyAed: number;
}

const aed = (value: number) => `AED ${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;

/**
 * The Private Cellar membership terms
 *
 * The figures come from the house rate card, so the terms a member accepts
 * always match what they are charged. Drafted from the membership page and
 * the agreed commercial terms; flagged for legal review before launch.
 */
const PrivateCellarTermsDocument = ({
  membershipFeeAed,
  includedCases,
  extraCaseMonthlyAed,
}: PrivateCellarTermsDocumentProps) => {
  const sections: { title: string; paragraphs: string[] }[] = [
    {
      title: '1. These terms',
      paragraphs: [
        'These terms govern membership of C&C Private Cellar, a service of Craft & Culture FZE ("C&C", "we", "us"), and apply alongside the Craft & Culture Terms of Use. By accepting them when you join, you ("the member") agree to be bound by them.',
      ],
    },
    {
      title: '2. Joining and activation',
      paragraphs: [
        'Joining is free. Membership begins, and the monthly fee is first charged, on activation: the first time you ask us to buy, release, sell or bring wine into your cellar. Before activation you may view your cellar and the wines available to you without charge.',
        'Activation requires a valid Emirates ID and a payment card registered with our billing provider. We may decline or close a membership where we cannot verify your identity or where required by law.',
      ],
    },
    {
      title: '3. Membership fee',
      paragraphs: [
        `The membership fee is ${aed(membershipFeeAed)} per month, charged monthly in advance to your registered card from the date of activation. No VAT is charged, as the service is provided within a designated free zone. Invoices are issued for each charge.`,
      ],
    },
    {
      title: '4. Storage allowance and additional cases',
      paragraphs: [
        `The fee includes storage for up to ${includedCases} 12-bottle cases. A 6-bottle case counts as half a case, so the allowance holds ${includedCases * 12} standard bottles in any mix.`,
        `Above the allowance, each 12-bottle case is charged at ${aed(extraCaseMonthlyAed)} per month and each 6-bottle case at ${aed(extraCaseMonthlyAed / 2)} per month, added to the following month's invoice.`,
        'Cases are counted in standard 75cl bottles. A half bottle (37.5cl) counts as half a bottle, a magnum (1.5L) as two, a double magnum (3L) as four and an Imperial (6L) as eight; other sizes count by volume. A 6-bottle case is a case of up to six standard bottles (up to 4.5 litres). A 12-bottle case is a case of seven to twelve standard bottles (over 4.5 litres and up to 9 litres). A case of more than twelve counts as one 12-bottle case for every twelve bottles or part of twelve. Loose bottles and mixed cases are counted together, every six bottles or part of six counting as one 6-bottle case.',
        'Cases are counted at the end of each calendar month, from what is held in your cellar that day.',
      ],
    },
    {
      title: '5. Your wine',
      paragraphs: [
        'Wine is imported and held by C&C as the licensed importer and bonded warehouse operator, as UAE customs rules require. You hold the beneficial interest in the wine recorded against your account, and it is held for you and not as stock of C&C. Every case is recorded against your account with its documents and movement history.',
      ],
    },
    {
      title: '6. Storage and care',
      paragraphs: [
        'Wine is stored in a licensed bonded warehouse in Ras Al Khaimah at 12–14°C, humidity controlled and continuously monitored, with duty suspended until release. Temperature records are kept against your wine at no charge.',
      ],
    },
    {
      title: '7. Insurance',
      paragraphs: [
        'Wine in our custody is insured on an all-risk basis at the value you declare for insurance, which you may update at any time. It is your responsibility to keep that value current.',
      ],
    },
    {
      title: '8. Releases and delivery',
      paragraphs: [
        'You may call wine forward at any time. Duty, VAT, handling and delivery charges are quoted before release and must be paid before wine leaves bond. Wine that remains in bond, is sold in bond or is exported remains duty suspended.',
      ],
    },
    {
      title: '9. Buying and selling',
      paragraphs: [
        'Wine bought through C&C is paid for by bank transfer and is reserved for you on order; it passes to your cellar once payment is confirmed. Wine you offer for sale stays in bond while it is offered, and any commission is agreed with you before a sale.',
      ],
    },
    {
      title: '10. Ending membership',
      paragraphs: [
        "Either party may end membership on thirty days' written notice. Before membership ends, your wine must be released, collected or transferred out; storage charges continue to apply until it has been. We may end membership immediately for a serious breach of these terms.",
      ],
    },
    {
      title: '11. Non-payment',
      paragraphs: [
        'If a payment fails, our billing provider will retry it. While any amount is outstanding, releases, purchases and sales on your account are paused.',
        'If any amount remains unpaid for thirty days after it falls due, we will give you written notice. If it remains unpaid thirty days after that notice, we may sell sufficient of your wine to recover the amount owed and reasonable costs of sale, and will account to you for any surplus. C&C holds a lien over the wine in its custody for amounts due under these terms.',
      ],
    },
    {
      title: '12. Changes, liability and law',
      paragraphs: [
        "We may change these terms or the fees on thirty days' notice; you may end membership before the change takes effect. Our liability for loss of or damage to wine is limited to its declared insurance value. These terms are governed by the laws of the United Arab Emirates as applied in the Emirate of Ras Al Khaimah.",
      ],
    },
  ];

  return (
    <main className="container py-6 sm:py-8 md:py-12 lg:py-16">
      <Card className="mx-auto w-full max-w-3xl">
        <CardContent className="p-4 sm:p-6 md:p-8">
          <CardProse>
            <CardTitle>C&amp;C Private Cellar — Membership Terms</CardTitle>
            <CardDescription colorRole="muted">Version {PRIVATE_CELLAR_TERMS_VERSION} · Draft, under legal review</CardDescription>
          </CardProse>

          <div className="mt-6 space-y-7 sm:mt-8">
            {sections.map((section) => (
              <section key={section.title}>
                <Typography variant="headingSm" className="mb-3 font-semibold">
                  {section.title}
                </Typography>
                {section.paragraphs.map((paragraph) => (
                  <Typography key={paragraph.slice(0, 40)} variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                    {paragraph}
                  </Typography>
                ))}
              </section>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default PrivateCellarTermsDocument;
