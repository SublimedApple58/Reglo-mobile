import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Avatar, ClaySurface } from './clay';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
import { currentAppVersion } from '../config/forceUpdate';
import type { UserPublic } from '../types/regloApi';

/** Rosso clay: solo testo di azioni distruttive o errori (guida REG-639). */
export const CLAY_DANGER = '#C13515';

/**
 * Card profilo clay (tab «Tu» istruttore/titolare e «Profilo» allievo):
 * volto + nome + una riga grigia (ruolo · autoscuola) + chevron. Tocca →
 * modifica profilo. La foto è quella della sessione (`user.photoUrl`, si
 * aggiorna subito dopo il cambio); senza foto, l'`Avatar` clay a iniziali.
 */
export function ProfileSummaryCard({
  user,
  detail,
  onPress,
  testID,
}: {
  user: UserPublic | null;
  detail?: string | null;
  onPress: () => void;
  testID?: string;
}) {
  const name = user?.name?.trim() || user?.email?.split('@')[0] || 'Account';
  const size = 60;
  return (
    <ClaySurface onPress={onPress} style={s.card} testID={testID} accessibilityLabel={`${name}, modifica profilo`}>
      {user?.photoUrl ? (
        <View style={[s.photoWrap, CLAY_SHADOW.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
          <Image source={{ uri: user.photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        </View>
      ) : (
        <Avatar userId={user?.id} name={name} size={size} />
      )}
      <View style={s.main}>
        <Text style={s.name} numberOfLines={1}>
          {name}
        </Text>
        {detail ? (
          <Text style={s.detail} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color={CLAY.chevron} />
    </ClaySurface>
  );
}

/**
 * Riga solo testo dentro una `ClayList` (es. «Esci», «Elimina account»):
 * stessa misura di `ClayListRow`, niente icona; `danger` = testo rosso.
 * Il separatore lo passa `ClayList` (`divider`).
 */
export function ClayTextRow({
  title,
  onPress,
  danger,
  disabled,
  divider,
  testID,
}: {
  title: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.row, pressed && s.pressed, disabled && s.off]}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
    >
      {divider ? <View style={s.divider} /> : null}
      <Text style={[s.rowTitle, danger && { color: CLAY_DANGER }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

/** «Reglo 2.3.0» piccolo e grigio in fondo alle schermate account. */
export function AppVersionFooter() {
  const version = currentAppVersion() ?? Constants.expoConfig?.version ?? null;
  if (!version) return null;
  return <Text style={s.version}>Reglo {version}</Text>;
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18, paddingHorizontal: 18 },
  photoWrap: { backgroundColor: CLAY.surface },
  main: { flex: 1, minWidth: 0 },
  name: { fontSize: 19, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4 },
  detail: { fontSize: 14, lineHeight: 19, color: CLAY.ink3, marginTop: 2 },

  row: { paddingVertical: 15, paddingHorizontal: 18, minHeight: 52, justifyContent: 'center' },
  pressed: { backgroundColor: 'rgba(17,17,17,0.03)' },
  off: { opacity: 0.45 },
  divider: { position: 'absolute', top: 0, left: 18, right: 18, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)' },
  rowTitle: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25 },

  version: { fontSize: 13, color: CLAY.ink4, textAlign: 'center', marginTop: 28 },
});
