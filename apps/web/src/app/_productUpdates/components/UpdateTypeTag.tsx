import type { ProductUpdateType } from '../types';

export interface UpdateTypeTagProps {
  type: ProductUpdateType;
}

/** What members see each kind of update called */
export const UPDATE_TYPE_LABELS: Record<ProductUpdateType, string> = {
  feature: 'New feature',
  improvement: 'Improvement',
  fix: 'Fix',
};

const DOTS: Record<ProductUpdateType, string> = {
  feature: 'bg-emerald-500',
  improvement: 'bg-amber-500',
  fix: 'bg-neutral-400',
};

/** The quiet label on an update: a small dot and the kind of change in muted text */
const UpdateTypeTag = ({ type }: UpdateTypeTagProps) => {
  return (
    <span className="text-text-muted inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`size-1.5 shrink-0 rounded-full ${DOTS[type]}`} aria-hidden />
      {UPDATE_TYPE_LABELS[type]}
    </span>
  );
};

export default UpdateTypeTag;
