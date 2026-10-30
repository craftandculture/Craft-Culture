import Link from 'next/link';

export type ShipmentDueTileKey = 'late' | 'ships_7d' | 'arrives_7d' | 'no_news';

export interface ShipmentDueTilesProps {
  counts: Record<ShipmentDueTileKey, number> | undefined;
  /** The tile showing as pressed, on the shipments list */
  active?: ShipmentDueTileKey | null;
  /** On the list: filter in place. Without it, each tile opens the list filtered */
  onPick?: (key: ShipmentDueTileKey) => void;
}

const TILES: { key: ShipmentDueTileKey; label: string; hint: string; tone: string; href: string }[] = [
  {
    key: 'late',
    label: 'Late',
    hint: 'ETA passed, not in yet',
    tone: 'bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-200',
    href: '/platform/admin/logistics/shipments?due=late',
  },
  {
    key: 'ships_7d',
    label: 'Ships in next 7 days',
    hint: 'Not yet departed',
    tone: 'bg-slate-100 text-slate-900 dark:bg-slate-500/10 dark:text-slate-200',
    href: '/platform/admin/logistics/shipments?due=ships_7d',
  },
  {
    key: 'arrives_7d',
    label: 'Arrives in next 7 days',
    hint: 'By its ETA',
    tone: 'bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200',
    href: '/platform/admin/logistics/shipments?due=arrives_7d&sort=eta',
  },
  {
    key: 'no_news',
    label: 'No news 48h',
    hint: 'Chase the forwarder',
    tone: 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200',
    href: '/platform/admin/logistics/shipments?news=none',
  },
];

/**
 * The four timing tiles: late, shipping this week, arriving this week, gone quiet
 *
 * @example
 *   <ShipmentDueTiles counts={data?.dueCounts} />
 */
const ShipmentDueTiles = ({ counts, active, onPick }: ShipmentDueTilesProps) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {TILES.map((t) => {
      const body = (
        <>
          <p className="text-2xl font-semibold tabular-nums">{counts ? counts[t.key] : '–'}</p>
          <p className="mt-0.5 text-sm font-semibold">{t.label}</p>
          <p className="text-xs opacity-75">{t.hint}</p>
        </>
      );
      const className = `rounded-xl px-4 py-3 text-left transition ${t.tone} ${
        active === t.key ? 'ring-2 ring-text-primary ring-offset-2 ring-offset-surface-primary' : 'hover:opacity-80'
      }`;
      return onPick ? (
        <button key={t.key} type="button" onClick={() => onPick(t.key)} className={className} aria-pressed={active === t.key}>
          {body}
        </button>
      ) : (
        <Link key={t.key} href={t.href} className={className}>
          {body}
        </Link>
      );
    })}
  </div>
);

export default ShipmentDueTiles;
