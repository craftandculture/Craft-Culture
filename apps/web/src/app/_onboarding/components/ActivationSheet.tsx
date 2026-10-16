'use client';

import { IconCheck, IconLock, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import useTRPC from '@/lib/trpc/browser';

import ContactLinks from './ContactLinks';
import FieldLabel from './FieldLabel';
import IdSideCapture from './IdSideCapture';
import fieldClass from '../constants/fieldClass';
import { PRIVATE_CELLAR_TERMS_PATH } from '../constants/privateCellarTerms';
import fileToUploadDataUrl from '../utils/fileToUploadDataUrl';

export type ActivationAction = 'purchase' | 'release' | 'offer_for_sale' | 'transfer_in' | 'other';

export interface ActivationSheetProps {
  action: ActivationAction;
  /** The cellar page to come back to after Zoho's payment page */
  returnTo: string;
  onClose: () => void;
}

type Side = 'emirates_id_front' | 'emirates_id_back';

/**
 * What they can carry on with once the membership starts
 *
 * The sheet does not repeat the action for them, so it must not promise that
 * the action has happened — only that they can now do it.
 */
const ACTION_NEXT: Record<ActivationAction, string> = {
  purchase: 'complete your purchase',
  release: 'send your delivery request',
  offer_for_sale: 'offer your wine for sale',
  transfer_in: 'tell us about your transfer',
  other: 'carry on',
};

const aed = (value: number) => `AED ${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;

/**
 * "Activate your cellar" — shown in place the first time a member acts
 *
 * Two steps, each only if needed: the Emirates ID, then the membership —
 * started at once when billed by invoice, or on Zoho's card page when billed
 * by card. The monthly membership starts at that point.
 */
const ActivationSheet = ({ action, returnTo, onClose }: ActivationSheetProps) => {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const activationQuery = api.onboarding.member.activation.queryOptions();
  const { data } = useQuery(activationQuery);

  const [eid, setEid] = useState({ eidNumber: '', eidExpiry: '' });
  const [uploading, setUploading] = useState<Side | null>(null);
  const [justUploaded, setUploaded] = useState<Side[]>([]);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [hadIdentityStep, setHadIdentityStep] = useState(false);

  const saveStep = useMutation(api.onboarding.application.saveStep.mutationOptions());
  const upload = useMutation(api.onboarding.application.uploadIdentity.mutationOptions());
  const start = useMutation(api.onboarding.member.startActivation.mutationOptions());

  if (!data) return null;

  /*
    A paused membership is the team's decision, usually about an invoice. The
    member cannot restart it here, so showing the price and a button that then
    refuses would be a dead end that also puts the fee in front of them.
  */
  if (data.status === 'past_due' || data.status === 'cancelled') {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog">
        <div className="bg-surface-primary w-full max-w-lg space-y-4 rounded-t-2xl p-6 shadow-xl sm:rounded-2xl">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-text-primary text-xl font-semibold tracking-tight">
              Your private cellar is paused
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted">
              <IconX size={20} />
            </button>
          </div>
          <p className="text-text-muted text-sm leading-6">
            Your wine remains safely stored and you can view your collection at any time. New purchases, deliveries
            and sales are on hold for now. Please get in touch and we will arrange the next step with you.
          </p>
          <ContactLinks />
          <button
            type="button"
            onClick={onClose}
            className="bg-text-primary text-surface-primary h-11 w-full rounded-lg text-sm font-semibold"
          >
            Back to my cellar
          </button>
        </div>
      </div>
    );
  }

  const needsIdentity = data.missing.includes('identity');
  const uploaded = [
    ...justUploaded,
    ...data.documentTypes.filter((type): type is Side => type === 'emirates_id_front' || type === 'emirates_id_back'),
  ];
  const eidNumber = eid.eidNumber || data.eidNumber || '';
  const refresh = () => queryClient.invalidateQueries({ queryKey: activationQuery.queryKey });

  const uploadSide = async (side: Side, file: File) => {
    setUploading(side);
    try {
      const { dataUrl, filename } = await fileToUploadDataUrl(file);
      const view = await upload.mutateAsync({ documentType: side, file: dataUrl, filename });
      setUploaded(view.documentTypes.filter((type): type is Side => type.startsWith('emirates_id')));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload');
    } finally {
      setUploading(null);
    }
  };

  const saveIdentity = async () => {
    try {
      setHadIdentityStep(true);
      await saveStep.mutateAsync({
        step: 'identity',
        next: 'membership',
        eidNumber,
        eidExpiry: eid.eidExpiry || undefined,
      });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save');
    }
  };

  const addCard = async () => {
    try {
      const result = await start.mutateAsync({ action, returnTo, acceptTerms: data.hasAcceptedTerms || hasAccepted });
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      toast.success(`Your cellar is active. You can now ${ACTION_NEXT[action]}.`);
      await refresh();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start your membership');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog">
      <div className="bg-surface-primary max-h-[92vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-2xl p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">
              {needsIdentity ? 'Step 1 of 2 · Your Emirates ID' : hadIdentityStep ? 'Step 2 of 2 · Membership' : 'Membership'}
            </p>
            <h2 className="text-text-primary mt-1 text-xl font-semibold tracking-tight">
              {needsIdentity ? 'Verify your identity' : 'Start your membership'}
            </h2>
            <p className="text-text-muted mt-1 text-sm leading-6">
              {needsIdentity
                ? 'We are required to verify every member before wine moves into or out of our bonded warehouse. You only do this once.'
                : `Once confirmed, you can ${ACTION_NEXT[action]} straight away.`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted">
            <IconX size={20} />
          </button>
        </div>

        {needsIdentity ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLabel label="Emirates ID number">
                <input
                  className={`${fieldClass} h-11`}
                  inputMode="numeric"
                  value={eidNumber}
                  onChange={(event) => setEid((current) => ({ ...current, eidNumber: event.target.value }))}
                  placeholder="784-0000-0000000-0"
                />
              </FieldLabel>
              <FieldLabel label="Expiry date">
                <input
                  type="date"
                  className={`${fieldClass} h-11`}
                  value={eid.eidExpiry}
                  onChange={(event) => setEid((current) => ({ ...current, eidExpiry: event.target.value }))}
                />
              </FieldLabel>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['emirates_id_front', 'emirates_id_back'] as const).map((side) => (
                <IdSideCapture
                  key={side}
                  label={side === 'emirates_id_front' ? 'Front' : 'Back'}
                  isUploaded={uploaded.includes(side)}
                  isUploading={uploading === side}
                  onFile={(file) => void uploadSide(side, file)}
                />
              ))}
            </div>
            <p className="text-text-muted flex items-center gap-2 text-xs">
              <IconLock size={14} /> Your documents are encrypted and accessible only to you and authorised C&amp;C personnel.
            </p>
            <button
              type="button"
              onClick={() => void saveIdentity()}
              disabled={saveStep.isPending || !eidNumber.trim() || new Set(uploaded).size < 2}
              className="bg-text-primary text-surface-primary h-11 w-full rounded-lg text-sm font-semibold disabled:opacity-40"
            >
              {saveStep.isPending ? 'Saving…' : 'Continue'}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/70 to-transparent p-4 dark:border-slate-700 dark:from-slate-500/10">
              <p className="text-text-primary text-3xl font-bold tracking-tight tabular-nums">
                {aed(data.terms.membershipFeeAed)}
                <span className="text-text-muted text-base font-medium"> / month</span>
              </p>
              <p className="text-text-muted mt-1 text-sm">
                Includes storage for {data.terms.includedCases * 12} bottles ({data.terms.includedCases} cases of 12)
              </p>
            </div>

            <ul className="space-y-2.5 text-sm">
              {[
                `Beyond that, ${aed(data.terms.extraCaseMonthlyAed)} a month per case of 12, or ${aed(
                  data.terms.extraCaseMonthlyAed / 2,
                )} per case of 6`,
                data.billingMode === 'invoice'
                  ? 'Invoiced monthly, payable by bank transfer. Wine you buy is invoiced separately.'
                  : 'Charged monthly to your card. Wine you buy is paid by bank transfer.',
                "No minimum term: end your membership at any time with 30 days' notice",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-600 dark:bg-emerald-500/20">
                    <IconCheck size={12} stroke={3} />
                  </span>
                  <span className="text-text-primary leading-6">{point}</span>
                </li>
              ))}
            </ul>

            {data.hasAcceptedTerms ? (
              <p className="text-text-muted text-xs leading-5">
                Under the{' '}
                <a
                  href={PRIVATE_CELLAR_TERMS_PATH}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-primary font-semibold underline underline-offset-2"
                >
                  Private Cellar Terms
                </a>{' '}
                you agreed when you opened your cellar, your membership and storage charges start today and
                continue until your membership ends. Prices exclude VAT, which is added only where it applies.
              </p>
            ) : (
              <label className="border-border-muted flex cursor-pointer items-start gap-3 rounded-xl border p-3.5">
                <input
                  type="checkbox"
                  checked={hasAccepted}
                  onChange={(event) => setHasAccepted(event.target.checked)}
                  className="mt-0.5 size-4 flex-shrink-0 accent-current"
                />
                <span className="text-text-muted text-xs leading-5">
                  I have read and agree to the{' '}
                  <a
                    href={PRIVATE_CELLAR_TERMS_PATH}
                    target="_blank"
                    rel="noreferrer"
                    className="text-text-primary font-semibold underline underline-offset-2"
                  >
                    Private Cellar Terms
                  </a>
                  , including the monthly fee and storage charges above. Prices exclude VAT, which is added only
                  where it applies.
                </span>
              </label>
            )}

            <button
              type="button"
              onClick={() => void addCard()}
              disabled={start.isPending || (!data.hasAcceptedTerms && !hasAccepted)}
              className="bg-text-primary text-surface-primary h-12 w-full rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
            >
              {start.isPending
                ? data.billingMode === 'invoice'
                  ? 'Starting…'
                  : 'Opening…'
                : data.billingMode === 'invoice'
                  ? 'Confirm and start membership'
                  : 'Add card and start membership'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivationSheet;
