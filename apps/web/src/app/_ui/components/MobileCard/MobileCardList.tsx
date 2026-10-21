/**
 * A list of MobileCards, shown below md only
 *
 * Pair it with the desktop table wrapped in `hidden md:block`: one set of rows,
 * two layouts, so a phone reads cards instead of scrolling a wide table.
 *
 * @example
 *   <div className="hidden md:block"><table>…</table></div>
 *   <MobileCardList>{rows.map((r) => <MobileCard key={r.id} title={r.name} />)}</MobileCardList>
 */
const MobileCardList = ({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) => (
  <ul className={`divide-y divide-border-muted overflow-hidden rounded-xl border border-border-muted bg-surface-primary md:hidden ${className}`}>
    {children}
  </ul>
);

export default MobileCardList;
