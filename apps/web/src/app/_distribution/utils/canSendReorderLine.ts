import type { ReorderLine } from '../data/getOutletReorderList';

/**
 * Whether a reorder line can be sent now, or has to be sourced
 *
 * Sendable when this vintage is held at C&C (ours or a consignor's) or
 * inbound, or a vintage within three years is. One-offs are never sendable:
 * they are sourcing ideas. The Slack post, the Reorder watch page and its
 * Excel export all split To send / To source on this.
 *
 * @param line - A line from getOutletReorderList
 */
const canSendReorderLine = (line: ReorderLine) =>
  line.status !== 'oneoff' && (line.available > 0 || line.alternatives.length > 0);

export default canSendReorderLine;
