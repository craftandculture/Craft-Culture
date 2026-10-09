import { createTRPCRouter } from '@/lib/trpc/trpc';

import addAttachment from './controller/addAttachment';
import addNote from './controller/addNote';
import cancelJob from './controller/cancelJob';
import closeJob from './controller/closeJob';
import createArea from './controller/createArea';
import createJob from './controller/createJob';
import getBoard from './controller/getBoard';
import getTask from './controller/getTask';
import goAhead from './controller/goAhead';
import jobsForLink from './controller/jobsForLink';
import myCount from './controller/myCount';
import partnerAddNote from './controller/partnerAddNote';
import partnerCount from './controller/partnerCount';
import partnerGetJobs from './controller/partnerGetJobs';
import partnerTickPart from './controller/partnerTickPart';
import reassignPart from './controller/reassignPart';
import removeAttachment from './controller/removeAttachment';
import reopenJob from './controller/reopenJob';
import setPartDue from './controller/setPartDue';
import setSlackIds from './controller/setSlackIds';
import tickPart from './controller/tickPart';
import updateJob from './controller/updateJob';

const teamTasksRouter = createTRPCRouter({
  getBoard,
  getTask,
  myCount,
  jobsForLink,
  createJob,
  updateJob,
  // Ticking never closes a job; closeJob is the confirmed second step
  tickPart,
  closeJob,
  setPartDue,
  reassignPart,
  reopenJob,
  cancelJob,
  goAhead,
  addNote,
  // Files go browser → Blob first; these only record and remove them
  addAttachment,
  removeAttachment,
  createArea,
  setSlackIds,
  // Partner portal: only jobs shared with the signed-in partner
  partnerGetJobs,
  partnerTickPart,
  partnerAddNote,
  partnerCount,
});

export default teamTasksRouter;
