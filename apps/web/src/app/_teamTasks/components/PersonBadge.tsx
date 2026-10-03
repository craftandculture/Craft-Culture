/** A person's initials in a small circle, with their name as the tooltip */
const PersonBadge = ({ name, isViewer }: { name: string; isViewer?: boolean }) => {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      title={name}
      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
        isViewer ? 'bg-fill-brand text-text-brand-on-fill' : 'bg-fill-muted text-text-primary'
      }`}
    >
      {initials}
    </span>
  );
};

export default PersonBadge;
