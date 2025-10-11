'use client';

import NavigationMenu from '@/app/_shared-platform/components/NavigationMenu';
import NavigationItemContent from '@/app/_ui/components/NavigationItem/NavigationItemContent';

import SubheaderNavigationItem from '../../_shared-platform/components/NavigationMenuItem';

const ProfileSettingsSideMenu = () => {
  return (
    <>
      <NavigationMenu
        direction="vertical"
        className="border-border-primary min-w-64 border-l"
      >
        <SubheaderNavigationItem href="/profile/settings/general">
          <NavigationItemContent align="start">Profiel</NavigationItemContent>
        </SubheaderNavigationItem>
      </NavigationMenu>
    </>
  );
};

export default ProfileSettingsSideMenu;
