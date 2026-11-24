/**
 * Layout for branded partner integration documents
 *
 * No app header, footer or theme toggle: these pages are documents sent to a
 * partner's technical team, set in the C&C document style (the same as the
 * Index Manual), and carry their own header band.
 */
const ApiDocsLayout = ({ children }: React.PropsWithChildren) => {
  return <div className="min-h-dvh bg-[#F2F1ED]">{children}</div>;
};

export default ApiDocsLayout;
