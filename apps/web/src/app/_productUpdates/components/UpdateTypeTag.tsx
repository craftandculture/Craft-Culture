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

const STYLES: Record<ProductUpdateType, string> = {
  feature: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  improvement: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  fix: 'bg-fill-muted text-text-secondary',
};

/** The tinted label on an update: New feature, Improvement or Fix */
const UpdateTypeTag = ({ type }: UpdateTypeTagProps) => {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase ${STYLES[type]}`}
    >
      {UPDATE_TYPE_LABELS[type]}
    </span>
  );
};

export default UpdateTypeTag;
