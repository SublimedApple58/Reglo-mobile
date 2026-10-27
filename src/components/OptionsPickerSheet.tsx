import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { optionsPickerStore, shouldShowPickerSearch } from '../stores/optionsPickerStore';
import { matchesPersonSearch } from '../utils/peopleSearch';
import { UserPhotoCircle } from './UserPhotoCircle';
import { GradientCTABackground, primaryCtaShadow } from './GradientCTA';
import { colors, navy } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { GlassCloseButton } from './GlassCloseButton';

const NAVY = '#1A1A2E';
const INK = '#222222';
const MUTED = '#929292';
// REG-636 — toni dei sottotitoli del picker moto (stessi hex del web).
const SUCCESS = '#2F7A4A';
const ACCENT = '#C2410C';

/**
 * Shared body of the options picker. Two presentations:
 * - `scrollable={false}` → content-hugging form sheet (short static lists).
 *   The list is a plain View: a ScrollView inside a fitToContents sheet
 *   breaks the native measuring (title collapses over the rows).
 * - `scrollable` → full-height page sheet (presentation 'modal') whose body
 *   scrolls — for long lists (students, big fleets) that a form sheet clips.
 *
 * Oltre le `PICKER_SEARCH_THRESHOLD` voci il foglio che scorre si porta dietro
 * un campo di ricerca (REG-617): senza, «Aggiungi allievo» su un'autoscuola
 * vera era una lista da scorrere a mano per centinaia di righe.
 */
