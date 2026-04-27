import React from 'react';
import { useSession } from '../context/SessionContext';
import { isInstructor } from '../utils/roles';
import { AllievoHomeScreen } from './AllievoHomeScreen';
import { IstruttoreHomeScreen } from './IstruttoreHomeScreen';
import { TitolareHomeScreen } from './TitolareHomeScreen';

export const RoleHomeScreen = () => {
  const { autoscuolaRole } = useSession();

  if (autoscuolaRole === 'OWNER') return <TitolareHomeScreen />;
  if (isInstructor(autoscuolaRole)) return <IstruttoreHomeScreen />;
  return <AllievoHomeScreen />;
};
