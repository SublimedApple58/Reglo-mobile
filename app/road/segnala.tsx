import React, { useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormSheet } from '../../src/components/SheetScaffold';
import { SHEET_BOTTOM } from '../../src/utils/sheetPresentation';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import * as Haptics from '../../src/utils/haptics';
import { GlassCloseButton } from '../../src/components/GlassCloseButton';
import { roadStore, useRoadState, type RoadSentiment } from '../../src/road/roadStore';
import { SENTIMENT_BAD, SENTIMENT_GOOD } from '../../src/components/road/RoadSentiment';
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
  const { catalog, street, sentimentMode } = useRoadState();
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
    void recordRoadMarker({ kind: item.kind, label: item.label, note: withNote ?? null, sentiment: sentimentMode });
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
          { text: 'Segna', isPreferred: true, onPress: (text?: string) => commit(item, text ?? null) },
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
              <View style={[s.sq, good ? s.sqGood : s.sqBad, pressed && s.sqPressed]}>
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

      <View style={s.seg} accessibilityRole="tablist">
        {(
          [
            ['good', 'Fatto bene', 'thumbs-up-outline', SENTIMENT_GOOD],
            ['bad', 'Da migliorare', 'thumbs-down-outline', SENTIMENT_BAD],
          ] as const
        ).map(([key, label, icon, color]) => {
          const on = sentimentMode === key;
          return (
            <Pressable
              key={key}
              onPress={() => setMode(key)}
              style={[s.segBtn, on && s.segBtnOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              testID={`road-sentiment-${key}`}
            >
              <Ionicons name={icon} size={18} color={color} />
              <Text style={[s.segTx, on && s.segTxOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

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
              placeholderTextColor="#8E8E93"
              style={s.noteInput}
              autoFocus
              multiline
              maxLength={500}
            />
            <View style={s.noteActions}>
              <Pressable onPress={() => setNoteFor(null)} style={[s.noteBtn, s.noteBtnSoft]}>
                <Text style={s.noteBtnSoftTx}>Annulla</Text>
              </Pressable>
              <Pressable onPress={() => commit(noteFor, note)} style={[s.noteBtn, s.noteBtnDark]}>
                <Text style={s.noteBtnDarkTx}>Segna</Text>
              </Pressable>
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
  // form sheet: respiro fisso, mai insets.bottom (§13.2.1)
  root: { backgroundColor: '#FFFFFF', paddingTop: 26, paddingHorizontal: 22, paddingBottom: SHEET_BOTTOM },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 24, fontWeight: '600', color: '#111111', letterSpacing: -0.5, lineHeight: 28 },
  lead: { fontSize: 15, fontWeight: '400', color: '#6A6A6A', marginTop: 3, letterSpacing: -0.1 },
  x: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(120,120,128,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18, rowGap: 14, marginHorizontal: -3 },
  tile: { width: '25%', alignItems: 'center', gap: 7, paddingHorizontal: 3 },
  sq: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: '#F2F2F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sqGood: { backgroundColor: '#EEF8F1' },
  sqBad: { backgroundColor: '#FDF1F0' },
  sqPressed: { backgroundColor: '#E6E6E3', transform: [{ scale: 0.96 }] },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: '#F2F2F0' },
  segBtn: { flex: 1, height: 44, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  segBtnOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segTx: { fontSize: 15, fontWeight: '500', color: '#6A6A6A', letterSpacing: -0.2 },
  segTxOn: { color: '#111111', fontWeight: '600' },
  sqImg: { width: 48, height: 48 },
  tileTx: { fontSize: 12.5, fontWeight: '400', color: '#3A3A3C', textAlign: 'center', lineHeight: 15, letterSpacing: -0.1 },
  sec: { fontSize: 13, fontWeight: '500', color: '#6A6A6A', marginTop: 20, letterSpacing: -0.05 },
  hint: { fontSize: 12.5, fontWeight: '400', color: '#8E8E93', textAlign: 'center', marginTop: 16 },
  noteBox: { marginTop: 18, gap: 10 },
  noteTitle: { fontSize: 15, fontWeight: '600', color: '#111111' },
  noteInput: {
    minHeight: 70,
    borderRadius: 16,
    backgroundColor: '#F2F2F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111111',
    textAlignVertical: 'top',
  },
  noteActions: { flexDirection: 'row', gap: 8 },
  noteBtn: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  noteBtnSoft: { backgroundColor: '#F2F2F0' },
  noteBtnSoftTx: { fontSize: 16, fontWeight: '600', color: '#111111' },
  noteBtnDark: { backgroundColor: '#111111' },
  noteBtnDarkTx: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
