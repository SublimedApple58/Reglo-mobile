import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';

/**
 * Campanella delle notifiche (REG-638): quando la tab bar dell'istruttore ha
 * Road al centro, «Notifiche» esce dalla barra e si apre da qui.
 */
export function InboxBellButton({ style, glass }: { style?: StyleProp<ViewStyle>; glass?: boolean }) {
  const router = useRouter();
  const unread = useUnreadNotifications();
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/inbox')}
      hitSlop={8}
      style={({ pressed }) => [s.btn, glass && s.glass, pressed && { opacity: 0.7 }, style]}
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
  btn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F2F0' },
  glass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
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
