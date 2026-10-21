import { VariantProps, tv } from 'tailwind-variants';

export const tableStyles = tv({
  slots: {
    // Scrolls sideways when the table is wider than the screen, as on a phone
    wrapper: 'w-full overflow-x-auto',
    table: 'w-full caption-bottom border-separate border-spacing-0 text-sm',
  },
});

export interface TableProps
  extends React.HTMLAttributes<HTMLTableElement>,
    VariantProps<typeof tableStyles> {}

const { table, wrapper } = tableStyles();

const Table = ({ className, ...props }: TableProps) => {
  return (
    <div className={wrapper()}>
      <table className={table({ className })} {...props} />
    </div>
  );
};

export default Table;
