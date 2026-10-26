import { IconClipboardList } from '@tabler/icons-react';

/** Two letters for a client with no logo, e.g. "JMK Trading LLC" → "JT" */
const initials = (name: string) =>
  name
    .replace(/\b(llc|l\.l\.c|fze|fzco|fz-llc|ltd|co)\b\.?/gi, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/**
 * The square at the start of an order or partner row: the partner's logo when
 * there is one, otherwise the client's initials, so each order is told apart
 * at a glance. Shared by the pick list and the dispatch wizard.
 */
const ClientMark = ({
  logoUrl,
  name,
  size = 'md',
}: {
  logoUrl: string | null | undefined;
  name: string | null | undefined;
  size?: 'sm' | 'md';
}) => {
  const box = size === 'sm' ? 'size-9 text-xs' : 'size-11 text-sm';
  return logoUrl ? (
    <span
      className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 ring-1 ring-border-muted`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- partner logos come from Blob at any size */}
      <img src={logoUrl} alt={name ?? ''} className="max-h-full max-w-full object-contain" />
    </span>
  ) : (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-lg bg-fill-secondary font-semibold text-text-muted`}
    >
      {name ? initials(name) || '?' : <IconClipboardList className="h-5 w-5" />}
    </span>
  );
};

export default ClientMark;
