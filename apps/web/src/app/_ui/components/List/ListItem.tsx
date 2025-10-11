import { VariantProps, tv } from 'tailwind-variants';

export const listItemStyles = tv({
  base: 'border-border-primary bg-surface-primary not-last:border-b border-x first:rounded-t-lg first:border-t last:rounded-b-lg last:border-b-2',
});

export interface ListItemProps
  extends VariantProps<typeof listItemStyles>,
    React.HTMLAttributes<HTMLDivElement> {}

const ListItem = ({ className, ...props }: ListItemProps) => {
  return <div className={listItemStyles({ className })} {...props} />;
};

export default ListItem;
