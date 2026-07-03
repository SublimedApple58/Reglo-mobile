import React, { useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { ToggleSwitch } from '../../../src/components/ToggleSwitch';
import { clusterSettingsStore } from '../../../src/stores/clusterSettingsStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function ExtrasScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(clusterSettingsStore.subscribe, clusterSettingsStore.get);
  if (!data) return <View style={s.root} />;

  const {
    companyDefaults: cd,
    swapEnabled, setSwapEnabled,
    studentCancellationEnabled, setStudentCancellationEnabled,
    weeklyAbsenceEnabled, setWeeklyAbsenceEnabled,
    saving, onSave,
  } = data;

  const rows: Array<{ label: string; desc: string; value: boolean; onChange: (v: boolean) => void }> = [
    {
      label: 'Scambio guide',
      desc: 'Gli allievi possono proporre scambi di orario tra loro.',
      value: swapEnabled ?? cd.swapEnabled,
      onChange: setSwapEnabled,
    },
    {
      label: 'Annullamento guide allievi',
      desc: 'Gli allievi possono annullare le proprie guide.',
      value: studentCancellationEnabled ?? cd.studentCancellationEnabled,
      onChange: setStudentCancellationEnabled,
    },
    {
      label: 'Assenza settimanale',
      desc: 'Gli allievi possono segnalare una settimana di assenza.',
      value: weeklyAbsenceEnabled ?? cd.weeklyAbsenceEnabled,
      onChange: setWeeklyAbsenceEnabled,
    },
  ];

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <View style={s.headerBlock}>
        <Text style={s.title}>Funzionalità extra</Text>
        <Text style={s.subtitle}>Opzioni aggiuntive per i tuoi allievi.</Text>
      </View>

      <SheetScaffold
        style={{ gap: 20 }}
        contentContainerStyle={{ gap: 20 }}
        footer={
          <Pressable
            onPress={saving ? undefined : async () => { await onSave(); router.back(); }}
            disabled={saving}
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }, saving && { opacity: 0.6 }]}
          >
            <GradientCTABackground radius={27} />
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.ctaText}>Salva</Text>}
          </Pressable>
        }
      >
      <View style={s.card}>
        {rows.map((r, i) => (
          <View key={r.label}>
            {i > 0 ? <View style={s.divider} /> : null}
            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>{r.label}</Text>
                <Text style={s.toggleDesc}>{r.desc}</Text>
              </View>
              <ToggleSwitch value={r.value} onValueChange={r.onChange} />
            </View>
          </View>
        ))}
      </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },

  card: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#EBEDF0' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  toggleDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  cta: {
    minHeight: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    ...primaryCtaShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
