import { twMerge } from 'tailwind-merge';

export interface CellarPageHeaderProps {
  /** The page's name */
  title: React.ReactNode;
  /** One muted line under the title, such as a greeting or what the page is for */
  description?: React.ReactNode;
  /** A small muted line above the title; none by default */
  eyebrow?: React.ReactNode;
  /** Buttons on the right; they stack full width on a phone */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The heading every Private Cellar page opens with
 *
 * The same heading as Team Tasks and Stock Explorer: a plain title and one
 * muted line, so the cellar reads as part of Index. Actions sit to the right
 * on a wide screen and drop beneath the title, full width, on a phone.
 */
const CellarPageHeader = ({
  title,
  description,
  eyebrow,
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
        {eyebrow && <p className="text-text-muted mb-1 text-sm">{eyebrow}</p>}
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {description && (
          <div className="text-text-muted mt-0.5 max-w-2xl text-sm">
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
