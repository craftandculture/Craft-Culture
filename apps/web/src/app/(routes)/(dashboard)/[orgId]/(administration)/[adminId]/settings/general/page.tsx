import SettingAdministrationName from '@/app/_settings/components/SettingAdministrationName';
import SettingAdministrationWebsite from '@/app/_settings/components/SettingAdministrationWebsite';
import SettingDeleteAdministration from '@/app/_settings/components/SettingDeleteAdministration';

const Page = async () => {
  return (
    <>
      <SettingAdministrationName />
      <SettingAdministrationWebsite />
      <SettingDeleteAdministration />
    </>
  );
};

export default Page;
