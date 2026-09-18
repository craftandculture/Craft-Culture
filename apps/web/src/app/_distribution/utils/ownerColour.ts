export interface OwnerColour {
  /** A filled dot beside the name */
  dot: string;
  /** The row's left edge, which is what the eye actually follows */
  edge: string;
  /** A tinted chip, for the legend */
  chip: string;
}

/**
 * A colour per owner, stable across every screen
 *
 * Whose wine a line is, is the question this module exists to answer, and it
 * was being carried by a name repeated in a column — which sorts by bottles,
 * so owners alternate and the eye has to read every row to follow one owner.
 *
 * Hues are chosen to be distinguishable without reading as status: nothing
 * green, amber or red, because those already mean settled, needs-attention and
 * wrong on this page. Slate is the fallback rather than a colour nobody else
 * has, so an owner added later is visibly uncoloured instead of silently
 * borrowing someone's.
 *
 * Classes are written out in full rather than composed, because Tailwind reads
 * source text to decide what to keep and a built-up class name is dropped from
 * the stylesheet.
 */
const PALETTE: OwnerColour[] = [
  {
    dot: 'bg-indigo-500',
    edge: 'border-l-indigo-500',
    chip: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  },
  {
    dot: 'bg-teal-500',
    edge: 'border-l-teal-500',
    chip: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  },
  {
    dot: 'bg-violet-500',
    edge: 'border-l-violet-500',
    chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  {
    dot: 'bg-sky-500',
    edge: 'border-l-sky-500',
    chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  {
    dot: 'bg-rose-500',
    edge: 'border-l-rose-500',
    chip: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  {
    dot: 'bg-fuchsia-500',
    edge: 'border-l-fuchsia-500',
    chip: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
  },
];

const UNCOLOURED: OwnerColour = {
  dot: 'bg-slate-400',
  edge: 'border-l-slate-300',
  chip: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

/**
 * The colour for an owner
 *
 * Keyed on position in the owner list rather than on a hash of the name, so
 * the colours are stable for as long as the list is and an owner never changes
 * colour because another was renamed.
 *
 * @param index - The owner's position in the sorted owner list
 * @returns Classes for the dot, the row edge and the legend chip
 */
const ownerColour = (index: number): OwnerColour =>
  index < 0 ? UNCOLOURED : (PALETTE[index % PALETTE.length] ?? UNCOLOURED);

export default ownerColour;
