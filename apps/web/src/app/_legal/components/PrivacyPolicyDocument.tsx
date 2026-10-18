import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Typography from '@/app/_ui/components/Typography/Typography';

/** The address privacy requests go to, named once so every mention agrees */
const PRIVACY_CONTACT_EMAIL = 'support@craftculture.xyz';

const PRIVACY_POLICY_LAST_UPDATED = 'October 2026';

interface PolicyTable {
  headings: [string, string];
  rows: [string, string][];
}

interface PolicyBlock {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: PolicyTable;
  after?: string[];
}

interface PolicySection {
  title: string;
  blocks: PolicyBlock[];
}

/*
  Written to describe what the platform actually does, not what a policy
  usually says. Before changing a statement here, check it against the code:
  identity documents (_cellar/data/storeIdentityDocument.ts, encrypted at
  rest), cookie categories (_cookies), and error monitoring with masked
  session replay (instrumentation-client.ts). A promise the system does not
  keep is worse than no promise.
*/
const sections: PolicySection[] = [
  {
    title: 'Introduction and data controller',
    blocks: [
      {
        paragraphs: [
          'This Privacy Policy explains how Craft & Culture FZE ("Craft & Culture", "C&C", "we", "our" or "us") collects, uses, shares, stores and protects personal data when you use our Services or otherwise deal with us.',
          'Craft & Culture FZE, registered in the Fujairah Free Zone, United Arab Emirates, is the controller of the personal data described in this Policy. Contact details are set out in the final section.',
          'This Policy is a notice. It describes how we handle personal data; it is not a contract and it does not ask you to consent to anything. Where we need your consent for a particular activity, such as marketing communications or optional cookies, we ask for it separately, and you may refuse or withdraw it without affecting the Services you receive.',
        ],
      },
    ],
  },
  {
    title: 'Scope of this Policy',
    blocks: [
      {
        paragraphs: [
          'This Policy applies to all of the products and services that Craft & Culture operates (together, the "Services"), including:',
        ],
        bullets: [
          'the Craft & Culture websites, including craftculture.xyz and wine.craftculture.xyz;',
          'the C&C Index, including trade (B2B) accounts and partner portals;',
          'C&C Private Cellar membership and our private client services;',
          'wine storage, custody and inventory management in the UAE and through our international storage network;',
          'buying, selling, consigning and managing wine collections through C&C;',
          'any other digital service we operate that links to this Policy.',
        ],
        after: [
          'It applies to our customers and members, to the authorised representatives of business customers, suppliers and partners, and to anyone who contacts us. Specific services are also governed by their own terms, such as the Terms of Use and the Private Cellar Membership Terms. Those terms refer to this Policy for how personal data is handled.',
        ],
      },
    ],
  },
  {
    title: 'Personal data we collect',
    blocks: [
      {
        paragraphs: [
          'The personal data we collect depends on the Services you use. It may include:',
        ],
        table: {
          headings: ['Category', 'Examples'],
          rows: [
            ['Identification and contact', 'Name, email address, mobile number, residential or delivery address'],
            ['Identity verification', 'Emirates ID (front and back) or passport, date of birth, nationality and the details shown on those documents'],
            ['Membership and account', 'Membership status and history, account settings and preferences, the version and date of terms you accepted'],
            ['Collection information', 'The wines you hold with us, quantities, condition, storage location, valuations and ownership history'],
            ['Transactions', 'Purchases, sales, consignments, transfers, withdrawals, deliveries and delivery instructions'],
            ['Financial', 'Billing details, invoices, payment confirmations and payment history'],
            ['Compliance', 'Proof of address, evidence of ownership, source-of-funds information and other due-diligence records, where requested'],
            ['Business', 'Company name, trade licence and tax registration details, authorised representatives, trade documentation'],
            ['Communications', 'Correspondence with us and records of service requests'],
            ['Technical and usage', 'Sign-in history, IP address, device and browser information, pages visited and error diagnostics'],
          ],
        },
      },
      {
        heading: 'Collection and ownership information',
        paragraphs: [
          'Information about a wine collection, such as what you own, where it is stored and what it is worth, is not always personal data on its own. It becomes personal data when it is linked to you, and it can reveal commercially sensitive information about your assets. We treat it as confidential and handle it with the same care as the rest of your personal data (see section 7).',
        ],
      },
    ],
  },
  {
    title: 'How we collect personal data',
    blocks: [
      {
        paragraphs: ['We collect personal data:'],
        bullets: [
          'directly from you, when you apply for membership, open an account, upload documents, place orders, give instructions or contact us;',
          'from the business you represent, when it opens or manages a trade or partner account;',
          'from warehouse operators, logistics providers and other service partners, for example storage statements, receipt confirmations and shipping records relating to your wine;',
          'from merchants or other parties transferring wine into your collection at your request;',
          'from integrated systems that you or your business authorise us to connect to (see section 8);',
          'automatically, through cookies and similar technologies when you use our websites and portals (see section 14).',
        ],
      },
    ],
  },
  {
    title: 'How and why we use personal data',
    blocks: [
      {
        paragraphs: [
          'We use personal data only for the purposes below, and we collect only what is reasonably needed for them. UAE law allows personal data to be processed with consent and, without consent, in defined circumstances. We rely on the following:',
        ],
        table: {
          headings: ['Purpose', 'Basis'],
          rows: [
            ['Opening and running your account or membership', 'Necessary to enter into and perform our agreement with you'],
            ['Storing, insuring and managing your wine, and keeping custody records', 'Necessary to perform our agreement with you'],
            ['Processing purchases, sales, consignments, transfers, deliveries and invoices', 'Necessary to perform our agreement with you'],
            ['Service communications, such as confirmations, statements and account notices', 'Necessary to perform our agreement with you'],
            ['Verifying identity and eligibility, preventing fraud and protecting our clients\' wine', 'Necessary to perform our agreement with you, and to meet legal obligations where they apply'],
            ['Customs, tax, licensing and other regulatory requirements', 'Necessary to comply with the law'],
            ['Establishing, exercising or defending legal claims', 'Permitted by law'],
            ['Keeping our Services secure and diagnosing faults', 'Necessary to provide the Services'],
            ['Marketing communications and optional cookies', 'Your consent, which you may withdraw at any time'],
          ],
        },
        after: [
          'We do not use personal data to make decisions about you by automated means alone that have legal or similarly significant effects.',
        ],
      },
    ],
  },
  {
    title: 'Identity verification and compliance',
    blocks: [
      {
        paragraphs: [
          'Before activating a Private Cellar membership, and at other times where appropriate, we verify who you are. We may ask for:',
        ],
        bullets: [
          'an Emirates ID, a passport or another identity document, to confirm your identity and that you are 21 or over;',
          'proof of address;',
          'evidence that you own, or are entitled to deal with, the wine you ask us to store, transfer or sell;',
          'information about the source of funds used to acquire wine, where the value or nature of a transaction makes this appropriate.',
        ],
        after: [
          'We may carry out identity verification, ownership checks, sanctions screening and other due-diligence procedures where required by applicable law or reasonably necessary to protect our business, customers and assets. Where we decline or suspend an account or an instruction because checks cannot be completed, we will tell you unless the law prevents us from doing so.',
          'Identity documents are encrypted when stored and are accessible only to authorised staff who need them to complete or review verification.',
        ],
      },
    ],
  },
  {
    title: 'Private Cellar and collection information',
    blocks: [
      {
        paragraphs: [
          'Our private clients trust us with information about valuable collections. We therefore commit that:',
        ],
        bullets: [
          'we do not sell personal data;',
          'we do not disclose identifiable information about your collection, including its contents, value or location, to third parties for their own marketing or commercial purposes;',
          'within C&C, access to collection and ownership records is limited to staff who need it to provide the Services;',
          'when we share collection information with a warehouse, carrier, buyer or other party, we share only what that party needs to carry out the task, such as the wine, quantity and storage reference for a transfer.',
        ],
        after: [
          'We may still need to disclose information where the law requires it, to a customs or other public authority, or to establish or defend legal claims, as described in section 9.',
        ],
      },
    ],
  },
  {
    title: 'International storage and platform integrations',
    blocks: [
      {
        heading: 'International storage',
        paragraphs: [
          'Your wine may be stored in our facility in the UAE or with approved third-party bonded warehouses in other countries, currently including the United Kingdom. To provide those services we exchange relevant customer and inventory information with the warehouse operators and logistics providers involved, in order to:',
        ],
        bullets: [
          'hold and reconcile stock in your name or reserve account;',
          'receive transfers of wine into your collection, and move wine between locations;',
          'verify ownership before acting on an instruction;',
          'prepare shipping, customs and excise documentation;',
          'complete purchases and sales;',
          'show you an accurate view of your collection in your client portal.',
        ],
        after: [
          'The physical movement of wine and the transfer of personal data are separate matters. Moving wine to a warehouse in another country involves sharing some personal data with that warehouse, and that sharing is covered by section 10. Where an overseas operator is subject to local data protection law, such as the UK GDPR or the EU GDPR, it also handles the data under that law.',
        ],
      },
      {
        heading: 'Platform integrations',
        paragraphs: [
          'Our systems connect to the systems of certain partners, such as warehouse operators, distributors and suppliers, so that stock, orders and shipments stay accurate without re-keying. Through these integrations we may receive, for example, storage statements and stock positions for wine held for you, or sales and stock reports from a distributor selling wine on consignment.',
          'We use this information only to keep your records and portal accurate and to provide the Services. It is visible to you and to authorised C&C staff. It is shared with another provider only where that provider needs it for the purposes set out in this Policy. If information we display about you or your collection is wrong, contact us and we will correct it with the source where we can.',
        ],
      },
    ],
  },
  {
    title: 'Sharing personal data with third parties',
    blocks: [
      {
        paragraphs: [
          'We share personal data only where necessary for the purposes in this Policy, and only with recipients who need it:',
        ],
        table: {
          headings: ['Recipient', 'Purpose'],
          rows: [
            ['Bonded warehouse operators', 'Storage, custody and inventory management'],
            ['International storage partners', 'Overseas storage and collection transfers'],
            ['Logistics providers and freight forwarders', 'Shipping, collection and delivery'],
            ['Customs, tax and other public authorities', 'Clearance, excise, tax and regulatory compliance, and where the law otherwise requires'],
            ['Insurers', 'Insuring wine in our custody and handling claims'],
            ['Licensed distributors and retail partners', 'Fulfilling orders, sales and deliveries you or your business have authorised'],
            ['Payment and accounting providers', 'Invoicing, payment processing and bookkeeping'],
            ['Technology providers', 'Hosting, databases, file storage, email delivery, error monitoring and internal messaging'],
            ['Professional advisers', 'Legal, accounting, audit and compliance services'],
          ],
        },
        after: [
          'Service providers that process personal data on our behalf may use it only on our instructions and must protect it. If Craft & Culture is involved in a merger, acquisition or sale of all or part of its business, personal data may pass to the new owner, who will be bound by the commitments in this Policy or will tell you of any change.',
        ],
      },
    ],
  },
  {
    title: 'International data transfers',
    blocks: [
      {
        paragraphs: [
          'Our technology providers and international storage partners may process personal data in countries outside the United Arab Emirates, including the United Kingdom, European Union and United States. The countries involved depend on the providers and services used. We take appropriate steps to ensure international transfers comply with applicable data protection requirements.',
          'We transfer personal data outside the UAE only where UAE law permits it. Depending on the destination and the circumstances, that may be because the destination provides adequate protection, because suitable safeguards are in place with the recipient, or because the transfer is necessary to perform our agreement with you, such as storing your wine in a warehouse abroad at your request. We assess each type of transfer against the conditions the law sets, rather than relying on one mechanism for all of them.',
        ],
      },
    ],
  },
  {
    title: 'Data security',
    blocks: [
      {
        paragraphs: [
          'We use technical and organisational measures appropriate to the sensitivity of the data we hold, including:',
        ],
        bullets: [
          'role-based access, so that staff and partners see only the records they need;',
          'secure sign-in to accounts and portals;',
          'encryption of identity documents when stored, and encryption of data in transit to and from our Services;',
          'restricted access to identity documents and compliance records;',
          'monitoring of our systems for faults and unauthorised access;',
          'contractual and practical safeguards with the service providers who process data for us.',
        ],
        after: [
          'No system is completely secure. If a personal data breach occurs, we will investigate and contain it, and we will notify the relevant authorities and affected individuals where the law requires us to.',
        ],
      },
    ],
  },
  {
    title: 'Data retention',
    blocks: [
      {
        paragraphs: [
          'We keep personal data only for as long as it is needed for the purposes for which it was collected, or as long as the law requires or permits:',
        ],
        table: {
          headings: ['Information', 'How long we keep it'],
          rows: [
            ['Account and membership information', 'While your account is active, and for a reasonable period afterwards to deal with any final matters'],
            ['Transaction and invoicing records', 'For the period required by applicable tax, customs and commercial record-keeping law'],
            ['Identity verification records', 'For as long as applicable law and our documented compliance needs require'],
            ['Collection, custody and ownership records', 'For as long as needed to establish ownership, custody and transaction history, including after wine has left our care'],
            ['Marketing preferences', 'Until you withdraw consent, after which we keep only a record that you have opted out'],
            ['Technical and security logs', 'For a limited operational period, unless needed to investigate an incident'],
          ],
        },
        after: [
          'Closing an account or ending a Private Cellar membership does not by itself delete the transaction, ownership or compliance records that we are required or permitted to keep. When data is no longer needed, we delete or anonymise it.',
        ],
      },
    ],
  },
  {
    title: 'Your privacy rights',
    blocks: [
      {
        paragraphs: [
          'Subject to the conditions and exceptions set out in applicable law, you may ask us to:',
        ],
        bullets: [
          'give you access to the personal data we hold about you and information about how we process it;',
          'correct personal data that is inaccurate or incomplete;',
          'delete personal data that we no longer need or have no lawful reason to keep;',
          'restrict our processing in certain circumstances, for example while the accuracy of your data is checked;',
          'stop processing your personal data for direct marketing;',
          'provide personal data you gave us in a structured, commonly used format;',
          'withdraw any consent you have given, without affecting processing already carried out.',
        ],
        after: [
          `To make a request, email ${PRIVACY_CONTACT_EMAIL}. We may need to verify your identity before acting on it, and we will respond within the time the law allows. Some requests may be limited where we must keep data by law or to perform our agreement with you; if so, we will explain why. You may also complain to the UAE Data Office or another competent authority.`,
        ],
      },
    ],
  },
  {
    title: 'Cookies and similar technologies',
    blocks: [
      {
        paragraphs: [
          'Our websites and portals use cookies and similar technologies. When you first visit, we ask which optional categories you accept. You can change your choice at any time through the cookie settings on our websites.',
        ],
        table: {
          headings: ['Category', 'Purpose'],
          rows: [
            ['Necessary (always active)', 'Keeping you signed in, protecting your account and remembering your cookie choices'],
            ['Preferences (optional)', 'Remembering your settings, such as display options'],
            ['Analytics (optional)', 'Understanding how the Services are used so we can improve them'],
            ['Marketing (optional)', 'Relevant communications on our sites and elsewhere'],
          ],
        },
        after: [
          'We use optional cookies only with your consent. At the date of this Policy we do not use analytics or marketing cookies on the platform; if we introduce them, they will be used only for people who have accepted that category.',
          'We also use an error-monitoring service to keep the Services secure and working. It records technical information when an error occurs and, for a small sample of visits, makes a session replay: a recording of how the page behaved during the visit. Session replays are a monitoring activity, not analytics. They are configured to hide the text on the page and anything you type, and to block images and media, but they may still contain technical details of the visit, such as the pages viewed, and are therefore treated as personal data.',
        ],
      },
    ],
  },
  {
    title: 'Marketing communications',
    blocks: [
      {
        paragraphs: [
          'We send marketing communications, such as offers and news about wines and events, only where you have agreed to receive them, or where the law otherwise allows it. Every marketing email includes a way to unsubscribe, and you can also opt out by contacting us. Opting out does not stop service communications about your account, orders or collection.',
        ],
      },
    ],
  },
  {
    title: 'Age restrictions and children',
    blocks: [
      {
        paragraphs: [
          'Our Services are intended only for people aged 21 or over, or the legal drinking age where they live if that is higher, and we verify age as part of identity checks for private clients. We do not knowingly collect personal data from anyone under that age. If we learn that we have, we will delete it unless retention is required or permitted by applicable law, and we ask anyone who believes this has happened to contact us.',
        ],
      },
    ],
  },
  {
    title: 'Changes to this Policy',
    blocks: [
      {
        paragraphs: [
          'We will update this Policy when our Services, our practices or the law change. The date at the top shows when it was last revised. We will notify account holders of significant changes by email or in the portal. Where a change involves new processing that requires your consent, we will ask for it rather than treating continued use as agreement.',
        ],
      },
    ],
  },
];

