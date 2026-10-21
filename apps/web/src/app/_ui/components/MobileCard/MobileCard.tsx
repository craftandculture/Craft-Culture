import { IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';

export interface MobileCardField {
  label: string;
  value: React.ReactNode;
}

export interface MobileCardProps {
  title: React.ReactNode;
  /** A logo or icon square at the start */
  leading?: React.ReactNode;
  /** A status pill or amount at the top right */
  aside?: React.ReactNode;
  /** One muted line under the title: numbers, dates, who */
  meta?: React.ReactNode;
  /** Labelled figures in two columns */
  fields?: MobileCardField[];
  /** Anything else under the figures: actions, a progress bar */
  children?: React.ReactNode;
  /** Makes the whole card a link */
  href?: string;
  onClick?: () => void;
}

/**
 * One row of a desktop table, as a card on a phone
 *
 * Title and status first, then the few figures that matter; the rest of the
 * detail is one tap away. Tappable cards get a chevron and a 44px-plus target.
 */
const MobileCard = ({ title, leading, aside, meta, fields, children, href, onClick }: MobileCardProps) => {
  const tappable = Boolean(href || onClick);
  const body = (
    <div className="flex items-start gap-3 p-4">
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 text-sm font-semibold text-text-primary">{title}</div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        {meta && <div className="mt-0.5 text-xs text-text-muted">{meta}</div>}
        {fields && fields.length > 0 && (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {fields.map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-text-muted">{field.label}</dt>
                <dd className="truncate text-sm text-text-primary tabular-nums">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {children && <div className="mt-3">{children}</div>}
      </div>
      {tappable && <IconChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />}
    </div>
  );

  const surface = 'block w-full text-left transition-colors hover:bg-surface-secondary active:bg-surface-secondary';

  return (
    <li>
      {href ? (
        <Link href={href} className={surface}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={surface}>
          {body}
        </button>
      ) : (
        body
      )}
    </li>
  );
};

export default MobileCard;
