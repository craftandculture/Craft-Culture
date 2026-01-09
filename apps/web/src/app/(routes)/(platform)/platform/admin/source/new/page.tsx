'use client';

import {
  IconArrowLeft,
  IconFileSpreadsheet,
  IconMail,
  IconSparkles,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type InputType = 'excel' | 'email_text' | 'manual';

/**
 * Create new SOURCE RFQ page
 */
const NewRfqPage = () => {
  const api = useTRPC();
  const router = useRouter();

  const [step, setStep] = useState<'input' | 'review' | 'details'>('input');
  const [inputType, setInputType] = useState<InputType>('email_text');
  const [inputContent, setInputContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedItems, setParsedItems] = useState<Array<{
    productName: string;
    producer?: string;
    vintage?: string;
    region?: string;
    quantity: number;
    quantityUnit: 'cases' | 'bottles';
    confidence: number;
  }>>([]);

  // Form state
  const [rfqName, setRfqName] = useState('');
  const [description, setDescription] = useState('');
  const [distributorName, setDistributorName] = useState('');
  const [distributorEmail, setDistributorEmail] = useState('');
  const [distributorCompany, setDistributorCompany] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('');

  // Parse input mutation - defined first since createRfq uses it
  const { mutate: parseInput, isPending: isParsing } = useMutation(
    api.source.admin.parseInput.mutationOptions({
      onSuccess: (result) => {
        if (result.success && result.items && result.items.length > 0) {
          // Add default quantityUnit to each parsed item
          setParsedItems(result.items.map(item => ({
            ...item,
            quantityUnit: 'cases' as const,
          })));
          setStep('review');
        } else {
          alert(result.message || 'No wine products found in the input. Please check your data or try manual entry.');
        }
      },
      onError: (error) => {
        console.error('Parse error:', error);
        alert(`Failed to parse input: ${error.message}`);
      },
    }),
  );

  // Create RFQ mutation
  const { mutate: createRfq, isPending: isCreating } = useMutation(
    api.source.admin.create.mutationOptions({
      onSuccess: (rfq) => {
        if (inputContent && inputType !== 'manual') {
          // Parse the input
          parseInput({ rfqId: rfq.id, inputType, content: inputContent, fileName });
        } else {
          router.push(`/platform/admin/source/${rfq.id}`);
        }
      },
      onError: (error) => {
        console.error('Failed to create RFQ:', error);
        alert(`Failed to create RFQ: ${error.message}`);
      },
    }),
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      // Parse Excel file with dynamically imported xlsx library
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          // Dynamic import to ensure it works in browser
          const XLSX = await import('xlsx');
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            throw new Error('No sheets found in workbook');
          }
          const firstSheet = workbook.Sheets[firstSheetName];
          if (!firstSheet) {
            throw new Error('Sheet not found in workbook');
          }
          // Convert to CSV for easier parsing
          const csv = XLSX.utils.sheet_to_csv(firstSheet);
          setInputContent(csv);
        } catch (error) {
          console.error('Failed to parse Excel file:', error);
          alert(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Read CSV/text files as text
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setInputContent(content);
      };
      reader.readAsText(file);
    }
  };

  const handleClearFile = () => {
    setFileName('');
    setInputContent('');
    // Reset the file input
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleCreateRfq = () => {
    if (!rfqName.trim()) {
      alert('Please enter an RFQ name');
      return;
    }

    createRfq({
      name: rfqName,
      description,
      sourceType: inputType,
      sourceFileName: fileName,
      rawInputText: inputContent,
      distributorName,
      distributorEmail,
      distributorCompany,
      responseDeadline: responseDeadline ? new Date(responseDeadline) : undefined,
    });
  };

  const handleProceedToDetails = () => {
    if (!inputContent.trim() && inputType !== 'manual') {
      alert('Please enter some content to parse');
      return;
    }
    setStep('details');
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/platform/admin/source">
            <Button variant="ghost" size="sm">
              <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
            </Button>
          </Link>
          <div>
            <Typography variant="headingLg">Create New RFQ</Typography>
            <Typography variant="bodySm" colorRole="muted">
              {step === 'input' && 'Step 1: Enter client request data'}
              {step === 'details' && 'Step 2: Add RFQ details'}
              {step === 'review' && 'Step 3: Review parsed items'}
            </Typography>
          </div>
        </div>

        {/* Step 1: Input */}
        {step === 'input' && (
          <div className="space-y-6">
            {/* Input type selection */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  How would you like to add items?
                </Typography>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={() => setInputType('email_text')}
                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                      inputType === 'email_text'
                        ? 'border-border-brand bg-fill-brand/5'
                        : 'border-border-primary hover:border-border-muted'
                    }`}
                  >
                    <IconMail className={`h-6 w-6 mb-2 ${inputType === 'email_text' ? 'text-text-brand' : 'text-text-muted'}`} />
                    <Typography variant="bodySm" className="font-medium">
                      Email / Text
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Paste email or text content
                    </Typography>
                  </button>

                  <button
                    onClick={() => setInputType('excel')}
                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                      inputType === 'excel'
                        ? 'border-border-brand bg-fill-brand/5'
                        : 'border-border-primary hover:border-border-muted'
                    }`}
                  >
                    <IconFileSpreadsheet className={`h-6 w-6 mb-2 ${inputType === 'excel' ? 'text-text-brand' : 'text-text-muted'}`} />
                    <Typography variant="bodySm" className="font-medium">
                      Excel / CSV
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Upload spreadsheet data
                    </Typography>
                  </button>

                  <button
                    onClick={() => setInputType('manual')}
                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                      inputType === 'manual'
                        ? 'border-border-brand bg-fill-brand/5'
                        : 'border-border-primary hover:border-border-muted'
                    }`}
                  >
                    <IconUpload className={`h-6 w-6 mb-2 ${inputType === 'manual' ? 'text-text-brand' : 'text-text-muted'}`} />
                    <Typography variant="bodySm" className="font-medium">
                      Manual Entry
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Add items one by one
                    </Typography>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Input content */}
            {inputType !== 'manual' && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <IconSparkles className="h-5 w-5 text-text-brand" />
                    <Typography variant="headingSm">
                      {inputType === 'email_text' ? 'Paste Email Content' : 'Upload File'}
                    </Typography>
                  </div>

                  {inputType === 'email_text' ? (
                    <textarea
                      value={inputContent}
                      onChange={(e) => setInputContent(e.target.value)}
                      placeholder="Paste the email or text content here. AI will extract wine products and quantities..."
                      rows={12}
                      className="w-full rounded-lg border border-border-primary bg-background-primary px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-border-primary rounded-lg p-8 text-center">
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls,.txt"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="file-upload"
                        />
                        <label htmlFor="file-upload" className="cursor-pointer">
                          <IconUpload className="h-8 w-8 mx-auto mb-2 text-text-muted" />
                          <Typography variant="bodySm" colorRole="muted">
                            Click to upload or drag and drop
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            CSV, Excel, or text files
                          </Typography>
                        </label>
                      </div>
                      {fileName && (
                        <div className="flex items-center justify-between gap-2 p-3 bg-fill-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <IconFileSpreadsheet className="h-5 w-5 text-text-brand" />
                            <Typography variant="bodySm">{fileName}</Typography>
                          </div>
                          <button
                            onClick={handleClearFile}
                            className="p-1 hover:bg-fill-primary rounded"
                            title="Remove file"
                          >
                            <IconX className="h-4 w-4 text-text-muted" />
                          </button>
                        </div>
                      )}
                      {inputContent && (
                        <div className="space-y-2">
                          <Typography variant="bodyXs" colorRole="muted">
                            Preview (read-only):
                          </Typography>
                          <textarea
                            value={inputContent}
                            readOnly
                            rows={8}
                            className="w-full rounded-lg border border-border-primary bg-fill-muted px-4 py-3 text-sm font-mono cursor-default"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <Typography variant="bodyXs" colorRole="muted" className="mt-3">
                    AI will parse this content to extract wine products, vintages, quantities and more.
                  </Typography>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button
                variant="default"
                colorRole="brand"
                onClick={handleProceedToDetails}
                isDisabled={!inputContent.trim() && inputType !== 'manual'}
              >
                <ButtonContent>Continue to Details</ButtonContent>
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 'details' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <Typography variant="headingSm" className="mb-4">
                  RFQ Details
                </Typography>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    RFQ Name *
                  </label>
                  <input
                    type="text"
                    value={rfqName}
                    onChange={(e) => setRfqName(e.target.value)}
                    placeholder="e.g., Hotel ABC January Order"
                    className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional notes about this RFQ..."
                    rows={2}
                    className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="border-t border-border-muted pt-4 mt-4">
                  <Typography variant="bodySm" className="font-medium mb-3">
                    Distributor Information (B2B Trade Customer)
                  </Typography>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={distributorCompany}
                        onChange={(e) => setDistributorCompany(e.target.value)}
                        placeholder="e.g., Grand Hotel Dubai"
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Contact Name
                      </label>
                      <input
                        type="text"
                        value={distributorName}
                        onChange={(e) => setDistributorName(e.target.value)}
                        placeholder="e.g., John Smith"
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={distributorEmail}
                        onChange={(e) => setDistributorEmail(e.target.value)}
                        placeholder="john@grandhotel.com"
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Response Deadline
                      </label>
                      <input
                        type="date"
                        value={responseDeadline}
                        onChange={(e) => setResponseDeadline(e.target.value)}
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('input')}>
                <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
              </Button>

              <Button
                variant="default"
                colorRole="brand"
                onClick={handleCreateRfq}
                isDisabled={!rfqName.trim() || isCreating || isParsing}
              >
                <ButtonContent iconLeft={inputType !== 'manual' ? IconSparkles : undefined}>
                  {isCreating || isParsing
                    ? 'Processing...'
                    : inputType !== 'manual'
                      ? 'Create & Parse'
                      : 'Create RFQ'}
                </ButtonContent>
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review parsed items */}
        {step === 'review' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Typography variant="headingSm">
                    Parsed Items ({parsedItems.length})
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    AI extracted these products from your input
                  </Typography>
                </div>

                {/* Bulk actions */}
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border-muted">
                  <Typography variant="bodyXs" colorRole="muted">
                    Set all units:
                  </Typography>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedItems(
                        parsedItems.map((item) => ({ ...item, quantityUnit: 'cases' }))
                      );
                    }}
                    className="text-xs px-2.5 py-1 rounded border border-border-muted hover:bg-fill-muted transition-colors"
                  >
                    All Cases
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedItems(
                        parsedItems.map((item) => ({ ...item, quantityUnit: 'bottles' }))
                      );
                    }}
                    className="text-xs px-2.5 py-1 rounded border border-border-muted hover:bg-fill-muted transition-colors"
                  >
                    All Bottles
                  </button>
                </div>

                <div className="space-y-3">
                  {parsedItems.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 bg-fill-muted rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <Typography variant="bodySm" className="font-medium">
                          {item.productName}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {[item.producer, item.vintage, item.region]
                            .filter(Boolean)
                            .join(' - ')}
                        </Typography>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold">{item.quantity}</span>
                          <select
                            value={item.quantityUnit || 'cases'}
                            onChange={(e) => {
                              const newItems = [...parsedItems];
                              const currentItem = newItems[index];
                              if (currentItem) {
                                newItems[index] = {
                                  ...currentItem,
                                  quantityUnit: e.target.value as 'cases' | 'bottles',
                                };
                                setParsedItems(newItems);
                              }
                            }}
                            className="text-xs border border-border-muted rounded px-1.5 py-0.5 bg-surface-primary"
                          >
                            <option value="cases">cases</option>
                            <option value="bottles">bottles</option>
                          </select>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            item.confidence > 0.8
                              ? 'bg-fill-success/10 text-text-success'
                              : item.confidence > 0.5
                                ? 'bg-fill-warning/10 text-text-warning'
                                : 'bg-fill-danger/10 text-text-danger'
                          }`}
                        >
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Link href="/platform/admin/source">
                <Button variant="default" colorRole="brand">
                  <ButtonContent>View RFQ</ButtonContent>
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewRfqPage;
