import Typography from '@/app/_ui/components/Typography/Typography';

/** A titled code sample, shared by the API docs pages */
const CodeBlock = ({
  children,
  title,
}: {
  children: string;
  title?: string;
}) => (
  <div className="border-border-muted bg-background-secondary overflow-hidden rounded-lg border">
    {title && (
      <div className="border-border-muted bg-fill-secondary border-b px-4 py-2">
        <Typography variant="bodySm" className="text-text-muted font-mono">
          {title}
        </Typography>
      </div>
    )}
    <pre className="overflow-x-auto p-4">
      <code className="text-text-primary font-mono text-sm">{children}</code>
    </pre>
  </div>
);

export default CodeBlock;
