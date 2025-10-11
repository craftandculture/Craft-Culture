import SettingChangeEmail from '@/app/_settings/components/SettingChangeEmail';
import SettingChangePassword from '@/app/_settings/components/SettingChangePassword';
import SettingProfileDetails from '@/app/_settings/components/SettingProfileName';

export const dynamic = 'force-dynamic';

const Page = async () => {
  return (
    <>
      <SettingProfileDetails />
      <SettingChangeEmail />
      <SettingChangePassword />
    </>
  );
};

export default Page;
