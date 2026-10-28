'use client';

import { IconChevronDown } from '@tabler/icons-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import AdminPageHeader from '@/app/_admin/components/AdminPageHeader';
import AttentionQueue from '@/app/_cellar/components/admin/AttentionQueue';
import RepacksList from '@/app/_cellar/components/admin/RepacksList';
import SharedAccessList from '@/app/_cellar/components/admin/SharedAccessList';
import UkBondList from '@/app/_cellar/components/admin/UkBondList';
import UkMovesList from '@/app/_cellar/components/admin/UkMovesList';
import UkStorageList from '@/app/_cellar/components/admin/UkStorageList';
import CellarMembersList from '@/app/_cellar/components/CellarMembersList';
import SourcingAdmin from '@/app/_cellarSourcing/components/admin/SourcingAdmin';
import ApplicationsList from '@/app/_onboarding/components/admin/ApplicationsList';
import IntakesList from '@/app/_onboarding/components/admin/IntakesList';
import InvitesList from '@/app/_onboarding/components/admin/InvitesList';
import StorageList from '@/app/_onboarding/components/admin/StorageList';

/** The tabs used every day; the rest sit under More so the pills fit one row */
const mainTabs = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'members', label: 'Members' },
  { id: 'applications', label: 'Applications' },
  { id: 'invites', label: 'Invites' },
  { id: 'requests', label: 'Requests' },
] as const;

const moreTabs = [
  { id: 'intakes', label: 'Intakes' },
  { id: 'storage', label: 'Storage' },
  { id: 'uk', label: 'UK bond' },
  { id: 'uk-moves', label: 'UK moves' },
  { id: 'access', label: 'Shared access' },
] as const;

const tabs = [...mainTabs, ...moreTabs];

const pillClass = (isActive: boolean) =>
  `flex-shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-text-primary text-surface-primary'
      : 'bg-surface-muted text-text-muted hover:text-text-primary'
  }`;

/**
 * Cellar members: who holds what, and who is asking to join
 *
 * The tab is in the URL so notifications can link straight to Applications.
 * Needs attention opens first: it is the one tab that answers "is anything
 * waiting on me" without visiting the others.
 */
const CellarMembersPage = () => {
  const searchParams = useSearchParams();
  const tab = tabs.find((item) => item.id === searchParams.get('tab'))?.id ?? 'attention';
  const activeMore = moreTabs.find((item) => item.id === tab);
  const [moreOpen, setMoreOpen] = useState(!!activeMore);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      <AdminPageHeader
        title="Cellar members"
        description="Who holds what with us, and who is asking to join"
      />

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {mainTabs.map((item) => (
          <Link
            key={item.id}
            href={`/platform/admin/cellar-members?tab=${item.id}`}
            className={pillClass(tab === item.id)}
          >
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          className={`${pillClass(!!activeMore)} inline-flex items-center gap-1`}
        >
          {activeMore?.label ?? 'More'}
          <IconChevronDown
            size={14}
            className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {moreOpen && (
        <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {moreTabs.map((item) => (
            <Link
              key={item.id}
              href={`/platform/admin/cellar-members?tab=${item.id}`}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                tab === item.id
                  ? 'bg-text-primary text-surface-primary'
                  : 'border border-border-muted text-text-muted hover:text-text-primary'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-5" />

      {tab === 'applications' && <ApplicationsList />}
      {tab === 'invites' && <InvitesList />}
      {tab === 'intakes' && <IntakesList />}
      {tab === 'storage' && (
        <div className="space-y-8">
          <StorageList />
          <RepacksList />
          <UkStorageList />
        </div>
      )}
      {tab === 'uk' && <UkBondList />}
      {tab === 'uk-moves' && <UkMovesList />}
      {tab === 'requests' && <SourcingAdmin />}
      {tab === 'access' && <SharedAccessList />}
      {tab === 'members' && <CellarMembersList />}
      {tab === 'attention' && <AttentionQueue />}
    </div>
  );
};

export default CellarMembersPage;
