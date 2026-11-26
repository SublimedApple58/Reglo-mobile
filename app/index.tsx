import React from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '../src/context/SessionContext';
import { homeRouteFor } from '../src/utils/roles';

export default function Index() {
  // Titolari su «Oggi» (REG-794), gli altri sulla home.
  const { autoscuolaRole } = useSession();
  return <Redirect href={homeRouteFor(autoscuolaRole)} />;
}
