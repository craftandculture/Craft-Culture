import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';

export interface LwinPack {
  /** Bottles per case, from the LWIN's pack segment */
  bottlesPerCase: number;
  /** Bottle size in millilitres, from the LWIN's size segment */
  bottleSizeMl: number;
}

/**
 * Read the pack and bottle size a LWIN already states
 *
 * A dashed LWIN18 is `wine-vintage-pack-size`, so `1148811-0000-02-00750` is a
 * two-bottle pack of 75cl and `2821579-2020-03-01500` is a three-bottle pack of
 * magnums. The pack is in the code; nobody should be reading it off by eye.
 *
 * That is what the manual pass over this shipment was doing — latching a LWIN
 * and then typing the pack it already contains, 163 times.
 *
 * @param lwin - A LWIN18, dashed or compact
 * @returns The pack and bottle size, or null if the code does not carry them
 */
const packFromLwin = (lwin?: string | null): LwinPack | null => {
  if (!lwin) return null;

  const normalized = normalizeLwin18(lwin);

  if (!normalized) return null;

  const parts = String(normalized).split('-');

  if (parts.length !== 4) return null;

  const bottlesPerCase = Number(parts[2]);
  const bottleSizeMl = Number(parts[3]);

  // A pack of 0 is the LWIN convention for "unspecified", not a real pack, and
  // an absurd one means the code is malformed rather than informative.
  if (!bottlesPerCase || bottlesPerCase < 1 || bottlesPerCase > 24) return null;
  if (!bottleSizeMl || bottleSizeMl < 100) return null;

  return { bottlesPerCase, bottleSizeMl };
};

export default packFromLwin;
