interface LocationAssignment {
  locationId: string;
  cases: number;
  isPalletized?: boolean;
}

/**
 * Combine location assignments that point at the same bay
 *
 * A receiver can put one product into the same bay in two batches (print 5
 * labels, then scan the bay again for the rest). Receiving books stock once
 * per bay, so two entries for one bay must arrive as one, or the second batch
 * is mistaken for a retry of the first and never reaches stock. The bay
 * counts as palletised only when every batch put there was.
 *
 * @example
 *   mergeLocationAssignments([
 *     { locationId: 'a', cases: 5 },
 *     { locationId: 'a', cases: 7 },
 *   ]); // [{ locationId: 'a', cases: 12, isPalletized: false }]
 *
 * @param assignments - Assignments in the order they were made
 * @returns One assignment per bay, in first-seen order
 */
const mergeLocationAssignments = <T extends LocationAssignment>(
  assignments: T[],
) => {
  const byLocation = new Map<string, T>();

  for (const assignment of assignments) {
    const existing = byLocation.get(assignment.locationId);
    if (!existing) {
      byLocation.set(assignment.locationId, { ...assignment });
      continue;
    }
    byLocation.set(assignment.locationId, {
      ...existing,
      cases: existing.cases + assignment.cases,
      isPalletized: !!existing.isPalletized && !!assignment.isPalletized,
    });
  }

  return [...byLocation.values()];
};

export default mergeLocationAssignments;
