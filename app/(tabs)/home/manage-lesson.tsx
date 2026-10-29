import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { manageLessonStore, type ManageLessonMenuOption } from '../../../src/stores/manageLessonStore';
import { lessonDetailsStore } from '../../../src/stores/lessonDetailsStore';
import { correctOutcomeStore } from '../../../src/stores/correctOutcomeStore';
import { instructorPickerStore } from '../../../src/stores/instructorPickerStore';
import { locationPickerStore } from '../../../src/stores/locationPickerStore';
import { locationFormStore } from '../../../src/stores/locationFormStore';
import { optionsPickerPath, optionsPickerStore } from '../../../src/stores/optionsPickerStore';
import { regloApi } from '../../../src/services/regloApi';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayIconButton, ClayList, ClayListRow, ClayPressable, Icon3D } from '../../../src/components/clay';
import { PlayGlyph } from '../../../src/components/clay/ClayButton';
import { VITA_ART } from '../../../src/theme/vitaArt';
import { evaluationSummary, evaluationSummaryLabel } from '../../../src/utils/evaluationSheet';
import { LESSON_TYPE_OPTIONS, normalizeLessonType } from '../../../src/utils/lessonTypes';
import { isMotoLicenseCategory, vehicleServesStudent } from '../../../src/utils/license';
import { asMotoLessonType, MOTO_LESSON_TYPE_LABELS, MOTO_LESSON_TYPE_HINTS } from '../../../src/utils/motoLessonType';
import { instructorCanUseVehicle } from '../../../src/utils/vehicles';
import { formatDay, formatTime } from '../../../src/utils/date';
import { SOFT_LAYOUT, SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../../../src/utils/motion';
import { CLAY } from '../../../src/theme/clay';
import { RoadLessonCard } from '../../../src/components/road/RoadLessonCard';
import { useRoadEnabled } from '../../../src/hooks/useRoadEnabled';
import { useRoadSelector } from '../../../src/road/roadStore';
import { SHEET_HANDOFF_MS, beginRoadEntry } from '../../../src/road/entryFlow';
import { lessonMinutes } from '../../../src/road/planStore';
import { RoadPlanCard } from '../../../src/components/road/RoadPlanCard';
import * as Haptics from '../../../src/utils/haptics';

const DANGER = '#C13515';

/** Elimina: testo rosso premibile (mai un bottone rosso pieno). */
function DeleteAction({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  return (
    <ClayPressable
      kind="small"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={s.textAction}
      accessibilityRole="button"
      accessibilityLabel="Elimina guida"
      testID="manage-lesson-delete"
    >
      <Text style={[s.textActionTx, { color: DANGER }]}>Elimina guida</Text>
    </ClayPressable>
  );
}

/** Sposta / Scambia: righe di una lista clay (aprono il loro foglio). */
function ActionList({
  options,
  onAction,
}: {
  options: ManageLessonMenuOption[];
  onAction: (key: string) => void;
}) {
  if (!options.length) return null;
  return (
    <ClayList>
      {options.map((o) => (
        <ClayListRow key={o.key} title={o.label} onPress={() => onAction(o.key)} testID={`manage-lesson-${o.key}`} />
      ))}
    </ClayList>
  );
}

/**
 * Azioni in fondo al foglio (prop `cta` di FormSheet, ultima cosa):
 * - guida in corso/da segnare: «Presente» (primaria) · «Assente» (secondaria);
 *   le altre azioni (Sposta, Scambia, Elimina) restano dietro «Altre azioni» e
 *   compaiono con una dissolvenza morbida, l'altezza scivola (niente pillole);
 * - senza Presente/Assente: le azioni direttamente;
 * - guida passata (correzione): «Correggi esito» + «Elimina guida».
 * Giro Road (Tiziano 28/10): se è la guida che Road può avviare adesso, in
 * cima «Avvia con Road» (primaria nera) e Presente/Assente scendono a
 * secondarie affiancate: così chi ha detto «Non ora» all'invito ci ritorna.
 */
function LessonActions({
  correctionMode,
  showStatusActions,
  allowPresente,
  pendingAction,
  menuOptions,
  onPresente,
  onAssente,
  onCorrect,
  onAction,
  onRoad,
}: {
  onRoad?: (() => void) | null;
  correctionMode: boolean;
  showStatusActions: boolean;
  allowPresente: boolean;
  pendingAction: string | null;
  menuOptions: ManageLessonMenuOption[];
  onPresente: () => void;
  onAssente: () => void;
  onCorrect: () => void;
  onAction: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPending = pendingAction !== null;
  const danger = menuOptions.find((o) => o.danger) ?? null;
  const others = menuOptions.filter((o) => !o.danger);

  if (correctionMode) {
    return (
      <View style={s.ctaCol}>
        {showStatusActions ? (
          <ClayButton
            title="Correggi esito"
            onPress={onCorrect}
            loading={isPending}
            testID="manage-lesson-correct"
          />
        ) : null}
        {danger ? <DeleteAction onPress={() => onAction(danger.key)} disabled={isPending} /> : null}
      </View>
    );
  }

  const run = (key: string) => {
    setExpanded(false);
    onAction(key);
  };

  const roadButton = onRoad ? (
    <ClayButton
      title="Avvia con Road"
      leading={<PlayGlyph />}
      onPress={onRoad}
      disabled={isPending}
      testID="manage-lesson-road"
    />
  ) : null;

  // Niente Presente/Assente: le azioni si vedono subito (c'è posto).
  if (!showStatusActions) {
    return (
      <View style={s.ctaCol}>
        {roadButton}
        <ActionList options={others} onAction={onAction} />
        {danger ? <DeleteAction onPress={() => onAction(danger.key)} disabled={isPending} /> : null}
      </View>
    );
  }

  const hasMore = others.length > 0;
  const presente = allowPresente ? (
    <ClayButton
      title="Presente"
      variant={roadButton ? 'secondary' : 'primary'}
      onPress={onPresente}
      loading={pendingAction === 'checked_in'}
      disabled={isPending}
      style={roadButton ? s.half : undefined}
      testID="manage-lesson-presente"
    />
  ) : null;
  const assente = (
    <ClayButton
      title="Assente"
      variant="secondary"
      onPress={onAssente}
      loading={pendingAction === 'no_show'}
      disabled={isPending}
      style={roadButton && presente ? s.half : undefined}
      testID="manage-lesson-assente"
    />
  );
  return (
    <View style={s.ctaCol}>
      {roadButton}
      {roadButton && presente ? (
        <View style={s.statusRow}>
          {presente}
          {assente}
        </View>
      ) : (
        <>
          {presente}
          {assente}
        </>
      )}
      {hasMore ? (
        <>
          <ClayPressable
            kind="small"
            onPress={() => setExpanded((v) => !v)}
            hitSlop={8}
            style={s.textAction}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Chiudi azioni' : 'Altre azioni'}
            accessibilityState={{ expanded }}
            testID="manage-lesson-more"
          >
            <Text style={s.textActionTx}>Altre azioni</Text>
          </ClayPressable>
          {expanded ? (
            <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT} layout={SOFT_LAYOUT} style={s.ctaCol}>
              <ActionList options={others} onAction={run} />
              {danger ? <DeleteAction onPress={() => run(danger.key)} disabled={isPending} /> : null}
            </Animated.View>
          ) : null}
        </>
      ) : danger ? (
        <DeleteAction onPress={() => onAction(danger.key)} disabled={isPending} />
      ) : null}
    </View>
  );
}

export default function ManageLessonScreen() {
  const router = useRouter();
  const { enabled: roadEnabled } = useRoadEnabled();
  const roadEligible = useRoadSelector((st) => st.eligible);
  const roadPhase = useRoadSelector((st) => st.phase);
  const data = useSyncExternalStore(manageLessonStore.subscribe, manageLessonStore.get);

  // Tell the parent when this route is dismissed (popped), then clear the store.
  useEffect(() => {
    return () => {
      manageLessonStore.get()?.onClosed?.();
      manageLessonStore.clear();
    };
  }, []);

  const lesson = data?.lesson ?? null;

  if (!data || !lesson) {
    return <View style={s.empty} />;
  }

  const {
    stateMeta, stateLabel, durationText, durationMin, vehiclesEnabled, vehicleText,
    vehicles, defaultLocation, showStatusActions, correctionMode, allowPresente, readOnly,
    pendingAction, menuOptions, onChangeInstructor, onStatus, onMenu, onChangeLocation, onChangeVehicle,
    onChangeDuration, studentLicense, followCarRules,
  } = data;

  // Esito attuale (per marcare "attuale" sul bottone giusto in correzione).
  const currentOutcome: 'checked_in' | 'no_show' | null =
    (lesson.status ?? '').trim().toLowerCase() === 'checked_in'
      ? 'checked_in'
      : (lesson.status ?? '').trim().toLowerCase() === 'no_show'
        ? 'no_show'
        : null;

  const isPending = pendingAction !== null;
  const phone = lesson.student?.phone ?? null;
  const hasMenu = menuOptions.length > 0;

  const openInstructorPicker = () => {
    instructorPickerStore.set({
      currentInstructorId: lesson.instructorId ?? null,
      selectedInstructorId: lesson.instructorId ?? null,
      onSelect: (it) => onChangeInstructor(it),
    });
    router.push('/(tabs)/home/manage-lesson-instructor');
  };

  const openLocationPicker = () => {
    locationPickerStore.set({
      selectedLocationId: lesson.locationId ?? defaultLocation?.id ?? null,
      onSelect: (loc) => onChangeLocation(loc),
      onRequestCreate: () => {
        locationFormStore.set({
          initial: null,
          onSubmit: async (values) => {
            // Just create it — the picker refetches on focus and shows it in
            // the list. The user then taps it to apply (single change → no
            // "Nessuna modifica da salvare" from re-applying the same id).
            await regloApi.createLocation(values);
          },
        });
        router.push('/(tabs)/home/manage-lesson-location-form');
      },
    });
    router.push('/(tabs)/home/manage-lesson-location');
  };

  // Auto / unassigned guide → single "Veicolo" row picker (eligible vehicles for
  // the student that this instructor can use). The moto multi-vehicle editing
  // (primary + extra motos + follow car) lives in the manage-lesson-vehicles
  // sheet to keep this screen uncluttered.
  const lessonInstructorId = lesson.instructorId ?? null;
  const openVehiclePicker = () => {
    optionsPickerStore.set({
      title: 'Veicolo',
      multi: false,
      selected: lesson.vehicleId ? [lesson.vehicleId] : [],
      options: vehicles
        .filter(
          (v) =>
            (!lessonInstructorId || instructorCanUseVehicle(v, lessonInstructorId)) &&
            vehicleServesStudent(v, studentLicense ?? {}),
        )
        .map((v) => ({ value: v.id, label: v.name, subtitle: v.subtitle ?? null })),
      onConfirm: (v) => onChangeVehicle(v[0] ?? null),
    });
    router.push(optionsPickerPath());
  };

  const openVehiclesSheet = () => router.push('/(tabs)/home/manage-lesson-vehicles');

  // Durata modificabile: start invariato, cambia solo l'endsAt. Le opzioni
  // fisse + la durata attuale (così esami/guide più lunghe restano selezionabili).
  const openDurationPicker = () => {
    const fmt = (m: number) =>
      m < 60 ? `${m} min` : m % 60 === 0 ? (m === 60 ? '1 ora' : `${m / 60} ore`) : `${Math.floor(m / 60)}h ${m % 60}′`;
    const choices = Array.from(new Set([30, 45, 60, 90, 120, durationMin])).sort((a, b) => a - b);
    optionsPickerStore.set({
      title: 'Durata',
      multi: false,
      selected: [String(durationMin)],
      options: choices.map((m) => ({ value: String(m), label: fmt(m), subtitle: null })),
      onConfirm: (v) => { if (v[0]) onChangeDuration(Number(v[0])); },
    });
    router.push(optionsPickerPath());
  };

  const openDetails = () => {
    lessonDetailsStore.set({
      lesson,
      isDetailsEditable: data.isDetailsEditable,
      onSaveDetails: data.onSaveDetails,
    });
    router.push('/(tabs)/home/manage-lesson-details');
  };

  // Student detail modal — same route the exam sheet uses, stacks natively
  // over this sheet with its own X close.
  const openStudentDetail = () =>
    router.push({
      pathname: '/(tabs)/home/student-detail',
      params: { studentId: lesson.studentId, name: studentName },
    } as never);

  const runMenu = (key: string) => {
    if (isPending) return;
    if (key === 'scambia' || key === 'sposta') {
      // These open a formSheet that stacks natively over this sheet — keep
      // "Gestisci guida" open underneath instead of closing it first.
      onMenu(key);
      return;
    }
    router.back();
    setTimeout(() => onMenu(key), 350);
  };

  const handleStatus = (action: 'checked_in' | 'no_show') => {
    if (isPending) return;
    router.back();
    setTimeout(() => onStatus(action), 300);
  };

  // Correzione guida passata: apre il form sheet nativo "Correggi esito".
  const openCorrect = () => {
    if (isPending) return;
    correctOutcomeStore.set({ currentOutcome, onPick: (action) => onStatus(action) });
    router.push('/(tabs)/home/manage-lesson-correct');
  };

  const locName = lesson.location?.name ?? defaultLocation?.name ?? "Sede dell'autoscuola";
  const locAddress = lesson.location?.address ?? defaultLocation?.address ?? null;

  // Vehicles: a moto guide shows a single "Veicoli" summary row that opens the
  // manage-lesson-vehicles sheet (primary moto + extra motos + follow car). An
  // auto / unassigned guide keeps the single "Veicolo" picker row inline.
  const primaryVehicle = lesson.vehicle ?? null;
  const followVehicle = lesson.followVehicle ?? null;
  const extraMotos = lesson.extraMotoVehicles ?? [];
  const primaryIsMoto = vehiclesEnabled && isMotoLicenseCategory(primaryVehicle?.licenseCategory);
  const motoBlock = primaryIsMoto;
  // Summary shown on the "Veicoli" row: primary (+N moto) and the follow car.
  const motoSummaryMain =
    (primaryVehicle?.name ?? 'Moto da assegnare') +
    (extraMotos.length ? ` +${extraMotos.length} moto` : '');
  const motoSummarySub = followVehicle
    ? `Auto al seguito: ${followVehicle.name}`
    : (primaryIsMoto && followCarRules?.[primaryVehicle?.licenseCategory ?? '']?.enabled === true
        ? 'Nessuna auto al seguito'
        : null);
  const instructorDisplay = lesson.instructor?.name ?? 'Nessun istruttore';
  const studentName = `${lesson.student?.firstName ?? ''} ${lesson.student?.lastName ?? ''}`.trim() || 'Allievo';

  // Details card preview (tipo · voto · note)
  const typeValues = lesson.types?.length ? lesson.types : (lesson.type ? [lesson.type] : []);
  const typeLabels = typeValues
    .map((v) => LESSON_TYPE_OPTIONS.find((o) => o.value === normalizeLessonType(v))?.label ?? null)
    .filter(Boolean) as string[];
  const summaryParts: string[] = [];
  if (typeLabels.length) summaryParts.push(typeLabels.join(', '));
  // Il riepilogo mostra il PAGELLINO, non più la stellina singola (che non si
  // compila più). Con scale miste non si fa la media: si conta le voci.
  const evalRecap = evaluationSummary(lesson.evaluations);
  if (evalRecap) {
    const label = evaluationSummaryLabel(evalRecap);
    summaryParts.push(
      // Con la media si mostra solo il numero ("pagellino 4,2"); senza media
      // (scale miste o tutte le voci escluse) si mostra l'etichetta intera.
      evalRecap.average != null ? `pagellino ${label!.split('/')[0]}` : `pagellino ${label}`,
    );
  }
  if (lesson.notes && lesson.notes.trim()) summaryParts.push('note');
  const detailsSummary = summaryParts.join(' · ') || 'Tipo, pagellino e note';
  // Giro «memorabile»: guida fatta e ancora da valutare = il prossimo passo.
  // La riga «Dettagli guida» diventa una domanda calda con la stella 3D, in
  // cima, finché non c'è il pagellino o una nota.
  const lessonDone = ['completed', 'checked_in'].includes((lesson.status ?? '').trim().toLowerCase());
  const askHowItWent =
    !readOnly && lesson.type !== 'esame' && lessonDone && !evalRecap && !(lesson.notes && lesson.notes.trim());
  const firstName = lesson.student?.firstName?.trim() || null;

  // Giro Road: la guida che Road può avviare adesso (stesso criterio
  // dell'invito, deciso dal server: esclude esami e guide di gruppo).
  const roadLesson =
    roadEnabled && roadPhase === 'idle' && !readOnly && !correctionMode && roadEligible?.appointmentId === lesson.id
      ? roadEligible
      : null;
  const startRoad = roadLesson
    ? () => {
        if (isPending) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        router.back();
        setTimeout(() => void beginRoadEntry(router, roadLesson), SHEET_HANDOFF_MS);
      }
    : null;

  const showBottom = showStatusActions || hasMenu || !!startRoad;
  const statusText = stateMeta ? stateMeta.label : stateLabel;
  const metaLine =
    `${formatDay(lesson.startsAt)} · ${formatTime(lesson.startsAt)}` +
    (durationText ? ` · ${durationText}` : '') +
    (vehiclesEnabled && !motoBlock ? ` · ${vehicleText}` : '');
  const motoType = asMotoLessonType(lesson.motoLessonType);

  return (
    <FormSheet
      testID="manage-lesson-sheet"
      title={
        // Nome tappabile → modal dettaglio allievo (storico, pagamenti, esami)
        <Pressable
          onPress={openStudentDetail}
          hitSlop={6}
          style={({ pressed }) => [s.nameRow, pressed && { opacity: 0.55 }]}
          accessibilityRole="button"
          accessibilityLabel={`${studentName}, apri la scheda allievo`}
          testID="manage-lesson-student"
        >
          <Text style={s.name} numberOfLines={2}>{studentName}</Text>
          <Ionicons name="chevron-forward" size={19} color={CLAY.chevron} style={{ marginTop: 3 }} />
        </Pressable>
      }
      subtitle={
        <View>
          <Text style={s.meta} numberOfLines={2}>{metaLine}</Text>
          {/* Stato in testo semplice (niente pillola colorata). */}
          <Text style={s.status} numberOfLines={1} testID="manage-lesson-status">{statusText}</Text>
        </View>
      }
      cta={
        showBottom ? (
          <LessonActions
            correctionMode={correctionMode}
            showStatusActions={showStatusActions}
            allowPresente={allowPresente}
            pendingAction={pendingAction}
            menuOptions={menuOptions}
            onPresente={() => handleStatus('checked_in')}
            onAssente={() => handleStatus('no_show')}
            onCorrect={openCorrect}
            onAction={runMenu}
            onRoad={startRoad}
          />
        ) : undefined
      }
    >
      <View style={s.body}>
        {/* Contatti: comandi monocromatici */}
        {phone ? (
          <View style={s.contacts}>
            <ClayIconButton
              icon={<Ionicons name="call-outline" size={20} color={CLAY.ink} />}
              size="lg"
              onPress={() => Linking.openURL(`tel:${phone}`)}
              accessibilityLabel="Chiama allievo"
              testID="manage-lesson-call"
            />
            <ClayIconButton
              icon={<Ionicons name="logo-whatsapp" size={21} color={CLAY.ink} />}
              size="lg"
              onPress={() => Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`)}
              accessibilityLabel="Scrivi su WhatsApp"
              testID="manage-lesson-whatsapp"
            />
          </View>
        ) : null}

        {/* REG-649: il giro di questa guida, sopra «Avvia con Road». */}
        {roadLesson ? (
          <RoadPlanCard
            studentId={roadLesson.student?.id}
            durationMin={lessonMinutes(roadLesson)}
            style={s.roadPlan}
            testID="manage-lesson-plan"
          />
        ) : null}

        {askHowItWent ? (
          <ClayList>
            <ClayListRow
              leading={<Icon3D source={VITA_ART.stella} size={40} />}
              title={firstName ? `Com’è andata ${firstName}?` : 'Com’è andata?'}
              subtitle="Dai il pagellino e lascia una nota"
              onPress={openDetails}
              testID="manage-lesson-how"
            />
          </ClayList>
        ) : null}

        {/* Istruttore, Luogo, Durata, Veicolo/i. Read-only (titolare) = righe
            statiche senza chevron; altrimenti auto-save su selezione. */}
        <ClayList>
          <ClayListRow
            title="Istruttore"
            subtitle={instructorDisplay}
            onPress={readOnly ? undefined : openInstructorPicker}
            testID="manage-lesson-instructor"
          />
          <ClayListRow
            title="Luogo"
            subtitle={
              <Text style={s.rowSub} numberOfLines={2}>
                {locName}
                {locAddress ? `\n${locAddress}` : ''}
              </Text>
            }
            onPress={readOnly ? undefined : openLocationPicker}
            testID="manage-lesson-location"
          />
          <ClayListRow
            title="Durata"
            subtitle={durationText}
            onPress={readOnly ? undefined : openDurationPicker}
            testID="manage-lesson-duration"
          />
          {vehiclesEnabled && !motoBlock ? (
            <ClayListRow
              title="Veicolo"
              subtitle={vehicleText}
              onPress={readOnly || !vehicles.length ? undefined : openVehiclePicker}
              testID="manage-lesson-vehicle"
            />
          ) : null}
          {/* Guida moto: riepilogo "Veicoli" → foglio dedicato (moto principale
              + aggiuntive + auto al seguito). */}
          {motoBlock ? (
            <ClayListRow
              title="Veicoli"
              subtitle={
                <Text style={s.rowSub} numberOfLines={2}>
                  {motoSummaryMain}
                  {motoSummarySub ? `\n${motoSummarySub}` : ''}
                </Text>
              }
              onPress={readOnly ? undefined : openVehiclesSheet}
              testID="manage-lesson-vehicles"
            />
          ) : null}
          {/* Tipo guida moto (birilli/strada) — sola lettura, impostato dal web. */}
          {motoType ? (
            <ClayListRow
              title="Tipo guida moto"
              subtitle={
                <Text style={s.rowSub} numberOfLines={2}>
                  {MOTO_LESSON_TYPE_LABELS[motoType]}
                  {`\n${MOTO_LESSON_TYPE_HINTS[motoType]}`}
                </Text>
              }
            />
          ) : null}
        </ClayList>

        {/* REG-638: percorso Road della guida (solo se c'è una sessione chiusa). */}
        {lesson.type !== 'esame' && !lesson.groupLessonId ? (
          <RoadLessonCard router={router} appointmentId={lesson.id} startsAt={lesson.startsAt} enabled={roadEnabled} />
        ) : null}

        {/* Dettagli guida → sub-sheet. Nascosta in read-only (il titolare non
            modifica tipo/voto/note). */}
        {!readOnly && lesson.type !== 'esame' && !askHowItWent ? (
          <ClayList>
            <ClayListRow
              title="Dettagli guida"
              subtitle={detailsSummary}
              onPress={openDetails}
              testID="manage-lesson-details"
            />
          </ClayList>
        ) : null}
      </View>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  roadPlan: { marginTop: 0 },
  empty: { backgroundColor: '#FFFFFF', height: 1 },

  // Testata
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%' },
  name: { flexShrink: 1, fontSize: 24, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5, lineHeight: 28 },
  meta: { fontSize: 15, color: CLAY.ink3, marginTop: 3, lineHeight: 20 },
  status: { fontSize: 15, fontWeight: '500', color: CLAY.ink2, marginTop: 1, lineHeight: 20 },

  body: { gap: 22 },
  contacts: { flexDirection: 'row', gap: 12 },


  rowSub: { flexShrink: 1, fontSize: 13.5, lineHeight: 18, color: CLAY.ink3 },

  // Azioni in fondo
  ctaCol: { gap: 10 },
  statusRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  textAction: { alignItems: 'center', paddingVertical: 10 },
  textActionTx: { fontSize: 15.5, fontWeight: '500', color: CLAY.ink2 },
});
