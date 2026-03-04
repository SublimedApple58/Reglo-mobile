import React from 'react';
import { SettingsScreen } from '../../src/screens/SettingsScreen';
import { useLazyTabRender } from '../../src/hooks/useLazyTabRender';

export default function SettingsRoute() {
  const { shouldRender } = useLazyTabRender();

  if (!shouldRender) return null;
  return <SettingsScreen />;
}
