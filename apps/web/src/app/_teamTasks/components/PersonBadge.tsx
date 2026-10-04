import personTone from '../utils/personTone';

/** A person's initials in a small tinted circle, with their name as the tooltip */
const PersonBadge = ({ name, size = 'sm' }: { name: string; isViewer?: boolean; size?: 'sm' | 'md' }) => {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${
        size === 'md' ? 'size-8 text-[11px]' : 'size-6 text-[10px]'
      } ${personTone(name)}`}
    >
      {initials}
    </span>
  );
};

export default PersonBadge;
