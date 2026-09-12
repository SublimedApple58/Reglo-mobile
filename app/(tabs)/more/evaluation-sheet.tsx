import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../../src/context/SessionContext';
import { isInstructor, isOwner } from '../../../src/utils/roles';
import { EvaluationSheetScreen } from '../../../src/screens/EvaluationSheetScreen';

// Configurazione del pagellino: titolari E istruttori (sono loro a compilarlo
// ogni giorno). Stesso gate lato server in saveEvaluationSheet.
export default function EvaluationSheetRoute() {
  const { autoscuolaRole } = useSession();
  const router = useRouter();
  const allowed = isOwner(autoscuolaRole) || isInstructor(autoscuolaRole);

  useEffect(() => {
    if (autoscuolaRole && !allowed) router.replace('/(tabs)/home');
  }, [autoscuolaRole, allowed, router]);

  if (!allowed) return null;
  return <EvaluationSheetScreen />;
}
