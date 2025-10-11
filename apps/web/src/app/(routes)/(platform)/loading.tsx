import Icon from '@/app/_ui/components/Icon/Icon';
import IconSpinner from '@/app/_ui/components/Icon/IconSpinner';

const PlatformLoading = () => {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center">
      <Icon icon={IconSpinner} colorRole="brand" size="lg" />
    </main>
  );
};

export default PlatformLoading;
