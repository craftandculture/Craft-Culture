'use client';

import { IconLoader2 } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import type { ApplicationStepKey } from './ApplicationProgress';
import ApplicationProgress from './ApplicationProgress';
import StepAbout from './StepAbout';
import type { IdSide } from './StepIdentity';
import StepIdentity from './StepIdentity';
import StepMembership from './StepMembership';
import type { WineSourceAnswer } from './StepWine';
import StepWine from './StepWine';
import fileToUploadDataUrl from '../utils/fileToUploadDataUrl';

export interface ApplicationWizardProps {
  /** Invite token carried from the invitation email, if any */
  invite?: string | null;
  /** Reopened from the status page to add what was skipped */
  isEditing?: boolean;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

/**
 * The Private Cellar application — four steps, saved as they go
 *
 * Every step but the name can be skipped, and the resume point is stored, so
 * someone who closes the page comes back to where they were. Submitting sends
 * an invited member straight into their cellar and anyone else to the status
 * page while the team reviews.
 */
const ApplicationWizard = ({ invite, isEditing = false }: ApplicationWizardProps) => {
  const api = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryOptions = api.onboarding.application.get.queryOptions();

  const { data, isLoading, error } = useQuery(queryOptions);
  const [step, setStep] = useState<ApplicationStepKey | null>(null);
  const [uploadingSide, setUploadingSide] = useState<IdSide | null>(null);
  const hasClaimed = useRef(false);

  type View = Awaited<ReturnType<typeof saveStep.mutateAsync>>;
  const applyView = (view: View) =>
    queryClient.setQueryData(queryOptions.queryKey, (current) =>
      current ? { ...current, ...view } : current,
    );

  const claim = useMutation(
    api.onboarding.application.claimInvite.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryOptions.queryKey }),
      onError: (claimError) => toast.error(claimError.message),
    }),
  );
  const { mutate: claimInvite } = claim;
  const saveStep = useMutation(api.onboarding.application.saveStep.mutationOptions());
  const upload = useMutation(api.onboarding.application.uploadIdentity.mutationOptions());
  const submit = useMutation(api.onboarding.application.submit.mutationOptions());

  useEffect(() => {
    if (invite && !hasClaimed.current) {
      hasClaimed.current = true;
      claimInvite({ token: invite });
    }
  }, [invite, claimInvite]);

  // Where to start: the stored resume point, or on to status / the cellar
  useEffect(() => {
    if (!data || step) return;
    const { application } = data;

    if (application.status === 'approved' && data.isApproved && application.termsAcceptedAt) {
      router.replace('/platform/cellar');
      return;
    }
    if (application.status === 'declined' || (application.status === 'submitted' && !isEditing)) {
      router.replace('/join/status');
      return;
    }
    if (isEditing) {
      setStep(data.missing.includes('Emirates ID') ? 'identity' : 'about');
      return;
    }
    setStep(application.step as ApplicationStepKey);
  }, [data, step, router, isEditing]);

  if (error) {
    return (
      <p className="text-text-danger rounded-2xl border p-6 text-sm">{errorMessage(error)}</p>
    );
  }

  if (isLoading || !data || !step || claim.isPending) {
    return (
      <div className="text-text-muted flex justify-center py-24">
        <IconLoader2 className="animate-spin" />
      </div>
    );
  }

  const { application, intakes, documentTypes, terms } = data;

  const move = async (next: ApplicationStepKey) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // The resume point only — failing to store it should not hold them up
    await saveStep.mutateAsync({ step: 'move', next }).then(applyView, () => undefined);
  };

  const save = async (input: Parameters<typeof saveStep.mutateAsync>[0], next: ApplicationStepKey) => {
    try {
      applyView(await saveStep.mutateAsync(input));
      setStep(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (saveError) {
      toast.error(errorMessage(saveError));
    }
  };

  const uploadSide = async (side: IdSide, file: File) => {
    setUploadingSide(side);
    try {
      const { dataUrl, filename } = await fileToUploadDataUrl(file);
      applyView(await upload.mutateAsync({ documentType: side, file: dataUrl, filename }));
      return dataUrl.startsWith('data:image/') ? dataUrl : null;
    } catch (uploadError) {
      toast.error(errorMessage(uploadError));
      return null;
    } finally {
      setUploadingSide(null);
    }
  };

  const submitApplication = async () => {
    try {
      await submit.mutateAsync({ acceptTerms: true });
      await queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
      if (data.isApproved) {
        toast.success('Welcome to your Private Cellar');
        router.push('/platform/cellar');
      } else {
        router.push('/join/status');
      }
    } catch (submitError) {
      toast.error(errorMessage(submitError));
    }
  };

  const greetingName = (application.fullName ?? data.invite?.name ?? '').split(' ')[0];

  return (
    <div className="space-y-6">
      {step === 'about' && greetingName && data.invite && (
        <p className="text-text-muted text-center text-sm">
          {data.invite.inviterName
            ? `Welcome, ${greetingName}. ${data.invite.inviterName.split(' ')[0]} has prepared your cellar account.`
            : `Welcome, ${greetingName}.`}
        </p>
      )}

      <ApplicationProgress current={step} onJump={(target) => void move(target)} />

      {step === 'about' && (
        <StepAbout
          initial={{
            fullName: application.fullName ?? data.invite?.name ?? '',
            phone: application.phone ?? '',
            deliveryAddress: application.deliveryAddress ?? '',
          }}
          isBusy={saveStep.isPending}
          onSave={(values) => void save({ step: 'about', next: 'identity', ...values }, 'identity')}
        />
      )}

      {step === 'identity' && (
        <StepIdentity
          initial={{ eidNumber: application.eidNumber ?? '', eidExpiry: application.eidExpiry ?? '' }}
          uploaded={documentTypes}
          uploadingSide={uploadingSide}
          isBusy={saveStep.isPending}
          onUpload={uploadSide}
          onSave={(values) =>
            void save(
              {
                step: 'identity',
                next: 'wine',
                eidNumber: values.eidNumber,
                eidExpiry: values.eidExpiry || undefined,
              },
              'wine',
            )
          }
          onSkip={() => void move('wine')}
          onBack={() => void move('about')}
        />
      )}

      {step === 'wine' && (
        <StepWine
          initial={intakes.map(
            (intake): WineSourceAnswer => ({
              source: intake.source as WineSourceAnswer['source'],
              holderName: intake.holderName ?? '',
              holderAccountRef: intake.holderAccountRef ?? '',
              approxCases: intake.approxCases?.toString() ?? '',
              note: intake.note ?? '',
              tastes: intake.tastes ?? '',
            }),
          )}
          isBusy={saveStep.isPending}
          onSave={(answers) =>
            void save(
              {
                step: 'wine',
                next: 'membership',
                sources: answers.map((answer) => ({
                  source: answer.source,
                  holderName: answer.holderName,
                  holderAccountRef: answer.holderAccountRef,
                  approxCases: answer.approxCases ? Number(answer.approxCases) : undefined,
                  note: answer.note,
                  tastes: answer.tastes,
                })),
              },
              'membership',
            )
          }
          onSkip={() => void move('membership')}
          onBack={() => void move('identity')}
        />
      )}

      {step === 'membership' && (
        <StepMembership
          terms={terms}
          hasAccepted={Boolean(application.termsAcceptedAt)}
          isBusy={submit.isPending}
          onSubmit={() => void submitApplication()}
          onBack={() => void move('wine')}
        />
      )}

      <p className="text-text-muted text-center text-xs">
        Signed in as {data.email}. Your answers are saved as you go.
      </p>
    </div>
  );
};

export default ApplicationWizard;
