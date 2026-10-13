import React, { useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  followCarConflictStore,
  type ConflictChoice,
  type FollowCarConflictData,
} from '../../stores/followCarConflictStore';
import { optionsPickerPath, optionsPickerStore } from '../../stores/optionsPickerStore';
import { transmissionLabel } from '../../utils/license';
import { GradientCTABackground, primaryCtaShadow } from '../GradientCTA';
import { GlassCloseButton } from '../GlassCloseButton';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const NAVY = '#1A1A2E';
const GREY = '#717171';
const MUTED = '#929292';
const RED = '#C13515';
const RED_TINT = '#FFF8F7';

/** Sentinella del picker: "nessuna auto al seguito" e' una risposta valida. */
const NO_FOLLOW_CAR = '__none__';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "ven 17 ott · 09:00 – 10:00" — le stesse parole del web. */
const formatSlot = (startsAt: string, endsAt: string) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = start.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${day} · ${time(start)} – ${time(end)}`;
};

const capitalize = (text: string) => (text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text);

/**
 * Una sola auto libera non e' una scelta: la mettiamo gia' noi (stessa regola
 * del veicolo precompilato). Con piu' d'una si lascia decidere.
 */
const prefillChoices = (data: FollowCarConflictData | null): Record<number, ConflictChoice> => {
  const next: Record<number, ConflictChoice> = {};
  for (const entry of data?.entries ?? []) {
    if (entry.conflict?.role !== 'follow') continue;
    if (entry.freeFollowCars?.length === 1) next[entry.index] = entry.freeFollowCars[0].id;
  }
  return next;
};

/**
 * «Auto al seguito occupata» — il secondo passo della prenotazione multipla
 * dell'app istruttore (REG-615, gemello nativo di REG-613).
 *
 * Due presentazioni, stessa sostanza (vedi `followCarConflictPath`):
 * - `scrollable={false}` → form sheet che abbraccia il contenuto (1-3 date):
 *   radice `<View>` semplice, **nessuna ScrollView** — `fitToContents` non la
 *   sa misurare e il foglio si rompe.
 * - `scrollable` → page sheet nativo (4+ date): header fisso, corpo che
 *   scorre, CTA ancorata in fondo.
 *
 * Le date libere non si elencano: sono gia' riassunte in cima. A schermo c'e'
 * solo quello su cui bisogna decidere.
 */
export function FollowCarConflictSheet({ scrollable }: { scrollable: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(followCarConflictStore.subscribe, followCarConflictStore.get);

  // Catturato al mount: le risposte sono di questo foglio, non dello store
  // (un fast-refresh non le deve azzerare a meta' decisione).
  const [choice, setChoice] = useState<Record<number, ConflictChoice>>(() =>
    prefillChoices(followCarConflictStore.get()),
  );

  if (!data) return <View style={scrollable ? s.rootTall : s.root} />;

  const total = data.entries.length;
  const conflicts = data.entries.filter((e) => e.conflict);
  const followConflicts = conflicts.filter((e) => e.conflict?.role === 'follow');
  // Il nome si puo' dire solo se a bloccare e' SEMPRE quella macchina: con
  // motivi misti (anche l'istruttore occupato) la frase mentirebbe.
  const busyName =
    followConflicts.length === conflicts.length ? followConflicts[0]?.conflict?.vehicleName : undefined;
  const pendingFollow = followConflicts.filter((e) => choice[e.index] === undefined);
  const showSuggestion = Boolean(data.suggestedForAll) && pendingFollow.length > 1;
  const anyChoosable = conflicts.some((e) => (e.freeFollowCars?.length ?? 0) > 0);
  const pendingCount = conflicts.filter((e) => choice[e.index] === undefined).length;
  const keptCount = data.entries.filter((e) => choice[e.index] !== 'remove').length;

  const pick = (index: number, value: ConflictChoice | undefined) =>
    setChoice((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[index];
      else next[index] = value;
      return next;
    });

  const applyToAll = () => {
    const car = data.suggestedForAll;
    if (!car) return;
    setChoice((prev) => {
      const next = { ...prev };
      for (const entry of followConflicts) {
        if (next[entry.index] === undefined) next[entry.index] = car.id;
      }
      return next;
    });
  };

  /** La scelta dell'auto e' un foglio nativo a sua volta: nessun elenco annidato. */
  const openCarPicker = (entry: (typeof data.entries)[number]) => {
    const current = choice[entry.index];
    const cars = entry.freeFollowCars ?? [];
    optionsPickerStore.set({
      title: 'Auto al seguito',
      hint: formatSlot(entry.startsAt, entry.endsAt),
      multi: false,
      selected: current === null ? [NO_FOLLOW_CAR] : current && current !== 'remove' ? [current] : [],
      options: [
        ...cars.map((car) => ({
          value: car.id,
          label: car.name,
          subtitle: transmissionLabel(car.transmission) || null,
        })),
        { value: NO_FOLLOW_CAR, label: 'Nessuna auto al seguito', subtitle: null },
      ],
      onConfirm: (values) => {
        const picked = values[0];
        if (!picked) return;
        pick(entry.index, picked === NO_FOLLOW_CAR ? null : picked);
      },
    });
    router.push(optionsPickerPath());
  };

  /** `onlyFree` crea solo le date gia' libere, lasciando perdere le altre. */
  const confirm = (onlyFree: boolean) => {
    const payload = data.entries
      .filter((entry) => choice[entry.index] !== 'remove')
      .filter((entry) => (onlyFree ? !entry.conflict : true))
      .map((entry) => {
        const answer = choice[entry.index];
        return {
          startsAt: entry.startsAt,
          endsAt: entry.endsAt,
          // `undefined` = eredita l'auto condivisa; `null` = nessuna auto.
          ...(answer !== undefined && answer !== 'remove' ? { followVehicleId: answer } : {}),
        };
      });
    // Il foglio si chiude subito: la prenotazione la fa il form sotto, con lo
    // spinner sulla sua CTA (una sola attesa a schermo, mai due).
    router.back();
    data.onConfirm(payload);
  };

  const rows = conflicts.map((entry) => {
    const answer = choice[entry.index];
    const answered = answer !== undefined;
    const removed = answer === 'remove';
    const freeCars = entry.freeFollowCars ?? [];
    const canSwap = entry.conflict?.role === 'follow' && freeCars.length > 0;
    // Tinta rossa solo dove non c'e' ancora una risposta: con tutte le righe
    // colorate il rosso smette di voler dire qualcosa.
    const alarming = !answered && !canSwap;
    const chosenCar =
      answer && answer !== 'remove' ? freeCars.find((car) => car.id === answer) : undefined;

    return (
      <View
        key={entry.index}
        style={[s.card, alarming ? s.cardAlarm : null, removed ? { opacity: 0.6 } : null]}
      >
        <View style={s.cardHead}>
          <View style={[s.num, removed && s.numOff]}>
            {answered ? (
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            ) : (
              <Text style={s.numTxt}>{entry.index + 1}</Text>
            )}
          </View>
          <Text style={s.slot} numberOfLines={1}>
            {formatSlot(entry.startsAt, entry.endsAt)}
          </Text>
        </View>

        {/* Il motivo si legge finche' e' un problema: risolto, sparisce. */}
        {!answered ? (
          <View style={s.reason}>
            <Ionicons name="alert-circle" size={13} color={RED} style={{ marginTop: 1 }} />
            <Text style={s.reasonTxt}>
              {canSwap
                ? `${entry.conflict?.vehicleName ?? "L'auto al seguito"} è già impegnata`
                : entry.conflict?.role === 'follow'
                  ? "Nessuna auto libera a quest'ora"
                  : `${capitalize(entry.conflict?.label ?? '')} — cambiare auto non risolve`}
            </Text>
          </View>
        ) : null}

        {removed ? (
          <View style={s.quietRow}>
            <Text style={s.quietTxt}>Guida tolta dal gruppo</Text>
            <Pressable
              hitSlop={8}
              onPress={() => pick(entry.index, undefined)}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Text style={s.restore}>Ripristina</Text>
            </Pressable>
          </View>
        ) : canSwap ? (
          <Pressable
            onPress={() => openCarPicker(entry)}
            style={({ pressed }) => [s.select, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="car-sport-outline" size={17} color={NAVY} />
            <Text style={[s.selectTxt, !answered && s.selectPlaceholder]} numberOfLines={1}>
              {answer === null
                ? 'Nessuna auto al seguito'
                : (chosenCar?.name ?? "Scegli un'auto libera")}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#C7CBD1" />
          </Pressable>
        ) : answered ? (
          <View style={s.quietRow}>
            <Text style={s.quietTxt}>Senza auto al seguito</Text>
          </View>
        ) : (
          <View style={s.chips}>
            {entry.conflict?.role === 'follow' ? (
              <Pressable
                onPress={() => pick(entry.index, null)}
                style={({ pressed }) => [s.chip, pressed && { opacity: 0.7 }]}
              >
                <Text style={s.chipTxt}>Senza auto al seguito</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => pick(entry.index, 'remove')}
              style={({ pressed }) => [s.chip, s.chipDanger, pressed && { opacity: 0.7 }]}
            >
              <Text style={[s.chipTxt, s.chipDangerTxt]}>Togli la guida</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  });

  const body = (
    <>
      <View style={s.strip}>
        <Ionicons name="alert-circle-outline" size={16} color="#767676" />
        <Text style={s.stripTxt}>
          <Text style={s.stripStrong}>
            {data.freeCount === 0
              ? `Nessuna delle ${total} date è libera.`
              : `${data.freeCount} guid${data.freeCount === 1 ? 'a' : 'e'} su ${total} ${
                  data.freeCount === 1 ? 'è libera' : 'sono libere'
                }.`}
          </Text>{' '}
          {busyName
            ? `In ${conflicts.length} dat${conflicts.length === 1 ? 'a' : 'e'} la ${busyName} è già impegnata.`
            : `In ${conflicts.length} dat${conflicts.length === 1 ? 'a serve' : 'e serve'} una decisione.`}
        </Text>
      </View>

      {showSuggestion && data.suggestedForAll ? (
        <View style={s.suggest}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.suggestTitle} numberOfLines={2}>
              Usa la {data.suggestedForAll.name} per tutte e {pendingFollow.length}
            </Text>
            <Text style={s.suggestSub}>È libera in tutte le date in conflitto</Text>
          </View>
          <Pressable onPress={applyToAll} style={({ pressed }) => [s.applyAll, pressed && { opacity: 0.8 }]}>
            <Text style={s.applyAllTxt}>Applica a tutte</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={s.captionRow}>
        <Text style={s.caption}>Da sistemare · {conflicts.length}</Text>
        <Text style={s.captionHint}>
          {anyChoosable
            ? showSuggestion
              ? 'oppure scegli data per data'
              : "Scegli un'altra auto"
            : 'Serve una decisione'}
        </Text>
      </View>

      <View style={{ gap: 10 }}>{rows}</View>
    </>
  );

  return (
    <View
      style={[
        scrollable ? s.rootTall : s.root,
        // Il form sheet (hug) non arriva all'home indicator: gli basta un
        // respiro fisso. `insets.bottom` serve solo al page sheet, che invece
        // e' a tutta altezza (vedi OptionsPickerSheet).
        { paddingTop: 22, paddingBottom: scrollable ? Math.max(insets.bottom, 16) : 18 },
      ]}
    >
      <View style={s.topbar}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title}>Auto al seguito occupata</Text>
          <Text style={s.hint}>Cambia solo la macchina: le date restano quelle che hai scelto</Text>
        </View>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [s.x, pressed && { opacity: 0.5 }]}
          >
            <Ionicons name="close" size={20} color={NAVY} />
          </Pressable>
        </GlassCloseButton>
      </View>

      {scrollable ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          // Android: senza questo il pan verticale resta al foglio nativo, che
          // si trascina invece di far scorrere il contenuto.
          nestedScrollEnabled
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}

      <Pressable
        onPress={() => confirm(false)}
        disabled={pendingCount > 0 || keptCount === 0}
        style={({ pressed }) => [
          s.cta,
          (pendingCount > 0 || keptCount === 0) && s.ctaOff,
          pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
        ]}
      >
        {pendingCount === 0 && keptCount > 0 ? <GradientCTABackground radius={27} /> : null}
        <Text style={[s.ctaTxt, (pendingCount > 0 || keptCount === 0) && s.ctaTxtOff]}>
          {`Prenota ${keptCount} guid${keptCount === 1 ? 'a' : 'e'}`}
        </Text>
      </Pressable>

      {/* Senza nemmeno una data libera la scorciatoia non ha senso:
          "Prenota solo le 0 libere" e' un bottone che non fa niente. */}
      {data.freeCount > 0 ? (
        <Pressable
          onPress={() => confirm(true)}
          style={({ pressed }) => [s.onlyFree, pressed && { opacity: 0.6 }]}
        >
          <Text style={s.onlyFreeTxt}>
            {`Prenota solo le ${data.freeCount} liber${data.freeCount === 1 ? 'a' : 'e'}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  rootTall: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },

  topbar: { flexDirection: 'row', alignItems: 'flex-start', paddingBottom: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  hint: { fontSize: 13, fontWeight: '500', color: MUTED, marginTop: 5, lineHeight: 18 },
  x: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#F1F2F4', alignItems: 'center', justifyContent: 'center' },

  /* riepilogo: quante sono libere, e perche' le altre no */
  strip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    backgroundColor: '#F6F6F8', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11,
  },
  stripTxt: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500', color: GREY },
  stripStrong: { fontWeight: '700', color: '#222222' },

  /* scorciatoia: un'auto libera in tutte le date in conflitto */
  suggest: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12,
    borderWidth: 1.5, borderColor: NAVY, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13,
  },
  suggestTitle: { fontSize: 14.5, fontWeight: '600', color: NAVY, letterSpacing: -0.2 },
  suggestSub: { fontSize: 12, fontWeight: '500', color: '#767676', marginTop: 3 },
  applyAll: { flexShrink: 0, backgroundColor: NAVY, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  applyAllTxt: { fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' },

  captionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  caption: { fontSize: 11.5, fontWeight: '700', color: '#555555', letterSpacing: 0.4, textTransform: 'uppercase' },
  captionHint: { fontSize: 11.5, fontWeight: '500', color: MUTED },

  /* una riga per ogni data da sistemare */
  card: { borderWidth: 1, borderColor: '#E6E7EC', borderRadius: 16, backgroundColor: '#FFFFFF', padding: 13 },
  cardAlarm: { borderColor: RED, backgroundColor: RED_TINT },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  num: { width: 21, height: 21, borderRadius: 11, backgroundColor: '#222222', alignItems: 'center', justifyContent: 'center' },
  numOff: { backgroundColor: MUTED },
  numTxt: { fontSize: 10.5, fontWeight: '700', color: '#FFFFFF' },
  slot: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '600', color: '#222222', letterSpacing: -0.2 },

  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 7, marginLeft: 30 },
  reasonTxt: { flex: 1, fontSize: 12.5, fontWeight: '500', color: RED, lineHeight: 17 },

  /* la scelta: una riga che apre il foglio delle auto libere */
  select: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginLeft: 30,
    minHeight: 46, borderRadius: 14, paddingHorizontal: 13,
    backgroundColor: '#F7F7F8', borderWidth: 1, borderColor: '#EDEEF2',
  },
  selectTxt: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '600', color: NAVY, letterSpacing: -0.2 },
  selectPlaceholder: { fontWeight: '500', color: GREY },

  quietRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginLeft: 30 },
  quietTxt: { fontSize: 12.5, fontWeight: '500', color: '#767676' },
  restore: { fontSize: 12.5, fontWeight: '600', color: NAVY, textDecorationLine: 'underline' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11, marginLeft: 30 },
  chip: {
    borderRadius: 999, borderWidth: 1, borderColor: '#DDDDDD', backgroundColor: '#FFFFFF',
    paddingHorizontal: 14, minHeight: 36, justifyContent: 'center',
  },
  chipTxt: { fontSize: 12.5, fontWeight: '600', color: '#555555' },
  chipDanger: { borderColor: '#F0C9BF' },
  chipDangerTxt: { color: RED },

  /* azioni */
  cta: {
    marginTop: 20, height: 54, borderRadius: 27, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    ...primaryCtaShadow,
  },
  ctaOff: { backgroundColor: '#ECECEF', shadowOpacity: 0, elevation: 0 },
  ctaTxt: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
  ctaTxtOff: { color: '#A3A3AD' },
  onlyFree: { alignItems: 'center', paddingTop: 14, paddingBottom: 2 },
  onlyFreeTxt: { fontSize: 14, fontWeight: '600', color: NAVY, textDecorationLine: 'underline' },
});
