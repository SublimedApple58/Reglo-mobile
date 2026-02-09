import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { regloApi } from './regloApi';

const PUSH_TOKEN_KEY = 'reglo_push_token';
const PUSH_INTENT_KEY = 'reglo_push_intent';

let listenersBound = false;
const intentListeners = new Set<(intent: string) => void>();

const getProjectId = () => {
  const easConfig = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig;
  if (easConfig?.projectId) return easConfig.projectId;

  const expoConfig = (Constants as unknown as {
    expoConfig?: { extra?: { eas?: { projectId?: string } } };
  }).expoConfig;
  return expoConfig?.extra?.eas?.projectId;
};

const requestPushPermission = async () => {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const next = await Notifications.requestPermissionsAsync();
  return next.granted || next.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
};

const savePushIntent = async (value: string) => {
  await SecureStore.setItemAsync(PUSH_INTENT_KEY, value);
};

const extractIntent = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const value = record.kind ?? record.intent ?? record.type;
  return typeof value === 'string' ? value : null;
};

const emitIntent = (intent: string | null) => {
  if (!intent) return;
  intentListeners.forEach((listener) => {
    try {
      listener(intent);
    } catch (error) {
      console.warn('[Push] Intent listener error', error);
    }
  });
};

const ensureListeners = () => {
  if (listenersBound) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  Notifications.addNotificationReceivedListener((notification) => {
    const intent = extractIntent(notification.request.content.data);
    emitIntent(intent);
  });

  Notifications.addNotificationResponseReceivedListener((response) => {
    const intent = extractIntent(response.notification.request.content.data);
    if (intent) {
      savePushIntent(intent).catch(() => undefined);
    }
    emitIntent(intent);
  });

  listenersBound = true;
};

export const registerPushToken = async () => {
  if (Platform.OS === 'web') return;
  if (!Device.isDevice) return;
  ensureListeners();

  const granted = await requestPushPermission();
  if (!granted) return;

  const projectId = getProjectId();
  let token: string | null = null;

  if (projectId) {
    try {
      const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenRes.data;
    } catch (error) {
      console.warn('[Push] getExpoPushTokenAsync with projectId failed', error);
    }
  }

  if (!token) {
    const tokenRes = await Notifications.getExpoPushTokenAsync();
    token = tokenRes.data;
  }

  await regloApi.registerPushToken({
    token,
    platform: Platform.OS === 'android' ? 'android' : 'ios',
  });
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
};

export const unregisterPushToken = async () => {
  if (Platform.OS === 'web') return;

  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (!token) return;

  try {
    await regloApi.unregisterPushToken({ token });
  } finally {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  }
};

export const consumePendingPushIntent = async () => {
  const intent = await SecureStore.getItemAsync(PUSH_INTENT_KEY);
  if (intent) {
    await SecureStore.deleteItemAsync(PUSH_INTENT_KEY);
  }
  return intent;
};

export const consumePendingOrLaunchPushIntent = async () => {
  const pending = await consumePendingPushIntent();
  if (pending) return pending;
  const response = await Notifications.getLastNotificationResponseAsync();
  const intent = extractIntent(response?.notification.request.content.data);
  if (intent) {
    await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  }
  return intent;
};

export const subscribePushIntent = (listener: (intent: string) => void) => {
  ensureListeners();
  intentListeners.add(listener);
  return () => {
    intentListeners.delete(listener);
  };
};
