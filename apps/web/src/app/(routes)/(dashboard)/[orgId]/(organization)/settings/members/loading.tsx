import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

const Loading = () => {
  return (
    <>
      <Skeleton className="h-[243px]" />
      <Skeleton className="h-[242px]" />
      <Skeleton className="h-[245px]" />
    </>
  );
};

export default Loading;
