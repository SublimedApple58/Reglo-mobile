import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { FormSheet } from '../../src/components/SheetScaffold';
import { ClayButton, ClayList, ClayListRow, ClaySegmented } from '../../src/components/clay';
import { SentimentBadge } from '../../src/components/road/RoadSentiment';
import { CLAY, CLAY_SHADOW } from '../../src/theme';
import { SHEET_NIGHT, SHEET_NIGHT_SHADOW, useSheetNight } from '../../src/theme/night';
import * as Haptics from '../../src/utils/haptics';
import { CUSTOM_KIND_PREFIX, markerArt, shortMarkerLabel } from '../../src/road/markerArt';
import { formatHm } from '../../src/road/format';
import { useRoadSelector } from '../../src/road/roadStore';
import { applyMarkerEdit, useEditedMarker, useMarkerEditTarget } from '../../src/road/markerEdit';
import type { UpdateRoadMarkerInput } from '../../src/types/regloApi';

type Mode = 'main' | 'kind' | 'note';
type Busy = null | 'sentiment' | 'kind' | 'note' | 'remove';

/**
 * Road novembre R3 (anteprima r3-pin approvata da Tiziano il 10/11/2026) —
 * foglio «Segnalazione»: giudizio, tipo, nota, «Sposta sulla mappa»,
 * «Elimina segnalazione». Si apre toccando il fumetto in guida e dal «⋯» di
 * riepilogo, ripasso e «Tutte le segnalazioni». Ogni modifica si salva subito
 * (anche offline, in coda); niente Salva. Il tipo si sceglie nello stesso
 * foglio (griglia di «Segnala», in dissolvenza), la nota con il prompt nativo
 * su iOS e con un campo nel foglio su Android.
 */
