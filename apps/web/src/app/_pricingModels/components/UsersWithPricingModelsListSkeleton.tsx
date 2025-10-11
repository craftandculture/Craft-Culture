import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

const UsersWithPricingModelsListSkeleton = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
};

export default UsersWithPricingModelsListSkeleton;
