'use client';

export interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

/**
 * A native select styled to match the platform's Input control
 *
 * The import wizard needs a dozen of these for column mapping, where a native
 * select's keyboard behaviour and rendering cost both beat a custom listbox.
 */
const SelectField = ({ label, className, children, ...props }: SelectFieldProps) => {
  return (
    <label className="flex flex-col gap-1">
      {label ? (
        <span className="text-text-muted text-xs font-medium tracking-tight">
          {label}
        </span>
      ) : null}
      <select
        className={`border-border-primary bg-fill-primary text-text-primary focus:ring-border-primary min-h-9 rounded-lg border border-b-2 px-2.5 text-sm font-medium tracking-tight focus:outline-none focus:ring-2 ${className ?? ''}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
};

export default SelectField;
