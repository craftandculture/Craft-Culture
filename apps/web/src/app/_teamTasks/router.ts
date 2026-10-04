import { createTRPCRouter } from '@/lib/trpc/trpc';

import addNote from './controller/addNote';
import cancelJob from './controller/cancelJob';
import closeJob from './controller/closeJob';
import createArea from './controller/createArea';
import createJob from './controller/createJob';
import getBoard from './controller/getBoard';
import getTask from './controller/getTask';
import goAhead from './controller/goAhead';
import myCount from './controller/myCount';
import reassignPart from './controller/reassignPart';
import reopenJob from './controller/reopenJob';
import setPartDue from './controller/setPartDue';
import setSlackIds from './controller/setSlackIds';
import tickPart from './controller/tickPart';
import updateJob from './controller/updateJob';

const teamTasksRouter = createTRPCRouter({
  getBoard,
  getTask,
  myCount,
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
  createArea,
  setSlackIds,
});

export default teamTasksRouter;
