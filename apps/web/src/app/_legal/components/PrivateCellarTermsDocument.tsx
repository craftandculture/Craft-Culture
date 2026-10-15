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
 * always match what they are charged. Revised (v3) after a first legal
 * review: custody, insurance, non-payment and liability tightened, a separate
 * Transaction Terms layer for buying and selling, and the missing standard
 * clauses added. Still to be confirmed by UAE counsel before launch,
 * particularly sections 6, 13, 14 (abandoned wine), 15 and 19, and VAT.
 */
const PrivateCellarTermsDocument = ({
  membershipFeeAed,
  includedCases,
  extraCaseMonthlyAed,
}: PrivateCellarTermsDocumentProps) => {
  const sections: { title: string; paragraphs: string[] }[] = [
    {
      title: '1. About these terms',
      paragraphs: [
        'These terms govern membership of C&C Private Cellar, a service of Craft & Culture FZE ("C&C", "we", "us"), and apply alongside the Craft & Culture Terms of Use. You ("the member") accept them electronically when you apply, and again when you start your membership; we keep a record of the version you accepted and when.',
        'Membership is governed by three documents: these Membership Terms; the Transaction Terms, which apply to each purchase or sale of wine and are provided with it; and the published C&C Rate Card, which sets out storage, handling, release, transfer and delivery charges. Where they conflict, the Transaction Terms prevail for that transaction and these terms prevail otherwise.',
      ],
    },
    {
      title: '2. Eligibility and verification',
      paragraphs: [
        'Membership is open to individuals aged 21 or over who hold a valid Emirates ID and who act on their own behalf. You may not hold wine for another person without our written agreement.',
        'We verify identity before activation and may at any time ask for further information, including proof of address, source of funds or evidence of ownership of wine. We may decline, suspend or close a membership, or refuse an instruction, where we cannot complete our checks, where you or anyone connected with the wine is subject to sanctions, where we suspect money laundering or other unlawful activity, or where the law requires it. We may report matters to the authorities where the law requires us to, and need not tell you that we have.',
      ],
    },
    {
      title: '3. Joining and activation',
      paragraphs: [
        'Joining is free. Before activation you may view your cellar and the wines available to you without charge.',
        'Your membership is activated, and the monthly fee starts, the first time you buy wine, ask for a release or sale, or bring wine into your cellar, including your first deposit of wine into storage. When you activate, you confirm your acceptance of these terms and of the recurring monthly fee and storage charges described below, which continue until your membership ends.',
      ],
    },
    {
      title: '4. Fees and payment',
      paragraphs: [
        `The membership fee is ${aed(membershipFeeAed)} per month, charged monthly in advance from the date of activation. We issue an invoice for each charge, payable by bank transfer by the due date shown, or, where we have agreed it, collected from a payment card you register with our billing provider. You must keep the payment method we have agreed with you valid while you are a member.`,
        'Fees and charges are stated exclusive of VAT and other taxes. Any VAT or other tax that applies under UAE law is added and shown on the invoice.',
        "Handling, release, transfer and delivery charges are set out in the Rate Card or quoted to you before the service is provided. We may change the Rate Card on thirty days' notice.",
      ],
    },
    {
      title: '5. Storage allowance and additional storage',
      paragraphs: [
        `The membership fee includes storage for up to ${includedCases} 12-bottle cases, equal to ${includedCases * 12} standard 75cl bottles.`,
        'Storage is measured in standard 75cl bottle equivalents and charged in units of six, rounded up. A half bottle (37.5cl) counts as half a bottle, a magnum (1.5L) as two, a double magnum (3L) as four and an Imperial (6L) as eight; other sizes count by volume. Each sealed case is counted on its own and rounded up to the next six: a case of up to six counts as one 6-bottle unit, a case of seven to twelve as two (one 12-bottle case), and so on. Loose bottles and opened cases are counted together and rounded up to the next six. Two 6-bottle units make one 12-bottle case of the allowance.',
        `Storage above the allowance is charged at ${aed(extraCaseMonthlyAed / 2)} per 6-bottle unit per month, which is ${aed(extraCaseMonthlyAed)} per 12-bottle case. Storage is counted from what is held in your cellar at the end of each calendar month and added to the following month's invoice.`,
      ],
    },
    {
      title: '6. Ownership and custody',
      paragraphs: [
        'Wine in your cellar is held by C&C as custodian for you. Each case and bottle is individually allocated to your account and recorded with its wine code, case reference, location, documents and movement history. It does not form part of C&C\'s trading stock, and we will not sell, lend, pledge or otherwise use it except on your instruction or as section 13 allows.',
        'Where UAE customs or licensing rules require wine to be imported or held in the name of C&C as licensed importer and bonded warehouse operator, we do so as your custodian, and this gives C&C no beneficial interest in the wine. Because the wine is held under those rules, you may sell, transfer or release it only through C&C or another route permitted by law.',
        'Your cellar shows the custody record for your wine. Please check it, and tell us of any discrepancy within thirty days of the movement concerned.',
      ],
    },
    {
      title: '7. Provenance and condition on receipt',
      paragraphs: [
        'For wine you bring into your cellar, you confirm that you own it outright or are authorised by its owner to deposit it, that it is free from any charge or third-party claim, that it was lawfully acquired and is described accurately to the best of your knowledge, and that you have no reason to believe it is counterfeit or stolen. We may refuse wine where we have doubts about any of these.',
        'On receipt we record the number of cases and bottles and the outward condition of the packaging. We do not open sealed cases or inspect contents, fill levels, labels or authenticity unless we agree to do so, which may be charged. Any discrepancy or visible damage on arrival is recorded and notified to you. We are not responsible for any condition or defect existing when the wine reached us.',
      ],
    },
    {
      title: '8. Storage and care',
      paragraphs: [
        'Wine is stored in a licensed bonded warehouse in Ras Al Khaimah at 12–14°C, humidity controlled and continuously monitored, with duty suspended until release. Temperature records are kept against your wine at no charge. We store your wine with reasonable care and skill.',
        'We may move wine within or between licensed facilities for operational, safety or regulatory reasons. Its allocation to your account is unaffected.',
      ],
    },
    {
      title: '9. Wine held outside the UAE',
      paragraphs: [
        'Where wine is held for you outside the UAE before consolidation, for example in a bonded warehouse in the United Kingdom, it is held by a third-party custodian under that custodian\'s own terms and insurance. C&C arranges its receipt, recording and onward shipment as your agent. Wine held abroad is held under bond only.',
        'Shipment to the UAE is arranged with a third-party freight forwarder at a cost quoted to you before it moves. Wine in transit is at your risk and is covered by transit insurance only where you ask us to arrange it and pay for it. Our responsibilities under sections 8 and 10 begin when wine is received into our warehouse in the UAE.',
      ],
    },
    {
      title: '10. Insurance',
      paragraphs: [
        'Wine in our custody in the UAE is insured on an all-risk basis at the value you declare for insurance, subject to the terms, exclusions, limits and deductibles of our policy, a summary of which is available on request. You must keep your declared value current and close to the market replacement value of your wine. For collections of high value we may ask for an independent valuation before cover applies at the declared value.',
        'Any claim is settled at the lower of the declared value and the market replacement value of the wine at the time of loss, on evidence of the loss, and in any case up to the amount we recover from our insurers. Insurance does not cover the matters listed in section 15(b).',
      ],
    },
    {
      title: '11. Releases and delivery',
      paragraphs: [
        'You may ask for wine to be released at any time through your cellar. We may verify that an instruction comes from you before acting on it, and may refuse or delay a release while any amount is outstanding, where the law prevents it, or where our checks are incomplete.',
        'Duty, VAT, handling and delivery charges are quoted before release and must be paid before wine leaves bond. Wine that remains in bond, is sold in bond or is exported remains duty suspended.',
        'Delivery is made by a licensed distributor to the address you give us. Risk in the wine passes to you on delivery to that address or on collection by you or your carrier. Please check deliveries on arrival and tell us of any damage or shortfall within 48 hours. If a delivery or collection fails because no one is available to receive it, re-delivery and further storage are charged under the Rate Card.',
      ],
    },
    {
      title: '12. Buying and selling',
      paragraphs: [
        'Wine bought or sold through C&C is governed by the Transaction Terms provided with each transaction, which state whether C&C acts as seller or as your agent, the price, any commission, and when payment and settlement take place. Wine you offer for sale stays in bond while it is offered. Nothing in these terms obliges you to buy or sell, or us to accept an order or offer.',
      ],
    },
    {
      title: '13. Non-payment',
      paragraphs: [
        'While any amount is overdue, releases, purchases and sales on your account are suspended and charges continue to accrue. Where you pay by card, our billing provider will retry a failed payment.',
        'If any amount remains unpaid thirty days after it falls due, we will give you written notice. If it remains unpaid thirty days after that notice, we may, to the extent permitted by law, retain wine in our custody of a value reasonably sufficient to cover the amount owed, and after giving you a further fourteen days\' written notice, sell that wine through ordinary market channels at a fair market price. We will apply the proceeds to the amount owed and the reasonable costs of sale, and promptly pay you any surplus. We will exercise these rights only as applicable law allows.',
      ],
    },
    {
      title: '14. Ending membership',
      paragraphs: [
        "You may end your membership on thirty days' written notice. We may end it on thirty days' written notice, or immediately for a serious breach of these terms, for non-payment under section 13, or where section 2 or the law requires.",
        'Before your membership ends, please instruct us to release, deliver or transfer out all of your wine. Storage and other charges continue until all of it has left our custody, and we will send you a final statement. Any amount owed remains payable after membership ends.',
        'If wine has not been removed ninety days after membership ends, we will write to you at the contact details on your account. If it is still not removed, or no instruction is received, ninety days after that notice, the wine may, to the extent permitted by law, be treated as abandoned and sold under the process in section 13, with any surplus held for you.',
      ],
    },
    {
      title: '15. Our liability',
      paragraphs: [
        '(a) We are responsible for loss of or damage to wine in our custody caused by our failure to take reasonable care or by our breach of these terms. Our liability for any wine is limited to the lower of its declared insurance value and its market replacement value at the time of loss.',
        '(b) We are not responsible for natural deterioration or ageing of wine, cork failure, ullage or seepage, wear to labels, capsules or packaging, any inherent defect or any condition existing on receipt, the authenticity of wine we did not sell to you, or changes in the market value of wine.',
        '(c) We are not responsible for the acts or omissions of third-party carriers, freight forwarders or custodians outside the UAE, but will pass on to you the benefit of any claim we have against them. We are not liable for any indirect or consequential loss, loss of profit, opportunity or enjoyment.',
        '(d) Nothing in these terms excludes or limits any liability that cannot lawfully be excluded or limited.',
      ],
    },
    {
      title: '16. Events beyond our control',
      paragraphs: [
        'We are not responsible for delay or failure caused by events beyond our reasonable control, including natural disaster, fire, flood, power or equipment failure not caused by our negligence, pandemic, war, civil unrest, government or customs action, strikes, or failure of third-party transport or utilities. We will take reasonable steps to protect your wine and resume normal service.',
      ],
    },
    {
      title: '17. Your information',
      paragraphs: [
        'We use your personal information, including your identity documents, to run your membership, keep custody records, and meet our customs, licensing, tax and anti-money-laundering obligations. Identity documents are stored securely and seen only by authorised C&C staff. We share information only as needed with customs and other authorities, our insurers, custodians, carriers, distributors and service providers acting for us, or as the law requires. Our privacy notice explains how we handle personal information and your rights.',
      ],
    },
    {
      title: '18. Changes and notices',
      paragraphs: [
        "We may change these terms or our fees on thirty days' notice; you may end your membership before the change takes effect. We give notices by email to the address on your account and in your cellar, and you may give notices to us by email to your C&C contact or through your cellar.",
      ],
    },
    {
      title: '19. Law and disputes',
      paragraphs: [
        'These terms are governed by the laws of the United Arab Emirates as applied in the Emirate of Ras Al Khaimah. If a dispute arises, we will each first try in good faith to resolve it within thirty days of written notice. If it is not resolved, the courts of Ras Al Khaimah have exclusive jurisdiction.',
        'If any part of these terms is found invalid, the rest remains in effect. A delay in enforcing any right is not a waiver of it. You may not transfer your membership without our consent; we may transfer it to a successor business on notice to you.',
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
