/**
 * The two levels of shared access, in words for each side
 *
 * `detail` is read by the holder choosing a level; `forDelegate` by the person
 * being given it.
 */
const accessLevels = {
  viewer: {
    label: 'View only',
    detail:
      'Can see the wine, deliveries, purchases and statements. Cannot request, buy or sell anything.',
    forDelegate:
      'You can see the wine, deliveries, purchases and statements. You cannot request, buy or sell anything.',
  },
  manager: {
    label: 'Manage',
    detail:
      'Can also request deliveries, buy and offer wine for sale on your behalf. You are told each time.',
    forDelegate:
      'You can also request deliveries, buy and offer wine for sale on their behalf. They are told each time.',
  },
} as const;

export type AccessLevel = keyof typeof accessLevels;

export default accessLevels;
