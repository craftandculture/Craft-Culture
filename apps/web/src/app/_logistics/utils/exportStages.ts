/**
 * The stages an export job moves through, in order
 *
 * Each also names the shipment status it corresponds to, so every existing
 * screen that reads the shipment's status still shows something sensible.
 * The stage is what the logistics team works to; the status is kept in step.
 */
export const EXPORT_STAGES = [
  { key: 'booking_received', label: 'Booking received', status: 'draft' },
  { key: 'cargo_ready', label: 'Cargo ready', status: 'draft' },
  { key: 'carrier_booked', label: 'Booked with carrier', status: 'booked' },
  { key: 'customs', label: 'Customs', status: 'customs_clearance' },
  { key: 'shipped', label: 'Shipped', status: 'in_transit' },
  { key: 'docs_sent', label: 'Docs sent', status: 'delivered' },
] as const;

export type ExportStage = (typeof EXPORT_STAGES)[number]['key'];

export const EXPORT_STAGE_KEYS = EXPORT_STAGES.map((s) => s.key) as [ExportStage, ...ExportStage[]];

/** The modes offered on an export job, and the shipment transport mode each is stored as */
export const EXPORT_MODES = [
  { key: 'sea_fcl', label: 'Sea FCL', transportMode: 'sea_fcl', bonded: false },
  { key: 'sea_lcl', label: 'Sea LCL', transportMode: 'sea_lcl', bonded: false },
  { key: 'air', label: 'Air', transportMode: 'air', bonded: false },
  { key: 'land', label: 'Land', transportMode: 'road', bonded: false },
  { key: 'bonded', label: 'Bonded transfer', transportMode: 'road', bonded: true },
] as const;

export type ExportMode = (typeof EXPORT_MODES)[number]['key'];

export const EXPORT_MODE_KEYS = EXPORT_MODES.map((m) => m.key) as [ExportMode, ...ExportMode[]];

/**
 * The mode a job shows as, from how it is stored
 *
 * @param transportMode - The shipment's transport mode
 * @param bonded - Whether the job is a bonded transfer
 * @returns The export mode
 */
export const exportModeOf = (transportMode: string, bonded: boolean): ExportMode => {
  if (bonded) return 'bonded';
  if (transportMode === 'road') return 'land';
  return (EXPORT_MODES.find((m) => m.transportMode === transportMode)?.key ?? 'land') as ExportMode;
};

export const stageLabel = (key: string) => EXPORT_STAGES.find((s) => s.key === key)?.label ?? key;
export const modeLabel = (key: string) => EXPORT_MODES.find((m) => m.key === key)?.label ?? key;
