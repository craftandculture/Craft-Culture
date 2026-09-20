import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * The Terms of Use, as one document rendered by every route that shows them
 *
 * Signing up is the moment someone most wants to read these, and the link on
 * the welcome form pointed into /platform — which redirects anyone without a
 * completed profile back to the welcome form. The tab opened and bounced, so
 * the terms were unreachable precisely when they were being agreed to.
 *
 * Kept as one component rather than a second copy of the text: two versions of
 * a legal document drift, and the one nobody is looking at is the one that
 * stays wrong.
 */
const TermsOfUseDocument = () => {
  return (
    <main className="container py-6 sm:py-8 md:py-12 lg:py-16">
      <Card className="mx-auto w-full max-w-5xl">
        <CardContent className="p-4 sm:p-6 md:p-8">
          <CardProse>
            <CardTitle>Terms of Use</CardTitle>
            <CardDescription colorRole="muted">
              Last updated: September 2026
            </CardDescription>
          </CardProse>

          <div className="mt-6 space-y-8 sm:mt-8">
            {/* Introduction */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                1. Introduction
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                Welcome to Craft &amp; Culture, a service operated by Craft & Culture FZ-LLC (&quot;we,&quot;
                &quot;our,&quot; or &quot;us&quot;). These Terms of Use (&quot;Terms&quot;) govern your
                access to and use of the Craft &amp; Culture platform (the &quot;Platform&quot; or
                &quot;Service&quot;), including any content, features, and services offered through
                wine.craftculture.xyz.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                By creating an account, accessing, or using the Platform, you agree to be bound by
                these Terms and our Privacy Policy. If you do not agree to these Terms, you may not
                access or use the Platform.
              </Typography>
            </section>

            {/* Eligibility */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                2. Eligibility
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                The Platform serves two kinds of account: trade accounts, held by
                licensed businesses buying for resale, and private collector
                accounts, held by individuals storing, valuing or consigning
                wine they own. Where a clause applies to only one, it says so.
                To use the Platform, you must:
              </Typography>
              <ul className="ml-6 space-y-2">
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Be at least 21 years of age (or the legal drinking age in your jurisdiction,
                  whichever is higher)
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Be legally permitted to purchase and possess alcoholic beverages in your
                  jurisdiction
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Be located in a region where our services are available (currently UAE and GCC
                  markets)
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Provide accurate and complete registration information
                </Typography>
              </ul>
            </section>

            {/* Account Registration */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                3. Account Registration and Security
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                To access the Platform, you must create an account and receive approval from our
                team. During registration, you agree to:
              </Typography>
              <ul className="ml-6 space-y-2">
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Provide accurate, current, and complete information
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Maintain and update your information to keep it accurate
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Maintain the confidentiality of your account credentials
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Notify us immediately of any unauthorized access to your account
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Accept responsibility for all activities that occur under your account
                </Typography>
              </ul>
              <Typography variant="bodySm" colorRole="muted" className="mt-3 leading-relaxed">
                We reserve the right to refuse registration, suspend, or terminate accounts at our
                discretion, including for violation of these Terms.
              </Typography>
            </section>

            {/* Platform Services */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                4. Platform Services
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                Craft &amp; Culture provides a platform for browsing, selecting, and ordering wine and
                spirits products. Our services include:
              </Typography>
              <ul className="ml-6 space-y-2">
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Access to our curated product catalog
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Quote creation and management tools
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Order tracking and status updates
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Customer support services
                </Typography>
              </ul>
            </section>

            {/* Quotes and Orders */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                5. Quotes and Orders
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Quote Validity:</strong> Quotes generated through the Platform are estimates
                subject to confirmation. Prices and availability may change before order
                confirmation.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Order Acceptance:</strong> Submitting a quote does not guarantee order
                acceptance. All orders are subject to availability, payment verification, and our
                acceptance. We reserve the right to refuse or cancel any order.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Pricing:</strong> All prices are displayed in USD and AED. Final pricing is
                confirmed upon order acceptance. Prices exclude any applicable taxes, duties, or
                shipping fees unless otherwise stated.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                <strong>Product Availability:</strong> Product availability is subject to change.
                If an ordered product becomes unavailable, we will notify you and offer
                alternatives or a refund.
              </Typography>
            </section>

            {/* Payment Terms */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                6. Payment Terms
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Important:</strong> Craft & Culture does not directly handle transactions or
                process payments. All payment processing and financial transactions are conducted
                through our licensed distribution partners who hold the appropriate licenses to sell
                alcoholic beverages in their respective jurisdictions.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                Payment is required before order processing begins. Payment details, including bank
                transfer information for our licensed partners, will be provided in your confirmed
                quote. Payment must be made in full within the timeframe specified.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                You are responsible for all applicable taxes, customs duties, and fees associated
                with your purchase. Orders may be subject to import regulations in your
                jurisdiction.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                Failure to complete payment within the specified timeframe may result in order
                cancellation.
              </Typography>
            </section>

            {/* Shipping and Delivery */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                7. Shipping and Delivery
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                Delivery times are estimates and may vary based on location, customs processing, and
                other factors. We are not liable for delays beyond our reasonable control.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                Orders are shipped to the address provided during checkout. You are responsible for
                ensuring the accuracy of delivery information. Someone of legal drinking age must be
                present to receive alcohol deliveries.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                Risk of loss and title for products pass to you upon delivery. Please inspect your
                order upon receipt and report any damage or discrepancies within 48 hours.
              </Typography>
            </section>

            {/* Cancellations and Refunds */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                8. Cancellations and Refunds
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Before Confirmation:</strong> You may cancel a quote at any time before it
                is confirmed by our team.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>After Payment:</strong> Cancellation requests after payment will be reviewed
                on a case-by-case basis. Refunds, if approved, may be subject to cancellation fees.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                <strong>Returns:</strong> Due to the nature of alcohol products and import
                regulations, we generally do not accept returns. Exceptions may be made for damaged
                or incorrect products. Contact support within 48 hours of delivery for such issues.
              </Typography>
            </section>

            {/*
              Private Cellar members hold wine with us rather than buying it
              from us, and the terms above describe only the buying. Two things
              a member is bound by appear nowhere else in writing: that title to
              the goods does not pass to them, and that consigning wine for sale
              can put it beyond recall without a further approval.
            */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                9. Private Cellar Storage and Ownership
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Scope:</strong> This section applies to accounts holding wine with us under
                the Craft &amp; Culture Private Cellar programme. Where it conflicts with the
                sections above, this section governs the wine you hold with us.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Title and beneficial interest:</strong> Craft &amp; Culture FZ-LLC holds the
                licence under which alcohol is imported into and stored in the United Arab Emirates.
                Legal title to wine imported under that licence rests with us and does not pass to
                you. What you acquire and hold is a beneficial interest in an identified parcel: the
                right to call it forward, to instruct us to sell it, and to the proceeds of any sale,
                subject to these Terms. We record your interest in the platform and in our warehouse
                records, and we do not encumber, pledge or deal in your parcel other than on your
                instruction.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Bonded storage and duty:</strong> Wine is held in a bonded facility at Ras Al
                Khaimah under customs supervision. Duty is suspended, not deferred, while it remains
                there. Duty, value added tax, clearance, licensed distribution and delivery become
                payable when wine is released to the mainland, are assessed by the relevant
                authorities at the rates in force on the day of clearance, and are quoted to you for
                acceptance before any wine moves.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Storage charges:</strong> Membership includes storage of the number of cases
                stated in your membership terms. Storage beyond that allowance is charged per case
                per month and invoiced in the ordinary course. We will not move, consolidate or
                dispose of wine to bring you within an allowance.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                <strong>Condition and risk:</strong> We store wine in controlled conditions and keep
                the temperature and handling record that travels with it. We do not value your
                collection, and figures shown in the platform are the values declared on import, not
                market valuations. We are not an insurer; you are responsible for insuring your
                interest in wine held with us unless we have separately agreed otherwise in writing.
              </Typography>
            </section>

            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                10. Consignment and Sale Mandates
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>What an offer is:</strong> Offering wine for sale through the platform
                appoints us as your agent to sell that parcel on your behalf. It is a consignment to
                Craft &amp; Culture, not a listing on an exchange and not a sale by you to any other
                person. You do not sell alcohol; we do, under our licence, and we account to you for
                the proceeds.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Price and commission:</strong> You set the amount you wish to receive per
                bottle. Our commission is added to that amount rather than deducted from it, so the
                price a buyer pays exceeds your figure and the figure you receive does not vary with
                the identity of the buyer. Commission is 2.5% on a sale to a private collector and 5%
                on trade and restaurant orders, determined by the buyer at the time of sale and
                recorded against that sale. We may decline an offer, or return it to you so that you
                may re-price it. We will not alter your price ourselves.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Withdrawal, and where it ends:</strong> While a consigned parcel remains in
                bond with us you may withdraw it at any time through the platform, and it returns to
                your cellar. To reach buyers who cannot be supplied from bond we may place wine with
                a licensed distributor on the mainland, at which point duty is paid and the wine
                leaves our facility.{' '}
                <strong>
                  Wine that has been placed with a distributor cannot be withdrawn.
                </strong>{' '}
                Whether to place a parcel, and with which distributor, is a decision reserved to us
                and does not require your further approval. You should therefore treat the moment you
                offer wine for sale as the moment you commit to selling it.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Settlement:</strong> You are paid on sell-through and not on placement. We
                account to you monthly for sales completed in the preceding period for which the
                buyer has paid us; we do not advance funds against sales that have not settled. A
                parcel may sell in part, and you are paid for each part as it sells. An invoice we
                raise to a distributor is a customs and licensing document and is not itself a sale
                on which you become payable.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                <strong>Confidentiality of ownership:</strong> Consigned wine is offered as Craft
                &amp; Culture stock. We do not disclose to buyers, to other members, or to
                distributors that a parcel is yours, except where we are required to do so by law or
                by a customs or licensing authority.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                <strong>No guarantee of sale:</strong> We give no assurance that consigned wine will
                sell, or will sell at your price or within any period. Where wine placed with a
                distributor does not sell, we will agree an outcome with you &mdash; re-pricing,
                placing it elsewhere, or delivering it to you. Duty already paid on placed wine
                cannot be reclaimed or re-suspended, and such wine cannot be returned to bond.
              </Typography>
            </section>

            {/* Acceptable Use */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                11. Acceptable Use Policy
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                You agree not to:
              </Typography>
              <ul className="ml-6 space-y-2">
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Use the Platform for any unlawful purpose or in violation of any applicable laws
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Provide false or misleading information
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Resell products commercially without authorization
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Attempt to gain unauthorized access to any part of the Platform
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Interfere with or disrupt the Platform or servers
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Use automated systems or software to access the Platform without permission
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="list-item list-disc">
                  Share your account credentials with others
                </Typography>
              </ul>
            </section>

            {/* Intellectual Property */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                12. Intellectual Property
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                All content on the Platform, including but not limited to text, graphics, logos,
                images, and software, is the property of Craft & Culture or its licensors and is
                protected by intellectual property laws. You may not reproduce, distribute, modify,
                or create derivative works without our written permission.
              </Typography>
            </section>

            {/* Privacy */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                13. Privacy and Data Protection
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                Your use of the Platform is also governed by our Privacy Policy. By using the
                Platform, you consent to the collection, use, and disclosure of your information as
                described in our Privacy Policy. We are committed to protecting your personal data
                in accordance with applicable data protection laws.
              </Typography>
            </section>

            {/* Disclaimer */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                14. Disclaimer of Warranties
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                THE PLATFORM AND ALL CONTENT, PRODUCTS, AND SERVICES ARE PROVIDED &quot;AS IS&quot;
                AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
                INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
                PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE PLATFORM WILL
                BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
              </Typography>
            </section>

            {/* Limitation of Liability */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                15. Limitation of Liability
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, CRAFT & CULTURE AND ITS OFFICERS,
                DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF
                PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF
                THE PLATFORM OR THESE TERMS, REGARDLESS OF THE THEORY OF LIABILITY.
              </Typography>
            </section>

            {/* Indemnification */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                16. Indemnification
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                You agree to indemnify, defend, and hold harmless Craft & Culture and its officers,
                directors, employees, and agents from any claims, damages, losses, liabilities, and
                expenses (including legal fees) arising out of or in connection with your use of the
                Platform, violation of these Terms, or violation of any rights of a third party.
              </Typography>
            </section>

            {/* Modifications */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                17. Modifications to Terms
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                We may modify these Terms at any time by posting the revised Terms on the Platform.
                Your continued use of the Platform after any changes constitutes acceptance of the
                modified Terms. We encourage you to review these Terms periodically.
              </Typography>
            </section>

            {/* Termination */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                18. Termination
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                We may suspend or terminate your access to the Platform at any time, without notice,
                for any reason, including violation of these Terms. Upon termination, your right to
                use the Platform will immediately cease. Provisions that by their nature should
                survive termination will remain in effect.
              </Typography>
            </section>

            {/* Governing Law */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                19. Governing Law and Dispute Resolution
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the
                United Arab Emirates. Any disputes arising from these Terms or your use of the
                Platform shall be resolved through the courts of Dubai, UAE.
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                Before initiating any legal proceedings, you agree to first contact us to attempt to
                resolve any disputes informally.
              </Typography>
            </section>

            {/* Severability */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                20. Severability
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                If any provision of these Terms is found to be unenforceable or invalid, that
                provision shall be limited or eliminated to the minimum extent necessary, and the
                remaining provisions shall continue in full force and effect.
              </Typography>
            </section>

            {/* Entire Agreement */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                21. Entire Agreement
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="leading-relaxed">
                These Terms, together with the Privacy Policy and any other agreements or policies
                referenced herein, constitute the entire agreement between you and Craft & Culture
                regarding the use of the Platform and supersede all prior agreements and
                understandings.
              </Typography>
            </section>

            {/* Contact */}
            <section>
              <Typography variant="headingSm" className="mb-3 font-semibold">
                22. Contact Information
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-3 leading-relaxed">
                For questions about these Terms or the Platform, please contact us:
              </Typography>
              <div className="rounded-lg border border-border-primary bg-fill-secondary/30 p-4">
                <Typography variant="bodySm" colorRole="muted" className="mb-1">
                  <strong>Craft & Culture FZ-LLC</strong>
                </Typography>
                <Typography variant="bodySm" colorRole="muted" className="mb-1">
                  Email:{' '}
                  <a
                    href="mailto:support@craftculture.xyz"
                    className="text-text-brand transition-colors hover:text-text-brand-hover"
                  >
                    support@craftculture.xyz
                  </a>
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  Website:{' '}
                  <a
                    href="https://craftculture.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-brand transition-colors hover:text-text-brand-hover"
                  >
                    craftculture.xyz
                  </a>
                </Typography>
              </div>
            </section>

            {/* Footer */}
            <section className="border-t border-border-primary pt-6">
              <Typography variant="bodySm" colorRole="muted" className="italic">
                By using Craft &amp; Culture, you acknowledge that you have read, understood, and agree to
                be bound by these Terms of Use.
              </Typography>
            </section>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default TermsOfUseDocument;
