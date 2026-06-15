import React from 'react';
import { Platform } from 'react-native';
import { SignupScreen } from '../../src/screens/SignupScreen';

// iOS → native page sheet · Android → full navy screen.
export default function SignupRoute() {
  return <SignupScreen mode={Platform.OS === 'ios' ? 'sheet' : 'inline'} />;
}
