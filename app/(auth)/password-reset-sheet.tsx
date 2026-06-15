import React from 'react';
import { PasswordResetScreen } from '../../src/screens/PasswordResetScreen';

// iOS native form sheet presenting the password-reset flow (opened from the login sheet).
export default function PasswordResetSheetRoute() {
  return <PasswordResetScreen mode="sheet" />;
}
