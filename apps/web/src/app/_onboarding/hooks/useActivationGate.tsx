'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';

import ActivationSheet, { type ActivationAction } from '../components/ActivationSheet';

/**
 * Catch "not activated" from a member action and open the activation sheet
 *
 * @example
 *   const { catchActivation, activationSheet } = useActivationGate();
 *   onError: (error) => catchActivation(error, 'release') || toast.error(error.message)
 *
 * @returns A handler that opens the sheet when it applies (true) and the sheet to render
 */
const useActivationGate = () => {
  const pathname = usePathname();
  const [action, setAction] = useState<ActivationAction | null>(null);

  const catchActivation = (error: { message: string }, forAction: ActivationAction) => {
    if (!error.message.startsWith('NOT_ACTIVATED')) return false;
    setAction(forAction);
    return true;
  };

  const activationSheet = action ? (
    <ActivationSheet action={action} returnTo={pathname || '/platform/cellar'} onClose={() => setAction(null)} />
  ) : null;

  return { catchActivation, activationSheet };
};

export default useActivationGate;