/**
 * The Craft & Culture Privacy Policy, one notice for every Service
 *
 * Rendered by /privacy and linked from the cookie dialog, the join journey and
 * the Private Cellar terms. One component, so there is one text: the old page
 * linked to a "full document" that did not exist, which is what happens when
 * a policy lives in two places.
 */
const PrivacyPolicyDocument = () => {
  return (
    <main className="container py-6 sm:py-8 md:py-12 lg:py-16">
      <Card className="mx-auto w-full max-w-5xl">
        <CardContent className="p-4 sm:p-6 md:p-8">
          <CardProse>
            <CardTitle>Privacy Policy</CardTitle>
            <CardDescription colorRole="muted">
              Last updated: {PRIVACY_POLICY_LAST_UPDATED}
            </CardDescription>
          </CardProse>

          <div className="mt-6 space-y-8 sm:mt-8">
            {sections.map((section, sectionIndex) => (
              <section key={section.title}>
                <Typography variant="headingSm" className="mb-3 font-semibold">
                  {sectionIndex + 1}. {section.title}
                </Typography>

                {section.blocks.map((block, blockIndex) => (
                  <div key={block.heading ?? blockIndex} className="mb-4 last:mb-0">
                    {block.heading && (
                      <Typography variant="bodyMd" className="mb-2 font-medium">
                        {block.heading}
                      </Typography>
                    )}

                    {block.paragraphs?.map((paragraph) => (
                      <Typography
                        key={paragraph}
                        variant="bodySm"
                        colorRole="muted"
                        className="mb-3 leading-relaxed"
                      >
                        {paragraph}
                      </Typography>
                    ))}

                    {block.bullets && (
                      <ul className="mb-3 list-disc space-y-1 pl-5">
                        {block.bullets.map((bullet) => (
                          <li key={bullet}>
                            <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                              {bullet}
                            </Typography>
                          </li>
                        ))}
                      </ul>
                    )}

                    {block.table && (
                      <div className="mb-3 overflow-x-auto rounded-lg border border-border-muted">
                        <table className="w-full text-left">
                          <thead className="bg-fill-muted">
                            <tr>
                              {block.table.headings.map((heading) => (
                                <th key={heading} className="px-3 py-2 align-top">
                                  <Typography variant="labelSm">{heading}</Typography>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {block.table.rows.map(([label, detail]) => (
                              <tr key={label} className="border-t border-border-muted">
                                <td className="w-1/3 px-3 py-2 align-top">
                                  <Typography variant="bodySm" className="font-medium">
                                    {label}
                                  </Typography>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <Typography variant="bodySm" colorRole="muted">
                                    {detail}
                                  </Typography>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {block.after?.map((paragraph) => (
                      <Typography
                        key={paragraph}
                        variant="bodySm"
                        colorRole="muted"
                        className="mb-3 leading-relaxed"
                      >
                        {paragraph}
                      </Typography>
                    ))}
                  </div>
                ))}
              </section>
            ))}

            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                {sections.length + 1}. Contact us
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                For questions about this Policy, or to exercise your rights, contact our privacy
                team at{' '}
                <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="text-text-brand">
                  {PRIVACY_CONTACT_EMAIL}
                </a>
                .
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                Craft &amp; Culture FZE
                <br />
                PO Box 50365, Fujairah Free Zone
                <br />
                Fujairah, United Arab Emirates
                <br />
                Phone: +971 58 149 8156
              </Typography>
            </section>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default PrivacyPolicyDocument;
