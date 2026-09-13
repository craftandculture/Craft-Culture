/**
 * When a member may still change a release request
 *
 * Until we have accepted it, it is theirs to edit — including after we have
 * asked for revisions, which is the whole point of asking. Once confirmed it
 * becomes an order and stops being a conversation.
 */
const EDITABLE_STATUSES = ['draft', 'revision_requested'] as const;

export type EditableStatus = (typeof EDITABLE_STATUSES)[number];

export default EDITABLE_STATUSES;
