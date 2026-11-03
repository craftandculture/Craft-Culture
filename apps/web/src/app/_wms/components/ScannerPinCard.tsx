'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import setScannerPin from '@/app/_wms/actions/setScannerPin';

/**
 * Set the six-digit PIN warehouse scanners sign in with
 *
 * @param props.isSet - Whether a PIN has been set already
 */
const ScannerPinCard = ({ isSet }: { isSet: boolean }) => {
  const [pin, setPin] = useState('');
  const [saved, setSaved] = useState(isSet);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await setScannerPin(pin);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    setSaved(true);
    setPin('');
    toast.success('Scanner PIN saved');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Typography variant="headingSm">Warehouse scanner PIN</Typography>
        <Typography variant="bodySm" colorRole="muted">
          Scanners sign in at wine.craftculture.xyz/warehouse with this PIN, as the Warehouse login, and then stay
          signed in. {saved ? 'A PIN is set. Enter a new one to change it.' : 'No PIN is set, so scanners cannot sign in yet.'}
        </Typography>
      </div>
      <div className="flex gap-3">
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={6}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Six digits"
          aria-label="New scanner PIN"
          className="max-w-40"
        />
        <Button type="button" onClick={save} isDisabled={busy || pin.length !== 6}>
          <ButtonContent isLoading={busy}>Save PIN</ButtonContent>
        </Button>
      </div>
    </div>
  );
};

export default ScannerPinCard;
