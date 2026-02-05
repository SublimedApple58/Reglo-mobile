import React from 'react';
import { useSession } from '../context/SessionContext';
import { AllievoHomeScreen } from './AllievoHomeScreen';
import { IstruttoreHomeScreen } from './IstruttoreHomeScreen';
import { TitolareHomeScreen } from './TitolareHomeScreen';

export const RoleHomeScreen = () => {
  const { autoscuolaRole } = useSession();

  if (autoscuolaRole === 'OWNER') return <TitolareHomeScreen />;
  if (autoscuolaRole === 'INSTRUCTOR') return <IstruttoreHomeScreen />;
  return <AllievoHomeScreen />;
};
