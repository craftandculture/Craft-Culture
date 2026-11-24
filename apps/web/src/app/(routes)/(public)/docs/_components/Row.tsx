/** One row of a field table, shared by the API docs pages */
const Row = ({
  name,
  type,
  children,
}: {
  name: string;
  type: string;
  children: React.ReactNode;
}) => (
  <tr className="border-border-muted border-t align-top">
    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm">{name}</td>
    <td className="text-text-muted whitespace-nowrap px-4 py-3 font-mono text-sm">
      {type}
    </td>
    <td className="px-4 py-3 text-sm">{children}</td>
  </tr>
);

export default Row;
