const LABELS: Record<number, string> = {
  150: 'Magnum',
  300: 'Double Magnum',
  450: 'Jeroboam',
  600: 'Imperial',
  900: 'Salmanazar',
  1200: 'Balthazar',
  1500: 'Nebuchadnezzar',
};

/**
 * Bordeaux large-format name for a bottle volume.
 *
 * @example
 *   largeFormatLabel(300); // 'Double Magnum'
 *
 * @param cl - Bottle volume in centilitres
 * @returns The format name, or an empty string below magnum
 */
const largeFormatLabel = (cl: number) =>
  LABELS[cl] ?? (cl >= 150 ? 'Magnum' : '');

export default largeFormatLabel;
