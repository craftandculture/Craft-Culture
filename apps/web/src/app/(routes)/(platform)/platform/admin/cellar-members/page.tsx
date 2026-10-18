'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import AttentionQueue from '@/app/_cellar/components/admin/AttentionQueue';
import UkBondList from '@/app/_cellar/components/admin/UkBondList';
import UkMovesList from '@/app/_cellar/components/admin/UkMovesList';
import CellarMembersList from '@/app/_cellar/components/CellarMembersList';
import ApplicationsList from '@/app/_onboarding/components/admin/ApplicationsList';
import IntakesList from '@/app/_onboarding/components/admin/IntakesList';
import InvitesList from '@/app/_onboarding/components/admin/InvitesList';
import StorageList from '@/app/_onboarding/components/admin/StorageList';

const tabs = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'members', label: 'Members' },
  { id: 'applications', label: 'Applications' },
  { id: 'invites', label: 'Invites' },
  { id: 'intakes', label: 'Intakes' },
  { id: 'storage', label: 'Storage' },
  { id: 'uk', label: 'UK bond' },
  { id: 'uk-moves', label: 'UK moves' },
] as const;

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

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Cellar members</h1>

      <div className="-mx-4 mb-5 mt-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/platform/admin/cellar-members?tab=${item.id}`}
            className={`flex-shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              tab === item.id
                ? 'bg-text-primary text-surface-primary'
                : 'bg-surface-muted text-text-muted hover:text-text-primary'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === 'applications' && <ApplicationsList />}
      {tab === 'invites' && <InvitesList />}
      {tab === 'intakes' && <IntakesList />}
      {tab === 'storage' && <StorageList />}
      {tab === 'uk' && <UkBondList />}
      {tab === 'uk-moves' && <UkMovesList />}
      {tab === 'members' && <CellarMembersList />}
      {tab === 'attention' && <AttentionQueue />}
    </div>
  );
};

export default CellarMembersPage;
