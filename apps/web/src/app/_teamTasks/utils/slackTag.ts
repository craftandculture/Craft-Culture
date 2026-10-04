/**
 * How a person appears in a #tasks post: a real @-mention when their Slack
 * account is linked, otherwise their name in bold
 */
const slackTag = (person: { name: string; slackMemberId: string | null } | undefined) =>
  person?.slackMemberId ? `<@${person.slackMemberId}>` : `*${person?.name ?? 'someone'}*`;

export default slackTag;
