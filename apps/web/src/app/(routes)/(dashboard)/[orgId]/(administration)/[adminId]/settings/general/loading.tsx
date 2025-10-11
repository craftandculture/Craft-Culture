import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

const Loading = () => {
  return (
    <>
      <Skeleton className="h-[195px]" />
      <Skeleton className="h-[348px]" />
      <Skeleton className="h-[249px]" />
      <Skeleton className="h-[249px]" />
    </>
  );
};

export default Loading;
