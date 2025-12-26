'use client';

import {
  IconBuildingBank,
  IconCoin,
  IconHome,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';

interface BankDetails {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  sortCode?: string;
  iban?: string;
  swiftBic?: string;
  branchAddress?: string;
}

/**
 * Personal details section for B2C users
 * Includes address and bank details for commission payouts
 */
const PersonalDetailsSection = () => {
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  // Fetch current settings
  const { data: settings } = useQuery({
    queryKey: ['settings.get'],
    queryFn: () => trpcClient.settings.get.query(),
  });

  // Address fields
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateProvince, setStateProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');

  // Bank details
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [iban, setIban] = useState('');
  const [swiftBic, setSwiftBic] = useState('');
  const [branchAddress, setBranchAddress] = useState('');

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: () =>
      trpcClient.settings.updatePersonalDetails.mutate({
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        stateProvince: stateProvince.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: country.trim() || undefined,
        phone: phone.trim() || undefined,
        bankDetails: {
          bankName: bankName.trim() || undefined,
          accountName: accountName.trim() || undefined,
          accountNumber: accountNumber.trim() || undefined,
          sortCode: sortCode.trim() || undefined,
          iban: iban.trim() || undefined,
          swiftBic: swiftBic.trim() || undefined,
          branchAddress: branchAddress.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Personal details updated successfully');
      void queryClient.invalidateQueries({ queryKey: ['settings.get'] });
    },
    onError: (error) => {
      toast.error(`Failed to update details: ${error.message}`);
    },
  });

  // Update local state when settings load
  useEffect(() => {
    if (settings) {
      setAddressLine1(settings.addressLine1 || '');
      setAddressLine2(settings.addressLine2 || '');
      setCity(settings.city || '');
      setStateProvince(settings.stateProvince || '');
      setPostalCode(settings.postalCode || '');
      setCountry(settings.country || '');
      setPhone(settings.phone || '');

      const bank = settings.bankDetails as BankDetails | null;
      if (bank) {
        setBankName(bank.bankName || '');
        setAccountName(bank.accountName || '');
        setAccountNumber(bank.accountNumber || '');
        setSortCode(bank.sortCode || '');
        setIban(bank.iban || '');
        setSwiftBic(bank.swiftBic || '');
        setBranchAddress(bank.branchAddress || '');
      }
    }
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate();
  };

  const currentBank = settings?.bankDetails as BankDetails | null;

  const hasChanges =
    addressLine1 !== (settings?.addressLine1 || '') ||
    addressLine2 !== (settings?.addressLine2 || '') ||
    city !== (settings?.city || '') ||
    stateProvince !== (settings?.stateProvince || '') ||
    postalCode !== (settings?.postalCode || '') ||
    country !== (settings?.country || '') ||
    phone !== (settings?.phone || '') ||
    bankName !== (currentBank?.bankName || '') ||
    accountName !== (currentBank?.accountName || '') ||
    accountNumber !== (currentBank?.accountNumber || '') ||
    sortCode !== (currentBank?.sortCode || '') ||
    iban !== (currentBank?.iban || '') ||
    swiftBic !== (currentBank?.swiftBic || '') ||
    branchAddress !== (currentBank?.branchAddress || '');

  // Only show for B2C users
  if (settings?.customerType !== 'b2c') {
    return null;
  }

  return (
    <div className="flex flex-col space-y-8">
      {/* Commission Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
        <Icon icon={IconCoin} size="md" className="mt-0.5 text-amber-600" />
        <div>
          <Typography variant="bodySm" className="font-medium text-amber-900 dark:text-amber-200">
            Commission Payout Details
          </Typography>
          <Typography variant="bodyXs" className="mt-1 text-amber-800 dark:text-amber-300/80">
            Add your address and bank details below to receive commission payouts. Your commission
            (5% of ex-works value) becomes payable once orders are delivered.
          </Typography>
        </div>
      </div>

      {/* Address Section */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Icon icon={IconHome} size="sm" colorRole="muted" />
          <Typography variant="bodyLg" className="font-semibold">
            Address
          </Typography>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Address Line 1
            </Typography>
            <Input
              type="text"
              placeholder="Street address"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Address Line 2
            </Typography>
            <Input
              type="text"
              placeholder="Apartment, suite, etc. (optional)"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              City
            </Typography>
            <Input
              type="text"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              State / Province
            </Typography>
            <Input
              type="text"
              placeholder="State or Province"
              value={stateProvince}
              onChange={(e) => setStateProvince(e.target.value)}
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Postal Code
            </Typography>
            <Input
              type="text"
              placeholder="Postal code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Country
            </Typography>
            <Input
              type="text"
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Phone Number
            </Typography>
            <Input
              type="tel"
              placeholder="+1 234 567 8900"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </div>
      </div>

      {/* Bank Details Section */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Icon icon={IconBuildingBank} size="sm" colorRole="muted" />
          <Typography variant="bodyLg" className="font-semibold">
            Bank Details
          </Typography>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-md bg-surface-muted p-3">
          <Icon icon={IconInfoCircle} size="sm" className="mt-0.5 text-text-muted" />
          <Typography variant="bodyXs" colorRole="muted">
            Your bank details are securely stored and only used for commission payouts. We recommend
            using IBAN for international transfers.
          </Typography>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Bank Name
            </Typography>
            <Input
              type="text"
              placeholder="e.g., HSBC, Emirates NBD"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Account Holder Name
            </Typography>
            <Input
              type="text"
              placeholder="Name as it appears on account"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Account Number
            </Typography>
            <Input
              type="text"
              placeholder="Account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Sort Code / Routing Number
            </Typography>
            <Input
              type="text"
              placeholder="e.g., 12-34-56"
              value={sortCode}
              onChange={(e) => setSortCode(e.target.value)}
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              IBAN
            </Typography>
            <Input
              type="text"
              placeholder="e.g., AE12 3456 7890 1234 5678 901"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              SWIFT / BIC Code
            </Typography>
            <Input
              type="text"
              placeholder="e.g., HSBCAEADXXX"
              value={swiftBic}
              onChange={(e) => setSwiftBic(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Bank Branch Address
            </Typography>
            <Input
              type="text"
              placeholder="Branch address (optional)"
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
            />
          </div>
        </div>
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
            {updateMutation.isPending ? 'Saving...' : 'Save Details'}
          </ButtonContent>
        </Button>
      </div>
    </div>
  );
};

export default PersonalDetailsSection;
