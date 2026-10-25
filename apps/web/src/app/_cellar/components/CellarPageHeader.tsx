import { twMerge } from 'tailwind-merge';

export interface CellarPageHeaderProps {
  /** The page's name, set in the cellar's display serif */
  title: React.ReactNode;
  /** One muted line under the title, such as a greeting or what the page is for */
  description?: React.ReactNode;
  /** The small line above the title; the programme's name by default */
  eyebrow?: React.ReactNode;
  /** Buttons on the right; they stack full width on a phone */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The heading every Private Cellar page opens with
 *
 * One eyebrow, one serif title and one muted line, so moving between tabs
 * never makes the page jump. Actions sit to the right on a wide screen and
 * drop beneath the title, full width, on a phone.
 */
const CellarPageHeader = ({
  title,
  description,
  eyebrow = 'C&C Private Cellar',
  actions,
  className = '',
}: CellarPageHeaderProps) => {
  return (
    <header
      className={twMerge(
        'mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.18em]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-text-primary mt-1 font-(family-name:--font-cellar-serif) text-3xl font-semibold leading-tight tracking-tight sm:text-[2.125rem]">
          {title}
        </h1>
        {description && (
          <div className="text-text-muted mt-1 max-w-2xl text-sm leading-6">
            {description}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-shrink-0 sm:flex-row sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
      )}
    </header>
  );
};

export default CellarPageHeader;
