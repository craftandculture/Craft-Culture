'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

type SlackResult = { slack?: { posted: boolean; reason: string | null } };

/**
 * Every Team Tasks change, wired to refresh the board and the nav count
 *
 * A failed #tasks post is reported but never treated as a failed save: the
 * job is in Index either way. "Not connected" is left to the page banner.
 */
const useTaskMutations = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const onSuccess = (result: unknown) => {
    void queryClient.invalidateQueries();
    if ((result as SlackResult)?.slack?.reason === 'error') {
      toast.warning('Saved, but the post to #tasks failed.');
    }
  };
  const onError = (error: { message: string }) => toast.error(error.message);
  const opts = { onSuccess, onError };

  return {
    createJob: useMutation({ ...api.teamTasks.createJob.mutationOptions(), ...opts }),
    updateJob: useMutation({ ...api.teamTasks.updateJob.mutationOptions(), ...opts }),
    tickPart: useMutation({ ...api.teamTasks.tickPart.mutationOptions(), ...opts }),
    setPartDue: useMutation({ ...api.teamTasks.setPartDue.mutationOptions(), ...opts }),
    reassignPart: useMutation({ ...api.teamTasks.reassignPart.mutationOptions(), ...opts }),
    closeJob: useMutation({ ...api.teamTasks.closeJob.mutationOptions(), ...opts }),
    reopenJob: useMutation({ ...api.teamTasks.reopenJob.mutationOptions(), ...opts }),
    cancelJob: useMutation({ ...api.teamTasks.cancelJob.mutationOptions(), ...opts }),
    goAhead: useMutation({ ...api.teamTasks.goAhead.mutationOptions(), ...opts }),
    addNote: useMutation({ ...api.teamTasks.addNote.mutationOptions(), ...opts }),
    setSlackIds: useMutation({ ...api.teamTasks.setSlackIds.mutationOptions(), ...opts }),
  };
};

export default useTaskMutations;
