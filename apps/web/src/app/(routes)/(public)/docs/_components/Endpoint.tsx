import Typography from '@/app/_ui/components/Typography/Typography';

/** One endpoint: method, path and what it returns, shared by the API docs pages */
const Endpoint = ({
  method,
  path,
  description,
}: {
  method: string;
  path: string;
  description: string;
}) => (
  <div className="border-border-muted dark:bg-background-secondary flex items-start gap-3 rounded-lg border bg-surface-primary p-4">
    <span className="rounded bg-green-100 px-2 py-1 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
      {method}
    </span>
    <div>
      <Typography variant="bodySm" className="font-mono font-medium">
        {path}
      </Typography>
      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
        {description}
      </Typography>
    </div>
  </div>
);

export default Endpoint;
