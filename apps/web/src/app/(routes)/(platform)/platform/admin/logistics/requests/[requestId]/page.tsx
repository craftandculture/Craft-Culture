'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconFileText,
  IconLoader2,
  IconPaperclip,
  IconPlus,
  IconSnowflake,
  IconThermometer,
  IconTruck,
  IconUpload,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

import Badge from '@/app/_ui/components/Badge/Badge';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import type {
  logisticsQuoteRequestPriority,
  logisticsQuoteRequestStatus,
} from '@/database/schema';
import useTRPC from '@/lib/trpc/browser';

type RequestStatus = (typeof logisticsQuoteRequestStatus.enumValues)[number];
type RequestPriority = (typeof logisticsQuoteRequestPriority.enumValues)[number];

const statusBadgeVariants: Record<RequestStatus, 'default' | 'warning' | 'success' | 'error' | 'secondary'> = {
  pending: 'warning',
  in_progress: 'secondary',
  quoted: 'success',
  completed: 'success',
  cancelled: 'error',
};

const priorityBadgeVariants: Record<RequestPriority, 'default' | 'warning' | 'success' | 'error' | 'secondary'> = {
  low: 'default',
  normal: 'secondary',
  high: 'warning',
  urgent: 'error',
};

const statusIcons: Record<RequestStatus, typeof IconClock> = {
  pending: IconClock,
  in_progress: IconTruck,
  quoted: IconFileText,
  completed: IconCheck,
  cancelled: IconX,
};

const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: Date | null | undefined) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Quote Request detail page
 */
