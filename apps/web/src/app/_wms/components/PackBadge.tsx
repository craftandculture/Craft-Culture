export interface PackBadgeProps {
  /** Bottles per case (e.g. 6, 12). Falls back to 12 when unknown. */
  pack?: number | null;
  /** Bottle size label, e.g. "75cl". */
  bottleSize?: string | null;
  /** Optional extra classes (sizing/spacing overrides). */
  className?: string;
}

/**
 * The amber pack-configuration chip (e.g. `6×75cl`) shown next to a wine name.
 *
 * Pack config is the single most common source of picking confusion — a 6-pack
 * vs a 12-pack of the same wine looks identical without it — so this badge is
 * reused everywhere a product is listed (Stock Explorer, Pick, Movements, etc.).
 *
 * @example
 *   <PackBadge pack={6} bottleSize="75cl" />; // 6×75cl
 */
const PackBadge = ({ pack, bottleSize, className }: PackBadgeProps) => {
  return (
    <span
      title="Pack configuration"
      className={`shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ${className ?? ''}`}
    >
      {pack ?? 12}×{bottleSize ?? '75cl'}
    </span>
  );
};

export default PackBadge;
