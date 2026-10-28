import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { CLAY_SHADOW } from '../theme/clay';

/** Cerchio bianco clay in rilievo delle azioni in testa (orologio, campanella). */
export const headerCircle: ViewStyle = {
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#FFFFFF',
  // Clay v2 (REG-639): stesso rilievo dei bottoni icona (`raiseSm`).
  ...CLAY_SHADOW.raiseSm,
};

/**
 * Disponibilità (REG-638, «T1 piatta»): l'istruttore la apre dall'orologio
 * nell'intestazione dell'Agenda invece che da una tab.
 */
export function AvailabilityButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/role')}
      hitSlop={8}
      style={({ pressed }) => [headerCircle, pressed && CLAY_SHADOW.sink, style]}
      accessibilityRole="button"
      accessibilityLabel="Disponibilità"
      testID="availability-button"
    >
      <Ionicons name="time-outline" size={22} color="#111111" />
    </Pressable>
  );
}

/**
 * Campanella delle notifiche (REG-638, tab bar «T1 piatta»): per l'istruttore
 * «Notifiche» non è più nella barra e si apre da qui.
 */
export function InboxBellButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const unread = useUnreadNotifications();
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/inbox')}
      hitSlop={8}
      style={({ pressed }) => [headerCircle, pressed && CLAY_SHADOW.sink, style]}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifiche, ${unread} da leggere` : 'Notifiche'}
      testID="inbox-bell"
    >
      <Ionicons name="notifications-outline" size={22} color="#111111" />
      {unread > 0 ? (
        <View style={s.badge}>
          <Text style={s.badgeTx}>{unread > 9 ? '9+' : String(unread)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -2,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#C13515',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeTx: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
});
