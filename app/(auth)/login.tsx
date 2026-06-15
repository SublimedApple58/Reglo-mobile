import React from 'react';
import { Platform } from 'react-native';
import { AuthWelcomeScreen } from '../../src/screens/AuthWelcomeScreen';
import { LoginScreen } from '../../src/screens/LoginScreen';

// iOS → navy brand welcome (login form opens as a native sheet).
// Android → full navy login form inline (B1).
export default function LoginRoute() {
  return Platform.OS === 'ios' ? <AuthWelcomeScreen /> : <LoginScreen mode="inline" />;
}
