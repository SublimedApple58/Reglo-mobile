import React from 'react';
import { AuthNavigator } from './AuthNavigator';
import { TabNavigator } from './TabNavigator';
import { CompanySelectScreen } from '../screens/CompanySelectScreen';
import { LoadingScreen } from '../screens/LoadingScreen';
import { RoleBlockedScreen } from '../screens/RoleBlockedScreen';
import { useSession } from '../context/SessionContext';

export const RootNavigator = () => {
  const { status, autoscuolaRole } = useSession();

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'unauthenticated') return <AuthNavigator />;
  if (status === 'company_select') return <CompanySelectScreen />;
  if (!autoscuolaRole) return <RoleBlockedScreen />;
  return <TabNavigator />;
};
