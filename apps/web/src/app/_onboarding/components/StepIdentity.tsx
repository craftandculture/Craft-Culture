'use client';

import { IconLock } from '@tabler/icons-react';
import { useState } from 'react';

import FieldLabel from './FieldLabel';
import IdSideCapture from './IdSideCapture';
import StepFrame from './StepFrame';
import fieldClass from '../constants/fieldClass';

export interface StepIdentityValues {
  eidNumber: string;
  eidExpiry: string;
}

export type IdSide = 'emirates_id_front' | 'emirates_id_back';

export interface StepIdentityProps {
  initial: StepIdentityValues;
  uploaded: string[];
  uploadingSide: IdSide | null;
  isBusy: boolean;
  onUpload: (side: IdSide, file: File) => Promise<string | null>;
  onSave: (values: StepIdentityValues) => void;
  onSkip: () => void;
  onBack: () => void;
}

/**
 * Step two: the Emirates ID
 *
 * Optional at this point — nobody is held up joining for want of a photo.
 * It is asked for again, in place, the first time they act on their cellar.
 */
const StepIdentity = ({ initial, uploaded, uploadingSide, isBusy, onUpload, onSave, onSkip, onBack }: StepIdentityProps) => {
  const [values, setValues] = useState(initial);
  const [previews, setPreviews] = useState<Partial<Record<IdSide, string>>>({});

  const upload = async (side: IdSide, file: File) => {
    const preview = await onUpload(side, file);
    if (preview) setPreviews((current) => ({ ...current, [side]: preview }));
  };

  // With nothing entered, "Continue" read as if it would fail validation
  const hasAnything =
    values.eidNumber.trim() !== '' ||
    values.eidExpiry !== '' ||
    uploaded.length > 0 ||
    Object.keys(previews).length > 0;

  return (
    <StepFrame
      title="Verification"
      titleNote="Optional for now"
      intro="To keep your collection in bonded storage, we need to verify the identity of the cellar owner. You can complete this now or when you first use your cellar."
      continueLabel={hasAnything ? 'Continue' : 'Continue without verification'}
      onContinue={() => onSave(values)}
      onSkip={onSkip}
      onBack={onBack}
      isBusy={isBusy}
    >
      <p className="text-text-primary text-sm leading-6">
        Verification is needed before your first purchase, release or transfer of wine into your cellar.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label="Emirates ID number">
          <input
            className={`${fieldClass} h-12 tracking-wide`}
            inputMode="numeric"
            value={values.eidNumber}
            onChange={(event) => setValues((current) => ({ ...current, eidNumber: event.target.value }))}
            placeholder="784-0000-0000000-0"
          />
        </FieldLabel>
        <FieldLabel label="Expiry date">
          <input
            type="date"
            className={`${fieldClass} h-12`}
            value={values.eidExpiry}
            onChange={(event) => setValues((current) => ({ ...current, eidExpiry: event.target.value }))}
          />
        </FieldLabel>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <IdSideCapture
          label="Front"
          isUploaded={uploaded.includes('emirates_id_front')}
          isUploading={uploadingSide === 'emirates_id_front'}
          previewUrl={previews.emirates_id_front}
          onFile={(file) => void upload('emirates_id_front', file)}
        />
        <IdSideCapture
          label="Back"
          isUploaded={uploaded.includes('emirates_id_back')}
          isUploading={uploadingSide === 'emirates_id_back'}
          previewUrl={previews.emirates_id_back}
          onFile={(file) => void upload('emirates_id_back', file)}
        />
      </div>

      <p className="text-text-muted flex items-start gap-2 text-xs leading-5">
        <IconLock size={14} className="mt-0.5 shrink-0" />
        Your documents are encrypted and accessible only to you and authorised C&amp;C personnel.
      </p>
    </StepFrame>
  );
};

export default StepIdentity;
