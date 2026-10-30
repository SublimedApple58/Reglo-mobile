import React, { useSyncExternalStore } from 'react';
import { Image, Platform, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { homeAddSheetStore } from '../../../src/stores/homeAddSheetStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayListRow, ClaySurface } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme/clay';
import { VITA_ART } from '../../../src/theme/vitaArt';
import { car34Art } from '../../../src/road/markerArt';

const PERSONE = require('../../../assets/icons3d-ai/persone.png') as ImageSourcePropType;

/**
 * Foglio «Nuovo» del «+» dell'Agenda — direzione «D · Mix» (REG-639,
 * approvata 28/10): in cima la card clay «Guida» con la cartina in stile Road
 * e l'auto 3D nel colore del veicolo dell'istruttore (senza colore: rossa);
 * sotto le altre voci con il loro oggetto 3D libero sul bianco (niente
 * riquadri). Al tocco chiude e lancia l'azione a foglio chiuso (iOS), mai due
 * fogli in animazione insieme.
 */
export default function AddActionScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(homeAddSheetStore.subscribe, homeAddSheetStore.get);

  const pick = (run: () => void) => {
    router.back();
    if (Platform.OS === 'ios') setTimeout(run, 380);
    else run();
  };

  if (!data) return <View style={s.empty} />;

  const vehicle = data.myVehicle ?? null;
  const rows = [
    { key: 'group', title: 'Guida di gruppo', sub: 'Più allievi insieme', art: PERSONE, run: data.onGroupLesson, show: data.canGroupLesson },
    { key: 'exam', title: 'Esame', sub: 'Una sessione con i tuoi allievi', art: VITA_ART.esame, run: data.onExam, show: true },
    { key: 'theory', title: 'Lezione teorica', sub: 'In sede, occupa l’orario', art: VITA_ART.edificio, run: data.onTheory, show: true },
    { key: 'block', title: 'Blocca un orario', sub: 'Nessuno può prenotarlo', art: VITA_ART.calendario, run: data.onBlock, show: true },
    { key: 'sick', title: 'Malattia', sub: 'Uno o più giorni di assenza', art: VITA_ART.termometro, run: data.onSick, show: true },
  ].filter((r) => r.show);

  return (
    <FormSheet title="Nuovo" testID="add-action-sheet">
      {data.canBook ? (
        <ClaySurface padded={false} radius={26} onPress={() => pick(data.onBook)} style={s.card} testID="add-book" accessibilityLabel="Guida">
          <View style={s.mapClip}>
            <Image source={VITA_ART.cartinaRoad} style={s.map} resizeMode="cover" />
            {/* Alone bianco morbido dietro l'auto: la stacca dalla cartina (Tiziano 28/10). */}
            <View pointerEvents="none" style={s.glow} />
            <Image source={car34Art(vehicle?.color ?? 'rosso')} style={s.car} resizeMode="contain" />
          </View>
          <View style={s.cardText}>
            <View style={s.cardMain}>
              <Text style={s.cardTitle}>Guida</Text>
              <Text style={s.cardSub} numberOfLines={1}>
                {vehicle ? `Con un allievo, sulla ${vehicle.name}` : 'Con un allievo, a un orario'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={CLAY.chevron} />
          </View>
        </ClaySurface>
      ) : null}
      <View style={s.rows}>
        {rows.map((r, i) => (
          <ClayListRow
            key={r.key}
            leading={<Image source={r.art} style={s.art} resizeMode="contain" />}
            title={r.title}
            subtitle={r.sub}
            divider={i > 0}
            onPress={() => pick(r.run)}
            testID={`add-${r.key}`}
          />
        ))}
      </View>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  card: { marginBottom: 8 },
  // L'ombra sta sulla card: il ritaglio arrotondato va su un figlio.
  mapClip: { height: 138, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' },
  map: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  car: { position: 'absolute', right: 14, bottom: 4, width: 150, height: 120 },
  // Alone: ellisse bianca velata con ombra bianca molto sfocata (il radial-gradient su iOS non si disegna).
  glow: {
    position: 'absolute',
    right: 22,
    bottom: 18,
    width: 136,
    height: 84,
    borderRadius: 68,
    backgroundColor: 'rgba(255,255,255,0.62)',
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 34, spreadDistance: 18, color: 'rgba(255,255,255,0.9)' }],
  },
  cardText: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14 },
  cardMain: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  cardSub: { fontSize: 14, color: CLAY.ink3, marginTop: 2 },
  rows: { marginHorizontal: -18 },
  art: { width: 50, height: 50 },
});
