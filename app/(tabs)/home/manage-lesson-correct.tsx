import React, { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { correctOutcomeStore } from '../../../src/stores/correctOutcomeStore';
import { colors } from '../../../src/theme/colors';

const NAVY = '#1A1A2E';
const INK = '#222222';

/**
 * Form sheet content-hugging (HUG_SHEET) per correggere l'esito di una guida
 * passata — stessa riga-picker di Istruttore/Veicolo (checkmark navy sull'esito
 * attuale). Nessuna ScrollView (romperebbe il fitToContents). Tap su un'opzione →
 * chiude questo foglio + "Gestisci guida" (dismiss(2)) e applica.
 */
export default function ManageLessonCorrectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(correctOutcomeStore.subscribe, correctOutcomeStore.get);

  React.useEffect(() => () => correctOutcomeStore.clear(), []);

  if (!data) return <View style={s.root} />;

  const pick = (action: 'checked_in' | 'no_show') => {
    const cb = data.onPick;
    router.dismiss(2); // chiude il form sheet + "Gestisci guida" → torna all'agenda
    setTimeout(() => cb(action), 260);
  };

  const current = data.currentOutcome;

  const Row = ({ action, label }: { action: 'checked_in' | 'no_show'; label: string }) => {
    const on = current === action;
    return (
      <Pressable onPress={() => pick(action)} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
        <Text style={[s.label, on && { fontWeight: '600' }]}>{label}</Text>
        {on ? <Ionicons name="checkmark-circle" size={23} color={NAVY} /> : <View style={s.dot} />}
      </Pressable>
    );
  };

  return (
    <View style={[s.root, { paddingTop: 16, paddingBottom: insets.bottom + 20 }]}>
      <View style={s.topbar}>
        <Text style={s.title} numberOfLines={1}>Correggi l&apos;esito</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [s.x, pressed && { opacity: 0.5 }]}>
          <Ionicons name="close" size={20} color={NAVY} />
        </Pressable>
      </View>

      <Row action="checked_in" label="Presente" />
      <View style={s.divider} />
      <Row action="no_show" label="Assente" />
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: 20 },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  x: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#F1F2F4', alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBEDF0' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, minHeight: 58 },
  label: { fontSize: 16, fontWeight: '500', color: INK },
  dot: { width: 23, height: 23 },
});
