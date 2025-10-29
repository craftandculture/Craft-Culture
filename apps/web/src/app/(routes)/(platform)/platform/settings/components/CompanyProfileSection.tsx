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

  // Update company name mutation
  const updateMutation = useMutation({
    mutationFn: (name: string) =>
      trpcClient.settings.update.mutate({ companyName: name }),
    onSuccess: () => {
      toast.success('Company name updated successfully');
      void queryClient.invalidateQueries({ queryKey: ['settings.get'] });
    },
    onError: (error) => {
      toast.error(`Failed to update company name: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (!companyName.trim()) {
      toast.error('Company name cannot be empty');
      return;
    }
    updateMutation.mutate(companyName.trim());
  };

  // Update local state when settings load
  if (settings?.companyName && !companyName) {
    setCompanyName(settings.companyName);
  }

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
            Company Name
          </Typography>
          <Typography variant="bodyXs" colorRole="muted">
            This will appear on your quotes and invoices
          </Typography>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="e.g., ABC Distributors LLC"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="max-w-md"
          />
          <Button
            variant="default"
            size="md"
            onClick={handleSave}
            isDisabled={updateMutation.isPending || companyName === settings?.companyName}
          >
            <ButtonContent>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </ButtonContent>
          </Button>
        </div>
      </div>

      <Divider />

      {/* Company Logo */}
      <CompanyLogoUpload />
    </div>
  );
};

export default CompanyProfileSection;
