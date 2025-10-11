import SettingAdministrationDescription from '@/app/_settings/components/SettingAdministrationDescription';
import SettingModelVersion from '@/app/_settings/components/SettingModelVersion';
import SettingUseAutomaticProcessing from '@/app/_settings/components/SettingUseAutomaticProcessing';
const Page = async () => {
  return (
    <>
      <SettingUseAutomaticProcessing />
      <SettingModelVersion />
      <SettingAdministrationDescription />
    </>
  );
};

export default Page;
