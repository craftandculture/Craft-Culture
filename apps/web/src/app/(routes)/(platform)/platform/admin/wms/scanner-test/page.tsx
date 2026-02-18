'use client';

import {
  IconArrowLeft,
  IconBarcode,
  IconCheck,
  IconMapPin,
  IconPackage,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

interface ScanRecord {
  id: string;
  barcode: string;
  type: 'case' | 'location' | 'unknown';
  timestamp: Date;
  isValid: boolean;
}

/**
 * Validates a barcode and determines its type
 */
const validateBarcode = (barcode: string): { type: ScanRecord['type']; isValid: boolean } => {
  const trimmed = barcode.trim().toUpperCase();

  // Case barcode format: CASE-{LWIN18}-{SEQ} e.g., CASE-1010279-20180600750-001
  if (trimmed.startsWith('CASE-')) {
    const parts = trimmed.split('-');
    // Should have at least CASE + LWIN + SEQ
    return { type: 'case', isValid: parts.length >= 3 };
  }

  // Location barcode format: LOC-{AISLE}-{BAY}-{LEVEL} e.g., LOC-A-01-02
  if (trimmed.startsWith('LOC-')) {
    const parts = trimmed.split('-');
    // Should have LOC + AISLE + BAY + LEVEL
    return { type: 'location', isValid: parts.length === 4 };
  }

  return { type: 'unknown', isValid: false };
};

/**
 * Scanner Test Page
 *
 * Tests barcode scanner integration using keyboard wedge mode.
 * The scanner acts as a keyboard, typing the barcode value followed by Enter.
 */
const ScannerTestPage = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Auto-focus the input on mount and when clicking anywhere on the page
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Refocus input when clicking anywhere (unless clicking a button)
  const handlePageClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('button') && !target.closest('a')) {
      inputRef.current?.focus();
    }
  }, []);

  // Handle barcode submission (Enter key from scanner)
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    const barcode = inputValue.trim();
    if (!barcode) return;

    const { type, isValid } = validateBarcode(barcode);

    const newScan: ScanRecord = {
      id: crypto.randomUUID(),
      barcode: barcode.toUpperCase(),
      type,
      timestamp: new Date(),
      isValid,
    };

    setScanHistory((prev) => [newScan, ...prev]);
    setInputValue('');

    // Keep focus on input for next scan
    inputRef.current?.focus();
  }, [inputValue]);

  // Clear scan history
  const handleClearHistory = useCallback(() => {
    setScanHistory([]);
    inputRef.current?.focus();
  }, []);

  // Get badge color role based on scan type
  const getBadgeColorRole = (type: ScanRecord['type'], isValid: boolean) => {
    if (!isValid) return 'danger';
    switch (type) {
      case 'case':
        return 'brand';
      case 'location':
        return 'info';
      default:
        return 'muted';
    }
  };

  // Get icon based on scan type
  const getTypeIcon = (type: ScanRecord['type']) => {
    switch (type) {
      case 'case':
        return IconPackage;
      case 'location':
        return IconMapPin;
      default:
        return IconBarcode;
    }
  };

  // Stats
  const totalScans = scanHistory.length;
  const validScans = scanHistory.filter((s) => s.isValid).length;
  const caseScans = scanHistory.filter((s) => s.type === 'case').length;
  const locationScans = scanHistory.filter((s) => s.type === 'location').length;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8" onClick={handlePageClick}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/platform/admin/wms">
              <Icon icon={IconArrowLeft} size="sm" />
            </Link>
          </Button>
          <div>
            <Typography variant="headingLg" className="mb-2">
              Scanner Test
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Test barcode scanner integration with keyboard wedge mode
            </Typography>
          </div>
        </div>

        {/* Instructions Card */}
        <Card>
          <CardContent className="p-6">
            <Typography variant="headingSm" className="mb-3">
              How to Test
            </Typography>
            <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary">
              <li>Connect your Zebra scanner via USB or Bluetooth</li>
              <li>Ensure keyboard wedge mode is enabled (default on TC21/TC26)</li>
              <li>Click in the scan input field below (or anywhere on page)</li>
              <li>Scan a barcode - it will appear in the input and auto-submit</li>
              <li>Check the scan history to verify the barcode was captured correctly</li>
            </ol>
            <div className="mt-4 p-3 bg-fill-secondary rounded-lg">
              <Typography variant="bodyXs" colorRole="muted">
                <strong>No scanner?</strong> You can also type barcodes manually and press Enter to test.
                Try: <code className="bg-fill-tertiary px-1.5 py-0.5 rounded">LOC-A-01-02</code> or{' '}
                <code className="bg-fill-tertiary px-1.5 py-0.5 rounded">CASE-1010279-001</code>
              </Typography>
            </div>
          </CardContent>
        </Card>

        {/* Scan Input */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`flex-1 border-2 rounded-lg transition-colors ${
                    isInputFocused ? 'border-brand-primary' : 'border-border-muted'
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Icon icon={IconBarcode} size="lg" colorRole={isInputFocused ? 'brand' : 'muted'} />
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      placeholder="Scan barcode or type here..."
                      className="flex-1 text-lg font-mono bg-transparent border-none outline-none placeholder:text-text-muted"
                      autoComplete="off"
                      inputMode="none"
                    />
                    {inputValue && (
                      <button
                        type="button"
                        onClick={() => {
                          setInputValue('');
                          inputRef.current?.focus();
                        }}
                        className="p-1 hover:bg-fill-secondary rounded"
                      >
                        <Icon icon={IconX} size="sm" colorRole="muted" />
                      </button>
                    )}
                  </div>
                </div>
                <Button type="submit" disabled={!inputValue.trim()}>
                  <ButtonContent iconLeft={IconCheck}>Submit</ButtonContent>
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>
                  {isInputFocused ? (
                    <span className="text-brand-primary">Ready to scan</span>
                  ) : (
                    'Click to focus input'
                  )}
                </span>
                <span>Scans will auto-submit when scanner sends Enter key</span>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Stats */}
        {scanHistory.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingMd">{totalScans}</Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Total Scans
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingMd" className="text-green-600">
                  {validScans}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Valid
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingMd" className="text-blue-600">
                  {caseScans}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Cases
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingMd" className="text-purple-600">
                  {locationScans}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Locations
                </Typography>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Scan History */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Typography variant="headingSm">Scan History</Typography>
              {scanHistory.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                  <ButtonContent iconLeft={IconTrash}>Clear</ButtonContent>
                </Button>
              )}
            </div>

            {scanHistory.length === 0 ? (
              <div className="text-center py-8">
                <Icon icon={IconBarcode} size="xl" colorRole="muted" className="mx-auto mb-3" />
                <Typography variant="bodySm" colorRole="muted">
                  No scans yet. Scan a barcode to see it appear here.
                </Typography>
              </div>
            ) : (
              <div className="space-y-2">
                {scanHistory.map((scan) => (
                  <div
                    key={scan.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      scan.isValid ? 'border-border-muted bg-fill-secondary' : 'border-red-300 bg-red-50'
                    }`}
                  >
                    <Icon
                      icon={getTypeIcon(scan.type)}
                      size="md"
                      colorRole={scan.isValid ? 'primary' : 'danger'}
                    />
                    <div className="flex-1 min-w-0">
                      <Typography variant="bodySm" className="font-mono font-medium truncate">
                        {scan.barcode}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        {scan.timestamp.toLocaleTimeString()}
                      </Typography>
                    </div>
                    <Badge colorRole={getBadgeColorRole(scan.type, scan.isValid)}>
                      {scan.isValid ? scan.type : 'invalid'}
                    </Badge>
                    {scan.isValid ? (
                      <Icon icon={IconCheck} size="sm" className="text-green-600" />
                    ) : (
                      <Icon icon={IconX} size="sm" className="text-red-600" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Technical Details */}
        <Card>
          <CardContent className="p-6">
            <Typography variant="headingSm" className="mb-3">
              Expected Barcode Formats
            </Typography>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-3 bg-fill-secondary rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Icon icon={IconPackage} size="sm" />
                  <Typography variant="bodySm" className="font-medium">
                    Case Labels
                  </Typography>
                </div>
                <code className="text-xs font-mono text-text-muted">CASE-{'{LWIN}'}-{'{SEQ}'}</code>
                <div className="mt-2 text-xs text-text-muted">
                  Example: CASE-1010279-20180600750-001
                </div>
              </div>
              <div className="p-3 bg-fill-secondary rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Icon icon={IconMapPin} size="sm" />
                  <Typography variant="bodySm" className="font-medium">
                    Location Labels
                  </Typography>
                </div>
                <code className="text-xs font-mono text-text-muted">LOC-{'{AISLE}'}-{'{BAY}'}-{'{LEVEL}'}</code>
                <div className="mt-2 text-xs text-text-muted">Example: LOC-A-01-02</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ScannerTestPage;
