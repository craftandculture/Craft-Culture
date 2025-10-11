import { VariantProps, tv } from 'tailwind-variants';

export const tableCaptionStyles = tv({
  base: 'text-text-muted mt-4 text-sm',
});

export interface TableCaptionProps
  extends React.HTMLAttributes<HTMLTableCaptionElement>,
    VariantProps<typeof tableCaptionStyles> {}

const TableCaption = ({ className, ...props }: TableCaptionProps) => {
  return <caption className={tableCaptionStyles({ className })} {...props} />;
};

export default TableCaption;
