'use client';

import {
  IconArrowLeft,
  IconCheck,
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

import AwardEmails from '@/app/_logistics/components/quotes/AwardEmails';
import ClientPriceBox from '@/app/_logistics/components/quotes/ClientPriceBox';
import QuoteDropZone from '@/app/_logistics/components/quotes/QuoteDropZone';
import QuoteRanking from '@/app/_logistics/components/quotes/QuoteRanking';
import RequestForwarders from '@/app/_logistics/components/quotes/RequestForwarders';
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

type BadgeRole = 'muted' | 'info' | 'warning' | 'success' | 'danger';

const statusBadgeVariants: Record<RequestStatus, BadgeRole> = {
  pending: 'warning',
  in_progress: 'info',
  quoted: 'info',
  completed: 'success',
  cancelled: 'danger',
};

const priorityBadgeVariants: Record<RequestPriority, BadgeRole> = {
  low: 'muted',
  normal: 'muted',
  high: 'warning',
  urgent: 'danger',
};

const statusIcons: Record<RequestStatus, typeof IconClock> = {
  pending: IconClock,
  in_progress: IconTruck,
  quoted: IconFileText,
  completed: IconCheck,
  cancelled: IconX,
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
 * A quote request: the one page its freight is worked from
 *
 * Top to bottom: the cargo, the forwarders asked (with each one's email to
 * copy), a drop zone for the quotes they send back, the quotes ranked per
 * 75cl in USD, the client's price and margin, and once a quote is accepted,
 * the award and decline emails.
 */
const QuoteRequestDetailPage = () => {
  const params = useParams();
  const requestId = params.requestId as string;
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [chosenQuoteId, setChosenQuoteId] = useState<string | null>(null);

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

  // The client is priced on the quote chosen, else the one priced before, else the cheapest still live
  const liveQuotes = request.quotes.filter((q) => q.status === 'pending' && !q.isExpired);
  const pricedQuoteId =
    [chosenQuoteId, request.clientQuoteId].find((id) => id && liveQuotes.some((q) => q.id === id)) ??
    liveQuotes[0]?.id ??
    null;
  const accepted = request.quotes.some((q) => q.status === 'accepted');
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
              <Link href="/platform/admin/logistics/quotes">
                <Icon icon={IconArrowLeft} size="sm" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
                <Link href="/platform/admin/logistics" className="hover:text-text-primary">
                  Logistics
                </Link>
                <span>/</span>
                <Link href="/platform/admin/logistics/quotes" className="hover:text-text-primary">
                  Freight quotes
                </Link>
                <span>/</span>
                <span>{request.requestNumber}</span>
              </div>
              <div className="flex items-center gap-3">
                <Typography variant="headingLg">{request.requestNumber}</Typography>
                <Badge colorRole={statusBadgeVariants[request.status]}>
                  <Icon icon={StatusIcon} size="xs" className="mr-1" />
                  {request.status.replace('_', ' ').charAt(0).toUpperCase() +
                    request.status.replace('_', ' ').slice(1)}
                </Badge>
                <Badge colorRole={priorityBadgeVariants[request.priority]}>
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
                  <ButtonContent isLoading>Assigning...</ButtonContent>
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
                <div className="grid gap-4 sm:grid-cols-6">
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
                      Bottles
                    </Typography>
                    <Typography variant="bodyMd">{request.totalBottles ?? '-'}</Typography>
                  </div>
                  <div>
                    <Typography variant="bodySm" colorRole="muted">
                      75cl equivalent
                    </Typography>
                    <Typography variant="bodyMd">
                      {request.total75clEquivalents != null ? Math.round(request.total75clEquivalents) : '-'}
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
                      <Badge colorRole="muted">
                        <IconSnowflake className="h-3 w-3 mr-1" />
                        Thermal Liner Required
                      </Badge>
                    )}
                    {request.requiresTracker && (
                      <Badge colorRole="muted">
                        <IconThermometer className="h-3 w-3 mr-1" />
                        Temperature Tracker Required
                      </Badge>
                    )}
                    {request.requiresInsurance && (
                      <Badge colorRole="muted">Insurance Required</Badge>
                    )}
                    {request.temperatureControlled && (
                      <Badge colorRole="muted">
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

            <RequestForwarders request={request} />

            {canAddQuote && !accepted && <QuoteDropZone requestId={requestId} />}

            <QuoteRanking request={request} selectedQuoteId={pricedQuoteId} onSelect={setChosenQuoteId} />

            {pricedQuoteId && !accepted && <ClientPriceBox request={request} quoteId={pricedQuoteId} />}

            <AwardEmails request={request} />

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
                    <Badge colorRole="muted">Dates are flexible</Badge>
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
