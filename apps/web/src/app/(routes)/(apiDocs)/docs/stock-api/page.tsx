import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stock API · Craft & Culture',
  description: 'Integration guide for wine partners: your stock, movements, sales and reservations held by Craft & Culture.',
  robots: { index: false, follow: false },
};

const BASE = 'https://wine.craftculture.xyz/api/v1';

const CONTENTS = [
  ['overview', 'Overview'],
  ['access', 'Access and security'],
  ['requests', 'Making a request'],
  ['endpoints', 'Endpoints'],
  ['holdings', 'Holdings'],
  ['movements', 'Movements'],
  ['sales', 'Sales'],
  ['reservations', 'Reservations'],
  ['sync', 'Keeping your system in step'],
  ['reconciling', 'Reconciling your balance'],
  ['errors', 'Limits and errors'],
  ['data', 'What the API does not include'],
  ['support', 'Support'],
] as const;

/** A numbered document section with an anchor */
const Section = ({ id, n, title, children }: React.PropsWithChildren<{ id: string; n: string; title: string }>) => (
  <section id={id} className="scroll-mt-6 border-t border-[#E5E5E5] py-10 first:border-t-0 first:pt-0">
    <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[#0D9488]">{n}</div>
    <h2 className="mb-4 text-[22px] font-semibold tracking-[-0.01em] text-[#0F0F0F]">{title}</h2>
    <div className="space-y-4 text-[15px] leading-[1.65] text-[#2B2B2B]">{children}</div>
  </section>
);

/** A sub-heading inside a section */
const H3 = ({ id, children }: React.PropsWithChildren<{ id?: string }>) => (
  <h3 id={id} className="scroll-mt-6 pt-4 text-[16px] font-semibold text-[#0F0F0F]">
    {children}
  </h3>
);

/** Inline code */
const C = ({ children }: React.PropsWithChildren) => (
  <code className="rounded bg-[#E6F4F1] px-1.5 py-0.5 font-mono text-[13px] text-[#0B7A70]">{children}</code>
);

/** A code sample with a caption */
const Sample = ({ caption, children }: { caption: string; children: string }) => (
  <figure className="overflow-hidden rounded-lg border border-[#0F2A28] bg-[#0F2A28]">
    <figcaption className="border-b border-white/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">
      {caption}
    </figcaption>
    <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-[1.6] text-[#E6F4F1]">
      <code>{children}</code>
    </pre>
  </figure>
);

/** A table of names, a short tag and a description */
const Fields = ({ head, rows }: { head: [string, string, string]; rows: [string, string, React.ReactNode][] }) => (
  <div className="overflow-x-auto rounded-lg border border-[#E5E5E5] bg-white">
    <table className="w-full text-left text-[14px]">
      <thead>
        <tr className="bg-[#F8F9F7] text-[12px] uppercase tracking-[0.08em] text-[#6B7280]">
          {head.map((h) => (
            <th key={h} className="px-4 py-2.5 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, tag, text]) => (
          <tr key={name} className="border-t border-[#E5E5E5] align-top">
            <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[13px] text-[#0F0F0F]">{name}</td>
            <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-[#6B7280]">{tag}</td>
            <td className="px-4 py-2.5 text-[#2B2B2B]">{text}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** A highlighted note */
const Note = ({ children }: React.PropsWithChildren) => (
  <div className="rounded-lg border-l-[3px] border-[#0D9488] bg-[#E6F4F1] px-4 py-3 text-[14px] text-[#0F2A28]">
    {children}
  </div>
);

/**
 * Stock API integration guide for wine partners
 *
 * Set in the C&C document style (header band, paper, teal accent), with its
 * own layout and no app chrome. Deliberately not linked to or from the
 * distributor catalogue documentation at /docs/api.
 */
const StockApiDocsPage = () => {
  return (
    <div className="font-sans text-[#0F0F0F] antialiased">
      <header className="bg-[#0F2A28] px-4 text-white">
        <div className="mx-auto max-w-[1080px] pb-12 pt-8">
          <div className="mb-12 flex items-center justify-between gap-4">
            <svg viewBox="0 0 218 62" role="img" aria-label="Craft & Culture" fill="none" className="h-9 w-auto">
              <rect x="3" y="3" width="56" height="56" stroke="#FFFFFF" strokeWidth="3.4" />
              <path d="M 43.31 15.24 A 20 20 0 1 0 43.31 46.76" stroke="#FFFFFF" strokeWidth="3.8" strokeLinecap="square" />
              <path d="M 38.39 21.54 A 12 12 0 1 0 38.39 40.46" stroke="#FFFFFF" strokeWidth="3.8" strokeLinecap="square" />
              <text x="76" y="27" fill="#FFFFFF" fontSize="23" fontWeight="500" letterSpacing="1.2" fontFamily="Inter, Helvetica, Arial, sans-serif">
                CRAFT &amp;
              </text>
              <text x="76" y="55" fill="#FFFFFF" fontSize="23" fontWeight="500" letterSpacing="1.2" fontFamily="Inter, Helvetica, Arial, sans-serif">
                CULTURE
              </text>
            </svg>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Partner integration</span>
          </div>
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[#5EEAD4]">
            Craft &amp; Culture · Wine partners
          </div>
          <h1 className="text-[clamp(34px,5vw,52px)] font-semibold leading-[1.05] tracking-[-0.02em]">Stock API</h1>
          <p className="mt-4 max-w-[680px] text-[17px] leading-[1.6] text-white/80">
            A direct connection between your systems and the wine you hold with Craft &amp; Culture: what is in
            our bonded warehouse, every movement in and out, what has been sold and what is committed to orders.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/15 pt-5 text-[13px] text-white/70">
            <span>
              <b className="font-medium text-white">Version</b> 1.0
            </span>
            <span>
              <b className="font-medium text-white">Format</b> JSON over HTTPS
            </span>
            <span>
              <b className="font-medium text-white">Access</b> Read only, by issued key
            </span>
            <span>
              <b className="font-medium text-white">Updated</b> 24 November 2026
            </span>
            <span>
              <b className="font-medium text-white">Classification</b> Partner confidential
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1080px] gap-12 px-4 py-12 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block" aria-label="Contents">
          <div className="sticky top-6">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">Contents</div>
            <ol className="space-y-1.5 text-[13px]">
              {CONTENTS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-[#2B2B2B] hover:text-[#0D9488]">
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <main className="min-w-0 rounded-xl bg-white px-6 py-10 shadow-[0_1px_0_#E5E5E5] sm:px-10">
          <Section id="overview" n="01" title="Overview">
            <p>
              The Stock API gives your stock, ERP or reporting systems the same information as the Stock and
              Activity pages of your partner portal, updated as our warehouse records each event. It is read
              only: nothing you send can change stock, orders or records.
            </p>
            <p>Four endpoints cover what partners most often need to know:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>what you hold with us now, wine by wine;</li>
              <li>every movement of your stock, as a complete and ordered record;</li>
              <li>what has been sold, and through which kind of channel;</li>
              <li>what is held against orders and not yet picked.</li>
            </ul>
            <Note>
              Every response is limited to the account your key was issued to. No request parameter names an
              owner, so a key can only ever return its own partner&rsquo;s wine.
            </Note>
          </Section>

          <Section id="access" n="02" title="Access and security">
            <p>
              Keys are issued by Craft &amp; Culture. Ask your account contact for a Stock API key, naming the
              technical contact who will hold it.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>The key is shown once, when it is issued. It cannot be retrieved later.</li>
              <li>Keep it on your servers. Never place it in a browser, mobile app, email or shared document.</li>
              <li>
                If a key may have been exposed, or the person holding it leaves, ask us to revoke it. Revocation
                is immediate, and we will issue a replacement.
              </li>
              <li>A partner may hold more than one key, for example one per system.</li>
            </ul>
          </Section>

          <Section id="requests" n="03" title="Making a request">
            <p>
              All endpoints are under <C>{BASE}</C>. Send the key in the <C>Authorization</C> header of every
              request.
            </p>
            <Sample caption="Request">{`curl ${BASE}/account/stock \\
  -H "Authorization: Bearer $CC_API_KEY"`}</Sample>
            <ul className="list-disc space-y-1 pl-5">
              <li>Responses are JSON. Times are ISO 8601 in UTC.</li>
              <li>
                Each wine is identified by its <C>lwin18</C> in dashed form, for example{' '}
                <C>1010279-2015-06-00750</C>: the wine, vintage, bottles per case and bottle size in millilitres.
                <C>lwin11</C> is provided for matching to market data.
              </li>
              <li>Quantities are given in both cases and bottles.</li>
            </ul>
          </Section>

          <Section id="endpoints" n="04" title="Endpoints">
            <Fields
              head={['Endpoint', 'Method', 'Returns']}
              rows={[
                ['/account/stock', 'GET', 'Your holdings now, per wine and place'],
                ['/account/movements', 'GET', 'Every event on your stock, oldest first'],
                ['/account/sales', 'GET', 'Sales of your wine, oldest first'],
                ['/account/reservations', 'GET', 'Your stock held against orders'],
              ]}
            />
            <p>
              A machine-readable description in OpenAPI 3.1, for generating a client or importing into Postman,
              is published at <C>{`${BASE}/account/openapi.json`}</C>.
            </p>
          </Section>

          <Section id="holdings" n="4.1" title="Holdings">
            <p>
              <C>GET /account/stock</C> returns what you hold now, one row per wine and place. Wine placed with a
              distributor on consignment remains yours until it is sold, and is shown with{' '}
              <C>heldAt: &quot;distributor&quot;</C>.
            </p>
            <Fields
              head={['Field', 'Type', 'Meaning']}
              rows={[
                ['wine', 'object', 'lwin18, lwin11, name, producer, vintage, caseSize, bottleSizeMl'],
                ['heldAt', 'string', <>
                  <C>warehouse</C> (our bonded warehouse) or <C>distributor</C> (on consignment)
                </>],
                ['cases', 'integer', 'Sealed cases'],
                ['openBottles', 'integer', 'Loose bottles from opened cases'],
                ['totalBottles', 'integer', 'cases × caseSize + openBottles'],
                ['reservedCases', 'integer', 'Committed to orders, not yet picked'],
                ['availableCases', 'integer', 'Free to sell'],
                ['notForSale', 'boolean', 'Held for you and not offered for sale'],
                ['firstReceivedAt', 'date-time', 'When the first of this wine arrived'],
                ['updatedAt', 'date-time', 'When this holding last changed'],
              ]}
            />
            <p>The response also carries <C>totals</C> (wines, cases, bottles, reserved cases) and <C>asOf</C>.</p>
          </Section>

          <Section id="movements" n="4.2" title="Movements">
            <p>
              <C>GET /account/movements</C> returns every event on your stock, oldest first: receipts, picks,
              transfers, corrections and the rest. It is the full export and the basis for synchronising your
              system (see section 05).
            </p>
            <H3>Parameters</H3>
            <Fields
              head={['Parameter', 'Type', 'Use']}
              rows={[
                ['cursor', 'string', <>Continue from the <C>meta.nextCursor</C> of the previous response</>],
                ['since', 'date-time', 'First run only: events at or after this moment'],
                ['until', 'date-time', 'Events before this moment'],
                ['lwin18', 'string', 'One wine only'],
                ['limit', 'integer', '1–500, default 100'],
              ]}
            />
            <H3>Event fields</H3>
            <Fields
              head={['Field', 'Type', 'Meaning']}
              rows={[
                ['id', 'uuid', 'Permanent identifier. Use it to de-duplicate.'],
                ['reference', 'string', 'Our movement number, for example MOV-2026-1234'],
                ['occurredAt', 'date-time', 'When the event was recorded in the warehouse'],
                ['type', 'string', 'What happened (table below)'],
                ['direction', 'string', <><C>in</C>, <C>out</C> or <C>none</C></>],
                ['outcome', 'string | null', <>
                  For stock leaving you: <C>sale</C>, <C>own_delivery</C>, <C>collected</C>,{' '}
                  <C>loss_reimbursed</C>, <C>transfer</C> or <C>correction</C>
                </>],
                ['channel', 'string | null', 'For sales: the kind of buyer (section 4.3)'],
                ['cases, bottles', 'integer', 'Quantity moved, unsigned'],
                ['balanceChangeCases, balanceChangeBottles', 'integer', 'Signed effect on your holding'],
                ['wine', 'object', 'lwin18, lwin11, name, vintage, caseSize, bottleSizeMl'],
                ['orderReference', 'string | null', 'Your PCO number, or our sales order number, on picks and dispatches'],
                ['description', 'string', 'A short plain-English summary of the event'],
              ]}
            />
            <H3>Event types</H3>
            <Fields
              head={['Type', 'Balance', 'Meaning']}
              rows={[
                ['received', '+', 'Arrived and booked into the warehouse'],
                ['picked', '−', <>Picked for an order. <C>outcome</C> shows whether it was a sale or your own delivery.</>],
                ['dispatched', '0', 'Left the building. Already deducted when picked, so it is never counted twice.'],
                ['transferred_in', '+', 'Ownership passed to you'],
                ['transferred_out', '−', 'Ownership passed from you. A transfer to Craft & Culture is a sale.'],
                ['taken_out_of_stock', '−', 'Removed by hand: sold, samples, collected by you, or damaged or lost in our care and reimbursed'],
                ['count_correction', '±', 'Adjusted after a stock count'],
                ['adjusted', '±', 'A correction to the record'],
                ['repacked_in / repacked_out', '±', 'Moved into a different case size. Bottles are unchanged.'],
                ['put_away / moved_bay', '0', 'Moved within the warehouse'],
              ]}
            />
            <Sample caption="Example event">{`{
  "id": "0b7c1f9e-3a52-4f7d-9a1e-2c4b5d6e7f80",
  "reference": "MOV-2026-1234",
  "occurredAt": "2026-11-20T08:41:12.000Z",
  "type": "picked",
  "direction": "out",
  "outcome": "sale",
  "channel": "distributor",
  "description": "Picked · sold to a distributor",
  "cases": 2,
  "bottles": 12,
  "balanceChangeCases": -2,
  "balanceChangeBottles": -12,
  "wine": {
    "lwin18": "1010279-2015-06-00750",
    "lwin11": "10102792015",
    "name": "Château Example 2015",
    "vintage": 2015,
    "caseSize": 6,
    "bottleSizeMl": 750
  },
  "orderReference": "SO-00184"
}`}</Sample>
          </Section>

          <Section id="sales" n="4.3" title="Sales">
            <p>
              <C>GET /account/sales</C> returns only the events that are sales of your wine, with the same fields,
              parameters and cursor as Movements. Because other events are filtered out, a page may contain fewer
              rows than <C>limit</C>; continue while <C>meta.hasMore</C> is true.
            </p>
            <Fields
              head={['Channel', '', 'Meaning']}
              rows={[
                ['distributor', '', 'Sold to a licensed distributor or trade buyer'],
                ['private_client', '', 'Sold on a private-client order, including your own PCOs'],
                ['craft_and_culture', '', 'Bought by Craft & Culture, including samples and tastings'],
                ['other', '', 'Sold outside the usual order process'],
              ]}
            />
            <p>Buyers are never named. The channel and the order reference identify the sale.</p>
          </Section>

          <Section id="reservations" n="4.4" title="Reservations">
            <p>
              <C>GET /account/reservations</C> returns stock held against orders, newest first. By default only
              active holds are returned.
            </p>
            <Fields
              head={['Parameter', 'Type', 'Use']}
              rows={[
                ['status', 'string', <><C>active</C> (default), <C>picked</C>, <C>released</C> or <C>all</C></>],
                ['updatedSince', 'date-time', 'Holds created or changed at or after this moment'],
                ['limit', 'integer', '1–500, default 100'],
                ['offset', 'integer', <>From <C>meta.nextOffset</C> of the previous response</>],
              ]}
            />
            <p>
              Each hold gives the wine, cases and bottles, its status and dates, and the order:{' '}
              <C>reference</C>, <C>channel</C> and <C>isDraft</C> (a draft order not yet confirmed).
            </p>
          </Section>

          <Section id="sync" n="05" title="Keeping your system in step">
            <p>
              Movements and sales are returned oldest first and paged with a cursor that records where you reached.
              Store the cursor, and each later request returns only what has happened since, in order, with nothing
              skipped and nothing repeated.
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                <b>First run.</b> Request <C>/account/movements?since=2026-01-01&amp;limit=500</C>, or omit{' '}
                <C>since</C> for your full history.
              </li>
              <li>
                <b>Page through.</b> While <C>meta.hasMore</C> is true, request again with{' '}
                <C>cursor=meta.nextCursor</C>.
              </li>
              <li>
                <b>Store</b> the last <C>meta.nextCursor</C>.
              </li>
              <li>
                <b>Every later run.</b> Start from the stored cursor, then store the new one.
              </li>
            </ol>
            <Sample caption="Incremental sync">{`# Resume from the stored cursor
curl "${BASE}/account/movements?cursor=$LAST_CURSOR&limit=500" \\
  -H "Authorization: Bearer $CC_API_KEY"`}</Sample>
            <p>
              A run every 15 minutes is ample. If a run is interrupted and repeated, de-duplicate on the event{' '}
              <C>id</C>. A cursor that was not issued by us is refused with a 400, so an error never restarts your
              import from the beginning.
            </p>
          </Section>

          <Section id="reconciling" n="06" title="Reconciling your balance">
            <p>
              The sum of <C>balanceChangeBottles</C> across your events should equal <C>totalBottles</C> in{' '}
              <C>/account/stock</C>. Stock leaves your balance when it is picked; dispatch and moves within the
              warehouse do not change it.
            </p>
            <p>
              Where another owner also holds some of the same wine, history that cannot be attributed to you is
              withheld. <C>meta.sharedWineCount</C> shows how many of your wines this affects. If a wine does not
              reconcile, contact us and we will reconcile it with you.
            </p>
          </Section>

          <Section id="errors" n="07" title="Limits and errors">
            <p>
              Each key may make 60 requests a minute. Responses carry <C>X-RateLimit-Remaining</C> and{' '}
              <C>X-RateLimit-Reset</C>.
            </p>
            <Fields
              head={['Status', '', 'Meaning']}
              rows={[
                ['400', '', 'A parameter is invalid. The response names which and why.'],
                ['401', '', 'The key is missing, revoked or expired.'],
                ['403', '', 'The key is not authorised for the Stock API.'],
                ['429', '', <>Too many requests. Wait for the number of seconds in <C>Retry-After</C>.</>],
                ['500', '', 'An error on our side. Retry later; contact us if it persists.'],
              ]}
            />
          </Section>

          <Section id="data" n="08" title="What the API does not include">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>Prices and values.</b> The API reports quantities and events. Amounts due to you are shown on your
                monthly statement.
              </li>
              <li>
                <b>Buyer names.</b> Sales identify the kind of buyer and the order reference only.
              </li>
              <li>
                <b>Warehouse locations.</b> Bays and racks are not published.
              </li>
            </ul>
            <p>
              The information returned is confidential to your business and may not be shared with third parties.
            </p>
          </Section>

          <Section id="support" n="09" title="Support">
            <p>
              For a new key, a revoked key, a balance that does not reconcile or a field you need, email{' '}
              <a href="mailto:partners@craftculture.xyz" className="font-medium text-[#0D9488] underline">
                partners@craftculture.xyz
              </a>
              .
            </p>
          </Section>
        </main>
      </div>

      <footer className="border-t border-[#E5E5E5] px-4 py-8">
        <div className="mx-auto flex max-w-[1080px] flex-wrap justify-between gap-2 text-[12px] text-[#6B7280]">
          <span>Craft &amp; Culture FZE · Fujairah Free Zone, UAE</span>
          <span>Stock API v1.0 · Partner confidential</span>
        </div>
      </footer>
    </div>
  );
};

export default StockApiDocsPage;
