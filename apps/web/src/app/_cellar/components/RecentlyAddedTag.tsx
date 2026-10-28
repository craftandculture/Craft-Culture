/** The quiet mark on a wine that arrived on the C&C Cellar List this week: a green dot and "New" */
const RecentlyAddedTag = () => {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
      New
    </span>
  );
};

export default RecentlyAddedTag;
