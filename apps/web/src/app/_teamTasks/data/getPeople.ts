import getPartnerPeople from './getPartnerPeople';
import getTeam from './getTeam';

/**
 * Everyone a job part can belong to: the C&C team and partner people
 *
 * Used wherever a part's owner is named or tagged, so a partner's part reads
 * with their name rather than "someone". Partner people have no Slack link.
 */
const getPeople = async () => {
  const [team, partnerPeople] = await Promise.all([getTeam(), getPartnerPeople()]);
  const staff = new Set(team.map((m) => m.id));

  return [
    ...team.map((m) => ({ id: m.id, name: m.name, slackMemberId: m.slackMemberId })),
    ...partnerPeople.filter((p) => !staff.has(p.id)).map((p) => ({ id: p.id, name: p.name, slackMemberId: null })),
  ];
};

export default getPeople;
