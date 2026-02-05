import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { IstruttoreHomeScreen } from '../screens/IstruttoreHomeScreen';
import { RoleHomeScreen } from '../screens/RoleHomeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { GlassTabBar } from '../components/GlassTabBar';
import { useSession } from '../context/SessionContext';

export type RootTabParamList = {
  Home: undefined;
  Istruttore: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export const TabNavigator = () => {
  const { autoscuolaRole } = useSession();
  const showInstructorTab = autoscuolaRole === 'OWNER';

  return (
    <Tab.Navigator
      key={autoscuolaRole ?? 'none'}
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
    >
      <Tab.Screen name="Home" component={RoleHomeScreen} />
      {showInstructorTab ? (
        <Tab.Screen name="Istruttore" component={IstruttoreHomeScreen} />
      ) : null}
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};
