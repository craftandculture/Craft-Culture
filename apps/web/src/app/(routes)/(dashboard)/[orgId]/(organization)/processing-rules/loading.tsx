import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

const Loading = () => {
  return (
    <main className="container space-y-12 py-6">
      <div className="flex flex-col gap-6">
        <div className="flex w-full gap-3">
          <Skeleton className="grow" />
          <Skeleton className="h-10 w-[238px]" />
        </div>

        <Skeleton className="h-[300px] w-full" />
      </div>
    </main>
  );
};

export default Loading;
