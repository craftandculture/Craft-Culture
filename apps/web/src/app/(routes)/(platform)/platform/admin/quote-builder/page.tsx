import QuoteBuilderClient from '@/app/_salesQuotes/components/QuoteBuilderClient';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Quote builder
 *
 * Builds the standard branded client offer from selectable catalogue lines and
 * publishes it to a shareable link, so the team can produce a quote without
 * going through code.
 */
const QuoteBuilderPage = () => {
  return (
    <main className="container space-y-6 py-8">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Quote builder</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1 max-w-3xl">
            Build a client offer from live catalogue lines — the same pricing the
            client sees on the price list — and publish it to a shareable link at{' '}
            <strong>/q/&lt;slug&gt;</strong>. Prices are captured when you save,
            so a quote already with a client never reprices itself. Drafts are
            visible only to signed-in admins, so you can proof a quote before the
            link goes out.
          </p>
        </Typography>
      </div>
      <QuoteBuilderClient />
    </main>
  );
};

export default QuoteBuilderPage;
