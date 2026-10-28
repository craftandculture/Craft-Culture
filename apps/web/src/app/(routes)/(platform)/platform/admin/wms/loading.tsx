import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

/**
 * Loading skeleton for WMS sub-routes
 *
 * Warehouse screens are single-column scanner views, so this is a plain
 * column of blocks. The dashboard draws its own skeleton (WMSDashboardSkeleton).
 */
const WMSLoading = () => {
  return (
    <div className="container mx-auto max-w-lg px-4 py-6 md:max-w-3xl lg:max-w-5xl">
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-14 w-full rounded-lg" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
};

export default WMSLoading;
