import type { Metadata } from 'next';

import Typography from '@/app/_ui/components/Typography/Typography';

export const metadata: Metadata = {
  title: 'Partner API Documentation | Craft & Culture',
  description: 'API documentation for Craft & Culture trade partners',
};

const CodeBlock = ({
  children,
  title,
}: {
  children: string;
  title?: string;
}) => (
  <div className="border-border-muted bg-background-secondary overflow-hidden rounded-lg border">
    {title && (
      <div className="border-border-muted bg-fill-secondary border-b px-4 py-2">
        <Typography variant="bodySm" className="text-text-muted font-mono">
          {title}
        </Typography>
      </div>
    )}
    <pre className="overflow-x-auto p-4">
      <code className="text-text-primary font-mono text-sm">{children}</code>
    </pre>
  </div>
);

const Endpoint = ({
  method,
  path,
  description,
}: {
  method: string;
  path: string;
  description: string;
}) => (
  <div className="border-border-muted dark:bg-background-secondary flex items-start gap-3 rounded-lg border bg-surface-primary p-4">
    <span className="rounded bg-green-100 px-2 py-1 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
      {method}
    </span>
    <div>
      <Typography variant="bodySm" className="font-mono font-medium">
        {path}
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
        {description}
      </Typography>
    </div>
  </div>
);

const Row = ({
  name,
  type,
  children,
}: {
  name: string;
  type: string;
  children: React.ReactNode;
}) => (
  <tr className="border-border-muted border-t align-top">
    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm">{name}</td>
    <td className="text-text-muted whitespace-nowrap px-4 py-3 font-mono text-sm">
      {type}
    </td>
    <td className="px-4 py-3 text-sm">{children}</td>
  </tr>
);

