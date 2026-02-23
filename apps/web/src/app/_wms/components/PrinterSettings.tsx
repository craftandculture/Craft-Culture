'use client';

import { IconPlus, IconPrinter, IconTrash, IconWifi, IconWifiOff } from '@tabler/icons-react';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';

import type { LabelSize } from '../providers/PrinterProvider';
import { usePrinterContext } from '../providers/PrinterProvider';

export interface PrinterSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal for managing WMS printer configurations.
 * Add, edit, and remove printers with label size assignments.
 */
const PrinterSettings = ({ open, onOpenChange }: PrinterSettingsProps) => {
  const { printers, printerStatus, addPrinter, removePrinter, updatePrinter } =
    usePrinterContext();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIp, setNewIp] = useState('');
  const [newLabelSize, setNewLabelSize] = useState<LabelSize>('4x2');

  const handleAdd = () => {
    if (!newName.trim() || !newIp.trim()) return;

    addPrinter({
      name: newName.trim(),
      ip: newIp.trim(),
      labelSize: newLabelSize,
      enabled: true,
    });

    setNewName('');
    setNewIp('');
    setNewLabelSize('4x2');
    setShowAddForm(false);
  };

  const handleRemove = (id: string) => {
    removePrinter(id);
  };

  const handleToggle = (id: string, enabled: boolean) => {
    updatePrinter(id, { enabled: !enabled });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Printer Settings</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {printers.length === 0 && !showAddForm && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Icon icon={IconPrinter} size="lg" className="text-text-muted" />
              <Typography variant="bodySm" colorRole="muted">
                No printers configured
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Add a printer to start printing labels
              </Typography>
            </div>
          )}

          {/* Printer list */}
          {printers.map((printer) => {
            const isOnline = printerStatus[printer.id] ?? false;

            return (
              <div
                key={printer.id}
                className="flex items-center gap-3 rounded-lg border border-border-primary bg-fill-secondary px-3 py-2.5"
              >
                {/* Status dot */}
                <div
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    !printer.enabled
                      ? 'bg-gray-400'
                      : isOnline
                        ? 'bg-emerald-500'
                        : 'bg-red-500'
                  }`}
                />

                {/* Printer info */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <Typography variant="bodySm" className="font-medium">
                    {printer.name}
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    {printer.ip} &middot; {printer.labelSize === '4x2' ? '4" x 2"' : '4" x 6"'}
                  </Typography>
                </div>

                {/* Online/offline icon */}
                <Icon
                  icon={isOnline && printer.enabled ? IconWifi : IconWifiOff}
                  size="sm"
                  className={
                    !printer.enabled
                      ? 'text-gray-400'
                      : isOnline
                        ? 'text-emerald-500'
                        : 'text-red-400'
                  }
                />

                {/* Toggle enabled */}
                <button
                  onClick={() => handleToggle(printer.id, printer.enabled)}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    printer.enabled
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {printer.enabled ? 'On' : 'Off'}
                </button>

                {/* Remove */}
                <button
                  onClick={() => handleRemove(printer.id)}
                  className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Icon icon={IconTrash} size="sm" />
                </button>
              </div>
            );
          })}

          {/* Add printer form */}
          {showAddForm && (
            <div className="space-y-3 rounded-lg border border-border-primary bg-fill-secondary p-3">
              <Typography variant="bodySm" className="font-medium">
                Add Printer
              </Typography>

              <div className="space-y-2">
                <Input
                  placeholder="Printer name (e.g. ZT231 Main)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <Input
                  placeholder="IP address (e.g. 192.168.1.100)"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                />
                <Select value={newLabelSize} onValueChange={(v) => setNewLabelSize(v as LabelSize)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4x2">4&quot; x 2&quot; (case / location labels)</SelectItem>
                    <SelectItem value="4x6">4&quot; x 6&quot; (bay totems / pallet labels)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleAdd}>
                  <ButtonContent>Add</ButtonContent>
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>
                  <ButtonContent>Cancel</ButtonContent>
                </Button>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {!showAddForm && (
            <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
              <ButtonContent iconLeft={IconPlus}>Add Printer</ButtonContent>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrinterSettings;
