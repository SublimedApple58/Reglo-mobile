import React, { useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormSheet } from '../../src/components/SheetScaffold';
import { useRouter } from 'expo-router';

import * as Haptics from '../../src/utils/haptics';
import { roadStore, useRoadSelector, type RoadSentiment } from '../../src/road/roadStore';
import { ClayButton, ClaySegmented } from '../../src/components/clay';
import { CLAY, CLAY_SHADOW } from '../../src/theme';
import { recordRoadMarker } from '../../src/road/roadActions';
import { CUSTOM_KIND_PREFIX, markerArt, shortMarkerLabel } from '../../src/road/markerArt';
import { formatHm } from '../../src/road/format';

type Item = { kind: string; label: string; short: string };

/**
 * REG-638 — «Cosa è da migliorare?» / «Cosa è andato bene?». In testa il segno
 * (fatto bene / da migliorare), che resta per la sessione. Form sheet nativo che abbraccia il contenuto
 * (FORM_SHEET, §13.2.1: la radice è lo scroll del foglio). Tocco = segnala subito sul punto in cui sei e chiude;
 * pressione lunga = prima una nota (Alert.prompt su iOS, campo qui su Android).
 */
export default function SegnalaSheet() {
  const router = useRouter();
  const catalog = useRoadSelector((s) => s.catalog);
  const street = useRoadSelector((s) => s.street);
  const sentimentMode = useRoadSelector((s) => s.sentimentMode);
  const good = sentimentMode === 'good';
  const setMode = (m: RoadSentiment) => {
    if (m === sentimentMode) return;
    Haptics.selectionAsync().catch(() => undefined);
    roadStore.setSentimentMode(m);
  };
  const [noteFor, setNoteFor] = useState<Item | null>(null);
  const [note, setNote] = useState('');
  const [openedAt] = useState(() => new Date().toISOString());

  const base: Item[] = catalog.base.map((b) => ({ kind: b.key, label: b.label, short: shortMarkerLabel(b.key, b.label) }));
  const custom: Item[] = catalog.custom.map((c) => ({
    kind: `${CUSTOM_KIND_PREFIX}${c.id}`,
    label: c.label,
    short: c.label,
  }));

  const commit = (item: Item, withNote?: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void recordRoadMarker({
      kind: item.kind,
      label: item.label,
      note: withNote ?? null,
      sentiment: sentimentMode,
      openedAt: Date.parse(openedAt),
    });
    router.back();
  };

  const onLongPress = (item: Item) => {
    Haptics.selectionAsync().catch(() => undefined);
    if (Platform.OS === 'ios') {
      Alert.prompt(
        item.label,
        'Aggiungi una nota alla segnalazione.',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Segna', onPress: (text?: string) => commit(item, text ?? null) },
        ],
        'plain-text',
      );
      return;
    }
    setNote('');
    setNoteFor(item);
  };

  const renderGrid = (items: Item[]) => (
    <View style={s.grid}>
      {items.map((item) => (
        <Pressable
          key={item.kind}
          onPress={() => commit(item)}
          onLongPress={() => onLongPress(item)}
          delayLongPress={380}
          style={s.tile}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          testID={`road-mk-${item.kind}`}
        >
          {({ pressed }) => (
            <>
              {/* Tessera bianca in rilievo; premuta sprofonda (ombra interna). */}
              <View style={[s.sq, pressed ? [CLAY_SHADOW.sink, s.sqPressed] : CLAY_SHADOW.raiseSm]}>
                <Image source={markerArt(item.kind)} style={s.sqImg} resizeMode="contain" />
              </View>
              <Text style={s.tileTx} numberOfLines={2}>{item.short}</Text>
            </>
          )}
        </Pressable>
      ))}
    </View>
  );

  return (
    <FormSheet
      title={good ? 'Cosa è andato bene?' : 'Cosa è da migliorare?'}
      subtitle={[street, formatHm(openedAt)].filter(Boolean).join(' · ')}
      testID="road-segnala-sheet"
    >

      <ClaySegmented
        options={[
          { value: 'good' as RoadSentiment, label: 'Fatto bene', testID: 'road-sentiment-good' },
          { value: 'bad' as RoadSentiment, label: 'Da migliorare', testID: 'road-sentiment-bad' },
        ]}
        value={sentimentMode}
        onChange={setMode}
      />

      <View>
        {renderGrid(base)}
        {custom.length ? (
          <>
            <Text style={s.sec}>Della tua autoscuola</Text>
            <View style={{ marginTop: 10 }}>{renderGrid(custom)}</View>
          </>
        ) : null}

        {noteFor ? (
          <View style={s.noteBox}>
            <Text style={s.noteTitle}>{noteFor.label}: aggiungi una nota</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Cosa è successo"
              placeholderTextColor={CLAY.ink4}
              style={[s.noteInput, CLAY_SHADOW.sink]}
              autoFocus
              multiline
              maxLength={500}
            />
            <View style={s.noteActions}>
              <ClayButton compact variant="secondary" title="Annulla" onPress={() => setNoteFor(null)} style={{ flex: 1 }} />
              <ClayButton compact title="Segna" onPress={() => commit(noteFor, note)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <Text style={s.hint}>Tocca per segnare dove sei · tieni premuto per aggiungere una nota</Text>
        )}
      </View>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, rowGap: 16, marginHorizontal: -3 },
  tile: { width: '25%', alignItems: 'center', gap: 8, paddingHorizontal: 3 },
  sq: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: CLAY.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sqPressed: { transform: [{ scale: 0.96 }] },
  sqImg: { width: 48, height: 48 },
  tileTx: { fontSize: 12.5, fontWeight: '400', color: CLAY.ink2, textAlign: 'center', lineHeight: 15, letterSpacing: -0.1 },
  sec: { fontSize: 13, fontWeight: '500', color: CLAY.ink3, marginTop: 22, letterSpacing: -0.05 },
  hint: { fontSize: 12.5, fontWeight: '400', color: CLAY.ink4, textAlign: 'center', marginTop: 18 },
  noteBox: { marginTop: 18, gap: 10 },
  noteTitle: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
  noteInput: {
    minHeight: 70,
    borderRadius: 18,
    backgroundColor: CLAY.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: CLAY.ink,
    textAlignVertical: 'top',
  },
  noteActions: { flexDirection: 'row', gap: 10 },
});