const QuoteRequestDetailPage = () => {
  const params = useParams();
  const requestId = params.requestId as string;
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const { data: request, isLoading } = useQuery({
    ...api.logistics.admin.requests.getOne.queryOptions({ requestId }),
  });

  const { mutate: assignRequest, isPending: isAssigning } = useMutation({
    ...api.logistics.admin.requests.assign.mutationOptions(),
    onSuccess: () => {
      toast.success('Request assigned to you');
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests', 'getOne']] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to assign request');
    },
  });

  const { mutate: updateRequest, isPending: isUpdating } = useMutation({
    ...api.logistics.admin.requests.update.mutationOptions(),
    onSuccess: () => {
      toast.success('Request updated');
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests', 'getOne']] });
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests', 'getMany']] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update request');
    },
  });

  const { mutate: uploadAttachment } = useMutation({
    ...api.logistics.admin.requests.uploadAttachment.mutationOptions(),
    onSuccess: () => {
      toast.success('Attachment uploaded');
      setIsUploading(false);
      void queryClient.invalidateQueries({ queryKey: [['logistics', 'admin', 'requests', 'getOne']] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload attachment');
      setIsUploading(false);
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        uploadAttachment({
          requestId,
          fileName: file.name,
          fileData: base64,
          mimeType: file.type,
        });
      };
      reader.readAsDataURL(file);
    },
    [requestId, uploadAttachment],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Typography variant="headingSm">Request not found</Typography>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = statusIcons[request.status];
  const canAssign = request.status === 'pending';
  const canComplete = request.status === 'in_progress' || request.status === 'quoted';
  const canAddQuote = request.status !== 'completed' && request.status !== 'cancelled';

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform/admin/logistics/requests">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
                <Link href="/platform/admin/logistics" className="hover:text-text-primary">
                  Logistics
                </Link>
                <span>/</span>
                <Link href="/platform/admin/logistics/requests" className="hover:text-text-primary">
                  Quote Requests
                </Link>
                <span>/</span>
                <span>{request.requestNumber}</span>
              </div>
              <div className="flex items-center gap-3">
                <Typography variant="headingLg">{request.requestNumber}</Typography>
                <Badge variant={statusBadgeVariants[request.status]}>
                  <Icon icon={StatusIcon} size="xs" className="mr-1" />
                  {request.status.replace('_', ' ').charAt(0).toUpperCase() +
                    request.status.replace('_', ' ').slice(1)}
                </Badge>
                <Badge variant={priorityBadgeVariants[request.priority]}>
                  {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canAssign && (
              <Button
                variant="outline"
                onClick={() => assignRequest({ requestId })}
                disabled={isAssigning}
              >
                {isAssigning ? (
                  <ButtonContent iconLeft={IconLoader2} iconLeftClassName="animate-spin">
                    Assigning...
                  </ButtonContent>
                ) : (
                  <ButtonContent iconLeft={IconUser}>Assign to Me</ButtonContent>
                )}
              </Button>
            )}
            {canComplete && (
              <Button
                variant="outline"
                onClick={() => updateRequest({ requestId, status: 'completed' })}
                disabled={isUpdating}
              >
                <ButtonContent iconLeft={IconCheck}>Mark Complete</ButtonContent>
              </Button>
            )}
            {canAddQuote && (
              <Button asChild>
                <Link href={`/platform/admin/logistics/quotes/new?requestId=${requestId}`}>
                  <ButtonContent iconLeft={IconPlus}>Add Quote</ButtonContent>
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Request Details */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Route & Cargo */}
            <Card>
              <div className="p-4 pb-0">
                <CardTitle>Route & Cargo</CardTitle>
              </div>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Typography variant="bodySm" colorRole="muted">
                      Origin
                    </Typography>
                    <Typography variant="bodyMd">
                      {request.originCity ? `${request.originCity}, ` : ''}{request.originCountry}
                    </Typography>
                    {request.originWarehouse && (
                      <Typography variant="bodySm" colorRole="muted">
                        {request.originWarehouse}
                      </Typography>
                    )}
                  </div>
                  <div>
                    <Typography variant="bodySm" colorRole="muted">
                      Destination
                    </Typography>
                    <Typography variant="bodyMd">
                      {request.destinationCity ? `${request.destinationCity}, ` : ''}{request.destinationCountry}
                    </Typography>
                    {request.destinationWarehouse && (
                      <Typography variant="bodySm" colorRole="muted">
                        {request.destinationWarehouse}
                      </Typography>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <Typography variant="bodySm" colorRole="muted">
                      Product Type
                    </Typography>
                    <Typography variant="bodyMd" className="capitalize">
                      {request.productType}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="bodySm" colorRole="muted">
                      Cases
                    </Typography>
                    <Typography variant="bodyMd">
                      {request.totalCases ?? '-'}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="bodySm" colorRole="muted">
                      Pallets
                    </Typography>
                    <Typography variant="bodyMd">
                      {request.totalPallets ?? '-'}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="bodySm" colorRole="muted">
                      Weight
                    </Typography>
                    <Typography variant="bodyMd">
                      {request.totalWeightKg ? `${request.totalWeightKg.toFixed(0)} kg` : '-'}
                    </Typography>
                  </div>
                </div>
                {request.productDescription && (
                  <div>
                    <Typography variant="bodySm" colorRole="muted">
                      Description
                    </Typography>
                    <Typography variant="bodyMd">{request.productDescription}</Typography>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Special Requirements */}
            {(request.requiresThermalLiner ||
              request.requiresTracker ||
              request.requiresInsurance ||
              request.temperatureControlled) && (
              <Card>
                <div className="p-4 pb-0">
                  <CardTitle>Special Requirements</CardTitle>
                </div>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {request.requiresThermalLiner && (
                      <Badge variant="secondary">
                        <IconSnowflake className="h-3 w-3 mr-1" />
                        Thermal Liner Required
                      </Badge>
                    )}
                    {request.requiresTracker && (
                      <Badge variant="secondary">
                        <IconThermometer className="h-3 w-3 mr-1" />
                        Temperature Tracker Required
                      </Badge>
                    )}
                    {request.requiresInsurance && (
                      <Badge variant="secondary">Insurance Required</Badge>
                    )}
                    {request.temperatureControlled && (
                      <Badge variant="secondary">
                        Temperature Controlled
                        {request.minTemperature !== null && request.maxTemperature !== null && (
                          <span className="ml-1">
                            ({request.minTemperature}C - {request.maxTemperature}C)
                          </span>
                        )}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Linked Quotes */}
            <Card>
              <div className="p-4 pb-0">
                <div className="flex items-center justify-between">
                  <CardTitle>Quotes ({request.quotes?.length ?? 0})</CardTitle>
                  {canAddQuote && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/platform/admin/logistics/quotes/new?requestId=${requestId}`}>
                        <ButtonContent iconLeft={IconPlus}>Add Quote</ButtonContent>
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
              <CardContent>
                {!request.quotes || request.quotes.length === 0 ? (
                  <Typography variant="bodyMd" colorRole="muted" className="text-center py-4">
                    No quotes have been added to this request yet.
                  </Typography>
                ) : (
                  <div className="space-y-3">
                    {request.quotes.map((quote) => (
                      <Link
                        key={quote.id}
                        href={`/platform/admin/logistics/quotes/${quote.id}`}
                        className="flex items-center justify-between rounded-lg border border-border-primary p-3 transition-colors hover:border-border-brand"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <Typography variant="bodySm" className="font-mono">
                              {quote.quoteNumber}
                            </Typography>
                            <Badge variant={quote.status === 'accepted' ? 'success' : 'secondary'}>
                              {quote.status}
                            </Badge>
                          </div>
                          <Typography variant="bodyMd">{quote.forwarderName}</Typography>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <Typography variant="headingSm">
                              {formatCurrency(quote.totalPrice, quote.currency)}
                            </Typography>
                            {quote.transitDays && (
                              <Typography variant="bodyXs" colorRole="muted">
                                {quote.transitDays} days
                              </Typography>
                            )}
                          </div>
                          <IconChevronRight className="h-5 w-5 text-text-muted" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attachments */}
            <Card>
              <div className="p-4 pb-0">
                <CardTitle>Attachments ({request.attachments?.length ?? 0})</CardTitle>
              </div>
              <CardContent className="space-y-4">
                {/* Upload area */}
                <div
                  {...getRootProps()}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${
                    isDragActive
                      ? 'border-border-brand bg-fill-brand/5'
                      : 'border-border-primary hover:border-border-brand'
                  }`}
                >
                  <input {...getInputProps()} />
                  {isUploading ? (
                    <>
                      <Icon icon={IconLoader2} size="lg" className="animate-spin text-text-muted mb-2" />
                      <Typography variant="bodySm" colorRole="muted">
                        Uploading...
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Icon icon={IconUpload} size="lg" className="text-text-muted mb-2" />
                      <Typography variant="bodySm" colorRole="muted">
                        {isDragActive
                          ? 'Drop the file here...'
                          : 'Drag & drop a file here, or click to select'}
                      </Typography>
                      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                        PDF, PNG, JPG up to 10MB
                      </Typography>
                    </>
                  )}
                </div>

                {/* Attachment list */}
                {request.attachments && request.attachments.length > 0 && (
                  <div className="space-y-2">
                    {request.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between rounded-lg border border-border-primary p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Icon icon={IconPaperclip} size="sm" className="text-text-muted" />
                          <div>
                            <Typography variant="bodySm">{attachment.fileName}</Typography>
                            {attachment.fileSize && (
                              <Typography variant="bodyXs" colorRole="muted">
                                {(attachment.fileSize / 1024).toFixed(1)} KB
                              </Typography>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Icon icon={IconDownload} size="sm" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {request.notes && (
              <Card>
                <div className="p-4 pb-0">
                  <CardTitle>Notes</CardTitle>
                </div>
                <CardContent>
                  <Typography variant="bodyMd" className="whitespace-pre-wrap">
                    {request.notes}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Timeline */}
            <Card>
              <div className="p-4 pb-0">
                <CardTitle>Timeline</CardTitle>
              </div>
              <CardContent className="space-y-3">
                <div>
                  <Typography variant="bodySm" colorRole="muted">
                    Requested
                  </Typography>
                  <Typography variant="bodyMd">
                    {formatDate(request.requestedAt)}
                  </Typography>
                  {request.requester && (
                    <Typography variant="bodyXs" colorRole="muted">
                      by {request.requester.name || request.requester.email}
                    </Typography>
                  )}
                </div>
                {request.assignedAt && (
                  <div>
                    <Typography variant="bodySm" colorRole="muted">
                      Assigned
                    </Typography>
                    <Typography variant="bodyMd">
                      {formatDate(request.assignedAt)}
                    </Typography>
                    {request.assignee && (
                      <Typography variant="bodyXs" colorRole="muted">
                        to {request.assignee.name || request.assignee.email}
                      </Typography>
                    )}
                  </div>
                )}
                {request.completedAt && (
                  <div>
                    <Typography variant="bodySm" colorRole="muted">
                      Completed
                    </Typography>
                    <Typography variant="bodyMd">
                      {formatDate(request.completedAt)}
                    </Typography>
                    {request.completedByUser && (
                      <Typography variant="bodyXs" colorRole="muted">
                        by {request.completedByUser.name || request.completedByUser.email}
                      </Typography>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Target Dates */}
            {(request.targetPickupDate || request.targetDeliveryDate) && (
              <Card>
                <div className="p-4 pb-0">
                  <CardTitle>Target Dates</CardTitle>
                </div>
                <CardContent className="space-y-3">
                  {request.targetPickupDate && (
                    <div>
                      <Typography variant="bodySm" colorRole="muted">
                        Pickup
                      </Typography>
                      <Typography variant="bodyMd">
                        {formatDate(request.targetPickupDate)}
                      </Typography>
                    </div>
                  )}
                  {request.targetDeliveryDate && (
                    <div>
                      <Typography variant="bodySm" colorRole="muted">
                        Delivery
                      </Typography>
                      <Typography variant="bodyMd">
                        {formatDate(request.targetDeliveryDate)}
                      </Typography>
                    </div>
                  )}
                  {request.isFlexibleDates && (
                    <Badge variant="secondary">Dates are flexible</Badge>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <div className="p-4 pb-0">
                <CardTitle>Details</CardTitle>
              </div>
              <CardContent className="space-y-3">
                {request.transportMode && (
                  <div>
                    <Typography variant="bodySm" colorRole="muted">
                      Transport Mode
                    </Typography>
                    <Typography variant="bodyMd" className="capitalize">
                      {request.transportMode.replace('_', ' ')}
                    </Typography>
                  </div>
                )}
                {request.totalVolumeM3 && (
                  <div>
                    <Typography variant="bodySm" colorRole="muted">
                      Volume
                    </Typography>
                    <Typography variant="bodyMd">
                      {request.totalVolumeM3.toFixed(2)} m3
                    </Typography>
                  </div>
                )}
                <div>
                  <Typography variant="bodySm" colorRole="muted">
                    Created
                  </Typography>
                  <Typography variant="bodyMd">
                    {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                  </Typography>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteRequestDetailPage;
