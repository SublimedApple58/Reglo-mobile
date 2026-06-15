import React from 'react';
import { LoginScreen } from '../../src/screens/LoginScreen';

// iOS native form sheet presenting the login form (opened from the welcome screen).
export default function LoginSheetRoute() {
  return <LoginScreen mode="sheet" />;
}
