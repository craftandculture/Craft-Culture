/** How a member's wine reaches our UAE warehouse */
const intakeRoutes = [
  { value: 'uk_bond', label: 'Via our UK bond (LCB Burton)' },
  { value: 'forwarder', label: 'Collected by our freight forwarder, exported direct' },
  { value: 'uae', label: 'Already in the UAE, in-bond transfer' },
] as const;

export type IntakeRoute = (typeof intakeRoutes)[number]['value'];

export const INTAKE_ROUTE_VALUES = intakeRoutes.map((route) => route.value) as [
  IntakeRoute,
  ...IntakeRoute[],
];

export default intakeRoutes;
