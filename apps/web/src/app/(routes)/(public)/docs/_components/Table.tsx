/** A bordered table with a header row, shared by the API docs pages */
const Table = ({
  head,
  children,
}: {
  head: string[];
  children: React.ReactNode;
}) => (
  <div className="border-border-muted overflow-x-auto rounded-lg border">
    <table className="w-full">
      <thead className="bg-fill-secondary">
        <tr>
          {head.map((h) => (
            <th key={h} className="px-4 py-3 text-left text-sm font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export default Table;
