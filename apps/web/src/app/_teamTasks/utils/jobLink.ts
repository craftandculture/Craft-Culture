import serverConfig from '@/server.config';

/** A Slack link to a job that opens its panel in Index */
const jobLink = (task: { id: string; title: string }) =>
  `<${serverConfig.appUrl}/platform/admin/tasks?job=${task.id}|${task.title.replace(/[<>|]/g, '')}>`;

export default jobLink;
