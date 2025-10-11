import { VariantProps, tv } from 'tailwind-variants';

export const tableFooterStyles = tv({
  base: 'border-border-primary bg-surface-primary border-t last:[&>tr]:border-b-0',
});

export interface TableFooterProps
  extends React.HTMLAttributes<HTMLTableSectionElement>,
    VariantProps<typeof tableFooterStyles> {}

const TableFooter = ({ className, ...props }: TableFooterProps) => {
  return <tfoot className={tableFooterStyles({ className })} {...props} />;
};

export default TableFooter;
