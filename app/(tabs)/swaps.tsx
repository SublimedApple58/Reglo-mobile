import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/context/SessionContext';
import { useSwapEnabled } from '../../src/hooks/useSwapEnabled';
import { SwapOffersScreen } from '../../src/screens/SwapOffersScreen';

export default function SwapsRoute() {
  const { autoscuolaRole } = useSession();
  const { enabled: swapEnabled, loading: swapLoading } = useSwapEnabled();
  const router = useRouter();
  const isStudent = autoscuolaRole !== 'OWNER' && autoscuolaRole !== 'INSTRUCTOR';
  const canAccess = isStudent && swapEnabled;

  useEffect(() => {
    if (!swapLoading && !canAccess) {
      router.replace('/(tabs)/home');
    }
  }, [swapLoading, canAccess, router]);

  if (swapLoading || !canAccess) return null;
  return <SwapOffersScreen />;
}
