'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { IconChevronDown, IconShieldCheck, IconUser } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Command from '@/app/_ui/components/Command/Command';
import CommandEmpty from '@/app/_ui/components/Command/CommandEmpty';
import CommandInput from '@/app/_ui/components/Command/CommandInput';
import CommandItem from '@/app/_ui/components/Command/CommandItem';
import CommandList from '@/app/_ui/components/Command/CommandList';
import Icon from '@/app/_ui/components/Icon/Icon';
import Popover from '@/app/_ui/components/Popover/Popover';
import PopoverContent from '@/app/_ui/components/Popover/PopoverContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import type { PrivateClientContact } from '@/database/schema';
import { useTRPCClient } from '@/lib/trpc/browser';

interface ClientsComboboxProps {
  onSelect: (client: PrivateClientContact) => void;
  value?: PrivateClientContact | null;
  placeholder?: string;
}

/**
 * Combobox for selecting existing client contacts
 */
const ClientsCombobox = ({
  onSelect,
  value,
  placeholder = 'Select a client...',
}: ClientsComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const trpcClient = useTRPCClient();

  const isDebouncing = search !== debouncedSearch;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['privateClientContacts.getMany', { search: debouncedSearch || undefined, limit: 50 }],
    queryFn: () =>
      trpcClient.privateClientContacts.getMany.query({
        search: debouncedSearch || undefined,
        limit: 50,
      }),
    enabled: open && !isDebouncing,
  });

  const clients = data?.data ?? [];

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleSelect = (client: PrivateClientContact) => {
    onSelect(client);
    setOpen(false);
    setSearch('');
    setDebouncedSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between">
          {value ? (
            <div className="flex items-center gap-2 text-left">
              <Icon icon={IconUser} size="sm" colorRole="muted" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{value.name}</span>
                  {value.cityDrinksVerifiedAt && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <IconShieldCheck size={10} />
                      <span className="text-[9px] font-medium">Verified</span>
                    </span>
                  )}
                </div>
                {value.email && (
                  <span className="text-xs text-text-muted">{value.email}</span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-text-muted font-normal">{placeholder}</span>
          )}
          <IconChevronDown size={16} className="shrink-0 opacity-50" />
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverContent
        className="min-w-(--radix-popover-trigger-width) max-w-(--radix-popover-content-available-width) p-0"
        sideOffset={8}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search clients by name or email..."
            value={search}
            onValueChange={handleSearchChange}
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <div className="py-6 text-center text-sm">Loading...</div>
            ) : clients.length === 0 ? (
              <CommandEmpty>
                {isDebouncing ? 'Searching...' : 'No clients found'}
              </CommandEmpty>
            ) : (
              clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.id}
                  onSelect={() => handleSelect(client)}
                  className="flex items-center gap-3"
                >
                  <Icon icon={IconUser} size="sm" colorRole="muted" />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <Typography variant="bodySm" className="font-medium">
                        {client.name}
                      </Typography>
                      {client.cityDrinksVerifiedAt && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <IconShieldCheck size={10} />
                          <span className="text-[9px] font-medium">Verified</span>
                        </span>
                      )}
                    </div>
                    <Typography variant="bodyXs" colorRole="muted">
                      {[client.email, client.phone].filter(Boolean).join(' · ')}
                    </Typography>
                  </div>
                </CommandItem>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ClientsCombobox;
