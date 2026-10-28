import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';

import { FormSheet } from '../SheetScaffold';
import { useDoneAccessory } from '../KeyboardDoneAccessory';
import { blockSheetStore } from '../../stores/blockSheetStore';
import { timePickerStore } from '../../stores/timePickerStore';
import { dayPickerStore } from '../../stores/dayPickerStore';
import { regloApi } from '../../services/regloApi';
import { ClayButton, ClayField, ClayList, ClayListRow, ClaySection, ClaySegmented, ClayToggle } from '../clay';
import { CLAY } from '../../theme/clay';
import { SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../../utils/motion';

const WEEK_OPTIONS = [2, 4, 8, 12];

const pad2 = (n: number) => String(n).padStart(2, '0');

const normalizeToQuarter = (value: Date) => {
  const next = new Date(value);
  next.setSeconds(0, 0);
  const rounded = Math.ceil(next.getMinutes() / 15) * 15;
  if (rounded === 60) next.setHours(next.getHours() + 1, 0, 0, 0);
  else next.setMinutes(rounded, 0, 0);
  return next;
};

/** Build a Date on `isoDay` at `minutes` from midnight (for the gesture preset). */
const dateAtMinutes = (isoDay: string, minutes: number) => {
  const d = new Date(isoDay);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
};

const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDay = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/* ───────── Shared block-slot form (block-slot, theory-lesson, quick-book) ─────────
 * REG-639 clay: da solo è un `FormSheet` (titolo, riepilogo come sottotitolo,
 * CTA in fondo). `embedded` = dentro il FormSheet di quick-book: solo contenuto
 * e, in coda, riepilogo + CTA (l'ultima cosa del foglio ospite).
 * `presetStartMinutes` seeds the start time (end = +60') from the
 * released-scrub position. */
export function BlockForm({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const data = useSyncExternalStore(blockSheetStore.subscribe, blockSheetStore.get);

  const [date, setDate] = useState<Date>(() => new Date());
  const [startTime, setStartTime] = useState<Date>(() => normalizeToQuarter(new Date()));
  const [endTime, setEndTime] = useState<Date>(() => { const e = normalizeToQuarter(new Date()); e.setMinutes(e.getMinutes() + 60); return e; });
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  const [pending, setPending] = useState(false);
  const reasonRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const { accessoryID, accessory } = useDoneAccessory();

  useEffect(() => {
    if (!data) return;
    const start = data.presetStartMinutes != null
      ? dateAtMinutes(data.initialDate, data.presetStartMinutes)
      : normalizeToQuarter(new Date());
    // Keep the grid ghost's exact duration for a block (no snap); default 60'.
    const end = new Date(start); end.setMinutes(end.getMinutes() + (data.presetDurationMinutes ?? 60));
    setDate(new Date(data.initialDate));
    setStartTime(start);
    setEndTime(end);
    setReason(data.reason ?? '');
    setDescription(data.description ?? '');
    setRecurring(false);
    setRecurringWeeks(4);
    setPending(false);
  }, [data]);

  const invalidRange = useMemo(() => {
    const s2 = startTime.getHours() * 60 + startTime.getMinutes();
    const e2 = endTime.getHours() * 60 + endTime.getMinutes();
    return e2 <= s2;
  }, [startTime, endTime]);

  if (!data) return <View style={s.empty} />;

  // 'theory' = Lezione teorica: reason forzato, niente campo motivo, avviso bloccante.
  const isTheory = data.kind === 'theory';
  // blockId valorizzato → modalità MODIFICA (PATCH, niente ricorrenza).
  const isEditing = !!data.blockId;

  const openDatePicker = () => {
    dayPickerStore.set({
      selectedDate: toYMD(date), markedDates: new Set(), monthsBack: 0, monthsCount: 4,
      allowPast: false, title: 'Seleziona data', onSelect: (ymd) => setDate(fromYMD(ymd)),
    });
    router.push('/(tabs)/home/select-date');
  };

  const openTimePicker = (current: Date, onConfirm: (d: Date) => void) => {
    timePickerStore.set({ selectedTime: current, onConfirm });
    router.push('/(tabs)/home/time-picker');
  };

  // Non-optimistic: keep the sheet open with a button spinner, create the block(s)
  // (one, or N for recurring — the BE creates N offset by 1 week), refresh the
  // parent's agenda from the BE, then close.
  const confirm = () => {
    if (!data) return;
    const startsAt = new Date(date); startsAt.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    const endsAt = new Date(date); endsAt.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    if (endsAt <= startsAt) { Alert.alert('Orario non valido', "L'ora di fine deve essere dopo l'inizio."); return; }
    const reasonVal = isTheory ? 'theory_lesson' : (reason.trim() || null);
    const descVal = description.trim();
    setPending(true);
    void (async () => {
      try {
        if (data.blockId) {
          // ── MODIFICA (blocco singolo) ──
          await regloApi.updateInstructorBlock(data.blockId, {
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            ...(isTheory ? {} : { reason: reason.trim() }),
            description: descVal || null,
          });
          await data.onApplied();
          data.onDone(isTheory ? 'Lezione teorica aggiornata.' : 'Evento aggiornato.');
          router.back();
          return;
        }
        // ── CREAZIONE ──
        await regloApi.createInstructorBlock({
          startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
          ...(reasonVal ? { reason: reasonVal } : {}),
          ...(descVal ? { description: descVal } : {}),
          ...(recurring ? { recurring: true, recurringWeeks } : {}),
        });
        await data.onApplied();
        data.onDone(isTheory ? 'Lezione teorica creata.' : 'Slot bloccato.');
        router.back();
      } catch (err) {
        setPending(false);
        Alert.alert('Errore', err instanceof Error ? err.message : (isTheory ? 'Errore nella lezione teorica' : 'Errore nel blocco slot'));
      }
    })();
  };

  const handleDelete = () => {
    if (!data?.blockId) return;
    Alert.alert(
      isTheory ? 'Eliminare la lezione teorica?' : "Eliminare l'evento?",
      "L'operazione non è reversibile.",
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => {
            const blockId = data.blockId!;
            setPending(true);
            void (async () => {
              try {
                await regloApi.deleteInstructorBlock(blockId);
                await data.onApplied();
                data.onDone(isTheory ? 'Lezione teorica eliminata.' : 'Evento eliminato.');
                router.back();
              } catch (err) {
                setPending(false);
                Alert.alert('Errore', err instanceof Error ? err.message : 'Errore eliminazione');
              }
            })();
          },
        },
      ],
    );
  };

  const canConfirm = !pending && !invalidRange;

  const title = isEditing ? (isTheory ? 'Modifica lezione' : 'Modifica evento') : (isTheory ? 'Lezione teorica' : 'Blocca slot');
  const summary = `${fmtDay(date)} · ${fmtTime(startTime)}–${fmtTime(endTime)}${recurring ? ` · ${recurringWeeks} sett.` : ''}`;
  // Mentre salva il modulo è fermo: le righe non aprono nulla.
  const guard = (fn: () => void) => () => { if (!pending) fn(); };

  const body = (
    <>
      {/* Giorno + orari */}
      <ClayList>
        <ClayListRow title="Giorno" subtitle={fmtDay(date)} onPress={guard(openDatePicker)} />
        <ClayListRow title="Ora inizio" subtitle={fmtTime(startTime)} onPress={guard(() => openTimePicker(startTime, setStartTime))} />
        <ClayListRow title="Ora fine" subtitle={fmtTime(endTime)} onPress={guard(() => openTimePicker(endTime, setEndTime))} />
      </ClayList>
      {invalidRange ? (
        <Animated.Text entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT} style={s.warn}>
          L&apos;ora di fine deve essere dopo l&apos;inizio.
        </Animated.Text>
      ) : null}

      {isTheory ? (
        /* Avviso bloccante — la teorica occupa la fascia in modo duro */
        <Text style={s.notice}>
          In questa fascia risulti occupato: gli allievi non vedranno slot prenotabili e non sarà possibile inserire guide, esami o guide di gruppo sovrapposte.
        </Text>
      ) : (
        /* Motivo — opzionale */
        <ClayField
          ref={reasonRef}
          label="Motivo · facoltativo"
          value={reason}
          onChangeText={setReason}
          placeholder="Es. Visita medica, pausa…"
          editable={!pending}
          multiline
          inputAccessoryViewID={accessoryID}
          style={s.field}
          testID="block-reason"
        />
      )}

      {/* Descrizione — opzionale (anche per la lezione teorica) */}
      <ClayField
        ref={descriptionRef}
        label="Descrizione · facoltativa"
        value={description}
        onChangeText={setDescription}
        placeholder={isTheory ? 'Es. argomento della lezione, aula, materiale…' : 'Note aggiuntive…'}
        editable={!pending}
        multiline
        maxLength={500}
        inputAccessoryViewID={accessoryID}
        style={s.field}
        testID="block-description"
      />
      {accessory}

      {/* Ricorrenza solo in creazione: in modifica si edita il singolo blocco. */}
      {!isEditing ? (
        <>
          <ClayList style={s.gap}>
            <ClayListRow
              title="Ripeti ogni settimana"
              subtitle="Stesso giorno e orario"
              trailing={
                <ClayToggle value={recurring} onValueChange={setRecurring} disabled={pending} accessibilityLabel="Ripeti ogni settimana" testID="block-recurring-toggle" />
              }
            />
          </ClayList>
          {recurring ? (
            <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT}>
              <ClaySection title="Per quante settimane">
                <ClaySegmented
                  options={WEEK_OPTIONS.map((w) => ({ value: w, label: `${w} sett.` }))}
                  value={recurringWeeks}
                  onChange={(w) => { if (!pending) setRecurringWeeks(w); }}
                />
              </ClaySection>
            </Animated.View>
          ) : null}
        </>
      ) : (
        <Pressable
          onPress={handleDelete}
          disabled={pending}
          accessibilityRole="button"
          style={({ pressed }) => [s.delete, pressed && s.pressed]}
          testID="block-delete"
        >
          <Text style={s.deleteTxt}>{isTheory ? 'Elimina lezione teorica' : 'Elimina evento'}</Text>
        </Pressable>
      )}
    </>
  );

  const cta = (
    <ClayButton
      title={isEditing ? 'Salva' : (isTheory ? 'Crea lezione' : 'Blocca slot')}
      loading={pending}
      disabled={!canConfirm}
      onPress={confirm}
      testID="block-submit"
    />
  );

  // Dentro quick-book: il foglio (testata col segmentato, X) è dell'ospite;
  // qui solo contenuto + riepilogo + CTA, che restano l'ultima cosa del foglio.
  if (embedded) {
    return (
      <>
        {body}
        <View style={s.embeddedCta}>
          <Text style={s.summary} numberOfLines={1}>{summary}</Text>
          {cta}
        </View>
      </>
    );
  }

  return (
    <FormSheet
      title={title}
      subtitle={summary}
      onClose={() => { if (!pending) router.back(); }}
      busy={pending}
      cta={cta}
      testID="block-sheet"
    >
      {body}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  gap: { marginTop: 22 },
  field: { marginTop: 22 },
  warn: { fontSize: 13, color: '#C13515', marginTop: 10, paddingHorizontal: 4 },
  notice: { fontSize: 15, lineHeight: 21, color: CLAY.ink2, marginTop: 22, paddingHorizontal: 2 },
  delete: { alignItems: 'center', paddingVertical: 14, marginTop: 14 },
  deleteTxt: { fontSize: 16, fontWeight: '500', color: '#C13515' },
  pressed: { opacity: 0.55 },
  // Stessa distanza che `FormSheet` mette sopra la sua CTA.
  embeddedCta: { marginTop: 22 },
  summary: { fontSize: 14, color: CLAY.ink3, marginBottom: 10, paddingHorizontal: 4 },
});
