import { IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';

export interface AdminPageHeaderCrumb {
  label: string;
  href?: string;
}

export interface AdminPageHeaderProps {
  title: React.ReactNode;
  /** One muted line under the title saying what the page is for */
  description?: React.ReactNode;
  /**
   * The trail between "Admin" and the title, for pages a level down
   * (e.g. `[{ label: 'Shipments', href: '/platform/admin/logistics/shipments' }]`)
   */
  crumbs?: AdminPageHeaderCrumb[];
  /** Buttons on the right; near-black for the one primary action */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The page header every admin screen uses
 *
 * Breadcrumb, title, one line of explanation and the page's actions on the
 * right, as on Team Tasks. One component, so the 100-odd admin pages cannot
 * drift apart again.
 *
 * @example
 *   <AdminPageHeader
 *     title="Private Client Orders"
 *     description="Orders from wine partners for their private clients"
 *     actions={<Button>New order</Button>}
 *   />
 */
const AdminPageHeader = ({
  title,
  description,
  crumbs = [],
  actions,
  className = '',
}: AdminPageHeaderProps) => {
  return (
    <div
      className={`mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        <nav
          aria-label="Breadcrumb"
          className="mb-1 flex flex-wrap items-center gap-1.5 text-sm text-text-muted"
        >
          <Link href="/platform/admin/home" className="transition-colors hover:text-text-primary">
            Admin
          </Link>
          {crumbs.map((crumb) => (
            <span key={crumb.label} className="flex items-center gap-1.5">
              <IconChevronRight className="size-4" />
              {crumb.href ? (
                <Link href={crumb.href} className="transition-colors hover:text-text-primary">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
            </span>
          ))}
          <IconChevronRight className="size-4" />
          <span className="truncate text-text-primary">{title}</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
};

export default AdminPageHeader;
