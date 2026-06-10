// OTA-safe haptics shim.
//
// The production binary (native build 31/03, runtime 1.1.1) does NOT bundle
// expo-haptics' native module. Because the runtimeVersion policy is "appVersion"
// (frozen at 1.1.1), an OTA that imports expo-haptics gets delivered to that
// binary and crashes at launch (`requireNativeModule('ExpoHaptics')` throws).
//
// Until the next native build ships expo-haptics, haptics degrade to no-ops.
// Same API surface as expo-haptics so call sites are a 1-line import swap.
// When a new native build goes out, revert these imports back to 'expo-haptics'.

export enum ImpactFeedbackStyle {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
  Soft = 'soft',
  Rigid = 'rigid',
}

export enum NotificationFeedbackType {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

export const impactAsync = (_style?: ImpactFeedbackStyle): Promise<void> => Promise.resolve();
export const selectionAsync = (): Promise<void> => Promise.resolve();
export const notificationAsync = (_type?: NotificationFeedbackType): Promise<void> => Promise.resolve();
