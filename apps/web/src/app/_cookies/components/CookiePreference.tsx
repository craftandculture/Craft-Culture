import Switch from '@/app/_ui/components/Switch/Switch';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface CookiePreferenceProps {
  title: string;
  description: string;
  alwaysActive?: boolean;
  value?: boolean;
  onChange?: (value: boolean) => void;
}

const CookiePreference = ({
  alwaysActive = false,
  title,
  description,
  value = false,
  onChange,
}: CookiePreferenceProps) => {
  return (
    <button
      className="bg-fill-muted/50 hover:bg-fill-muted-hover flex flex-col gap-1.5 p-3 text-start"
      onClick={() => onChange && onChange(!value)}
    >
      <div className="flex w-full justify-between">
        <Typography variant="labelSm">{title}</Typography>
        {alwaysActive ? (
          <Typography variant="bodyXs">Always active</Typography>
        ) : (
          <Switch checked={value} onCheckedChange={onChange} size="sm" />
        )}
      </div>
      <Typography variant="bodySm" colorRole="muted">
        {description}
      </Typography>
    </button>
  );
};

export default CookiePreference;
