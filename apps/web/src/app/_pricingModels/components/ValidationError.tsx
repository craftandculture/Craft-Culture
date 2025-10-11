import { IconAlertCircle } from '@tabler/icons-react';

import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface ValidationErrorProps {
  error: string;
}

const ValidationError = ({ error }: ValidationErrorProps) => {
  const lines = error.split('\n');
  const title = lines[0];
  const details = lines.slice(1).filter((line) => line.trim());

  return (
    <div className="border-border-danger bg-background-danger/10 rounded-lg border p-4">
      <div className="flex gap-3">
        <Icon icon={IconAlertCircle} size="lg" colorRole="danger" className="mt-0.5" />
        <div className="flex-1 space-y-2">
          <Typography variant="bodySm" className="text-text-danger font-medium">
            {title}
          </Typography>
          {details.length > 0 && (
            <div className="space-y-1">
              {details.map((line, index) => (
                <Typography
                  key={index}
                  variant="bodyXs"
                  className="text-text-danger/80 font-mono"
                >
                  {line}
                </Typography>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ValidationError;
