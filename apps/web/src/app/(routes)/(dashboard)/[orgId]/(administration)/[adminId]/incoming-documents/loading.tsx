import ButtonSkeleton from '@/app/_ui/components/Button/ButtonSkeleton';
import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

const Loading = () => {
  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-row justify-between px-6 py-3">
        <div className="flex gap-3">
          <ButtonSkeleton className="w-[97px]" />
          <ButtonSkeleton className="w-[81px]" />
        </div>
        <div className="flex items-center gap-3">
          <ButtonSkeleton className="w-[176px]" />
        </div>
      </div>
      <div className="grid w-full grid-cols-6 gap-3 px-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex h-12 items-center justify-center">
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
      <div className="flex w-full flex-col px-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            className="flex h-[59px] items-center justify-center"
            key={index}
          >
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Loading;
