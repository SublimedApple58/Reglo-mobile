import React, { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  followCarConflictStore,
  type ConflictChoice,
  type FollowCarConflictData,
} from '../../stores/followCarConflictStore';
import { optionsPickerPath, optionsPickerStore } from '../../stores/optionsPickerStore';
import { transmissionLabel } from '../../utils/license';
import { FormSheet } from '../SheetScaffold';
import { ClayButton, ClayList, ClayListRow, ClaySection } from '../clay';
import { CLAY } from '../../theme/clay';

/** Rosso solo per il problema ancora aperto e per «Togli la guida». */
const RED = '#C13515';

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
 * Le date da sistemare in ordine **cronologico**, non in quello in cui sono
 * state aggiunte: qui si guarda un calendario, e un 15:00 in mezzo fra le 9 e
 * le 11 fa perdere il filo. La numerazione segue l'elenco (1, 2, 3...).
 * Gemello del web: `FollowCarConflictPane.orderConflicts`.
 */
const orderConflicts = (entries: FollowCarConflictData['entries']) =>
  entries
    .filter((entry) => entry.conflict)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

/**
 * Quante guide nascono premendo **adesso**: le date libere piu' quelle gia'
 * sistemate, meno quelle tolte. Il bottone non promette numeri che non puo'
 * mantenere — una riga ancora senza risposta non e' una guida.
 */
const countCreatable = (
  entries: FollowCarConflictData['entries'],
  choice: Record<number, ConflictChoice>,
) =>
  entries.filter(
    (entry) =>
      choice[entry.index] !== 'remove' &&
      (!entry.conflict || choice[entry.index] !== undefined),
  ).length;

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
 * Il form sheet unico (FORM_SHEET + FormSheet, REG-639 clay): alto quanto il
 * contenuto, con molte date scorre il foglio stesso. Le date da sistemare sono
 * righe di una lista clay; il problema aperto si scrive in rosso nel
 * sottotitolo, le decisioni sono azioni di testo (niente chip).
 *
 * Le date libere non si elencano: sono gia' riassunte in cima. A schermo c'e'
 * solo quello su cui bisogna decidere.
 */
