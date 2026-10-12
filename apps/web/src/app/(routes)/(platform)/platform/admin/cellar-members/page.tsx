'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import CellarMembersList from '@/app/_cellar/components/CellarMembersList';
import ApplicationsList from '@/app/_onboarding/components/admin/ApplicationsList';
import IntakesList from '@/app/_onboarding/components/admin/IntakesList';
import InvitesList from '@/app/_onboarding/components/admin/InvitesList';
import StorageList from '@/app/_onboarding/components/admin/StorageList';

const tabs = [
  { id: 'members', label: 'Members' },
  { id: 'applications', label: 'Applications' },
  { id: 'invites', label: 'Invites' },
  { id: 'intakes', label: 'Intakes' },
  { id: 'storage', label: 'Storage' },
] as const;

/**
 * Cellar members: who holds what, and who is asking to join
 *
 * The tab is in the URL so notifications can link straight to Applications.
 */
const CellarMembersPage = () => {
  const searchParams = useSearchParams();
  const tab = tabs.find((item) => item.id === searchParams.get('tab'))?.id ?? 'members';

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Cellar members</h1>

      <div className="mb-5 mt-4 flex gap-1.5">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/platform/admin/cellar-members?tab=${item.id}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
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
      {tab === 'members' && <CellarMembersList />}
    </div>
  );
};

export default CellarMembersPage;
