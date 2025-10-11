import Skeleton from '@/app/_ui/components/Skeleton/Skeleton';

const Loading = () => {
  return (
    <main className="container space-y-12 py-6">
      <div className="flex flex-col gap-6">
        <div className="flex w-full gap-3">
          <Skeleton className="grow" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-[180px]" />
            <Skeleton className="h-10 w-[208px]" />
          </div>
        </div>

        {new Array(2).fill(null).map((_, index) => (
          <div key={index} className="flex flex-col gap-3">
            <Skeleton className="h-5 w-[69px]" />
            <div className="rounded-lg shadow-sm">
              {new Array(3).fill(null).map((_, index) => (
                <div
                  key={index}
                  className="border-border-primary bg-surface-primary not-last:border-b border-x first:rounded-t-lg first:border-t last:rounded-b-lg last:border-b"
                >
                  <div className="flex h-20 flex-row items-center gap-4 p-4">
                    <Skeleton className="size-8 rounded-md" />

                    <div className="flex w-1/3 flex-col gap-1">
                      <Skeleton className="h-4 w-[155px]" />
                      <Skeleton className="h-4 w-[127px]" />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-4 w-[155px]" />
                      <Skeleton className="h-4 w-[127px]" />
                    </div>

                    <div className="flex grow items-center justify-end">
                      <Skeleton className="size-6" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};

export default Loading;
