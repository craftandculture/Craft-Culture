'use client';

import type { TablerIcon } from '@tabler/icons-react';
import type { ReactNode } from 'react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface HelpSectionProps {
  id: string;
  icon: TablerIcon;
  title: string;
  children: ReactNode;
}

/**
 * A section wrapper for the Help Center with anchor targeting
 */
const HelpSection = ({ id, icon, title, children }: HelpSectionProps) => {
  return (
    <section
      id={id}
      className="scroll-mt-32 rounded-xl border border-border-primary bg-fill-primary p-4 shadow-sm sm:p-6"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200">
          <Icon icon={icon} size="md" />
        </div>
        <Typography variant="headingSm">{title}</Typography>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
};

export default HelpSection;
