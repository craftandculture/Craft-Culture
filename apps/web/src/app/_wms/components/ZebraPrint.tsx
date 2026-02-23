'use client';

import { IconPrinter, IconSettings } from '@tabler/icons-react';
import { useState } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

import PrinterSettings from './PrinterSettings';
import { usePrinterContext } from '../providers/PrinterProvider';

/**
 * ZebraPrint — Multi-printer status display for WMS pages.
 *
 * Shows a compact summary of configured printers (online count)
 * with a gear icon to open the PrinterSettings modal.
 *
 * Print routing is handled by the usePrint hook, not this component.
 */
const ZebraPrint = () => {
  const { printers, printerStatus } = usePrinterContext();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const enabledPrinters = printers.filter((p) => p.enabled);
  const onlineCount = enabledPrinters.filter((p) => printerStatus[p.id]).length;
  const totalCount = enabledPrinters.length;

  // No printers configured
  if (totalCount === 0) {
    return (
      <>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border-primary bg-fill-secondary px-3 py-2"
        >
          <Icon icon={IconPrinter} size="md" className="text-text-muted" />
          <div className="flex flex-col">
            <Typography variant="bodyXs" className="font-medium">
              No Printers
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Tap to configure
            </Typography>
          </div>
        </button>
        <PrinterSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </>
    );
  }

  const allOnline = onlineCount === totalCount;
  const someOnline = onlineCount > 0;

  return (
    <>
      <button
        onClick={() => setSettingsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border-primary bg-fill-secondary px-3 py-2"
      >
        <Icon
          icon={IconPrinter}
          size="md"
          className={allOnline ? 'text-emerald-500' : someOnline ? 'text-amber-500' : 'text-red-500'}
        />
        <div className="flex flex-col text-left">
          <Typography variant="bodyXs" className="font-medium">
            {onlineCount}/{totalCount} Online
          </Typography>
          <div className="flex gap-1">
            {enabledPrinters.map((p) => (
              <div
                key={p.id}
                className={`h-1.5 w-1.5 rounded-full ${
                  printerStatus[p.id] ? 'bg-emerald-500' : 'bg-red-400'
                }`}
                title={`${p.name} (${p.labelSize === '4x2' ? '4"x2"' : '4"x6"'}) — ${printerStatus[p.id] ? 'Online' : 'Offline'}`}
              />
            ))}
          </div>
        </div>
        <Icon icon={IconSettings} size="sm" className="text-text-muted" />
      </button>
      <PrinterSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};

export default ZebraPrint;

/**
 * Legacy hook for backward compatibility.
 * Prefer usePrint() from hooks/usePrint.ts for new code.
 */
export const useZebraPrint = () => {
  if (typeof window === 'undefined') {
    return { print: async () => false, isConnected: () => false };
  }
  const zebraPrint = (
    window as unknown as {
      zebraPrint?: { print: (zpl: string) => Promise<boolean>; isConnected: () => boolean };
    }
  ).zebraPrint;
  return {
    print: zebraPrint?.print ?? (async () => false),
    isConnected: zebraPrint?.isConnected ?? (() => false),
  };
};
