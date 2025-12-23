import type { Metadata } from 'next';

import Typography from '@/app/_ui/components/Typography/Typography';

export const metadata: Metadata = {
  title: 'Partner API Documentation | Craft & Culture',
  description: 'API documentation for Craft & Culture retail partners',
};

const CodeBlock = ({ children, title }: { children: string; title?: string }) => (
  <div className="rounded-lg border border-border-muted bg-background-secondary overflow-hidden">
    {title && (
      <div className="px-4 py-2 border-b border-border-muted bg-fill-secondary">
        <Typography variant="bodySm" className="font-mono text-text-muted">
          {title}
        </Typography>
      </div>
    )}
    <pre className="p-4 overflow-x-auto">
      <code className="text-sm font-mono text-text-primary">{children}</code>
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
  <div className="flex items-start gap-3 p-4 rounded-lg border border-border-muted bg-white dark:bg-background-secondary">
    <span
      className={`px-2 py-1 rounded text-xs font-bold ${
        method === 'GET'
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      }`}
    >
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

const ApiDocsPage = () => {
  return (
    <div className="min-h-screen bg-background-primary">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <Typography variant="displaySm" className="mb-4">
            Partner API Documentation
          </Typography>
          <Typography variant="bodyLg" colorRole="muted">
            Integrate Craft & Culture inventory into your point-of-sale system
          </Typography>
        </div>

        {/* Quick Start */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Quick Start
          </Typography>
          <div className="space-y-4">
            <Typography variant="bodyMd">
              The Craft & Culture Partner API provides real-time access to our wine inventory.
              Use it to sync product availability, pricing, and stock levels with your POS system.
            </Typography>
            <div className="p-4 rounded-lg border border-border-brand bg-fill-brand-secondary">
              <Typography variant="bodySm" className="font-medium text-text-brand">
                Base URL
              </Typography>
              <Typography variant="bodyMd" className="font-mono mt-1">
                https://wine.craftculture.xyz/api/v1
              </Typography>
            </div>
          </div>
        </section>

        {/* Authentication */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Authentication
          </Typography>
          <div className="space-y-4">
            <Typography variant="bodyMd">
              All API requests require a Bearer token in the Authorization header.
              Contact your account manager to obtain an API key.
            </Typography>
            <CodeBlock title="Request Header">
              {`Authorization: Bearer cc_live_xxxxxxxxxxxxxxxxxxxx`}
            </CodeBlock>
            <div className="p-4 rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20">
              <Typography variant="bodySm" className="font-medium text-yellow-800 dark:text-yellow-300">
                Keep your API key secure
              </Typography>
              <Typography variant="bodyXs" className="mt-1 text-yellow-700 dark:text-yellow-400">
                Never expose your API key in client-side code or public repositories.
                If compromised, contact us immediately to revoke and regenerate your key.
              </Typography>
            </div>
          </div>
        </section>

        {/* Rate Limits */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Rate Limits
          </Typography>
          <div className="space-y-4">
            <Typography variant="bodyMd">
              API requests are rate limited to ensure fair usage and system stability.
            </Typography>
            <div className="overflow-hidden rounded-lg border border-border-muted">
              <table className="min-w-full divide-y divide-border-muted">
                <thead className="bg-fill-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                      Limit
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                      Window
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-primary">
                      Scope
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-background-secondary divide-y divide-border-muted">
                  <tr>
                    <td className="px-4 py-3 text-sm">60 requests</td>
                    <td className="px-4 py-3 text-sm">1 minute</td>
                    <td className="px-4 py-3 text-sm">Per API key</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Typography variant="bodySm" colorRole="muted">
              Rate limit headers are included in all responses:
            </Typography>
            <CodeBlock>
              {`X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 2025-01-15T10:30:00.000Z`}
            </CodeBlock>
          </div>
        </section>

        {/* Endpoints */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Endpoints
          </Typography>
          <div className="space-y-4">
            <Endpoint
              method="GET"
              path="/api/v1/inventory"
              description="List all products with stock levels and pricing"
            />
            <Endpoint
              method="GET"
              path="/api/v1/inventory/:lwin18"
              description="Get a specific product by LWIN18 identifier"
            />
          </div>
        </section>

        {/* List Inventory */}
        <section className="mb-12">
          <Typography variant="headingMd" className="mb-4">
            List Inventory
          </Typography>
          <CodeBlock title="GET /api/v1/inventory">{`curl -X GET "https://wine.craftculture.xyz/api/v1/inventory?limit=50&inStock=true" \\
  -H "Authorization: Bearer cc_live_xxxxxxxxxxxxxxxxxxxx"`}</CodeBlock>

          <Typography variant="bodySm" className="font-medium mt-6 mb-3">
            Query Parameters
          </Typography>
          <div className="overflow-hidden rounded-lg border border-border-muted">
            <table className="min-w-full divide-y divide-border-muted">
              <thead className="bg-fill-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Parameter</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-background-secondary divide-y divide-border-muted">
                <tr>
                  <td className="px-4 py-3 text-sm font-mono">cursor</td>
                  <td className="px-4 py-3 text-sm">number</td>
                  <td className="px-4 py-3 text-sm">Pagination offset (default: 0)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono">limit</td>
                  <td className="px-4 py-3 text-sm">number</td>
                  <td className="px-4 py-3 text-sm">Items per page, max 100 (default: 50)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono">source</td>
                  <td className="px-4 py-3 text-sm">string</td>
                  <td className="px-4 py-3 text-sm">
                    Filter by source: <code className="px-1 py-0.5 bg-fill-secondary rounded">local_inventory</code> or{' '}
                    <code className="px-1 py-0.5 bg-fill-secondary rounded">cultx</code>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-mono">inStock</td>
                  <td className="px-4 py-3 text-sm">boolean</td>
                  <td className="px-4 py-3 text-sm">Filter to only in-stock items</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Typography variant="bodySm" className="font-medium mt-6 mb-3">
            Response
          </Typography>
          <CodeBlock title="200 OK">
            {`{
  "data": [
    {
      "lwin18": "100209520092019750",
      "name": "Chateau Margaux 2019",
      "producer": "Chateau Margaux",
      "region": "Margaux",
      "country": "France",
      "vintage": 2019,
      "imageUrl": "https://...",
      "offers": [
        {
          "id": "offer_123",
          "source": "local_inventory",
          "price": 850.00,
          "currency": "USD",
          "unitCount": 6,
          "unitSize": "750ml",
          "availableQuantity": 12,
          "inStock": true
        }
      ]
    }
  ],
  "meta": {
    "nextCursor": 50,
    "totalCount": 1250
  }
}`}
          </CodeBlock>
        </section>

        {/* Get Single Product */}
        <section className="mb-12">
          <Typography variant="headingMd" className="mb-4">
            Get Product by LWIN18
          </Typography>
          <CodeBlock title="GET /api/v1/inventory/:lwin18">{`curl -X GET "https://wine.craftculture.xyz/api/v1/inventory/100209520092019750" \\
  -H "Authorization: Bearer cc_live_xxxxxxxxxxxxxxxxxxxx"`}</CodeBlock>

          <Typography variant="bodySm" className="font-medium mt-6 mb-3">
            Response
          </Typography>
          <CodeBlock title="200 OK">
            {`{
  "data": {
    "lwin18": "100209520092019750",
    "name": "Chateau Margaux 2019",
    "producer": "Chateau Margaux",
    "region": "Margaux",
    "country": "France",
    "vintage": 2019,
    "imageUrl": "https://...",
    "offers": [
      {
        "id": "offer_123",
        "source": "local_inventory",
        "price": 850.00,
        "currency": "USD",
        "unitCount": 6,
        "unitSize": "750ml",
        "availableQuantity": 12,
        "inStock": true
      }
    ]
  }
}`}
          </CodeBlock>
        </section>

        {/* Error Responses */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Error Responses
          </Typography>
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-border-muted">
              <table className="min-w-full divide-y divide-border-muted">
                <thead className="bg-fill-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-background-secondary divide-y divide-border-muted">
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono">400</td>
                    <td className="px-4 py-3 text-sm">Invalid request parameters</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono">401</td>
                    <td className="px-4 py-3 text-sm">Missing or invalid API key</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono">403</td>
                    <td className="px-4 py-3 text-sm">Insufficient permissions</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono">404</td>
                    <td className="px-4 py-3 text-sm">Product not found</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono">429</td>
                    <td className="px-4 py-3 text-sm">Rate limit exceeded</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono">500</td>
                    <td className="px-4 py-3 text-sm">Internal server error</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <CodeBlock title="Error Response Format">
              {`{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}`}
            </CodeBlock>
          </div>
        </section>

        {/* Support */}
        <section className="mb-12">
          <Typography variant="headingLg" className="mb-4">
            Support
          </Typography>
          <Typography variant="bodyMd">
            For API support, technical questions, or to request additional features,
            contact your account manager or email{' '}
            <a
              href="mailto:partners@craftculture.xyz"
              className="text-text-brand hover:underline"
            >
              partners@craftculture.xyz
            </a>
          </Typography>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-border-muted">
          <Typography variant="bodySm" colorRole="muted">
            Last updated: December 2025
          </Typography>
        </footer>
      </div>
    </div>
  );
};

export default ApiDocsPage;
