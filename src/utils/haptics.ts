// Haptics indirection point.
//
// History: the 31/03 binary (runtime 1.1.1) did NOT bundle expo-haptics, so any
// OTA importing it crashed at launch. While that binary was the production
// target this module was a no-op shim.
//
// From the 1.1.2 native build onward, expo-haptics IS bundled (it's in
// package.json + autolinked by prebuild), so this module simply re-exports the
// real API. Call sites keep importing from `../utils/haptics`, which means
// toggling haptics on/off (e.g. for a future OTA-only window) stays a one-file
// change here.
export {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  selectionAsync,
  notificationAsync,
} from 'expo-haptics';
