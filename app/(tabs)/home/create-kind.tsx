import React, { useSyncExternalStore } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { createKindSheetStore } from '../../../src/stores/createKindSheetStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayList, CLAY_ROW_PRESSED, clayRowPadding, markClayRow, type ClayRowPosition } from '../../../src/components/clay/ClayList';
import { CREATE_KIND_HINT, CREATE_LABEL, createArt } from '../../../src/components/agenda/createKinds';
import type { AgendaCreateKind } from '../../../src/components/WeeklyAgendaView';
import { CLAY } from '../../../src/theme/clay';
import * as Haptics from '../../../src/utils/haptics';

/**
 * «Cosa vuoi creare?» — scelta del tipo dalla barra del blocco fantasma
 * dell'Agenda (anteprima v3 approvata da Tiziano, 05/11/2026): righe alte e
 * ariose, oggetto 3D in una scatola fissa (allineati anche se le immagini
 * hanno proporzioni diverse), nome + una riga di spiegazione, spunta nera sul
 * tipo scelto. Il tocco applica e chiude.
 */
const KindRow = markClayRow(function KindRow({
  kind,
  carColor,
  selected,
  onPress,
  divider,
  first,
  last,
}: ClayRowPosition & {
  kind: AgendaCreateKind;
  carColor?: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, clayRowPadding({ first, last }, ROW_PAD), pressed && CLAY_ROW_PRESSED]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${CREATE_LABEL[kind]}, ${CREATE_KIND_HINT[kind]}`}
      testID={`create-kind-${kind}`}
    >
      {divider ? <View style={s.divider} /> : null}
      <View style={s.art}>
        <Image source={createArt(kind, carColor)} style={s.artImg} resizeMode="contain" />
      </View>
      <View style={s.text}>
        <Text style={s.title} numberOfLines={1}>{CREATE_LABEL[kind]}</Text>
        <Text style={s.sub} numberOfLines={1}>{CREATE_KIND_HINT[kind]}</Text>
      </View>
      <View style={s.check}>
        {selected ? <Ionicons name="checkmark" size={22} color={CLAY.ink} /> : null}
      </View>
    </Pressable>
  );
});

export default function CreateKindScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(createKindSheetStore.subscribe, createKindSheetStore.get);

  if (!data) return <View style={s.empty} />;

  const pick = (kind: AgendaCreateKind) => {
    Haptics.selectionAsync();
    data.onPick(kind);
    router.back();
  };

  return (
    <FormSheet title="Cosa vuoi creare?" subtitle={data.subtitle} testID="create-kind-sheet">
      <ClayList style={s.list}>
        {data.kinds.map((k) => (
          <KindRow key={k} kind={k} carColor={data.carColor} selected={k === data.selected} onPress={() => pick(k)} />
        ))}
      </ClayList>
    </FormSheet>
  );
}

const ROW_PAD = 14;
const ART_W = 52;
const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  list: { marginTop: 4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 16, paddingRight: 20, minHeight: 76 },
  // Il filetto parte dal testo, non dal bordo (stesso rientro della riga).
  divider: { position: 'absolute', top: 0, left: 16 + ART_W + 16, right: 0, height: 0.5, backgroundColor: 'rgba(17,17,17,0.12)' },
  art: { width: ART_W, height: 46, alignItems: 'center', justifyContent: 'center' },
  artImg: { width: ART_W, height: 46 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.25, lineHeight: 22 },
  sub: { fontSize: 14, fontWeight: '400', color: CLAY.ink3, lineHeight: 19, marginTop: 2 },
  check: { width: 22, alignItems: 'flex-end' },
});
