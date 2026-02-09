import React from 'react';
import { DynamicColorIOS, Platform } from 'react-native';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useSession } from '../../src/context/SessionContext';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  const { autoscuolaRole } = useSession();
  const showRoleTab = autoscuolaRole === 'OWNER' || autoscuolaRole === 'INSTRUCTOR';
  const isOwner = autoscuolaRole === 'OWNER';

  const transparent = DynamicColorIOS({
    light: 'transparent',
    dark: 'transparent',
  });
  const defaultLabelColor = DynamicColorIOS({
    light: colors.textMuted,
    dark: colors.textMuted,
  });
  const selectedLabelColor = DynamicColorIOS({
    light: colors.navy,
    dark: colors.navy,
  });

  return (
    <NativeTabs
      iconColor={{
        default: defaultLabelColor,
        selected: selectedLabelColor,
      }}
      labelStyle={{
        default: { color: defaultLabelColor, fontSize: 11 },
        selected: { color: selectedLabelColor, fontSize: 11, fontWeight: '600' },
      }}
      tintColor={selectedLabelColor}
      backgroundColor={Platform.OS === 'ios' ? transparent : colors.backgroundTop}
      blurEffect={Platform.OS === 'ios' ? 'none' : undefined}
      shadowColor={Platform.OS === 'ios' ? transparent : undefined}
      disableTransparentOnScrollEdge={Platform.OS === 'ios' ? false : undefined}
    >
      <NativeTabs.Trigger name="home">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} drawable="ic_menu_view" />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      {showRoleTab ? (
        <NativeTabs.Trigger name="role">
          <Icon
            sf={{ default: isOwner ? 'speedometer' : 'car', selected: isOwner ? 'speedometer' : 'car.fill' }}
            drawable="ic_menu_manage"
          />
          <Label>{isOwner ? 'Istruttore' : 'Gestione'}</Label>
        </NativeTabs.Trigger>
      ) : null}
      <NativeTabs.Trigger name="settings">
        <Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} drawable="ic_menu_preferences" />
        <Label>Impostazioni</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
