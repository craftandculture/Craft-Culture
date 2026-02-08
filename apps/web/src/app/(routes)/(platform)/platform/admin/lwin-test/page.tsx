'use client';

import { useState } from 'react';

import LwinLookup from '@/app/_lwin/components/LwinLookup';
import type { LwinLookupResult } from '@/app/_lwin/components/LwinLookup';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';

/**
 * Test page for LWIN Lookup component
 */
const LwinTestPage = () => {
  const [selectedResult, setSelectedResult] = useState<LwinLookupResult | null>(null);

  const handleSelect = (result: LwinLookupResult) => {
    setSelectedResult(result);
    console.log('Selected LWIN:', result);
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Typography variant="headingLg" className="mb-6">
        LWIN Lookup Test
      </Typography>

      <Card>
        <CardContent className="p-6">
          <LwinLookup
            onSelect={handleSelect}
            defaultCaseSize={6}
            defaultBottleSize={750}
          />
        </CardContent>
      </Card>

      {selectedResult && (
        <Card className="mt-6 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
          <CardContent className="p-6">
            <Typography variant="headingSm" className="mb-4 text-emerald-700 dark:text-emerald-300">
              Selected Result
            </Typography>
            <div className="space-y-2 font-mono text-sm">
              <div><strong>LWIN18:</strong> {selectedResult.lwin18}</div>
              <div><strong>Compact SKU:</strong> {selectedResult.compact}</div>
              <div><strong>Display Name:</strong> {selectedResult.displayName}</div>
              <div><strong>LWIN7:</strong> {selectedResult.lwin7}</div>
              <div><strong>Vintage:</strong> {selectedResult.vintage ?? 'NV'}</div>
              <div><strong>Case Size:</strong> {selectedResult.caseSize}</div>
              <div><strong>Bottle Size:</strong> {selectedResult.bottleSizeMl}ml</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LwinTestPage;
