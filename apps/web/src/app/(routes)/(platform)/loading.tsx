import Icon from '@/app/_ui/components/Icon/Icon';
import IconSpinner from '@/app/_ui/components/Icon/IconSpinner';

/* Neutral spinner; no full-height wrapper, so the footer stays on screen */
const PlatformLoading = () => {
  return (
    <main className="flex flex-1 items-center justify-center py-24">
      <Icon icon={IconSpinner} colorRole="muted" size="lg" className="text-text-muted" />
    </main>
  );
};

export default PlatformLoading;
