'use client';

import {
  IconPencil,
  IconPlus,
  IconPrinter,
  IconPrinterOff,
  IconTrash,
  IconWifi,
  IconWifiOff,
} from '@tabler/icons-react';
import { useCallback, useRef, useState } from 'react';

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
import generateTestLabelZpl from '../utils/generateTestLabelZpl';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formIp, setFormIp] = useState('');
  const [formPort, setFormPort] = useState('');
  const [formLabelSize, setFormLabelSize] = useState<LabelSize>('4x2');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, 'sent' | 'error'>>({});
  const testTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleTestPrint = useCallback(async (printer: (typeof printers)[number]) => {
    setTestingId(printer.id);
    setTestResult((prev) => {
      const next = { ...prev };
      delete next[printer.id];
      return next;
    });

    const zpl = generateTestLabelZpl(printer.name, printer.ip, printer.labelSize);
    const url = printer.port
      ? `http://${printer.ip}:${printer.port}/`
      : `http://${printer.ip}/pstprnt`;

    let sent = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: zpl,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      sent = true;
    } catch (err) {
      // Port 9100 printers (ZT series) accept the ZPL data over raw TCP but
      // return a non-HTTP response, causing the browser to throw after the data
      // is already sent. Only treat AbortError (timeout) as unreachable.
      if (printer.port && err instanceof DOMException && err.name !== 'AbortError') {
        sent = true;
      }
    }

    setTestingId(null);
    setTestResult((prev) => ({ ...prev, [printer.id]: sent ? 'sent' : 'error' }));

    // Clear previous timer for this printer if any
    if (testTimers.current[printer.id]) clearTimeout(testTimers.current[printer.id]);
    testTimers.current[printer.id] = setTimeout(() => {
      setTestResult((prev) => {
        const next = { ...prev };
        delete next[printer.id];
        return next;
      });
    }, 3000);
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormIp('');
    setFormPort('');
    setFormLabelSize('4x2');
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleAdd = () => {
    if (!formName.trim() || !formIp.trim()) return;

    addPrinter({
      name: formName.trim(),
      ip: formIp.trim(),
      port: formPort ? parseInt(formPort, 10) : undefined,
      labelSize: formLabelSize,
      enabled: true,
    });

    resetForm();
  };

  const handleEdit = (id: string) => {
    const printer = printers.find((p) => p.id === id);
    if (!printer) return;

    setEditingId(id);
    setFormName(printer.name);
    setFormIp(printer.ip);
    setFormPort(printer.port ? String(printer.port) : '');
    setFormLabelSize(printer.labelSize);
    setShowAddForm(false);
  };

  const handleSave = () => {
    if (!editingId || !formName.trim() || !formIp.trim()) return;

    updatePrinter(editingId, {
      name: formName.trim(),
      ip: formIp.trim(),
      port: formPort ? parseInt(formPort, 10) : undefined,
      labelSize: formLabelSize,
    });

    resetForm();
  };

  const handleRemove = (id: string) => {
    removePrinter(id);
    if (editingId === id) resetForm();
  };

  const handleToggle = (id: string, enabled: boolean) => {
    updatePrinter(id, { enabled: !enabled });
  };

  const isFormOpen = showAddForm || editingId !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Printer Settings</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {printers.length === 0 && !isFormOpen && (
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
                    {printer.ip}{printer.port ? `:${printer.port}` : ''} &middot;{' '}
                    {printer.labelSize === '4x2' ? '4" x 2"' : '4" x 6"'}
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

                {/* Test print */}
                <button
                  onClick={() => handleTestPrint(printer)}
                  disabled={testingId === printer.id}
                  className={`rounded p-1 ${
                    testResult[printer.id] === 'sent'
                      ? 'text-emerald-600'
                      : testResult[printer.id] === 'error'
                        ? 'text-red-500'
                        : 'text-text-muted hover:bg-fill-tertiary hover:text-text-primary'
                  }`}
                  title={testResult[printer.id] === 'sent' ? 'Sent' : testResult[printer.id] === 'error' ? 'Unreachable' : 'Test print'}
                >
                  {testingId === printer.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : testResult[printer.id] === 'error' ? (
                    <Icon icon={IconPrinterOff} size="sm" />
                  ) : (
                    <Icon icon={IconPrinter} size="sm" />
                  )}
                </button>

                {/* Edit */}
                <button
                  onClick={() => handleEdit(printer.id)}
                  className="rounded p-1 text-text-muted hover:bg-fill-tertiary hover:text-text-primary"
                >
                  <Icon icon={IconPencil} size="sm" />
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

          {/* Add / Edit printer form */}
          {isFormOpen && (
            <div className="space-y-3 rounded-lg border border-border-primary bg-fill-secondary p-3">
              <Typography variant="bodySm" className="font-medium">
                {editingId ? 'Edit Printer' : 'Add Printer'}
              </Typography>

              <div className="space-y-2">
                <Input
                  placeholder="Printer name (e.g. ZT231 Case)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
                <Input
                  placeholder="IP address (e.g. 192.168.1.100)"
                  value={formIp}
                  onChange={(e) => setFormIp(e.target.value)}
                />
                <Input
                  placeholder="Port (default: 80, use 9100 for ZT series)"
                  value={formPort}
                  onChange={(e) => setFormPort(e.target.value)}
                />
                <Select value={formLabelSize} onValueChange={(v) => setFormLabelSize(v as LabelSize)}>
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
                <Button variant="primary" size="sm" onClick={editingId ? handleSave : handleAdd}>
                  <ButtonContent>{editingId ? 'Save' : 'Add'}</ButtonContent>
                </Button>
                <Button variant="secondary" size="sm" onClick={resetForm}>
                  <ButtonContent>Cancel</ButtonContent>
                </Button>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {!isFormOpen && (
            <Button variant="secondary" size="sm" onClick={() => { resetForm(); setShowAddForm(true); }}>
              <ButtonContent iconLeft={IconPlus}>Add Printer</ButtonContent>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrinterSettings;
