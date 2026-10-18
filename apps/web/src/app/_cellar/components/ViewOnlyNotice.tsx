'use client';

import { IconEye } from '@tabler/icons-react';

/**
 * The one line a view-only guest sees where the actions would be
 *
 * Quiet on purpose: they are a guest in someone else's cellar, not someone who
 * has done anything wrong.
 */
const ViewOnlyNotice = () => (
  <p className="text-text-muted mb-4 flex items-center gap-1.5 text-xs">
    <IconEye size={14} />
    You can view this private cellar. Only its holder or a manager can make changes.
  </p>
);

export default ViewOnlyNotice;
