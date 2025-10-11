import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

const Loading = () => {
  return (
    <>
      <Skeleton className="h-[195px]" />
      <Skeleton className="h-[195px]" />
      <Skeleton className="h-[348px]" />
    </>
  );
};

export default Loading;
