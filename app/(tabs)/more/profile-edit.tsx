import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { Input } from '../../../src/components/Input';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { useSession } from '../../../src/context/SessionContext';
import { regloApi } from '../../../src/services/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function MoreProfileEditScreen() {
  const router = useRouter();
  const { user, refreshMe } = useSession();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setError('Nome troppo corto');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await regloApi.updateProfile({ name: trimmed, phone: phone.trim() });
      await refreshMe();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornando il profilo');
      setSaving(false);
    }
  };

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <SheetScaffold
        keyboardAware
        style={s.body}
        contentContainerStyle={s.body}
        footer={
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }, saving && { opacity: 0.6 }]}
          >
            <GradientCTABackground radius={26} />
            <Text style={s.ctaText}>{saving ? 'Salvataggio...' : 'Salva'}</Text>
          </Pressable>
        }
      >
        <Text style={s.title}>Modifica profilo</Text>

        <View style={s.field}>
          <Text style={s.label}>Nome completo</Text>
          <Input placeholder="Nome" value={name} onChangeText={(t) => { setName(t); setError(null); }} />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Numero di cellulare</Text>
          <Input placeholder="Cellulare" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 16 },
  body: { gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3, marginBottom: 4 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  error: { fontSize: 13, fontWeight: '400', color: '#DC2626' },
  cta: {
    minHeight: 50, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    ...primaryCtaShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