const Table = ({
  head,
  children,
}: {
  head: string[];
  children: React.ReactNode;
}) => (
  <div className="border-border-muted overflow-x-auto rounded-lg border">
    <table className="w-full">
      <thead className="bg-fill-secondary">
        <tr>
          {head.map((h) => (
            <th key={h} className="px-4 py-3 text-left text-sm font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

const ApiDocsPage = () => {
  return (
    <div className="bg-background-primary min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12">
          <Typography variant="displaySm" className="mb-4">
            C&amp;C Pre-Order Integration
          </Typography>
          <Typography variant="bodyLg" colorRole="muted">
            One live feed of everything Craft &amp; Culture holds — what is on
            the shelf, what is on its way, and what it costs — for building
            pre-orders against.
          </Typography>
          <div className="border-border-brand bg-fill-brand-secondary mt-6 rounded-lg border p-4">
            <Typography variant="bodySm">
              <strong>Available to trusted partners only.</strong> Access is
              granted by Craft &amp; Culture and issued against a named key. The
              feed is not public, and nothing in it may be redistributed beyond
              your own business.
            </Typography>
          </div>
        </div>

        {/* Quick start */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Quick start
          </Typography>
          <div className="space-y-4">
            <Typography variant="bodyMd">
              Every wine we hold, in one call. Each row tells you whether it can
              be sold now or is still in transit, how much there is, and the
              trade price. Availability is read live from the warehouse, so a
              case sold is gone from the next response.
            </Typography>
            <div className="border-border-brand bg-fill-brand-secondary rounded-lg border p-4">
              <Typography
                variant="bodySm"
                className="text-text-brand font-medium"
              >
                Base URL
              </Typography>
              <Typography variant="bodyMd" className="mt-1 font-mono">
                https://wine.craftculture.xyz/api/v1
              </Typography>
            </div>
            <Typography variant="bodySm" colorRole="muted">
              Prefer to generate a client? The same API is described at{' '}
              <a
                href="/api/v1/openapi.json"
                className="text-text-brand font-mono underline"
              >
                /api/v1/openapi.json
              </a>{' '}
              (OpenAPI 3.1) — import it into Postman or your codegen of choice.
            </Typography>
            <CodeBlock title="The only call most integrations need">
              {`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "https://wine.craftculture.xyz/api/v1/catalogue?stock=all"`}
            </CodeBlock>
          </div>
        </section>

        {/* Authentication */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Authentication
          </Typography>
          <div className="space-y-4">
            <Typography variant="bodyMd">
              Pass your key as a bearer token on every request. Keys are issued
              by Craft &amp; Culture and shown once, at creation — we cannot
              retrieve one later, so store it somewhere you can recover it. If a
              key is lost or exposed, tell us and we will revoke it and issue
              another.
            </Typography>
            <CodeBlock>
              Authorization: Bearer cc_live_xxxxxxxxxxxxxxxx
            </CodeBlock>
            <Typography variant="bodySm" colorRole="muted">
              Keys belong on your server. A key in browser or app code is a key
              published to anyone who opens the developer tools.
            </Typography>
          </div>
        </section>

        {/* Rate limits */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Rate limits
          </Typography>
          <div className="space-y-4">
            <Typography variant="bodyMd">
              <strong>60 requests per minute</strong>, per key, on a rolling
              window. The feed is cached for two minutes, so polling faster than
              that returns the same data — once every few minutes is plenty for
              catalogue sync.
            </Typography>
            <Typography variant="bodyMd">
              Exceeding the limit returns <code className="font-mono">429</code>{' '}
              with <code className="font-mono">Retry-After</code>,{' '}
              <code className="font-mono">X-RateLimit-Limit</code>,{' '}
              <code className="font-mono">X-RateLimit-Remaining</code> and{' '}
              <code className="font-mono">X-RateLimit-Reset</code>. Those
              headers are sent <strong>only on a 429</strong>, not on successful
              responses — wait for{' '}
              <code className="font-mono">Retry-After</code> and retry.
            </Typography>
          </div>
        </section>

        {/* The feed */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            The catalogue feed
          </Typography>
          <div className="space-y-4">
            <Endpoint
              method="GET"
              path="/catalogue"
              description="Every wine we hold, one row each, with live availability and trade price"
            />

            <Typography variant="headingMd" className="mb-3 mt-8">
              Query parameters
            </Typography>
            <Table head={['Parameter', 'Type', 'Description']}>
              <Row name="stock" type="string">
                <code className="font-mono">available</code> (default) returns
                landed stock only. <code className="font-mono">inbound</code>{' '}
                returns what is in transit.{' '}
                <strong>
                  <code className="font-mono">all</code>
                </strong>{' '}
                returns both, merged one row per wine — use this one.
              </Row>
              <Row name="category" type="string">
                <code className="font-mono">Wine</code>,{' '}
                <code className="font-mono">Spirits</code> or{' '}
                <code className="font-mono">RTD</code>. Omit for everything.
              </Row>
              <Row name="search" type="string">
                Free text across wine and producer name.
              </Row>
            </Table>

            <Typography variant="headingMd" className="mb-3 mt-8">
              Understanding lwin18
            </Typography>
            <div className="space-y-3">
              <Typography variant="bodyMd">
                Every wine in the trade has a standard identifier called an{' '}
                <strong>LWIN</strong>, maintained by Liv-ex, the London exchange
                for fine wine. It is to wine what an ISBN is to a book: one
                agreed number, so two businesses can be certain they mean the
                same thing without comparing spellings. The standard and the
                free wine database are at{' '}
                <a
                  href="https://www.liv-ex.com/lwin/"
                  target="_blank"
                  rel="noopener"
                  className="text-text-brand underline"
                >
                  liv-ex.com/lwin
                </a>
                .
              </Typography>
              <Typography variant="bodyMd">
                We use the eighteen-digit form, which identifies not just the
                wine but the exact thing in the warehouse. We write it with
                dashes:
              </Typography>
              <CodeBlock title="1104653-2020-05-00750">
                {`1104653   the wine — Guidalberto, Tenuta San Guido, any vintage
2020      the vintage (0000 or 1000 means non-vintage)
05        bottles per case — here a 5-pack
00750     bottle size in millilitres — a magnum reads 01500`}
              </CodeBlock>
              <Typography variant="bodyMd">
                The same wine reaches us as &ldquo;Ch. Lynch Bages&rdquo;,
                &ldquo;Chateau Lynch-Bages&rdquo; and &ldquo;Lynch Bages
                Pauillac&rdquo;. Matching on names means reconciling those
                forever; matching on the LWIN18 is exact. Note that the same
                wine in a 6-pack and a 3-pack are <strong>different</strong>{' '}
                LWIN18s, because they are different things to ship — and that
                the number is printed on the physical case label in our
                warehouse, so it is what a picker reads off the box.
              </Typography>
            </div>

            <Typography variant="headingMd" className="mb-3 mt-8">
              Response fields
            </Typography>
            <Table head={['Field', 'Type', 'Description']}>
              <Row name="lwin18" type="string">
                The Liv-ex identifier explained above. Use it as your key — it
                encodes wine, vintage, pack and bottle size, and does not change
                when a name is tidied.
              </Row>
              <Row name="product" type="string">
                Wine name as we hold it.
              </Row>
              <Row name="producer" type="string | null">
                Producer, where recorded.
              </Row>
              <Row name="vintage" type="number | null">
                Year. <code className="font-mono">null</code> for non-vintage.
              </Row>
              <Row name="region / country" type="string | null">
                Where recorded against the wine.
              </Row>
              <Row name="category" type="string | null">
                Wine, Spirits or RTD.
              </Row>
              <Row name="format" type="string">
                Human-readable pack, e.g.{' '}
                <code className="font-mono">6×75cl</code>.
              </Row>
              <Row name="caseConfig" type="number">
                Bottles per case.
              </Row>
              <Row name="bottleSize" type="string | null">
                e.g. <code className="font-mono">75cl</code>,{' '}
                <code className="font-mono">150cl</code>.
              </Row>
              <Row name="status" type="string">
                <code className="font-mono">available</code>,{' '}
                <code className="font-mono">in_transit</code> or{' '}
                <code className="font-mono">unavailable</code>. See below.
              </Row>
              <Row name="availableCases" type="number">
                Whole cases on the shelf now.
              </Row>
              <Row name="availableBottles" type="number">
                Bottles on the shelf now. This is{' '}
                <code className="font-mono">availableCases × caseConfig</code> —
                not a separate loose-bottle count, so do not add the two.
              </Row>
              <Row name="inTransitBottles" type="number">
                Bottles bought and on their way, not yet landed.
              </Row>
              <Row name="pricePerBottle" type="number">
                Trade price per bottle, USD, in bond.
              </Row>
              <Row name="pricePerCase" type="number">
                Trade price per case, USD, in bond.
              </Row>
              <Row name="eta" type="string | null">
                ISO date of the earliest expected arrival, when something is in
                transit. <code className="font-mono">null</code> otherwise, and{' '}
                <code className="font-mono">null</code> where a shipment has no
                confirmed date yet.
              </Row>
            </Table>

            <Typography variant="headingMd" className="mb-3 mt-8">
              What status means
            </Typography>
            <Table head={['Status', 'Meaning', 'What you can do']}>
              <Row name="available" type="on the shelf">
                Physically in our UAE bonded warehouse.{' '}
                <code className="font-mono">availableBottles</code> is sellable
                now.
              </Row>
              <Row name="in_transit" type="on its way">
                Bought and shipping to us. Nothing sellable today;{' '}
                <code className="font-mono">inTransitBottles</code> with an{' '}
                <code className="font-mono">eta</code> is what to take
                pre-orders against.
              </Row>
              <Row name="unavailable" type="neither">
                Known to us but nothing on hand or inbound.
              </Row>
            </Table>
            <Typography variant="bodySm" colorRole="muted">
              A wine can be both: cases on the shelf and more arriving. Then{' '}
              <code className="font-mono">status</code> is{' '}
              <code className="font-mono">available</code>, and{' '}
              <code className="font-mono">inTransitBottles</code> and{' '}
              <code className="font-mono">eta</code> describe what is still to
              come. Where several shipments carry the same wine, the{' '}
              <code className="font-mono">eta</code> given is the soonest.
            </Typography>

            <Typography variant="headingMd" className="mb-3 mt-8">
              Example
            </Typography>
            <CodeBlock title="GET /api/v1/catalogue?stock=all">
              {`{
  "data": [
    {
      "lwin18": "1104653-2020-05-00750",
      "product": "Guidalberto, Tenuta San Guido, Toscana",
      "producer": "Tenuta San Guido",
      "vintage": 2020,
      "region": "Tuscany",
      "country": "Italy",
      "category": "Wine",
      "owner": "Craft & Culture",
      "format": "5×75cl",
      "caseConfig": 5,
      "bottleSize": "75cl",
      "status": "available",
      "availableCases": 1,
      "availableBottles": 5,
      "inTransitBottles": 0,
      "pricePerBottle": 40.78,
      "pricePerCase": 203.91,
      "eta": null
    }
  ],
  "meta": { "feed": "trade", "stock": "all", "totalCount": 468 }
}`}
            </CodeBlock>
            <Typography variant="bodySm" colorRole="muted">
              The whole book is returned in one response — there is no
              pagination on this endpoint today. Expect several hundred rows.
            </Typography>
          </div>
        </section>

        {/* Product lookup */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Product lookup
          </Typography>
          <div className="space-y-4">
            <Endpoint
              method="GET"
              path="/inventory"
              description="Product reference data with merchant offers. Paginated via cursor and limit."
            />
            <Endpoint
              method="GET"
              path="/inventory/{lwin18}"
              description="A single product by its identifier"
            />
            <Typography variant="bodySm" colorRole="muted">
              These cover product reference data rather than what we hold. For
              availability and price, use the catalogue feed above.
            </Typography>
          </div>
        </section>

        {/* Errors */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Errors
          </Typography>
          <div className="space-y-4">
            <Table head={['Code', 'Meaning', 'What to do']}>
              <Row name="401" type="Unauthorized">
                Key missing, malformed, revoked or expired. Check the{' '}
                <code className="font-mono">Authorization</code> header.
              </Row>
              <Row name="403" type="Forbidden">
                The key lacks the permission for this endpoint. Contact us.
              </Row>
              <Row name="400" type="Bad request">
                A query parameter is not a permitted value.{' '}
                <code className="font-mono">details</code> names the field.
              </Row>
              <Row name="429" type="Too many requests">
                Rate limited. Wait for{' '}
                <code className="font-mono">Retry-After</code> seconds.
              </Row>
              <Row name="500" type="Server error">
                Our side. Retry with backoff; tell us if it persists.
              </Row>
            </Table>
            <CodeBlock title="Error shape">
              {`{
  "error": "Rate limit exceeded",
  "retryAfter": 42
}`}
            </CodeBlock>
          </div>
        </section>

        {/* Notes */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Notes for integrators
          </Typography>
          <div className="space-y-3">
            <Typography variant="bodyMd">
              <strong>Key on lwin18.</strong> Names get tidied and producers get
              corrected; the identifier does not move.
            </Typography>
            <Typography variant="bodyMd">
              <strong>Do not add availableBottles and inTransitBottles.</strong>{' '}
              They answer different questions — one is sellable today, the other
              is not yet here.
            </Typography>
            <Typography variant="bodyMd">
              <strong>A missing wine means none held.</strong> Rows appear and
              disappear as stock moves, so treat each response as the full
              current picture rather than a delta.
            </Typography>
            <Typography variant="bodyMd">
              <strong>Prices are USD, in bond</strong>, exclusive of duty, tax
              and delivery.
            </Typography>
            <Typography variant="bodyMd">
              <strong>Every line is supplied by Craft &amp; Culture.</strong>{' '}
              The <code className="font-mono">owner</code> field reads Craft
              &amp; Culture throughout and carries no information — you can
              ignore it.
            </Typography>
          </div>
        </section>

        {/* Your own stock */}
        <section id="account" className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Your stock, sales and movements
          </Typography>
          <div className="space-y-4">
            <Typography variant="bodyMd">
              If you hold wine with us, these endpoints give your systems the
              same picture as your partner portal: what you hold, everything
              that happened to it, what sold and what is held for orders. Every
              answer is scoped to the partner your key was issued to. There is
              no parameter that names an owner, so a key can only ever see its
              own wine.
            </Typography>
            <div className="border-border-brand bg-fill-brand-secondary rounded-lg border p-4">
              <Typography variant="bodySm">
                <strong>Needs a key with the read:own_stock permission.</strong>{' '}
                Ask us to add it to your existing key or issue a new one. Buyers
                are never named: a sale tells you the kind of buyer (distributor,
                private client, Craft &amp; Culture) and the order reference, not
                who bought.
              </Typography>
            </div>
            <div className="space-y-2">
              <Endpoint
                method="GET"
                path="/account/stock"
                description="What you hold right now, per wine and place (our warehouse, or with a distributor on consignment)."
              />
              <Endpoint
                method="GET"
                path="/account/movements"
                description="Every event on your stock, oldest first, paged by cursor. The full export."
              />
              <Endpoint
                method="GET"
                path="/account/sales"
                description="Your wine sold out of our warehouse. Same events and cursor, sales only."
              />
              <Endpoint
                method="GET"
                path="/account/reservations"
                description="Your stock held for orders: active by default, or picked, released or all."
              />
            </div>

            <Typography variant="headingSm" className="pt-4">
              Keeping your system in sync
            </Typography>
            <Typography variant="bodyMd">
              Movements and sales are read oldest first and paged with an opaque
              cursor. On the first run, pass <code className="font-mono">since</code>{' '}
              (or nothing, for your full history) and keep calling with{' '}
              <code className="font-mono">cursor=meta.nextCursor</code> until{' '}
              <code className="font-mono">meta.hasMore</code> is false. Store the
              last <code className="font-mono">nextCursor</code>. Next time, start
              from it and you receive only what happened since, in order, with
              nothing skipped or repeated. Every event has a stable{' '}
              <code className="font-mono">id</code> you can de-duplicate on.
              Polling every 15 minutes is plenty.
            </Typography>
            <CodeBlock title="First sync, then incremental">
              {`# 1. Everything since 1 January
curl -H "Authorization: Bearer $CC_API_KEY" \\
  "https://wine.craftculture.xyz/api/v1/account/movements?since=2026-01-01&limit=500"

# 2. Repeat with the cursor until meta.hasMore is false
curl -H "Authorization: Bearer $CC_API_KEY" \\
  "https://wine.craftculture.xyz/api/v1/account/movements?cursor=MjAyNi0xMS0yNCAwOTox...&limit=500"

# 3. Later: start from the last stored cursor to get only new events`}
            </CodeBlock>
            <CodeBlock title="An event">
              {`{
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
}`}
            </CodeBlock>

            <Typography variant="headingSm" className="pt-4">
              Event types
            </Typography>
            <Table head={['type', 'Balance', 'Meaning']}>
              <Row name="received" type="+">Arrived and booked into the warehouse.</Row>
              <Row name="picked" type="−">Picked for an order. <code className="font-mono">outcome</code> says whether it was a sale or your own delivery.</Row>
              <Row name="dispatched" type="0">Left the building. Already counted when it was picked.</Row>
              <Row name="transferred_in / _out" type="±">Ownership changed. A transfer to Craft &amp; Culture is a sale.</Row>
              <Row name="taken_out_of_stock" type="−">Removed by hand: sold, samples, collected by you, or damaged or lost in our care (reimbursed).</Row>
              <Row name="count_correction / adjusted" type="±">A stock-count or record correction.</Row>
              <Row name="repacked_in / _out" type="±">Repacked into another case size. Bottles are conserved; cases change.</Row>
              <Row name="put_away / moved_bay" type="0">Moved within the warehouse.</Row>
            </Table>
            <Typography variant="bodySm" colorRole="muted">
              Add up <code className="font-mono">balanceChangeBottles</code> across
              all events and the total should match the bottles in{' '}
              <code className="font-mono">/account/stock</code>. If{' '}
              <code className="font-mono">meta.sharedWineCount</code> is above
              zero, another owner also holds some of the same wine, and the part
              of its history that cannot be attributed to you is left out, so
              that wine may not reconcile exactly. Ask us and we will
              reconcile it with you.
            </Typography>

            <Typography variant="headingSm" className="pt-4">
              Sales
            </Typography>
            <Table head={['channel', '', 'Meaning']}>
              <Row name="distributor" type="">Sold to a licensed distributor or trade buyer.</Row>
              <Row name="private_client" type="">Sold on a private-client order (including your own PCOs).</Row>
              <Row name="craft_and_culture" type="">Bought by Craft &amp; Culture, including samples and tastings.</Row>
              <Row name="other" type="">Sold by hand outside our usual order flow.</Row>
            </Table>
            <Typography variant="bodySm" colorRole="muted">
              Prices are not part of these endpoints. What you are paid is on
              your monthly statement.
            </Typography>
          </div>
        </section>

        {/* Support */}
        <section>
          <Typography variant="headingLg" className="mb-4">
            Support
          </Typography>
          <Typography variant="bodyMd">
            Questions, a key that needs rotating, or a field you need that is
            not here — email{' '}
            <a
              href="mailto:partners@craftculture.xyz"
              className="text-text-brand underline"
            >
              partners@craftculture.xyz
            </a>
            .
          </Typography>
          <Typography variant="bodyXs" colorRole="muted" className="mt-8">
            Last updated: November 2026
          </Typography>
        </section>
      </div>
    </div>
  );
};

export default ApiDocsPage;
