import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { SelectableChip } from '../../../src/components/SelectableChip';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { ToggleSwitch } from '../../../src/components/ToggleSwitch';
import { clusterSettingsStore } from '../../../src/stores/clusterSettingsStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;

const ACTOR_OPTIONS = [
  { value: undefined, label: 'Default' },
  { value: 'students', label: 'Solo allievi' },
  { value: 'instructors', label: 'Solo istruttori' },
  { value: 'both', label: 'Entrambi' },
] as const;

// REG-426: le tre righe del pannello "differenzia per percorso". Ogni riga può
// ereditare ("Default autoscuola") oppure forzare un valore (usa ACTOR_OPTIONS).
const PATH_BUCKETS = [
  { key: 'moto' as const, label: 'Percorso moto', cats: 'AM · A1 · A2 · A' },
  { key: 'auto' as const, label: 'Percorso auto', cats: 'B · BE' },
  { key: 'pro' as const, label: 'Percorso professionali', cats: 'C · CE · D · DE' },
];

const MODE_OPTIONS = [
  { value: undefined, label: 'Default' },
  { value: 'manual_full', label: 'Manuale totale' },
  { value: 'manual_engine', label: 'Manuale + motore' },
] as const;

export default function BookingRulesScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(clusterSettingsStore.subscribe, clusterSettingsStore.get);
  // Modalità "differenzia per percorso" — apre il pannello moto/auto/pro. Locale
  // (hook prima dell'early return); si inizializza da eventuali override dal BE.
  const [perPathOpen, setPerPathOpen] = useState(false);
  const seededRef = useRef(false);
  useEffect(() => {
    if (data && !seededRef.current) {
      const bp = data.appBookingActorsByPath;
      if (bp && (bp.moto || bp.auto || bp.pro)) setPerPathOpen(true);
      seededRef.current = true;
    }
  }, [data]);
  if (!data) return <View style={s.root} />;

  const {
    appBookingActors, setAppBookingActors,
    appBookingActorsByPath, setAppBookingActorsByPath,
    instructorBookingMode, setInstructorBookingMode,
    bookingSlotDurations, toggleDuration,
    roundedHoursOnly, setRoundedHoursOnly,
    saving, onSave,
  } = data;

  const byPath = appBookingActorsByPath ?? {};

  // Entra in "differenzia": semina le 3 righe col valore semplice corrente (se
  // concreto), altrimenti tutte su "Default autoscuola". Apre il pannello.
  const enterPerPath = () => {
    if (appBookingActors) {
      setAppBookingActorsByPath({ moto: appBookingActors, auto: appBookingActors, pro: appBookingActors });
    } else {
      setAppBookingActorsByPath({});
    }
    setPerPathOpen(true);
  };
  // Torna a un valore semplice: azzera gli override, chiude il pannello.
  const pickSimple = (value: string | undefined) => {
    setAppBookingActors(value);
    setAppBookingActorsByPath(undefined);
    setPerPathOpen(false);
  };
  // Imposta una riga: "Default" rimuove la chiave (eredita), altrimenti forza.
  const pickPath = (bucket: 'moto' | 'auto' | 'pro', value: string | undefined) => {
    const next: { moto?: string; auto?: string; pro?: string } = { ...byPath };
    if (value) next[bucket] = value;
    else delete next[bucket];
    setAppBookingActorsByPath(next);
  };

  return (
    <View style={[s.root, { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <View style={s.headerBlock}>
        <Text style={s.title}>Prenotazione guide</Text>
        <Text style={s.subtitle}>Chi può prenotare, modalità e durate.</Text>
      </View>

      <SheetScaffold
        fill
        style={{ gap: 20 }}
        contentContainerStyle={{ gap: 20, paddingBottom: 8 }}
        footer={
          <Pressable
            onPress={saving ? undefined : async () => { await onSave(); router.back(); }}
            disabled={saving}
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }, saving && { opacity: 0.6 }]}
          >
            <GradientCTABackground radius={27} />
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.ctaText}>Salva</Text>}
          </Pressable>
        }
      >
      <Animated.View style={s.section} layout={LinearTransition.duration(240)}>
        <Text style={s.label}>Chi prenota</Text>
        <View style={s.chips}>
          {ACTOR_OPTIONS.map((opt) => (
            <SelectableChip
              key={opt.value ?? '_default'}
              label={opt.label}
              active={!perPathOpen && appBookingActors === opt.value}
              onPress={() => pickSimple(opt.value)}
            />
          ))}
          {/* REG-426: voce che apre il pannello per-percorso (equivalente mobile
              della voce "Differenzia per percorso patente…" del dropdown web). */}
          <SelectableChip
            label="Per percorso"
            active={perPathOpen}
            onPress={enterPerPath}
          />
        </View>

        {perPathOpen && (
          // entering/exiting = fade; il layout della sezione (+ delle sezioni
          // sotto) anima l'altezza → reveal/collapse fluido (height + opacity).
          <Animated.View
            style={s.pathCard}
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(150)}
          >
            {PATH_BUCKETS.map((bucket, i) => (
              <View key={bucket.key} style={[s.pathRow, i > 0 && s.pathRowBorder]}>
                <Text style={s.pathTitle}>{bucket.label}</Text>
                <Text style={s.pathCats}>{bucket.cats}</Text>
                <View style={s.pathChips}>
                  {ACTOR_OPTIONS.map((opt) => (
                    <SelectableChip
                      key={opt.value ?? '_default'}
                      label={opt.value === undefined ? 'Default autoscuola' : opt.label}
                      active={(byPath[bucket.key] ?? undefined) === opt.value}
                      onPress={() => pickPath(bucket.key, opt.value)}
                    />
                  ))}
                </View>
              </View>
            ))}
            <Text style={s.pathHint}>
              «Default autoscuola» eredita, per quel percorso, il valore impostato dall&apos;autoscuola.
            </Text>
          </Animated.View>
        )}
      </Animated.View>

      <Animated.View style={s.section} layout={LinearTransition.duration(240)}>
        <Text style={s.label}>Modalità istruttore</Text>
        <View style={s.chips}>
          {MODE_OPTIONS.map((opt) => (
            <SelectableChip
              key={opt.value ?? '_default'}
              label={opt.label}
              active={instructorBookingMode === opt.value}
              onPress={() => setInstructorBookingMode(opt.value)}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View style={s.section} layout={LinearTransition.duration(240)}>
        <Text style={s.label}>Durata guide</Text>
        <View style={s.chips}>
          {DURATION_OPTIONS.map((dur) => (
            <SelectableChip
              key={dur}
              label={`${dur} min`}
              active={bookingSlotDurations.includes(dur)}
              onPress={() => toggleDuration(dur)}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View style={s.card} layout={LinearTransition.duration(240)}>
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Solo orari tondi</Text>
            <Text style={s.toggleDesc}>Slot solo a ore piene (es. 9:00, 10:00).</Text>
          </View>
          <ToggleSwitch value={roundedHoursOnly} onValueChange={setRoundedHoursOnly} />
        </View>
      </Animated.View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },
  section: { gap: 11 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // REG-426 per-path panel
  pathCard: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EBEDF0',
    paddingHorizontal: 16,
  },
  pathRow: { paddingVertical: 16, gap: 10 },
  pathRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0F0F0' },
  pathTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  pathCats: { fontSize: 12, fontWeight: '500', color: '#A0A0A0', marginTop: -6 },
  pathChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pathHint: { fontSize: 12, fontWeight: '500', color: colors.textMuted, lineHeight: 17, paddingBottom: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#EBEDF0' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  toggleDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  cta: {
    minHeight: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    ...primaryCtaShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
