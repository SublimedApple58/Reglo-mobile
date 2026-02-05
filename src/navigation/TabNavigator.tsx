import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RoleHomeScreen } from '../screens/RoleHomeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { InstructorManageScreen } from '../screens/InstructorManageScreen';
import { OwnerInstructorScreen } from '../screens/OwnerInstructorScreen';
import { GlassTabBar } from '../components/GlassTabBar';
import { useSession } from '../context/SessionContext';

export type RootTabParamList = {
  Home: undefined;
  Istruttore: undefined;
  Gestione: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export const TabNavigator = () => {
  const { autoscuolaRole } = useSession();
  const showInstructorTab = autoscuolaRole === 'OWNER' || autoscuolaRole === 'INSTRUCTOR';
  const isOwner = autoscuolaRole === 'OWNER';

  return (
    <Tab.Navigator
      key={autoscuolaRole ?? 'none'}
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
    >
      <Tab.Screen name="Home" component={RoleHomeScreen} />
      {showInstructorTab ? (
        isOwner ? (
          <Tab.Screen name="Istruttore" component={OwnerInstructorScreen} />
        ) : (
          <Tab.Screen name="Gestione" component={InstructorManageScreen} />
        )
      ) : null}
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};
