'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { sectionForPath, visibleAdminNav } from '@/app/_admin/constants/adminNav';
import Icon from '@/app/_ui/components/Icon/Icon';
import useTRPC from '@/lib/trpc/browser';

interface AdminTopNavProps {
  userRole?: string;
}

/** The top-level section the current page belongs to, from the shared menu */
const getSectionFromPathname = sectionForPath;

/**
 * Admin top navigation bar with 6 section items
 * Replaces the old sidebar + header pill navigation
 */
const AdminTopNav = ({ userRole }: AdminTopNavProps) => {
  const pathname = usePathname();
  const currentSection = getSectionFromPathname(pathname);
  const api = useTRPC();

  // Your own open parts on Team Tasks; red when any is overdue. Partner
  // logins with an admin role are refused by the server and show no badge.
  const { data: taskCount } = useQuery({
    ...api.teamTasks.myCount.queryOptions(),
    retry: false,
    refetchInterval: 60_000,
  });

  const visibleItems = visibleAdminNav({ role: userRole }).filter((item) => item.inTopNav);

  // From lg up; below it the phone menu takes over, as nine items crowd a tablet
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {visibleItems.map((item) => {
        const isActive = currentSection === item.key;

        return (
          <Link
            key={item.key}
            href={item.href}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-fill-brand/10 text-text-brand'
                : 'text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
            }`}
          >
            <Icon icon={item.icon} size="sm" className={isActive ? 'text-text-brand' : ''} />
            <span>{item.label}</span>
            {item.key === 'tasks' && taskCount && taskCount.open > 0 && (
              <span
                className={`ml-0.5 min-w-[18px] rounded-full px-1.5 text-center text-[11px] font-semibold leading-[18px] ${
                  taskCount.overdue > 0 ? 'bg-fill-danger text-text-danger-on-fill' : 'bg-fill-brand/15 text-text-brand'
                }`}
                title={taskCount.overdue > 0 ? `${taskCount.overdue} overdue` : `${taskCount.open} open`}
              >
                {taskCount.open}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
};

export { getSectionFromPathname };
export default AdminTopNav;
