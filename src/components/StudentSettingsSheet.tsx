import React, { useSyncExternalStore } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { studentSettingsStore } from '../stores/studentSettingsStore';
import { ToggleSwitch } from './ToggleSwitch';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const FLUENT_GRADUATE = require('../../assets/icons/fluent-graduate.png');
const FLUENT_PEOPLE = require('../../assets/icons/fluent-people.png');
const FLUENT_BUILDING = require('../../assets/icons/fluent-building.png');

/**
 * "Impostazioni allievo" in un form sheet: nella scheda allievo le tre righe
 * stavano sempre aperte e la riempivano. Qui hanno spazio — icone 3D comprese —
 * e la scheda torna a parlare solo di guide e pagellino.
 *
 * Padding in fondo: il form sheet non arriva al bordo dello schermo, quindi
 * NON si somma `insets.bottom` (vedi docs/design-system.md §13.2.1).
 */
export function StudentSettingsSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(studentSettingsStore.subscribe, studentSettingsStore.get);

  if (!data) return <View style={s.root} />;

  return (
    <View style={[s.root, { paddingTop: 22, paddingBottom: Math.max(insets.bottom - 16, 18) }]}>
      <View style={s.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>Impostazioni</Text>
          {data.studentName ? <Text style={s.hint}>{data.studentName}</Text> : null}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [s.x, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      {data.group ? (
        <View style={s.row}>
          <Image source={FLUENT_PEOPLE} style={s.icon} />
          <View style={s.body}>
            <Text style={s.rowTitle}>Guide di gruppo</Text>
            <Text style={s.rowSub}>{data.group.value ? 'Può partecipare' : 'Non può partecipare'}</Text>
          </View>
          <ToggleSwitch
            value={data.group.value}
            disabled={data.group.saving}
            onValueChange={data.group.onChange}
          />
        </View>
      ) : null}

      {data.examReady ? (
        <View style={s.row}>
          <Image source={FLUENT_GRADUATE} style={s.icon} />
          <View style={s.body}>
            <Text style={s.rowTitle}>Pronto per l&apos;esame</Text>
            <Text style={s.rowSub}>{data.examReady.value ? 'Segnato come pronto' : 'Non segnato'}</Text>
          </View>
          <ToggleSwitch
            value={data.examReady.value}
            disabled={data.examReady.saving}
            onValueChange={data.examReady.onChange}
          />
        </View>
      ) : null}

      {data.location ? (
        <Pressable
          onPress={data.location.onPress}
          style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}
        >
          <Image source={FLUENT_BUILDING} style={s.icon} />
          <View style={s.body}>
            <Text style={s.rowTitle}>Luogo di default</Text>
            <Text style={s.rowSub} numberOfLines={1}>{data.location.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#C4C4C4" />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', paddingBottom: 18, gap: 12 },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  hint: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginTop: 3 },
  x: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#F1F2F4', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  icon: { width: 40, height: 40 },
  body: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15.5, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  rowSub: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginTop: 2 },
});
