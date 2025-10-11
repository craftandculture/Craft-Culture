import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

const PricingModelsListSkeleton = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
};

export default PricingModelsListSkeleton;
