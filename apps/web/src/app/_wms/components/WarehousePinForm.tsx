'use client';

import { IconArrowRight } from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';

import getNextPath from '@/app/_shared/utils/getNextPath';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Warehouse scanner sign-in: the six-digit warehouse PIN, nothing else
 *
 * Signs the scanner in as the shared warehouse login, so picks and moves are
 * recorded as Warehouse. The scanner then stays signed in and signs itself
 * back in when its session ends; this page is only for a new scanner or one
 * whose browser data was cleared.
 */
const WarehousePinForm = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/warehouse/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (response.ok) {
        const next = getNextPath();
        window.location.href = next?.startsWith('/platform/') || next?.startsWith('/wms/') ? next : '/platform/admin/wms';
        return;
      }
      setError(
        response.status === 429
          ? 'Too many tries. Wait 15 minutes and try again.'
          : response.status === 404
            ? 'The warehouse login is missing. Ask Kevin.'
            : 'That PIN is not right.',
      );
      setPin('');
    } catch {
      setError('Could not reach the Index. Check the scanner is online.');
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Typography variant="headingMd">Warehouse sign-in</Typography>
        <Typography variant="bodySm" colorRole="muted">
          Enter the six-digit warehouse PIN.
        </Typography>
      </div>
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        autoFocus
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="••••••"
        className="text-center text-2xl tracking-[0.5em]"
        aria-label="Warehouse PIN"
      />
      {error && (
        <Typography variant="bodySm" className="text-red-600">
          {error}
        </Typography>
      )}
      <Button
        type="submit"
        size="lg"
        className="border-text-primary bg-text-primary text-surface-primary hover:bg-text-primary/90"
        isDisabled={busy || pin.length !== 6}
      >
        <ButtonContent iconRight={IconArrowRight} isLoading={busy}>
          Sign in
        </ButtonContent>
      </Button>
      <a href="/sign-in" className="text-text-muted text-center text-xs hover:underline">
        Staff sign-in by email
      </a>
    </form>
  );
};

export default WarehousePinForm;
