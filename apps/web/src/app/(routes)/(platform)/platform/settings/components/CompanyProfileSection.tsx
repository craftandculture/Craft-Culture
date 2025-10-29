'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';

import CompanyLogoUpload from './CompanyLogoUpload';

/**
 * Company profile section with name and logo
 */
const CompanyProfileSection = () => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  // Fetch current settings
  const { data: settings } = useQuery({
    queryKey: ['settings.get'],
    queryFn: () => trpcClient.settings.get.query(),
  });

  const [companyName, setCompanyName] = useState(settings?.companyName || '');
  const [companyAddress, setCompanyAddress] = useState(settings?.companyAddress || '');
  const [companyPhone, setCompanyPhone] = useState(settings?.companyPhone || '');
  const [companyEmail, setCompanyEmail] = useState(settings?.companyEmail || '');
  const [companyWebsite, setCompanyWebsite] = useState(settings?.companyWebsite || '');
  const [companyVatNumber, setCompanyVatNumber] = useState(settings?.companyVatNumber || '');

  // Update company information mutation
  const updateMutation = useMutation({
    mutationFn: () =>
      trpcClient.settings.update.mutate({
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim() || undefined,
        companyPhone: companyPhone.trim() || undefined,
        companyEmail: companyEmail.trim() || undefined,
        companyWebsite: companyWebsite.trim() || undefined,
        companyVatNumber: companyVatNumber.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Company information updated successfully');
      void queryClient.invalidateQueries({ queryKey: ['settings.get'] });
    },
    onError: (error) => {
      toast.error(`Failed to update company information: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (!companyName.trim()) {
      toast.error('Company name cannot be empty');
      return;
    }
    updateMutation.mutate();
  };

  // Update local state when settings load
  if (settings && !companyName) {
    setCompanyName(settings.companyName || '');
    setCompanyAddress(settings.companyAddress || '');
    setCompanyPhone(settings.companyPhone || '');
    setCompanyEmail(settings.companyEmail || '');
    setCompanyWebsite(settings.companyWebsite || '');
    setCompanyVatNumber(settings.companyVatNumber || '');
  }

  const hasChanges =
    companyName !== settings?.companyName ||
    companyAddress !== (settings?.companyAddress || '') ||
    companyPhone !== (settings?.companyPhone || '') ||
    companyEmail !== (settings?.companyEmail || '') ||
    companyWebsite !== (settings?.companyWebsite || '') ||
    companyVatNumber !== (settings?.companyVatNumber || '');

  return (
    <div className="flex flex-col space-y-6">
      <div>
        <Typography variant="bodyLg" className="mb-1 font-semibold">
          Company Profile
        </Typography>
        <Typography variant="bodySm" colorRole="muted">
          Manage your company information
        </Typography>
      </div>

      {/* Company Name */}
      <div className="flex flex-col space-y-3">
        <div>
          <Typography variant="bodySm" className="mb-1 font-medium">
            Company Name *
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            This will appear on your quotes and invoices
          </Typography>
        </div>
        <Input
          type="text"
          placeholder="e.g., ABC Distributors LLC"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Company Address */}
      <div className="flex flex-col space-y-3">
        <div>
          <Typography variant="bodySm" className="mb-1 font-medium">
            Address
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Company address for PDF quotes (optional)
          </Typography>
        </div>
        <Input
          type="text"
          placeholder="e.g., 123 Business Street, Dubai, UAE"
          value={companyAddress}
          onChange={(e) => setCompanyAddress(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Company Phone */}
      <div className="flex flex-col space-y-3">
        <div>
          <Typography variant="bodySm" className="mb-1 font-medium">
            Phone
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Contact phone number (optional)
          </Typography>
        </div>
        <Input
          type="tel"
          placeholder="e.g., +971 4 123 4567"
          value={companyPhone}
          onChange={(e) => setCompanyPhone(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Company Email */}
      <div className="flex flex-col space-y-3">
        <div>
          <Typography variant="bodySm" className="mb-1 font-medium">
            Company Email
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Business email for quotes (optional)
          </Typography>
        </div>
        <Input
          type="email"
          placeholder="e.g., info@company.com"
          value={companyEmail}
          onChange={(e) => setCompanyEmail(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Company Website */}
      <div className="flex flex-col space-y-3">
        <div>
          <Typography variant="bodySm" className="mb-1 font-medium">
            Website
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Company website URL (optional)
          </Typography>
        </div>
        <Input
          type="url"
          placeholder="e.g., https://www.company.com"
          value={companyWebsite}
          onChange={(e) => setCompanyWebsite(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* VAT Number */}
      <div className="flex flex-col space-y-3">
        <div>
          <Typography variant="bodySm" className="mb-1 font-medium">
            VAT Number
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            Tax registration number (optional)
          </Typography>
        </div>
        <Input
          type="text"
          placeholder="e.g., 123456789012345"
          value={companyVatNumber}
          onChange={(e) => setCompanyVatNumber(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Save Button */}
      <div>
        <Button
          variant="default"
          size="md"
          onClick={handleSave}
          isDisabled={updateMutation.isPending || !hasChanges}
        >
          <ButtonContent>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </ButtonContent>
        </Button>
      </div>

      <Divider />

      {/* Company Logo */}
      <CompanyLogoUpload />
    </div>
  );
};

export default CompanyProfileSection;