export function FollowCarConflictSheet() {
  const router = useRouter();
  const data = useSyncExternalStore(followCarConflictStore.subscribe, followCarConflictStore.get);

  // Catturato al mount: le risposte sono di questo foglio, non dello store
  // (un fast-refresh non le deve azzerare a meta' decisione).
  const [choice, setChoice] = useState<Record<number, ConflictChoice>>(() =>
    prefillChoices(followCarConflictStore.get()),
  );

  if (!data) return <View style={s.empty} />;

  const total = data.entries.length;
  const conflicts = orderConflicts(data.entries);
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
  // Il numero sulla CTA e' quello che nascerebbe premendo adesso.
  const creatableCount = countCreatable(data.entries, choice);

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
    const chosenCar =
      answer && answer !== 'remove' ? freeCars.find((car) => car.id === answer) : undefined;
    const title = capitalize(formatSlot(entry.startsAt, entry.endsAt));
    // Il motivo si legge finche' e' un problema (in rosso): risolto, sparisce.
    const reason = canSwap
      ? `${entry.conflict?.vehicleName ?? "L'auto al seguito"} è già impegnata`
      : entry.conflict?.role === 'follow'
        ? "Nessuna auto libera a quest'ora"
        : `${capitalize(entry.conflict?.label ?? '')} — cambiare auto non risolve`;

    if (removed) {
      return (
        <ClayListRow
          key={entry.index}
          title={title}
          subtitle="Guida tolta dal gruppo"
          dimmed
          trailing={
            <Pressable
              hitSlop={8}
              onPress={() => pick(entry.index, undefined)}
              accessibilityRole="button"
              style={({ pressed }) => pressed && s.pressed}
            >
              <Text style={s.action}>Ripristina</Text>
            </Pressable>
          }
        />
      );
    }
    if (canSwap) {
      return (
        <ClayListRow
          key={entry.index}
          title={title}
          subtitle={
            answered ? (
              <Text style={s.sub} numberOfLines={1}>
                {answer === null ? 'Nessuna auto al seguito' : (chosenCar?.name ?? '')}
              </Text>
            ) : (
              <Text style={s.alarm} numberOfLines={2}>
                {`${reason} · scegli un'auto libera`}
              </Text>
            )
          }
          onPress={() => openCarPicker(entry)}
        />
      );
    }
    if (answered) {
      return <ClayListRow key={entry.index} title={title} subtitle="Senza auto al seguito" />;
    }
    return (
      <ClayListRow
        key={entry.index}
        title={title}
        subtitle={
          <View style={s.decide}>
            <Text style={s.alarm}>{reason}</Text>
            <View style={s.actions}>
              {entry.conflict?.role === 'follow' ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => pick(entry.index, null)}
                  accessibilityRole="button"
                  style={({ pressed }) => pressed && s.pressed}
                >
                  <Text style={s.action}>Senza auto al seguito</Text>
                </Pressable>
              ) : null}
              <Pressable
                hitSlop={8}
                onPress={() => pick(entry.index, 'remove')}
                accessibilityRole="button"
                style={({ pressed }) => pressed && s.pressed}
              >
                <Text style={[s.action, s.danger]}>Togli la guida</Text>
              </Pressable>
            </View>
          </View>
        }
      />
    );
  });

  const ctaDisabled = pendingCount > 0 || keptCount === 0;

  return (
    <FormSheet
      title="Auto al seguito occupata"
      subtitle="Cambia solo la macchina: le date restano quelle che hai scelto"
      testID="follow-car-conflict-sheet"
      cta={
        <View style={s.ctas}>
          <ClayButton
            title={`Prenota ${creatableCount} guid${creatableCount === 1 ? 'a' : 'e'}`}
            onPress={() => confirm(false)}
            disabled={ctaDisabled}
            testID="follow-car-conflict-confirm"
          />
          {/* Senza nemmeno una data libera la scorciatoia non ha senso:
              "Prenota solo le 0 libere" e' un bottone che non fa niente. */}
          {data.freeCount > 0 ? (
            <ClayButton
              variant="secondary"
              title={`Prenota solo le ${data.freeCount} liber${data.freeCount === 1 ? 'a' : 'e'}`}
              onPress={() => confirm(true)}
              testID="follow-car-conflict-only-free"
            />
          ) : null}
        </View>
      }
    >
      <Text style={s.lead}>
        <Text style={s.leadStrong}>
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

      {showSuggestion && data.suggestedForAll ? (
        <ClayList style={s.suggest}>
          <ClayListRow
            title={`Usa la ${data.suggestedForAll.name} per tutte e ${pendingFollow.length}`}
            subtitle="È libera in tutte le date in conflitto"
            onPress={applyToAll}
            chevron={false}
            trailing={<Text style={s.action}>Applica a tutte</Text>}
            testID="follow-car-conflict-apply-all"
          />
        </ClayList>
      ) : null}

      <ClaySection
        title={`Da sistemare · ${conflicts.length}`}
        action={
          <Text style={s.hint}>
            {anyChoosable
              ? showSuggestion
                ? 'oppure scegli data per data'
                : "Scegli un'altra auto"
              : 'Serve una decisione'}
          </Text>
        }
      >
        <ClayList>{rows}</ClayList>
      </ClaySection>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  lead: { fontSize: 15, lineHeight: 21, color: CLAY.ink2 },
  leadStrong: { fontWeight: '600', color: CLAY.ink },
  suggest: { marginTop: 18 },
  hint: { fontSize: 13, color: CLAY.ink3 },
  sub: { flexShrink: 1, fontSize: 13.5, color: CLAY.ink3 },
  alarm: { flexShrink: 1, fontSize: 13.5, lineHeight: 18, color: RED },
  decide: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 8 },
  action: { fontSize: 14.5, fontWeight: '600', color: CLAY.ink },
  danger: { color: RED },
  pressed: { opacity: 0.55 },
  ctas: { gap: 10 },
});
