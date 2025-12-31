'use client';

import { IconArrowLeft, IconCheck } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

import ColumnMappingStep from './ColumnMappingStep';
import UploadStep from './UploadStep';

interface WizardStep {
  id: string;
  title: string;
  description: string;
}

const STEPS: WizardStep[] = [
  { id: 'upload', title: 'Upload', description: 'Upload supplier sheet' },
  { id: 'mapping', title: 'Map Columns', description: 'Map columns to fields' },
  { id: 'variables', title: 'Configure', description: 'Set pricing variables' },
  { id: 'preview', title: 'Preview', description: 'Review & export' },
];

/**
 * Main wizard container for pricing calculator
 *
 * Manages state across all steps and handles session creation
 */
const PricingCalculatorWizard = () => {
  const router = useRouter();
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [uploadData, setUploadData] = useState<{
    fileName: string;
    headers: string[];
    rows: Record<string, unknown>[];
  } | null>(null);
  const [_columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [sessionName, setSessionName] = useState('');

  const createSessionMutation = useMutation(api.pricingCalc.session.create.mutationOptions());

  const handleSessionCreated = (sessionId: string) => {
    void queryClient.invalidateQueries({
      queryKey: api.pricingCalc.session.getMany.queryKey(),
    });
    router.push(`/platform/admin/pricing-calculator/${sessionId}`);
  };

  const handleUploadComplete = (data: {
    fileName: string;
    headers: string[];
    rows: Record<string, unknown>[];
  }) => {
    setUploadData(data);
    setSessionName(data.fileName.replace(/\.[^/.]+$/, '')); // Remove extension for default name
    setCurrentStep(1);
  };

  const handleMappingComplete = (
    mapping: Record<string, string>,
    settings: { sourcePriceType: 'bottle' | 'case'; sourceCurrency: 'GBP' | 'EUR' | 'USD' },
  ) => {
    setColumnMapping(mapping);
    // Create the session with column mapping and redirect to detail view
    createSessionMutation.mutate(
      {
        name: sessionName || 'Untitled Session',
        sourceType: 'upload',
        sourceFileName: uploadData?.fileName,
        rawData: uploadData?.rows,
        detectedColumns: uploadData?.headers,
        columnMapping: {
          ...mapping,
          __sourcePriceType: settings.sourcePriceType,
          __sourceCurrency: settings.sourceCurrency,
        },
      },
      {
        onSuccess: (session) => {
          if (session) {
            handleSessionCreated(session.id);
          }
        },
      },
    );
  };

  const handleBack = () => {
    if (currentStep === 0) {
      router.push('/platform/admin/pricing-calculator');
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
        </Button>
        <div>
          <Typography variant="headingMd">New Pricing Session</Typography>
          <Typography variant="bodySm" colorRole="muted">
            {uploadData?.fileName || 'Upload a supplier price sheet to get started'}
          </Typography>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                index < currentStep
                  ? 'bg-green-500 text-white'
                  : index === currentStep
                    ? 'bg-fill-brand text-white'
                    : 'bg-surface-secondary text-text-muted'
              }`}
            >
              {index < currentStep ? (
                <IconCheck className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={`ml-2 hidden text-sm sm:inline ${
                index === currentStep ? 'font-medium text-text-primary' : 'text-text-muted'
              }`}
            >
              {step.title}
            </span>
            {index < STEPS.length - 1 && (
              <div
                className={`mx-3 h-px w-8 ${
                  index < currentStep ? 'bg-green-500' : 'bg-border-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {currentStep === 0 && <UploadStep onUploadComplete={handleUploadComplete} />}

          {currentStep === 1 && uploadData && (
            <ColumnMappingStep
              headers={uploadData.headers}
              sampleRows={uploadData.rows.slice(0, 5)}
              onMappingComplete={handleMappingComplete}
              isSubmitting={createSessionMutation.isPending}
            />
          )}

          {currentStep === 2 && (
            <div className="py-12 text-center">
              <Typography variant="bodySm" colorRole="muted">
                Variables configuration coming in next phase
              </Typography>
            </div>
          )}

          {currentStep === 3 && (
            <div className="py-12 text-center">
              <Typography variant="bodySm" colorRole="muted">
                Preview & export coming in next phase
              </Typography>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PricingCalculatorWizard;
