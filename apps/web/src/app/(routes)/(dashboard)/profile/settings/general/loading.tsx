import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

const Loading = () => {
  return (
    <>
      <Skeleton className="h-[308px]" />
      <Skeleton className="h-[243px]" />
      <Skeleton className="h-[308px]" />
    </>
  );
};

export default Loading;
