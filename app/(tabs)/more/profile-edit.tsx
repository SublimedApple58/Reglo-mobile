import React, { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Input } from '../../../src/components/Input';
import { settingsStore } from '../../../src/stores/settingsStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function MoreProfileEditScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(settingsStore.subscribe, settingsStore.get);

  if (!data) return <View style={s.root} />;

  const { name, phone, saving, setName, setPhone, onSaveProfile } = data;

  return (
    <View style={s.root}>
      <Text style={s.title}>Modifica profilo</Text>

      <View style={s.field}>
        <Text style={s.label}>Nome completo</Text>
        <Input placeholder="Nome" value={name} onChangeText={setName} />
      </View>
      <View style={s.field}>
        <Text style={s.label}>Numero di cellulare</Text>
        <Input placeholder="Cellulare" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </View>

      <Pressable
        onPress={() => { onSaveProfile(); router.back(); }}
        disabled={saving}
        style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }, saving && { opacity: 0.6 }]}
      >
        <Text style={s.ctaText}>{saving ? 'Salvataggio...' : 'Salva'}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3, marginBottom: 4 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  cta: {
    backgroundColor: colors.primary, minHeight: 50, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.20, shadowRadius: 8, elevation: 4,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