export default function SegnalazioneSheet() {
  const router = useRouter();
  const night = useSheetNight();
  const target = useMarkerEditTarget();
  const marker = useEditedMarker();
  const catalog = useRoadSelector((s) => s.catalog);
  const [mode, setMode] = useState<Mode>('main');
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState('');

  // Eliminata (anche da un altro foglio) o target perso: il foglio si chiude da solo.
  if (!target || !marker) return <FormSheet title="Segnalazione" testID="road-marker-sheet" />;

  const save = async (what: Exclude<Busy, null>, change: { patch: UpdateRoadMarkerInput } | { remove: true }) => {
    if (busy) return false;
    setBusy(what);
    const ok = await applyMarkerEdit(target, change);
    setBusy(null);
    if (ok) Haptics.selectionAsync().catch(() => undefined);
    return ok;
  };

  const onSentiment = (v: 'good' | 'bad') => {
    if (v === marker.sentiment) return;
    void save('sentiment', { patch: { sentiment: v } });
  };

  const onKind = async (kind: string) => {
    if (kind === marker.kind) return setMode('main');
    if (await save('kind', { patch: { kind } })) setMode('main');
  };

  const onNote = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Nota',
        undefined,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Salva', onPress: (text?: string) => void save('note', { patch: { note: text?.trim() ? text.trim() : null } }) },
        ],
        'plain-text',
        marker.note ?? '',
        undefined,
        { userInterfaceStyle: night ? 'dark' : 'light' },
      );
      return;
    }
    setNote(marker.note ?? '');
    setMode('note');
  };

  const onRemove = () =>
    Alert.alert(
      `Eliminare «${marker.label}»?`,
      'Sparisce dal percorso e dai punti critici.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            if (await save('remove', { remove: true })) router.back();
          },
        },
      ],
      { userInterfaceStyle: night ? 'dark' : 'light' },
    );

  const subtitle = [formatHm(marker.recordedAt), marker.street].filter(Boolean).join(' · ');
  const value = (text: string) => (
    <Text style={[s.value, night && n.ink3]} numberOfLines={1}>
      {text}
    </Text>
  );
  const spinner = <ActivityIndicator size="small" color={night ? SHEET_NIGHT.ink3 : CLAY.ink3} />;

  const items = [
    ...catalog.base.map((b) => ({ kind: b.key, label: shortMarkerLabel(b.key, b.label) })),
    ...catalog.custom.map((c) => ({ kind: `${CUSTOM_KIND_PREFIX}${c.id}`, label: c.label })),
  ];

  return (
    <FormSheet
      title={mode === 'kind' ? 'Cosa è successo?' : marker.label}
      subtitle={subtitle || undefined}
      contentKey={mode}
      busy={busy != null}
      leading={
        mode === 'main' ? (
          <View style={[s.icon, night ? [n.surface, SHEET_NIGHT_SHADOW.raise] : CLAY_SHADOW.raiseSm]}>
            <Image source={markerArt(marker.kind)} style={s.iconImg} resizeMode="contain" />
            {marker.sentiment ? <SentimentBadge sentiment={marker.sentiment} size={18} style={s.badge} /> : null}
          </View>
        ) : undefined
      }
      testID="road-marker-sheet"
    >
      {mode === 'main' ? (
        <>
          <ClaySegmented
            options={[
              { value: 'bad' as const, label: 'Da migliorare', testID: 'road-marker-bad' },
              { value: 'good' as const, label: 'Fatto bene', testID: 'road-marker-good' },
            ]}
            value={marker.sentiment ?? 'bad'}
            onChange={onSentiment}
          />
          <ClayList style={s.block}>
            <ClayListRow
              title="Tipo"
              trailing={busy === 'kind' ? spinner : value(marker.label)}
              onPress={() => setMode('kind')}
              testID="road-marker-kind"
            />
            <ClayListRow
              title="Nota"
              trailing={busy === 'note' ? spinner : value(marker.note?.trim() ? marker.note.trim() : 'Aggiungi')}
              onPress={onNote}
              testID="road-marker-note"
            />
          </ClayList>
          <ClayList style={s.block}>
            <ClayListRow
              leading={<Ionicons name="locate-outline" size={21} color={night ? SHEET_NIGHT.ink : CLAY.ink} />}
              title="Sposta sulla mappa"
              onPress={() => router.push('/road/sposta')}
              testID="road-marker-move"
            />
          </ClayList>
          <Pressable
            onPress={onRemove}
            disabled={busy != null}
            style={({ pressed }) => [s.remove, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            testID="road-marker-remove"
          >
            {busy === 'remove' ? spinner : <Text style={s.removeTx}>Elimina segnalazione</Text>}
          </Pressable>
        </>
      ) : null}

      {mode === 'kind' ? (
        <View style={s.grid}>
          {items.map((item) => {
            const on = item.kind === marker.kind;
            return (
              <Pressable
                key={item.kind}
                onPress={() => void onKind(item.kind)}
                disabled={busy != null}
                style={s.tile}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={item.label}
                testID={`road-marker-kind-${item.kind}`}
              >
                {({ pressed }) => (
                  <>
                    <View
                      style={[
                        s.sq,
                        night && n.surface,
                        pressed
                          ? [night ? SHEET_NIGHT_SHADOW.sink : CLAY_SHADOW.sink, s.sqPressed]
                          : night
                            ? SHEET_NIGHT_SHADOW.raise
                            : CLAY_SHADOW.raiseSm,
                        on && [s.sqOn, night && n.sqOn],
                      ]}
                    >
                      {busy === 'kind' && pressed ? spinner : <Image source={markerArt(item.kind)} style={s.sqImg} resizeMode="contain" />}
                    </View>
                    <Text style={[s.tileTx, night && n.ink2, on && s.tileOn, on && night && n.ink]} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {mode === 'note' ? (
        <View style={s.noteBox}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Cosa è successo"
            placeholderTextColor={night ? SHEET_NIGHT.ink4 : CLAY.ink4}
            keyboardAppearance={night ? 'dark' : 'default'}
            style={[s.noteInput, night ? [n.surface, n.ink, SHEET_NIGHT_SHADOW.sink] : CLAY_SHADOW.sink]}
            autoFocus
            multiline
            maxLength={500}
          />
          <View style={s.noteActions}>
            <ClayButton compact variant="secondary" title="Annulla" onPress={() => setMode('main')} style={{ flex: 1 }} />
            <ClayButton
              compact
              title="Salva"
              loading={busy === 'note'}
              onPress={async () => {
                if (await save('note', { patch: { note: note.trim() ? note.trim() : null } })) setMode('main');
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: CLAY.surface, alignItems: 'center', justifyContent: 'center' },
  iconImg: { width: 34, height: 34 },
  badge: { position: 'absolute', right: -3, bottom: -3 },
  block: { marginTop: 14 },
  value: { fontSize: 15, color: CLAY.ink3, maxWidth: 190 },
  remove: { alignSelf: 'center', marginTop: 18, minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
  removeTx: { fontSize: 16, fontWeight: '500', color: '#DC2626' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, rowGap: 16, marginHorizontal: -3 },
  tile: { width: '25%', alignItems: 'center', gap: 8, paddingHorizontal: 3 },
  sq: { width: 74, height: 74, borderRadius: 24, backgroundColor: CLAY.surface, alignItems: 'center', justifyContent: 'center' },
  sqPressed: { transform: [{ scale: 0.96 }] },
  sqOn: { borderWidth: 2, borderColor: CLAY.ink },
  sqImg: { width: 48, height: 48 },
  tileTx: { fontSize: 12.5, fontWeight: '400', color: CLAY.ink2, textAlign: 'center', lineHeight: 15, letterSpacing: -0.1 },
  tileOn: { fontWeight: '600', color: CLAY.ink },
  noteBox: { gap: 10 },
  noteInput: {
    minHeight: 90,
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

const n = StyleSheet.create({
  surface: { backgroundColor: SHEET_NIGHT.surface },
  sqOn: { borderColor: SHEET_NIGHT.ink },
  ink: { color: SHEET_NIGHT.ink },
  ink2: { color: SHEET_NIGHT.ink2 },
  ink3: { color: SHEET_NIGHT.ink3 },
});
