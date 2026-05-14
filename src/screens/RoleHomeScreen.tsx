import React from 'react';
import { useSession } from '../context/SessionContext';
import { isInstructor } from '../utils/roles';
import { useStudentPhase } from '../hooks/useStudentPhase';
import { AllievoHomeScreen } from './AllievoHomeScreen';
import { AllievoTheoryHomeScreen } from './AllievoTheoryHomeScreen';
import { AllievoLicensedScreen } from './AllievoLicensedScreen';
import { IstruttoreHomeScreen } from './IstruttoreHomeScreen';
import { TitolareHomeScreen } from './TitolareHomeScreen';

export const RoleHomeScreen = () => {
  const { autoscuolaRole } = useSession();
  const { phase } = useStudentPhase();

  if (autoscuolaRole === 'OWNER') return <TitolareHomeScreen />;
  if (isInstructor(autoscuolaRole)) return <IstruttoreHomeScreen />;
  if (phase === 'TEORIA') return <AllievoTheoryHomeScreen />;
  if (phase === 'PATENTATO') return <AllievoLicensedScreen />;
  return <AllievoHomeScreen />;
};
