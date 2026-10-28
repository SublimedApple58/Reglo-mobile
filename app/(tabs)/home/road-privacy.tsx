import React, { useState, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClaySurface, Icon3D } from '../../../src/components/clay';
import { CLAY, type Icon3DName } from '../../../src/theme';
import { useRouter } from 'expo-router';

import { enterRoad, markRoadPrivacySeen } from '../../../src/road/roadActions';
import { ROAD_ROUTE, SHEET_HANDOFF_MS, roadEntryStore, roadPendingStart } from '../../../src/road/entryFlow';

const ROWS: Array<{ icon: Icon3DName; title: string; body: string }> = [
  {
    icon: 'road',
    title: 'Solo durante la guida',
    body: 'Il GPS si accende quando entri in Road e si spegne con «Termina guida».',
  },
  {
    icon: 'headquarters',
    title: 'Lo vede la tua autoscuola',
    body: "Percorso e segnalazioni compaiono in Reglo. L'allievo li vede se l'autoscuola lo consente.",
  },
  {
    icon: 'calendar',
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
  const live = useSyncExternalStore(roadEntryStore.subscribe, roadEntryStore.get);
  const [seed] = useState(() => live);
  // Road libero: arrivo da «Avvia guida», l'avvio è già pronto.
  const [pending] = useState(() => roadPendingStart.take());

  const onContinue = async () => {
    await markRoadPrivacySeen();
    router.back();
    if (!pending && !seed) return;
    setTimeout(async () => {
      const ok = pending ? await pending() : seed ? await enterRoad(seed.lesson.appointmentId) : false;
      if (ok) router.replace(ROAD_ROUTE);
    }, SHEET_HANDOFF_MS);
  };

  return (
    <FormSheet
      title={'Prima di partire'}
      subtitle={'Road usa la posizione del telefono solo mentre sei in guida.'}
      testID="road-privacy"
      cta={
        <>
      <ClayButton title="Continua" onPress={() => void onContinue()} testID="road-privacy-continue" />
        </>
      }
    >

      <ClaySurface padded={false} radius={24} style={s.card}>
        {ROWS.map((r, i) => (
          <View key={r.title} style={[s.row, i > 0 && s.rowSep]}>
            <Icon3D name={r.icon} size={30} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{r.title}</Text>
              <Text style={s.rowBody}>{r.body}</Text>
            </View>
          </View>
        ))}
      </ClaySurface>
      {/* Spiegazione prima della CTA: il bottone resta l'ultima cosa del foglio. */}
      <Text style={s.fine}>
        {Platform.OS === 'ios'
          ? "Al passo successivo iPhone ti chiede il permesso. Scegli «Consenti mentre usi l'app»."
          : "Al passo successivo il telefono ti chiede il permesso. Scegli «Mentre usi l'app»."}
      </Text>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  card: { paddingVertical: 4, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(17,17,17,0.12)' },
  rowTitle: { fontSize: 15.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  rowBody: { fontSize: 14, fontWeight: '400', color: CLAY.ink3, marginTop: 2, lineHeight: 19.5 },
  fine: { fontSize: 12.5, fontWeight: '400', color: CLAY.ink4, textAlign: 'center', marginTop: 14, lineHeight: 17.5, paddingHorizontal: 10 },
});
