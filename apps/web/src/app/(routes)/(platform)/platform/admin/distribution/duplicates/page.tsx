import DuplicateWinesPanel from '@/app/_distribution/components/DuplicateWinesPanel';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Wines recorded twice
 *
 * The review that comes before any merge. One wine held under two records
 * splits its stock and, silently, its consignment position — an owner's
 * bottles sitting half under one code and half under another, reconciling to
 * neither.
 */
const DuplicateWinesPage = () => {
  return (
    <main className="container space-y-6 py-8">
      <div>
        <Typography variant="headingLg" asChild>
          <h1>Wines recorded twice</h1>
        </Typography>
        <Typography variant="bodySm" colorRole="muted" asChild>
          <p className="mt-1 max-w-3xl">
            One wine under two records splits its stock and its consignment
            position, so it reconciles to neither. This page proposes merges and
            performs none — read it first, and the merging follows as its own
            step.
          </p>
        </Typography>
      </div>
      <DuplicateWinesPanel />
    </main>
  );
};

export default DuplicateWinesPage;
