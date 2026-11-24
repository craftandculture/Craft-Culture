import type { Metadata } from 'next';

import Typography from '@/app/_ui/components/Typography/Typography';

import CodeBlock from '../_components/CodeBlock';
import Endpoint from '../_components/Endpoint';
import Row from '../_components/Row';
import Table from '../_components/Table';

export const metadata: Metadata = {
  title: 'Stock API | Craft & Culture',
  description: 'Your stock, sales and movements at Craft & Culture, for your own systems',
  robots: { index: false, follow: false },
};

/**
 * Documentation for wine partners' Stock API (`/api/v1/account/*`)
 *
 * Its own page, and deliberately not linked from the catalogue docs or
 * linking to them: wine partners and distributors are shown only the
 * integration they are given.
 */
const StockApiDocsPage = () => {
  return (
    <div className="bg-background-primary min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12">
          <Typography variant="displaySm" className="mb-4">
            C&amp;C Stock API
          </Typography>
          <Typography variant="bodyLg" colorRole="muted">
            Your wine held by Craft &amp; Culture, for your own systems: what
            you hold, everything that happened to it, what has sold and what is
            held for orders.
          </Typography>
          <div className="border-border-brand bg-fill-brand-secondary mt-6 rounded-lg border p-4">
            <Typography variant="bodySm">
              <strong>For wine partners holding stock with us.</strong> Access
              is issued by Craft &amp; Culture against a named key. Your key
              only ever returns your own wine.
            </Typography>
          </div>
        </div>

        {/* Quick start */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Quick start
          </Typography>
          <div className="space-y-4">
            <div className="border-border-brand bg-fill-brand-secondary rounded-lg border p-4">
              <Typography variant="bodySm" className="text-text-brand font-medium">
                Base URL
              </Typography>
              <Typography variant="bodyMd" className="mt-1 font-mono">
                https://wine.craftculture.xyz/api/v1
              </Typography>
            </div>
            <Typography variant="bodySm" colorRole="muted">
              Machine-readable description (OpenAPI 3.1), for generating a
              client or loading into Postman:{' '}
              <span className="font-mono">
                https://wine.craftculture.xyz/api/v1/account/openapi.json
              </span>
            </Typography>
            <CodeBlock title="What do we hold right now?">
              {`curl -H "Authorization: Bearer $CC_API_KEY" \\
  "https://wine.craftculture.xyz/api/v1/account/stock"`}
            </CodeBlock>
          </div>
        </section>

        {/* Authentication */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Authentication and limits
          </Typography>
          <Typography variant="bodyMd">
            Send your key on every request as{' '}
            <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>.
            It is shown once, when we issue it: keep it on your server, never in
            a browser or a shared document. Ask us to revoke and reissue it if
            it may have been exposed. The limit is 60 requests a minute per key;
            responses carry <code className="font-mono">X-RateLimit-Remaining</code>{' '}
            and <code className="font-mono">X-RateLimit-Reset</code>.
          </Typography>
        </section>

        <section id="account" className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Endpoints
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


        {/* Errors */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Errors
          </Typography>
          <Table head={['Status', '', 'Meaning']}>
            <Row name="400" type="">A query parameter is invalid. The body names which and why.</Row>
            <Row name="401" type="">The key is missing, revoked or expired.</Row>
            <Row name="403" type="">The key does not carry the read:own_stock permission.</Row>
            <Row name="429" type="">Too many requests. Wait for the Retry-After seconds.</Row>
          </Table>
        </section>

        {/* Support */}
        <section>
          <Typography variant="headingLg" className="mb-4">
            Support
          </Typography>
          <Typography variant="bodyMd">
            Questions, a key that needs rotating, or a field you need that is
            not here: email{' '}
            <a href="mailto:partners@craftculture.xyz" className="text-text-brand underline">
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

export default StockApiDocsPage;
