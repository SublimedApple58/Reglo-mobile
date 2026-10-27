import React, { useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCloseButton } from '../../../src/components/GlassCloseButton';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { enterRoad, markRoadPrivacySeen } from '../../../src/road/roadActions';
import { ROAD_ROUTE, SHEET_HANDOFF_MS, roadEntryStore } from '../../../src/road/entryFlow';

const ROWS: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; body: string }> = [
  {
    icon: 'location-outline',
    title: 'Solo durante la guida',
    body: 'Il GPS si accende quando entri in Road e si spegne con «Termina guida».',
  },
  {
    icon: 'home-outline',
    title: 'Lo vede la tua autoscuola',
    body: "Percorso e segnalazioni compaiono in Reglo. L'allievo li vede se l'autoscuola lo consente.",
  },
  {
    icon: 'calendar-clear-outline',
    title: 'Conservato 12 mesi',
    body: 'Poi i percorsi vengono cancellati in automatico.',
  },
];

/**
 * REG-638 — «Prima di partire»: informativa del primo ingresso in Road (una
 * volta per dispositivo). «Continua» chiede il permesso posizione
 * («Mentre usi l'app») ed entra in Road.
 */
export default function RoadPrivacySheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const live = useSyncExternalStore(roadEntryStore.subscribe, roadEntryStore.get);
  const [seed] = useState(() => live);

  const onContinue = async () => {
    await markRoadPrivacySeen();
    router.back();
    if (!seed) return;
    setTimeout(async () => {
      const ok = await enterRoad(seed.lesson.appointmentId);
      if (ok) router.replace(ROAD_ROUTE);
    }, SHEET_HANDOFF_MS);
  };

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Prima di partire</Text>
          <Text style={s.lead}>Road usa la posizione del telefono solo mentre sei in guida.</Text>
        </View>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.x}>
            <Ionicons name="close" size={20} color="#3A3A3C" />
          </Pressable>
        </GlassCloseButton>
      </View>

      <SheetScaffold
        footer={
          <View style={{ paddingBottom: Math.max(insets.bottom - 16, 18) }}>
            <Pressable
              onPress={onContinue}
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.88 }]}
              testID="road-privacy-continue"
            >
              <Text style={s.btnTx}>Continua</Text>
            </Pressable>
            <Text style={s.fine}>
              {Platform.OS === 'ios'
                ? "Al passo successivo iPhone ti chiede il permesso. Scegli «Consenti mentre usi l'app»."
                : "Al passo successivo il telefono ti chiede il permesso. Scegli «Mentre usi l'app»."}
            </Text>
          </View>
        }
      >
        <View style={s.card}>
          {ROWS.map((r, i) => (
            <View key={r.title} style={[s.row, i > 0 && s.rowSep]}>
              <Ionicons name={r.icon} size={24} color="#111111" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{r.title}</Text>
                <Text style={s.rowBody}>{r.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: '#FFFFFF', paddingTop: 24, paddingHorizontal: 22 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 24, fontWeight: '600', color: '#111111', letterSpacing: -0.5, lineHeight: 28 },
  lead: { fontSize: 15, fontWeight: '400', color: '#6A6A6A', marginTop: 6, lineHeight: 21, letterSpacing: -0.1 },
  x: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(120,120,128,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { marginTop: 16, borderRadius: 24, backgroundColor: '#F2F2F0', paddingVertical: 4, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.18)' },
  rowTitle: { fontSize: 15.5, fontWeight: '600', color: '#111111', letterSpacing: -0.2 },
  rowBody: { fontSize: 14, fontWeight: '400', color: '#6A6A6A', marginTop: 2, lineHeight: 19.5 },
  btn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  btnTx: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.3 },
  fine: { fontSize: 12.5, fontWeight: '400', color: '#8E8E93', textAlign: 'center', marginTop: 12, lineHeight: 17.5, paddingHorizontal: 10 },
});
