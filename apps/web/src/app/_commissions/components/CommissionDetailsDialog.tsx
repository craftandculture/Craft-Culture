'use client';

import { IconCheck, IconClock, IconLoader2 } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

import Badge from '@/app/_ui/components/Badge/Badge';
import BadgeContent from '@/app/_ui/components/Badge/BadgeContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogBody from '@/app/_ui/components/Dialog/DialogBody';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';
import formatPrice from '@/utils/formatPrice';

export interface CommissionDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Dialog showing detailed commission history for B2C users
 */
const CommissionDetailsDialog = ({ isOpen, onClose }: CommissionDetailsDialogProps) => {
  const api = useTRPC();

  const { data, isLoading } = useQuery({
    ...api.commissions.getDetails.queryOptions({ limit: 50 }),
    enabled: isOpen,
    staleTime: 30000,
  });

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-2xl">
        <DialogHeader>
          <DialogTitle>Commission Details</DialogTitle>
          <DialogDescription>
            View your commission earnings from completed orders
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
            </div>
          ) : !data?.data || data.data.length === 0 ? (
            <div className="py-12 text-center">
              <Typography variant="bodySm" className="text-text-muted">
                No commission history yet. Complete orders to earn commission!
              </Typography>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {/* Mobile Card Layout */}
              <div className="space-y-3 md:hidden">
                {data.data.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border-muted bg-surface-muted/30 p-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <Typography variant="bodySm" className="font-medium">
                        {item.name}
                      </Typography>
                      {item.commissionPaidOutAt ? (
                        <Badge size="sm" colorRole="success">
                          <BadgeContent iconLeft={IconCheck}>Paid</BadgeContent>
                        </Badge>
                      ) : (
                        <Badge size="sm" colorRole="warning">
                          <BadgeContent iconLeft={IconClock}>Pending</BadgeContent>
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Typography variant="bodyXs" className="text-text-muted mb-0.5">
                          Order Total
                        </Typography>
                        <Typography variant="bodySm">
                          {formatPrice(item.orderTotal, 'USD')}
                        </Typography>
                      </div>
                      <div>
                        <Typography variant="bodyXs" className="text-text-muted mb-0.5">
                          Commission
                        </Typography>
                        <Typography variant="bodySm" className="font-semibold text-fill-brand">
                          {formatPrice(item.commissionEarned, 'USD')}
                        </Typography>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border-muted pt-3">
                      <Typography variant="bodyXs" className="text-text-muted">
                        {item.commissionPaidOutAt
                          ? formatDate(item.commissionPaidOutAt)
                          : formatDate(item.createdAt)}
                      </Typography>
                      {item.payoutReference && (
                        <Typography variant="bodyXs" className="text-text-muted">
                          Ref: {item.payoutReference}
                        </Typography>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table Layout */}
              <table className="hidden w-full md:table">
                <thead className="sticky top-0 bg-surface-primary">
                  <tr className="border-b border-border-primary text-left">
                    <th className="pb-3 pr-4">
                      <Typography variant="bodyXs" className="text-text-muted uppercase tracking-wide">
                        Order
                      </Typography>
                    </th>
                    <th className="pb-3 pr-4">
                      <Typography variant="bodyXs" className="text-text-muted uppercase tracking-wide">
                        Order Total
                      </Typography>
                    </th>
                    <th className="pb-3 pr-4">
                      <Typography variant="bodyXs" className="text-text-muted uppercase tracking-wide">
                        Commission
                      </Typography>
                    </th>
                    <th className="pb-3 pr-4">
                      <Typography variant="bodyXs" className="text-text-muted uppercase tracking-wide">
                        Status
                      </Typography>
                    </th>
                    <th className="pb-3">
                      <Typography variant="bodyXs" className="text-text-muted uppercase tracking-wide">
                        Date
                      </Typography>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((item) => (
                    <tr key={item.id} className="border-b border-border-muted last:border-0">
                      <td className="py-4 pr-4">
                        <Typography variant="bodySm" className="font-medium">
                          {item.name}
                        </Typography>
                      </td>
                      <td className="py-4 pr-4">
                        <Typography variant="bodySm">
                          {formatPrice(item.orderTotal, 'USD')}
                        </Typography>
                      </td>
                      <td className="py-4 pr-4">
                        <Typography variant="bodySm" className="font-semibold text-fill-brand">
                          {formatPrice(item.commissionEarned, 'USD')}
                        </Typography>
                      </td>
                      <td className="py-4 pr-4">
                        {item.commissionPaidOutAt ? (
                          <Badge size="sm" colorRole="success">
                            <BadgeContent iconLeft={IconCheck}>Paid</BadgeContent>
                          </Badge>
                        ) : (
                          <Badge size="sm" colorRole="warning">
                            <BadgeContent iconLeft={IconClock}>Pending</BadgeContent>
                          </Badge>
                        )}
                      </td>
                      <td className="py-4">
                        <Typography variant="bodyXs" className="text-text-muted">
                          {item.commissionPaidOutAt
                            ? formatDate(item.commissionPaidOutAt)
                            : formatDate(item.createdAt)}
                        </Typography>
                        {item.payoutReference && (
                          <Typography variant="bodyXs" className="text-text-muted">
                            Ref: {item.payoutReference}
                          </Typography>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default CommissionDetailsDialog;
