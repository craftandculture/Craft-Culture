'use client';

import { IconArrowLeft, IconLoader2 } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Label from '@/app/_ui/components/Label/Label';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Textarea from '@/app/_ui/components/Textarea/Textarea';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type ShipmentType = 'inbound' | 'outbound' | 're_export';
type TransportMode = 'sea_fcl' | 'sea_lcl' | 'air' | 'road';

/**
 * Create new logistics shipment page
 */
const NewShipmentPage = () => {
  const router = useRouter();
  const api = useTRPC();

  const [formData, setFormData] = useState({
    type: 'inbound' as ShipmentType,
    transportMode: 'sea_fcl' as TransportMode,
    originCountry: '',
    originCity: '',
    destinationCountry: 'UAE',
    destinationCity: '',
    destinationWarehouse: 'RAK Port',
    carrierName: '',
    carrierBookingRef: '',
    containerNumber: '',
    blNumber: '',
    awbNumber: '',
    internalNotes: '',
  });

  const { mutate: createShipment, isPending } = useMutation(
    api.logistics.admin.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Shipment ${data.shipmentNumber} created`);
        router.push(`/platform/admin/logistics/shipments/${data.id}`);
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to create shipment');
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createShipment({
      type: formData.type,
      transportMode: formData.transportMode,
      originCountry: formData.originCountry || undefined,
      originCity: formData.originCity || undefined,
      destinationCountry: formData.destinationCountry || undefined,
      destinationCity: formData.destinationCity || undefined,
      destinationWarehouse: formData.destinationWarehouse || undefined,
      carrierName: formData.carrierName || undefined,
      carrierBookingRef: formData.carrierBookingRef || undefined,
      containerNumber: formData.containerNumber || undefined,
      blNumber: formData.blNumber || undefined,
      awbNumber: formData.awbNumber || undefined,
      internalNotes: formData.internalNotes || undefined,
    });
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/platform/admin/logistics">
            <Button variant="ghost" size="sm">
              <Icon icon={IconArrowLeft} size="sm" />
            </Button>
          </Link>
          <div>
            <Typography variant="headingLg">New Shipment</Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Create a new logistics shipment
            </Typography>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="space-y-6 p-6">
              {/* Type & Mode */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Shipment Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => updateField('type', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound (Partner → UAE)</SelectItem>
                      <SelectItem value="outbound">Outbound (UAE → Client)</SelectItem>
                      <SelectItem value="re_export">Re-Export</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Transport Mode</Label>
                  <Select
                    value={formData.transportMode}
                    onValueChange={(v) => updateField('transportMode', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sea_fcl">Sea - Full Container (FCL)</SelectItem>
                      <SelectItem value="sea_lcl">Sea - Less than Container (LCL)</SelectItem>
                      <SelectItem value="air">Air Freight</SelectItem>
                      <SelectItem value="road">Road</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Origin */}
              <div>
                <Typography variant="headingSm" className="mb-3">
                  Origin
                </Typography>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      placeholder="e.g. France"
                      value={formData.originCountry}
                      onChange={(e) => updateField('originCountry', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      placeholder="e.g. Bordeaux"
                      value={formData.originCity}
                      onChange={(e) => updateField('originCity', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Destination */}
              <div>
                <Typography variant="headingSm" className="mb-3">
                  Destination
                </Typography>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      placeholder="e.g. UAE"
                      value={formData.destinationCountry}
                      onChange={(e) => updateField('destinationCountry', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      placeholder="e.g. Dubai"
                      value={formData.destinationCity}
                      onChange={(e) => updateField('destinationCity', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Warehouse</Label>
                    <Input
                      placeholder="e.g. RAK Port"
                      value={formData.destinationWarehouse}
                      onChange={(e) => updateField('destinationWarehouse', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Carrier Info */}
              <div>
                <Typography variant="headingSm" className="mb-3">
                  Carrier Information
                </Typography>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Carrier Name</Label>
                    <Input
                      placeholder="e.g. Hillebrand, Hapag-Lloyd"
                      value={formData.carrierName}
                      onChange={(e) => updateField('carrierName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Booking Reference</Label>
                    <Input
                      placeholder="Carrier booking number"
                      value={formData.carrierBookingRef}
                      onChange={(e) => updateField('carrierBookingRef', e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {(formData.transportMode === 'sea_fcl' || formData.transportMode === 'sea_lcl') && (
                    <>
                      <div className="space-y-2">
                        <Label>Container Number</Label>
                        <Input
                          placeholder="e.g. HLCU1234567"
                          value={formData.containerNumber}
                          onChange={(e) => updateField('containerNumber', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bill of Lading #</Label>
                        <Input
                          placeholder="BOL number"
                          value={formData.blNumber}
                          onChange={(e) => updateField('blNumber', e.target.value)}
                        />
                      </div>
                    </>
                  )}
                  {formData.transportMode === 'air' && (
                    <div className="space-y-2">
                      <Label>Airway Bill #</Label>
                      <Input
                        placeholder="AWB number"
                        value={formData.awbNumber}
                        onChange={(e) => updateField('awbNumber', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <Textarea
                  placeholder="Any internal notes about this shipment..."
                  value={formData.internalNotes}
                  onChange={(e) => updateField('internalNotes', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border-muted">
                <Link href="/platform/admin/logistics">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isPending}>
                  <ButtonContent iconLeft={isPending ? IconLoader2 : undefined}>
                    {isPending ? 'Creating...' : 'Create Shipment'}
                  </ButtonContent>
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
};

export default NewShipmentPage;
