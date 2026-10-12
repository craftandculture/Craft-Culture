/** The stages a wine transfer into a member's cellar moves through, in order */
const intakeStages = [
  { value: 'requested', label: 'Request received' },
  { value: 'in_progress', label: "We're arranging the transfer" },
  { value: 'arriving_uk', label: 'Arriving at our UK bond' },
  { value: 'shipping_uae', label: 'Shipping to the UAE' },
  { value: 'in_cellar', label: 'In your cellar' },
] as const;

export type IntakeStage = (typeof intakeStages)[number]['value'] | 'closed';

export const INTAKE_STAGE_VALUES: [IntakeStage, ...IntakeStage[]] = [
  'requested',
  'in_progress',
  'arriving_uk',
  'shipping_uae',
  'in_cellar',
  'closed',
];

export default intakeStages;