export function OptionsPickerSheet({ scrollable }: { scrollable: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(optionsPickerStore.subscribe, optionsPickerStore.get);
  const mono = data?.tone === 'mono';

  const [picked, setPicked] = useState<string[]>(data?.selected ?? []);
  const [query, setQuery] = useState('');

  const options = data?.options ?? [];
  const showSearch = shouldShowPickerSearch(options.length, scrollable);
  // Si cerca su etichetta E sottotitolo: nel picker degli allievi il
  // sottotitolo porta la patente, e cercare "B" per vedere i B e' legittimo.
  const visible = useMemo(
    () =>
      showSearch
        ? options.filter((o) => matchesPersonSearch(`${o.label} ${o.subtitle ?? ''}`, query))
        : options,
    [options, query, showSearch],
  );

  if (!data) return <View style={scrollable ? s.rootTall : s.root} />;

  const pickSingle = (value: string) => {
    data.onConfirm([value]);
    router.back();
  };
  const toggleMulti = (value: string) =>
    setPicked((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  const confirmMulti = () => {
    data.onConfirm(picked);
    router.back();
  };

  const rows = visible.map((o) => {
    const on = data.multi ? picked.includes(o.value) : data.selected.includes(o.value);
    return (
      <View key={o.value}>
        <Pressable
          onPress={() => (data.multi ? toggleMulti(o.value) : pickSingle(o.value))}
          style={({ pressed }) => [s.row, on && (mono ? s.rowOnMono : s.rowOn), pressed && { opacity: 0.7 }]}
        >
          {o.leadingInitials ? (
            <UserPhotoCircle userId={o.leadingUserId} size={36} style={{ marginRight: 13 }}>
              <View style={s.avatar}><Text style={s.avatarText}>{o.leadingInitials}</Text></View>
            </UserPhotoCircle>
          ) : null}
          <View style={s.body}>
            <Text style={s.label} numberOfLines={1}>{o.label}</Text>
            {o.subtitle ? (
              o.subtitleTone ? (
                <View style={s.subRow}>
                  {o.subtitleTone === 'success' ? (
                    <View style={[s.subDot, { backgroundColor: SUCCESS }]} />
                  ) : (
                    <Ionicons name="swap-horizontal" size={14} color={ACCENT} />
                  )}
                  <Text
                    style={[s.subToned, { color: o.subtitleTone === 'success' ? SUCCESS : ACCENT }]}
                    numberOfLines={1}
                  >
                    {o.subtitle}
                  </Text>
                </View>
              ) : (
                <Text style={s.sub} numberOfLines={1}>{o.subtitle}</Text>
              )
            ) : null}
          </View>
          {/* La selezione tinge TUTTA la riga (non è una spunta in fondo):
              il tocco ha una superficie, non un bersaglio da 23px. */}
          {o.trailingInitials && !on ? (
            <View style={s.trailingAvatar}><Text style={s.trailingAvatarText}>{o.trailingInitials}</Text></View>
          ) : (
            <View style={[s.mark, mono && s.markMono, on && (mono ? s.markOnMono : s.markOn)]}>
              {on ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
            </View>
          )}
        </Pressable>
      </View>
    );
  });

  return (
    <View
      style={[
        scrollable ? s.rootTall : s.root,
        // paddingTop generoso: il titolo non deve sembrare incollato al bordo.
        // In fondo: il FORM SHEET (hug) non arriva all'home indicator — sta già
        // staccato dal bordo schermo — ma `insets.bottom` riporta comunque la
        // safe area della FINESTRA (34pt): sommandola la CTA restava a mezz'aria.
        // Lì basta un respiro fisso; la safe area serve solo al page sheet, che
        // invece è a tutta altezza.
        { paddingTop: 22, paddingBottom: scrollable ? Math.max(insets.bottom, 16) : 18 },
      ]}
    >
      <View style={s.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{data.title}</Text>
          {data.hint ? <Text style={s.hint} numberOfLines={2}>{data.hint}</Text> : null}
        </View>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [s.x, pressed && { opacity: 0.5 }]}>
            <Ionicons name="close" size={20} color={NAVY} />
          </Pressable>
        </GlassCloseButton>
      </View>

      {showSearch ? (
        <View style={s.searchWrap}>
          <Ionicons name="search" size={19} color={MUTED} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cerca per nome..."
            returnKeyType="search"
            placeholderTextColor={MUTED}
            style={s.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}

      {scrollable ? (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator
          contentContainerStyle={{ paddingBottom: 8, gap: 10 }}
          // Con la tastiera aperta, il primo tocco su una riga deve scegliere
          // quella riga — non servire solo a chiudere la tastiera.
          keyboardShouldPersistTaps="handled"
        >
          {visible.length === 0 ? (
            // Il vuoto non appare di scatto: comparire e' un'informazione.
            <Animated.Text entering={FadeIn.duration(140)} style={s.empty}>
              {data.emptyLabel ?? 'Nessun risultato'}
            </Animated.Text>
          ) : (
            rows
          )}
        </ScrollView>
      ) : (
        <View style={{ gap: 10 }}>{rows}</View>
      )}

      {data.footnote ? <Text style={s.footnote}>{data.footnote}</Text> : null}

      {data.multi ? (
        <Pressable
          onPress={confirmMulti}
          disabled={!picked.length}
          style={({ pressed }) => [
            s.cta,
            !picked.length && s.ctaOff,
            mono && picked.length ? s.ctaMono : null,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
        >
          {/* Il contatore sta DENTRO la CTA: il bottone smette di essere una
              pillola che galleggia e diventa il riepilogo di ciò che hai scelto. */}
          {picked.length && !mono ? <GradientCTABackground radius={27} /> : null}
          {picked.length ? (
            <View style={s.ctaCount}>
              <Text style={s.ctaCountText}>{picked.length}</Text>
            </View>
          ) : null}
          <Text style={[s.ctaText, !picked.length && s.ctaTextOff]}>
            {data.confirmLabel ?? 'Conferma'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  rootTall: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', paddingBottom: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  hint: { fontSize: 13, fontWeight: '500', color: MUTED, marginTop: 5, lineHeight: 18 },
  x: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#F1F2F4', alignItems: 'center', justifyContent: 'center' },

  // Stesso campo del picker allievi di "Nuova prenotazione": card bianca su
  // fondo chiaro, non un input incassato. Coerenza prima di originalita'.
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 16, borderWidth: 1, borderColor: '#ECECEC', backgroundColor: '#FFFFFF',
  },
  searchInput: { flex: 1, fontSize: 16, color: INK, padding: 0 },
  empty: { fontSize: 14, fontWeight: '500', color: MUTED, textAlign: 'center', paddingVertical: 34 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68,
    paddingVertical: 17, paddingHorizontal: 16, borderRadius: 18,
    backgroundColor: '#F7F7F8', borderWidth: 1.5, borderColor: 'transparent',
  },
  rowOn: { backgroundColor: navy[50], borderColor: NAVY },
  mark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: navy[200], alignItems: 'center', justifyContent: 'center' },
  markOn: { borderWidth: 0, backgroundColor: NAVY },
  rowOnMono: { backgroundColor: '#F4F4F4', borderColor: '#111111' },
  markMono: { borderColor: '#D4D4D4' },
  markOnMono: { borderWidth: 0, backgroundColor: '#111111' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 13, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '600', color: NAVY },
  body: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 15.5, fontWeight: '600', color: NAVY, letterSpacing: -0.2 },
  sub: { fontSize: 12.5, fontWeight: '500', color: MUTED, marginTop: 3 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  subDot: { width: 6, height: 6, borderRadius: 3 },
  subToned: { flexShrink: 1, fontSize: 12.5, fontWeight: '500' },
  trailingAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  trailingAvatarText: { fontSize: 10.5, fontWeight: '600', color: NAVY },
  footnote: { fontSize: 12.5, fontWeight: '500', color: '#A3A3A3', lineHeight: 18, marginTop: 16, marginHorizontal: 4 },

  cta: {
    marginTop: 22, height: 54, borderRadius: 27, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center',
    ...primaryCtaShadow,
  },
  ctaOff: { backgroundColor: '#ECECEF', shadowOpacity: 0, elevation: 0 },
  ctaMono: { backgroundColor: '#111111' },
  ctaCount: {
    minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  ctaCountText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
  ctaTextOff: { color: '#A3A3AD' },
});
