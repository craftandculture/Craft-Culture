import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

const Loading = () => {
  return (
    <>
      <Skeleton className="h-[311px]" />
      <Skeleton className="h-[779px]" />
      <Skeleton className="h-[779px]" />
    </>
  );
};

export default Loading;
