import React, { useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { instructorSettingsStore, type AgendaViewMode } from '../../../src/stores/instructorSettingsStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const OPTIONS: { value: AgendaViewMode; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'day', label: 'Giornaliera', desc: 'Vedi un giorno alla volta', icon: 'calendar-outline' },
  { value: 'week', label: 'Settimanale', desc: "Vedi tutta la settimana", icon: 'list-outline' },
  { value: 'grid', label: 'Griglia', desc: 'La settimana a griglia oraria', icon: 'grid-outline' },
];

export default function AgendaViewScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(instructorSettingsStore.subscribe, instructorSettingsStore.get);
  if (!data) return <View style={s.root} />;

  const { agendaViewMode, onPickAgendaView } = data;

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <SheetScaffold>
        <Text style={s.title}>Vista agenda</Text>
        <Text style={s.subtitle}>Come visualizzi l'agenda delle guide.</Text>

        <View style={s.list}>
          {OPTIONS.map((opt) => {
            const active = agendaViewMode === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => { onPickAgendaView(opt.value); router.back(); }}
                style={({ pressed }) => [s.optRow, active && s.optRowActive, pressed && { opacity: 0.9 }]}
              >
                <View style={s.optIcon}>
                  <Ionicons name={opt.icon} size={20} color={active ? '#1A1A2E' : '#9CA3AF'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.optLabel}>{opt.label}</Text>
                  <Text style={s.optDesc}>{opt.desc}</Text>
                </View>
                {active ? (
                  <View style={s.check}><Ionicons name="checkmark" size={15} color="#FFFFFF" /></View>
                ) : (
                  <View style={s.radio} />
                )}
              </Pressable>
            );
          })}
        </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg, paddingBottom: 32 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted, marginTop: 4, marginBottom: 16 },
  list: { gap: 10 },
  optRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: colors.surface,
  },
  optRowActive: { borderColor: '#1A1A2E' },
  optIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  optLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  optDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  check: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#1A1A2E',
    alignItems: 'center', justifyContent: 'center',
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1' },
});
