import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { lessonDetailsStore } from '../stores/lessonDetailsStore';
import { optionsPickerStore, LONG_PICKER_THRESHOLD } from '../stores/optionsPickerStore';
import { studentLocationsStore } from '../stores/studentLocationsStore';
import { studentSettingsStore } from '../stores/studentSettingsStore';
import { lessonHistoryStore } from '../stores/lessonHistoryStore';
import { studentPaymentsStore, StudentPaymentsSettings } from '../stores/studentPaymentsStore';
import { isCompanyManualMode, isLessonUnpaid, canManageLessonPayments } from '../utils/lessonPayments';
import { useSession } from '../context/SessionContext';
import { resolveInitialLessonTypes } from '../utils/lessonTypes';
import { evaluationLevelDate, studentEvaluationLevels } from '../utils/evaluationSheet';
import { StarRating } from '../components/StarRating';
import { SkeletonBlock } from '../components/Skeleton';
import { regloApi } from '../services/regloApi';
import { FormSheet } from '../components/SheetScaffold';
import { Avatar, ClayButton, ClayList, ClayListRow, ClayPressable, ClaySection, ClaySurface, Icon3D } from '../components/clay';
import { CLAY, CLAY_EXAM, CLAY_SHADOW } from '../theme/clay';
import { EXAM_TIME_TBD, examTimeKnown } from '../utils/examTime';
import { VITA_ART } from '../theme/vitaArt';
import {
  AutoscuolaAppointmentWithRelations,
  AutoscuolaCase,
  LicensePath,
  ObtainedLicense,
} from '../types/regloApi';
import {
  ALL_LESSON_PATHS,
  currentPath,
  isQualification,
  lessonsPathFilterId,
  pathForDate,
} from '../utils/licensePaths';
import { colors } from '../theme';
import { transmissionLabel } from '../utils/license';
import { asExamOutcome, askExamOutcome, type ExamOutcome } from '../utils/examOutcome';
import { impactAsync, ImpactFeedbackStyle } from '../utils/haptics';
import { LessonHistoryRow } from '../components/student/LessonHistoryRow';
import { useRoadEnabled } from '../hooks/useRoadEnabled';
import { openRoadPercorso } from '../road/openRoadPercorso';
import { studentSheetHref, studentSheetStack } from '../utils/studentSheetRoute';

import { forgetRoadStudent, prefetchRoadStudent } from '../road/avvioFlow';
import { ROAD_ASSETS } from '../road/markerArt';
import type { RoadStudentItem } from '../types/regloApi';
import { REQUIRED_DRIVING_MINUTES, creditedMinutes, formatDrivingHours, lessonMinutes } from '../utils/mandatoryLessons';

// Sentinella per "Sede dell'autoscuola" nel picker (= nessun default -> sede).
const SEDE_OPTION = '__sede__';


function outcomeFromStatus(status?: string | null): 'checked_in' | 'no_show' | null {
  const s = (status ?? '').toLowerCase();
  if (s === 'checked_in' || s === 'completed') return 'checked_in';
  if (s === 'no_show') return 'no_show';
  return null;
}

const WEEKDAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** «Giovedì 14 novembre» (+ l'anno solo se non è quest'anno). */
const formatExamDay = (iso: string) => {
  const d = new Date(iso);
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
};

/** «oggi», «domani», «tra 4 giorni». */
const examCountdown = (iso: string) => {
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000);
  if (days <= 0) return 'oggi';
  if (days === 1) return 'domani';
  return `tra ${days} giorni`;
};

const formatHm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

type UpcomingExam = {
  kind: 'guida' | 'teoria';
  startsAt: string;
  /** false = esame senza orario (REG-604) o data della sola pratica. */
  timeKnown: boolean;
  place: string | null;
  examiners: string[];
};

/** REG-458 — cambiando percorso lo storico guide è un altro elenco: sfuma una
 *  volta, come contenuto che si sostituisce.
 *
 *  ⚠️ **Una sola dissolvenza sul contenitore, non una per riga.** La versione
 *  con entrata/uscita e cascata per riga è stata bocciata (10/10): righe che
 *  salgono una dopo l'altra mentre il resto scivola di molla fanno ondeggiare
 *  la scheda e sembrare l'app un giocattolo. Qui non si muove niente: cambia
 *  solo l'opacità, una volta, in 180ms. */
const LIST_DISSOLVE = FadeIn.duration(180).reduceMotion(ReduceMotion.Never);

/** I numeri cambiano valore restando dove sono: dissolvenza corta, perché una
 *  cifra grossa che si sostituisce di colpo è lo scatto più visibile. */
const STAT_DISSOLVE = FadeIn.duration(160).reduceMotion(ReduceMotion.Never);

/** Guide mostrate nella scheda per «Prossime guide» e «Storico»: il resto sta
 *  nel foglio «Tutte le guide» (Tiziano 29/10: niente liste infinite). */
const HISTORY_PREVIEW = 5;

/** Ultima riga della card: apre l'elenco intero. */
const SeeAllRow = React.memo(function SeeAllRow({ count, onPress, testID }: { count: number; onPress: () => void; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => [s.seeAll, pressed && { opacity: 0.6 }]}
    >
      <Text style={s.seeAllTx}>Vedi tutte ({count})</Text>
      <Ionicons name="chevron-forward" size={16} color={CLAY.chevron} />
    </Pressable>
  );
});

export const StudentNotesDetailScreen = () => {
  const router = useRouter();
  const segments = useSegments() as string[];
  const { studentId, name } = useLocalSearchParams<{ studentId: string; name: string }>();
  // REG-638: percorsi Road delle guide dello storico (chip «Percorso»).
  const { enabled: roadEnabled } = useRoadEnabled();
  const [roadByLesson, setRoadByLesson] = useState<Map<string, RoadStudentItem>>(new Map());
  // REG-663: la stessa risposta serve alla riga «Road» e al foglio «Road di …»
  // (cache condivisa: al tocco il foglio è già pieno). Riletta a ogni apertura.
  const [roadSummary, setRoadSummary] = useState<{ guides: number; points: number } | null>(null);
  useEffect(() => {
    if (!roadEnabled || !studentId) return;
    let alive = true;
    forgetRoadStudent(String(studentId));
    void prefetchRoadStudent(String(studentId)).then((res) => {
      if (!alive || !res) return;
      setRoadByLesson(new Map(res.items.map((it) => [it.appointmentId, it])));
      setRoadSummary({ guides: res.items.length, points: res.hotspots?.length ?? 0 });
    });
    return () => {
      alive = false;
    };
  }, [roadEnabled, studentId]);
  const { autoscuolaRole } = useSession();
  const [rawAppointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  /**
   * Storico GREZZO, annullate comprese: serve al registro pagamenti (REG-450),
   * dove "Annullate" è un filtro e le penali tardive sono guide da pagare.
   * `appointments` resta la lista senza annullate usata da tutto il resto.
   */
  const [allAppointments, setAllAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  /** Modalità di incasso dell'autoscuola: decide se esiste il "segna pagata". */
  const [paymentSettings, setPaymentSettings] = useState<StudentPaymentsSettings | null>(null);
  /** Guida con il pagellino espanso nello storico (una alla volta). */
  /** Blocco pagellino aggregato: a riposo è una riga sola. */
  const [pagellinoOpen, setPagellinoOpen] = useState(false);
  const [cases, setCases] = useState<AutoscuolaCase[]>([]);
  const [license, setLicense] = useState<{ category: string | null; transmission: string | null } | null>(null);
  // REG-458 — le patenti già conseguite, dalla più recente. Vuoto per chi è al
  // primo percorso, cioè per quasi tutti.
  const [obtained, setObtained] = useState<ObtainedLicense[]>([]);
  // Tutti i percorsi (vuoto se ne ha uno solo) e quale si sta guardando:
  // `null` = non ha scelto, vale il default, cioè il percorso in corso.
  const [licensePaths, setLicensePaths] = useState<LicensePath[]>([]);
  const [pathChoice, setPathChoice] = useState<string | null>(null);
  const [groupEnabled, setGroupEnabled] = useState(false);
  const [groupOptIn, setGroupOptIn] = useState(false);
  const [groupSaving, setGroupSaving] = useState(false);
  // "Pronto per l'esame" — segnale interno, solo per allievi in fase PRATICA.
  const [studentPhase, setStudentPhase] = useState<string | null>(null);
  const [examReady, setExamReady] = useState(false);
  const [examReadySaving, setExamReadySaving] = useState(false);
  // Luogo di default (REG-392)
  const [locations, setLocations] = useState<Array<{ id: string; name: string; isDefault: boolean; isPrecise: boolean; address: string | null }>>([]);
  // REG-705: luoghi dove fa guida (vuoto = tutti) + interruttore dell'autoscuola.
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [availabilityByLocation, setAvailabilityByLocation] = useState(false);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [defaultLocationName, setDefaultLocationName] = useState<string | null>(null);
  const [locSaving, setLocSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  /**
   * Niente toast in un foglio (Tiziano 28/10: compariva in mezzo, sopra il
   * contenuto): il risultato si vede già sulla riga o sull'interruttore, gli
   * errori li dice un avviso nativo.
   */
  const showError = useCallback((text: string) => Alert.alert('Non è andata', text), []);

  const loadData = useCallback(async () => {
    if (!studentId) return;
    try {
      const [appts, allCases, students, settings, locs] = await Promise.all([
        regloApi.getAppointments({ studentId, limit: 500 }),
        regloApi.getCases().catch(() => [] as AutoscuolaCase[]),
        regloApi.getStudents(typeof name === 'string' ? name : undefined).catch(() => []),
        regloApi.getAutoscuolaSettings().catch(() => null),
        regloApi.getLocations().catch(() => []),
      ]);
      const byRecent = [...appts].sort(
        (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
      );
      const filtered = byRecent.filter(
        (a) => (a.status ?? '').trim().toLowerCase() !== 'cancelled',
      );
      setAllAppointments(byRecent);
      setAppointments(filtered);
      setCases(allCases.filter((c) => c.studentId === studentId));
      setGroupEnabled(settings?.groupLessonsEnabled === true);
      setPaymentSettings(
        settings
          ? {
              autoPaymentsEnabled: settings.autoPaymentsEnabled,
              lessonCreditFlowEnabled: settings.lessonCreditFlowEnabled,
              lessonCreditsRequired: settings.lessonCreditsRequired,
            }
          : null,
      );
      setLocations(
        (locs ?? []).map((l) => ({
          id: l.id,
          name: l.name,
          isDefault: Boolean(l.isDefault),
          isPrecise: Boolean(l.isPrecise),
          address: l.address ?? null,
        })),
      );
      setAvailabilityByLocation(settings?.availabilityByLocation === true);
      const me = students.find((stu) => stu.id === studentId);
      if (me) {
        setLicense({ category: me.licenseCategory ?? null, transmission: me.transmission ?? null });
        setObtained(me.obtainedLicenses ?? []);
        setLicensePaths(me.licensePaths ?? []);
        setGroupOptIn(me.groupLessonsOptIn ?? false);
        setStudentPhase(me.studentPhase ?? null);
        setExamReady(me.examReady ?? false);
        setDefaultLocationId(me.defaultLocationId ?? null);
        setDefaultLocationName(me.defaultLocationName ?? null);
        setLocationIds(me.locationIds ?? []);
      }
    } catch {
      showError('Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, [studentId, name, showError]);

  useEffect(() => { loadData(); }, [loadData]);

  // Esito esame (REG-513) dallo storico: stesso menu del foglio esame, stesso
  // effetto lato server. Qui l'istruttore arriva a mente fredda — l'esame di
  // ieri si chiude da dove si guarda l'allievo, non solo dall'agenda.
  const [outcomeSavingId, setOutcomeSavingId] = useState<string | null>(null);

  const recordOutcome = useCallback(
    (appt: AutoscuolaAppointmentWithRelations) => {
      const current = asExamOutcome(appt.examOutcome);
      void impactAsync(ImpactFeedbackStyle.Light);
      askExamOutcome({
        title: name ? String(name) : 'Esito esame',
        current,
        onPick: async (outcome: ExamOutcome | null) => {
          if (outcome === current) return;
          setOutcomeSavingId(appt.id);
          try {
            await regloApi.setExamOutcome(appt.id, outcome);
            // Nessun update ottimistico: si ricarica dal BE, che intanto può
            // aver portato l'allievo a PATENTATO (la fase in testa alla
            // schermata deve muoversi insieme all'esito).
            await loadData();
          } catch (err) {
            showError(err instanceof Error ? err.message : 'Impossibile registrare l\u2019esito.');
          } finally {
            setOutcomeSavingId(null);
          }
        },
      });
    },
    [loadData, name, showError],
  );

  // Apre il foglio "Dettagli guida" (Tipo/Valutazione/Note) per una guida dello
  // storico, seedando lessonDetailsStore (store DEDICATO del foglio: seedare
  // manageLessonStore da qui clobberava lo snapshot della ManageLessonScreen
  // eventualmente montata sotto → crash). Al salvataggio aggiorna via BE (solo i
  // campi cambiati, come il flusso home) e ricarica. Il foglio è registrato in
  // entrambi gli stack (home + notes): navighiamo alla route dello stack corrente.
  const openDetails = useCallback(
    (appt: AutoscuolaAppointmentWithRelations) => {
      const status = (appt.status ?? '').trim().toLowerCase();
      const startMs = new Date(appt.startsAt).getTime();
      const typeLc = (appt.type ?? '').toLowerCase();
      const isGroup = typeLc === 'group_lesson' || !!appt.groupLessonId;
      const isExam = typeLc === 'esame';
      // Esito solo sulle guide individuali (non gruppi né esami): la presenza dei
      // gruppi è di gruppo (non per-partecipante) e gli esami hanno il loro esito.
      const canSetOutcome =
        status !== 'cancelled' &&
        status !== 'proposal' &&
        !isGroup &&
        !isExam &&
        startMs - 10 * 60 * 1000 <= Date.now();
      const currentOutcome = outcomeFromStatus(status);
      lessonDetailsStore.set({
        lesson: appt,
        showEsito: canSetOutcome,
        isDetailsEditable: true,
        onEvaluationAutosaved: () => void loadData(),
        onSaveDetails: async ({ lessonTypes, notes, esito, evaluations }) => {
          try {
            // 1. Esito PRIMA (il BE accetta il rating solo su guide effettuate).
            if (esito !== undefined && esito !== currentOutcome && esito) {
              await regloApi.updateAppointmentStatus(appt.id, { status: esito });
            }
            // 2. Dettagli (solo i campi cambiati).
            const payload: {
              lessonType?: string;
              lessonTypes?: string[];
              notes?: string;
              evaluations?: Array<{
                itemId: string;
                score: number | null;
                notApplicable?: boolean;
              }>;
            } = {};
            const initialTypes = resolveInitialLessonTypes(appt);
            const typesChanged =
              JSON.stringify([...lessonTypes].sort()) !== JSON.stringify([...initialTypes].sort());
            if (lessonTypes.length && typesChanged) {
              payload.lessonTypes = lessonTypes;
              payload.lessonType = lessonTypes[0];
            }
            const trimmed = notes.trim();
            if (trimmed !== (appt.notes ?? '').trim()) payload.notes = trimmed;
            // Array vuoto = pagellino svuotato: va inoltrato, non scartato.
            if (evaluations !== undefined) payload.evaluations = evaluations;
            if (Object.keys(payload).length) {
              await regloApi.updateAppointmentDetails(appt.id, payload);
            }
            await loadData();
            return true;
          } catch (e) {
            showError(e instanceof Error ? e.message : 'Errore nel salvataggio');
            return false;
          }
        },
      });
      const stack = studentSheetStack(segments);
      router.push(studentSheetHref(stack, 'manage-lesson-details') as never);
    },
    [loadData, router, segments, showError],
  );

  // Luogo di default (REG-392): aggiorna solo sulla risposta BE (niente
  // optimistic update, come da convenzione reglo-mobile).
  const applyDefaultLocation = useCallback(
    async (locId: string | null) => {
      if (locSaving) return;
      setLocSaving(true);
      try {
        const res = await regloApi.setStudentDefaultLocation(String(studentId), locId);
        setDefaultLocationId(res.defaultLocation?.id ?? null);
        setDefaultLocationName(res.defaultLocation?.name ?? null);
        if (res.locationIds) setLocationIds(res.locationIds);
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Errore.');
      } finally {
        setLocSaving(false);
      }
    },
    [studentId, locSaving, showError],
  );

  // Apre il form sheet NATIVO riusabile (OptionsPickerSheet) invece di un modal
  // custom: stesso pattern di Durata/Veicolo/Tipo. Applica al tap e si chiude.
  // La route è registrata in entrambi gli stack (home + notes).
  const openLocationPicker = useCallback(() => {
    const custom = locations.filter((l) => !l.isDefault);
    optionsPickerStore.set({
      title: 'Luogo di default',
      multi: false,
      selected: [defaultLocationId ?? SEDE_OPTION],
      options: [
        { value: SEDE_OPTION, label: 'Sede dell’autoscuola' },
        ...custom.map((l) => ({ value: l.id, label: l.name })),
      ],
      onConfirm: (vals) => {
        const v = vals[0];
        applyDefaultLocation(!v || v === SEDE_OPTION ? null : v);
      },
    });
    const stack = studentSheetStack(segments);
    const long = custom.length + 1 > LONG_PICKER_THRESHOLD;
    router.push(studentSheetHref(stack, `select-options${long ? '-long' : ''}`) as never);
  }, [locations, defaultLocationId, applyDefaultLocation, router, segments]);

  // REG-705: con «Disponibilità per luogo» accesa (≥ 2 luoghi) la riga apre il
  // foglio «Luoghi» a scelta multipla. Salva sul backend e aggiorna la scheda
  // con la risposta (niente optimistic update).
  const locationsMode = availabilityByLocation && locations.length >= 2;
  const openLocationsSheet = useCallback(() => {
    studentLocationsStore.set({
      studentName: typeof name === 'string' ? name : null,
      locations: locations.map((l) => ({ id: l.id, name: l.name, address: l.address, isPrecise: l.isPrecise })),
      selectedIds: locationIds,
      primaryId: defaultLocationId,
      onSave: async ({ locationIds: nextIds, primaryId }) => {
        try {
          const res = await regloApi.setStudentLocations(String(studentId), nextIds);
          let ids = res.locationIds;
          let primaryNow = res.defaultLocationId;
          if (primaryId && primaryId !== primaryNow && ids.includes(primaryId)) {
            const r2 = await regloApi.setStudentDefaultLocation(String(studentId), primaryId);
            primaryNow = r2.defaultLocation?.id ?? null;
            if (r2.locationIds) ids = r2.locationIds;
          }
          setLocationIds(ids);
          setDefaultLocationId(primaryNow);
          setDefaultLocationName(locations.find((l) => l.id === primaryNow)?.name ?? null);
        } catch (e) {
          showError(e instanceof Error ? e.message : 'Errore.');
          throw e;
        }
      },
    });
    const stack = studentSheetStack(segments);
    router.push(studentSheetHref(stack, 'student-locations') as never);
  }, [name, locations, locationIds, defaultLocationId, studentId, router, segments, showError]);

  const locationsLabel = useMemo(() => {
    if (!locationIds.length) return 'Tutti i luoghi';
    return locations.filter((l) => locationIds.includes(l.id)).map((l) => l.name).join(', ');
  }, [locations, locationIds]);

  /** Semina e apre il foglio "Impostazioni allievo". Gli handler restano qui:
   *  il foglio disegna, la scheda conserva stato e chiamate. */
  const openStudentSettings = useCallback(() => {
    studentSettingsStore.set({
      // `name` arriva dai params: `fullName` è calcolato più in basso.
      studentName: typeof name === 'string' ? name : null,
      group: groupEnabled
        ? {
            value: groupOptIn,
            saving: groupSaving,
            onChange: async (next: boolean) => {
              setGroupOptIn(next);
              setGroupSaving(true);
              try {
                await regloApi.updateStudentGroupLessonOptIn(String(studentId), next);
              } catch (e) {
                setGroupOptIn(!next);
                showError(e instanceof Error ? e.message : 'Errore.');
              } finally {
                setGroupSaving(false);
              }
            },
          }
        : null,
      examReady: studentPhase === 'PRATICA'
        ? {
            value: examReady,
            saving: examReadySaving,
            onChange: async (next: boolean) => {
              setExamReady(next);
              setExamReadySaving(true);
              try {
                await regloApi.setStudentExamReady(String(studentId), next);
              } catch (e) {
                setExamReady(!next);
                showError(e instanceof Error ? e.message : 'Errore.');
              } finally {
                setExamReadySaving(false);
              }
            },
          }
        : null,
      location: locationsMode
        ? { title: 'Luoghi', label: locationsLabel, onPress: openLocationsSheet }
        : locations.length
          ? { label: defaultLocationName ?? 'Sede dell\u2019autoscuola', onPress: openLocationPicker }
          : null,
    });
    const stack = studentSheetStack(segments);
    router.push(studentSheetHref(stack, 'student-settings') as never);
  }, [
    name, groupEnabled, groupOptIn, groupSaving, studentPhase, examReady, examReadySaving,
    locations.length, defaultLocationName, openLocationPicker, studentId, router, segments, showError,
    locationsMode, locationsLabel, openLocationsSheet,
  ]);

  // ── Pagamenti guide (REG-450) ───────────────────────────────────────────
  // Il conteggio usa lo stesso predicato del backend (src/utils/lessonPayments),
  // così il numero qui e quello del dettaglio allievo web non divergono mai.
  const paymentsManualMode = useMemo(
    () => isCompanyManualMode(paymentSettings),
    [paymentSettings],
  );
  const unpaidCount = useMemo(
    () => allAppointments.filter((a) => isLessonUnpaid(a, paymentsManualMode)).length,
    [allAppointments, paymentsManualMode],
  );

  const openPayments = useCallback(() => {
    studentPaymentsStore.set({
      studentName: typeof name === 'string' ? name : null,
      lessons: allAppointments,
      settings: paymentSettings,
      canManagePayments: canManageLessonPayments(autoscuolaRole),
      onChanged: loadData,
    });
    const stack = studentSheetStack(segments);
    router.push(studentSheetHref(stack, 'student-payments') as never);
  }, [
    name, allAppointments, paymentSettings, autoscuolaRole,
    loadData, router, segments,
  ]);

  const phone = useMemo(() => {
    // Grezzo di proposito: il numero e' dell'allievo, non del percorso.
    for (const appt of rawAppointments) if (appt.student?.phone) return appt.student.phone;
    return null;
  }, [rawAppointments]);

  // ── REG-458: tutto quello che segue e' del PERCORSO, non dell'allievo ──
  //
  // Le guide non hanno una colonna che dica a quale percorso appartengono: si
  // ricava dalla data. Filtrando qui, **alla fonte**, diventano coerenti in un
  // colpo solo lo storico guide, il contatore dell'obbligo (che per decisione
  // di prodotto e' per percorso), il voto medio e le ore guidate: prima un
  // allievo che ripartiva si portava dietro le guide della patente precedente
  // dentro quella nuova.
  //
  // `allAppointments` resta **non filtrato** di proposito: alimenta i pagamenti,
  // e i crediti sono dell'allievo, non del percorso (portafoglio unico).
  const shownPathId = lessonsPathFilterId(licensePaths, pathChoice);
  const shownPath = useMemo(
    () => licensePaths.find((p) => p.id === shownPathId) ?? null,
    [licensePaths, shownPathId],
  );
  const thisPath = useMemo(() => currentPath(licensePaths), [licensePaths]);
  const appointments = useMemo(
    () =>
      shownPathId
        ? rawAppointments.filter(
            (a) => pathForDate(licensePaths, a.startsAt)?.id === shownPathId,
          )
        : rawAppointments,
    [rawAppointments, licensePaths, shownPathId],
  );
  const hiddenByPath = rawAppointments.length - appointments.length;

  // Obbligo: le ORE guidate del percorso (ogni guida completata, qualunque
  // durata), a mezz'ore con la tolleranza Road — stessa regola del web.
  const mandatoryMinutes = useMemo(
    () => creditedMinutes(
      appointments.reduce((sum, a) => {
        const s = (a.status ?? '').trim().toLowerCase();
        return s === 'completed' || s === 'checked_in' ? sum + lessonMinutes(a) : sum;
      }, 0),
    ),
    [appointments],
  );

  /** Media per voce su tutto lo storico: alimenta sia il blocco "Pagellino"
   *  sia la statistica "voto medio" della card profilo. */
  // R2 (Road novembre): il pagellino è il LIVELLO del ragazzo, l'ultimo voto
  // di ogni voce; sostituisce la media su tutte le guide.
  const pagellino = useMemo(() => studentEvaluationLevels(appointments), [appointments]);

  const avgRating = useMemo(() => {
    // Il numero «pagellino» è il livello medio (R2: media degli ultimi voti per
    // voce): la stellina singola non si compila più.
    // Le vecchie stelline restano come ripiego per gli allievi storici.
    if (pagellino?.average != null) return pagellino.average.toFixed(1).replace('.', ',');
    const rated = appointments.filter((a) => a.rating != null);
    if (!rated.length) return null;
    const avg = rated.reduce((s, a) => s + (a.rating as number), 0) / rated.length;
    return avg.toFixed(1).replace('.', ',');
  }, [appointments, pagellino]);

  const totalHours = useMemo(() => {
    const mins = appointments
      .filter((a) => { const st = (a.status ?? '').trim().toLowerCase(); return st === 'completed' || st === 'checked_in'; })
      .reduce((s, a) => {
        const start = new Date(a.startsAt).getTime();
        const end = a.endsAt ? new Date(a.endsAt).getTime() : start + 60 * 60 * 1000;
        return s + Math.max(0, Math.round((end - start) / 60000));
      }, 0);
    return Math.round(mins / 60);
  }, [appointments]);

  // R6 (Road novembre): l'esame più vicino, in cima alla scheda. Prima
  // vinceva sempre la data della pratica anche con un esame prenotato prima;
  // ora si prende il più vicino e, a parità di giorno, l'appuntamento
  // d'esame (ha ora, luogo ed esaminatori).
  const upcomingExam = useMemo<UpcomingExam | null>(() => {
    const today = startOfDay(new Date());
    const list: UpcomingExam[] = [];
    for (const appt of appointments) {
      if ((appt.type ?? '').toLowerCase() !== 'esame') continue;
      // L'esame senza orario ha startsAt a mezzanotte: conta il giorno.
      if (startOfDay(new Date(appt.startsAt)) < today) continue;
      if (appt.endsAt && new Date(appt.endsAt).getTime() < Date.now()) continue;
      list.push({
        kind: 'guida',
        startsAt: appt.startsAt,
        timeKnown: examTimeKnown(appt),
        place: appt.location?.name ?? null,
        examiners: appt.examiners ?? [],
      });
    }
    const bookedDays = new Set(list.map((e) => startOfDay(new Date(e.startsAt))));
    for (const c of cases) {
      for (const [kind, date] of [['guida', c.drivingExamAt], ['teoria', c.theoryExamAt]] as const) {
        if (!date) continue;
        const day = startOfDay(new Date(date));
        if (day < today || (kind === 'guida' && bookedDays.has(day))) continue;
        list.push({ kind, startsAt: date, timeKnown: false, place: null, examiners: [] });
      }
    }
    list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return list[0] ?? null;
  }, [cases, appointments]);

  const student = useMemo(() => appointments.find((a) => a.student)?.student ?? null, [appointments]);
  const displayName = (name ?? 'Allievo').toString();
  const fullName = student ? `${student.firstName} ${student.lastName}`.trim() : displayName;
  const firstName = student?.firstName ?? displayName.split(' ')[0];
  const email = student?.email ?? null;
  const initials = (firstName[0] ?? displayName[0] ?? '?').toUpperCase();
  const cleanPhone = phone?.replace(/\s+/g, '').replace(/^\+/, '');
  // Su una qualificazione (CQC, ADR) il cambio non vuol dire niente:
  // «CQC · Manuale» e' una riga che non significa nulla.
  const licenseLabel = license?.category
    ? isQualification(license.category)
      ? license.category
      : `${license.category} · ${transmissionLabel(license.transmission)}`
    : null;
  // REG-458 — «B · ott 2026». Senza data (succede: in produzione 67 patentati su
  // 72 non hanno mai avuto né numero né data) resta la sola categoria.
  const obtainedLabel = (o: ObtainedLicense) => {
    const cat = o.licenseCategory;
    if (!cat) return null;
    const when = o.obtainedAt ? new Date(o.obtainedAt) : null;
    if (!when || Number.isNaN(when.getTime())) return cat;
    return `${cat} · ${when.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}`;
  };
  /** «ha già A2», «ha già A2 e B», «ha già A2, B +2». */
  const giaConseguite = (() => {
    const cats = obtained.map((o) => o.licenseCategory).filter(Boolean) as string[];
    if (cats.length === 0) return null;
    if (cats.length <= 2) return `ha già ${cats.join(' e ')}`;
    return `ha già ${cats.slice(0, 2).join(', ')} +${cats.length - 2}`;
  })();

  const subtitleLine = [licenseLabel, giaConseguite].filter(Boolean).join(' · ');
  /** Prossime guide (dalla più vicina) e storico già svolto (dalla più
   *  recente), dallo stesso elenco del percorso mostrato. Calcolati una volta
   *  per caricamento: il tocco non ricalcola niente. */
  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: AutoscuolaAppointmentWithRelations[] = [];
    const done: AutoscuolaAppointmentWithRelations[] = [];
    for (const a of appointments) (new Date(a.startsAt).getTime() > now ? up : done).push(a);
    up.reverse();
    return { upcoming: up, past: done };
  }, [appointments]);

  // R5: aperta da Road i fogli restano nello stack `/road`.
  const stackName = studentSheetStack(segments);
  const openRoad = useCallback(
    (appointmentId: string) => openRoadPercorso(router, stackName, appointmentId),
    [router, stackName],
  );

  // Seed del foglio «Tutte le guide»: ripubblicato a ogni ricarica, così il
  // foglio aperto si aggiorna dopo un salvataggio (dati già pronti, §15).
  useEffect(() => {
    lessonHistoryStore.set({
      studentName: fullName,
      upcoming,
      past,
      roadByLesson,
      savingId: outcomeSavingId,
      onDetails: openDetails,
      onOutcome: recordOutcome,
      onRoad: openRoad,
    });
  }, [fullName, upcoming, past, roadByLesson, outcomeSavingId, openDetails, recordOutcome, openRoad]);

  const openHistory = useCallback(
    (kind: 'upcoming' | 'past') => router.push(`${studentSheetHref(stackName, 'lesson-history')}?kind=${kind}` as never),
    [router, stackName],
  );
  const showSettings = groupEnabled || studentPhase === 'PRATICA' || locations.length > 0;

  // REG-639 «vita ovunque» (Tiziano 28/10): il dettaglio allievo è un FORM SHEET
  // nativo alto quanto il contenuto (FORM_SHEET + FormSheet); scorre da sé solo
  // se supera lo schermo. In testa il volto grande, poi i numeri che contano.
  return (
    <FormSheet
      testID="student-detail-sheet"
      headerStyle={s.sheetHead}
      cta={
        phone && !loading ? (
          <View style={s.ctaRow}>
            <ClayPressable
              onPress={() => Linking.openURL(`tel:${phone}`)}
              accessibilityRole="button"
              accessibilityLabel={`Chiama ${firstName}`}
              style={s.callBtn}
            >
              <Ionicons name="call" size={20} color={CLAY.ink} />
            </ClayPressable>
            <ClayButton
              title="Scrivi su WhatsApp"
              onPress={() => Linking.openURL(`https://wa.me/${cleanPhone}`)}
              leading={<Ionicons name="logo-whatsapp" size={19} color="#FFFFFF" />}
              style={s.waBtn}
            />
          </View>
        ) : undefined
      }
    >

      {/* Volto, nome, patente */}
      <View style={s.hero}>
        <Avatar userId={studentId ?? null} name={fullName} size={88} />
        <Text style={s.heroName} numberOfLines={1}>{fullName}</Text>
        {subtitleLine ? <Text style={s.heroSub} numberOfLines={2}>{subtitleLine}</Text> : null}
      </View>

      {/* R6: esame prenotato in cima, nel viola dell'esame (Tiziano 10/11). */}
      {!loading && upcomingExam ? (
        <Animated.View entering={LIST_DISSOLVE} style={[s.exam, CLAY_EXAM.surface]} testID="student-exam-card">
          <View style={s.examTop}>
            <Image source={VITA_ART.esame} style={s.examArt} />
            <View style={{ flex: 1 }}>
              <Text style={s.examKicker} numberOfLines={1}>
                Esame {upcomingExam.kind === 'teoria' ? 'di teoria' : 'di guida'} · {examCountdown(upcomingExam.startsAt)}
              </Text>
              <Text style={s.examDay} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                {formatExamDay(upcomingExam.startsAt)}
              </Text>
              <Text style={s.examTime}>
                {upcomingExam.timeKnown ? `ore ${formatHm(upcomingExam.startsAt)}` : EXAM_TIME_TBD}
              </Text>
            </View>
          </View>
          {upcomingExam.place || upcomingExam.examiners.length > 0 ? (
            <View style={s.examRows}>
              {upcomingExam.place ? (
                <View style={s.examRow}>
                  <Text style={s.examLabel}>Luogo</Text>
                  <Text style={s.examValue} numberOfLines={1}>{upcomingExam.place}</Text>
                </View>
              ) : null}
              {upcomingExam.examiners.length > 0 ? (
                <View style={s.examRow}>
                  <Text style={s.examLabel}>{upcomingExam.examiners.length === 1 ? 'Esaminatore' : 'Esaminatori'}</Text>
                  <Text style={s.examValue} numberOfLines={2}>{upcomingExam.examiners.join(', ')}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      {/* Allievo: contatti e patenti, subito sotto il nome (Tiziano 29/10:
          in fondo, sotto tutto lo storico, non li trovava nessuno). */}
      {loading ? (
        <ClaySurface padded={false} style={s.firstBlock}>
          {[0, 1].map((i) => (
            <View key={i} style={[s.skelRow, i > 0 && s.hDivider]}>
              <SkeletonBlock width="30%" height={15} radius={6} />
              <SkeletonBlock width="55%" height={12} radius={6} style={{ marginTop: 8 }} />
            </View>
          ))}
        </ClaySurface>
      ) : email || phone || obtained.length > 0 || defaultLocationName ? (
        <Animated.View entering={LIST_DISSOLVE} style={upcomingExam ? s.listGap : s.firstBlock}>
          <ClayList>
            {phone ? <ClayListRow title="Telefono" subtitle={phone} onPress={() => Linking.openURL(`tel:${phone}`)} /> : null}
            {email ? <ClayListRow title="Email" subtitle={email} onPress={() => Linking.openURL(`mailto:${email}`)} /> : null}
            {obtained.length > 0 ? (
              <ClayListRow
                title={obtained.length === 1 ? 'Patente già conseguita' : 'Patenti già conseguite'}
                subtitle={obtained.map(obtainedLabel).filter(Boolean).join(' · ')}
              />
            ) : null}
            {defaultLocationName ? <ClayListRow title="Luogo abituale" subtitle={defaultLocationName} /> : null}
          </ClayList>
        </Animated.View>
      ) : null}

      {/* Pagamenti e impostazioni: una lista sola */}
      {!loading && (paymentsManualMode || showSettings || roadEnabled) ? (
        <ClayList style={s.listGap}>
          {roadEnabled ? (
            <ClayListRow
              title="Road"
              subtitle={
                !roadSummary
                  ? ' '
                  : roadSummary.guides === 0
                    ? 'Ancora nessuna guida in Road'
                    : [
                        roadSummary.guides === 1 ? '1 guida' : `${roadSummary.guides} guide`,
                        roadSummary.points ? `${roadSummary.points} ${roadSummary.points === 1 ? 'punto' : 'punti'} da migliorare` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
              }
              trailing={<Icon3D source={ROAD_ASSETS.road} size={46} />}
              onPress={() =>
                router.push({ pathname: studentSheetHref(stackName, 'road-allievo') as never, params: { studentId: String(studentId), name: fullName } })
              }
              testID="student-road-row"
            />
          ) : null}
          {paymentsManualMode ? (
            <ClayListRow
              title="Pagamenti"
              subtitle={
                // REG-639 «memorabile»: il da riscuotere è il prossimo passo, in
                // nero; in pari resta grigio. Il salvadanaio lo dice a colpo d'occhio.
                unpaidCount === 0 ? (
                  'In pari, niente da riscuotere'
                ) : (
                  <Text style={s.dueTx} numberOfLines={1}>
                    {unpaidCount === 1 ? '1 guida da pagare' : `${unpaidCount} guide da pagare`}
                  </Text>
                )
              }
              trailing={
                <Icon3D source={unpaidCount === 0 ? VITA_ART.salvadanaioPieno : VITA_ART.salvadanaio} size={46} />
              }
              onPress={openPayments}
              testID="student-payments-row"
            />
          ) : null}
          {showSettings ? (
            <ClayListRow
              title="Impostazioni"
              subtitle={[
                groupEnabled ? (groupOptIn ? 'Guide di gruppo sì' : 'Guide di gruppo no') : null,
                studentPhase === 'PRATICA' ? (examReady ? 'pronto per l’esame' : null) : null,
              ].filter(Boolean).join(' · ') || 'Gruppo, esame e luogo'}
              onPress={openStudentSettings}
              testID="student-settings-row"
            />
          ) : null}
        </ClayList>
      ) : null}

      {/* Prossime guide: le cose da fare, prima dello storico */}
      {!loading && upcoming.length > 0 ? (
        <ClaySection title="Prossime guide">
          <Animated.View entering={LIST_DISSOLVE}>
            <ClaySurface padded={false}>
              {upcoming.slice(0, HISTORY_PREVIEW).map((appt, idx) => (
                <LessonHistoryRow
                  key={appt.id}
                  appt={appt}
                  divider={idx > 0}
                  roadItem={roadByLesson.get(appt.id)}
                  saving={outcomeSavingId === appt.id}
                  onDetails={openDetails}
                  onOutcome={recordOutcome}
                  onRoad={openRoad}
                />
              ))}
              {upcoming.length > HISTORY_PREVIEW ? (
                <SeeAllRow count={upcoming.length} onPress={() => openHistory('upcoming')} testID="upcoming-see-all" />
              ) : null}
            </ClaySurface>
          </Animated.View>
        </ClaySection>
      ) : null}
      {/* REG-458 — percorso mostrato: esiste solo con più di un percorso. */}
      {licensePaths.length > 1 ? (
        <ClaySurface
          radius={22}
          onPress={() => setPathChoice(shownPath ? ALL_LESSON_PATHS : (thisPath?.id ?? ALL_LESSON_PATHS))}
          style={s.pathCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>
              {shownPath ? `Percorso ${shownPath.licenseCategory ?? ''}`.trim() : 'Tutti i percorsi'}
            </Text>
            <Text style={s.cardSub}>
              {shownPath ? 'Numeri e storico di questo percorso' : 'Numeri e storico di tutti i percorsi'}
            </Text>
          </View>
          <Text style={s.link}>
            {shownPath
              ? hiddenByPath > 0 ? `Vedi tutto (${hiddenByPath})` : 'Vedi tutto'
              : `Solo la ${thisPath?.licenseCategory ?? 'attuale'}`}
          </Text>
        </ClaySurface>
      ) : null}

      {/* Tre numeri, ognuno col suo oggetto 3D */}
      <View style={s.stats}>
        {[
          {
            art: VITA_ART.volante,
            value: formatDrivingHours(mandatoryMinutes),
            unit: `/${formatDrivingHours(REQUIRED_DRIVING_MINUTES)} h`,
            label: mandatoryMinutes >= REQUIRED_DRIVING_MINUTES ? 'obbligo fatto' : 'obbligo guide',
          },
          { art: VITA_ART.stella, value: avgRating ?? '—', unit: avgRating ? '/5' : '', label: 'pagellino' },
          { art: VITA_ART.orologio, value: String(totalHours), unit: 'h', label: 'al volante' },
        ].map((st) => (
          <ClaySurface key={st.label} radius={22} padded={false} style={s.stat}>
            <Image source={st.art} style={s.statArt} />
            {loading ? (
              <SkeletonBlock width={40} height={22} radius={6} style={{ marginTop: 8 }} />
            ) : (
              <Animated.Text key={`${st.label}-${st.value}`} entering={STAT_DISSOLVE} style={s.statNum}>
                {st.value}
                {st.unit ? <Text style={s.statUnit}> {st.unit}</Text> : null}
              </Animated.Text>
            )}
            <Text style={s.statLbl} numberOfLines={1}>{st.label}</Text>
          </ClaySurface>
        ))}
      </View>

      {/* Pagellino: una riga, il dettaglio si apre al tocco */}
      {!loading && pagellino ? (
        <View style={s.listGap}>
          <ClaySurface radius={22} padded={false}>
            <Pressable
              onPress={() => setPagellinoOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: pagellinoOpen }}
              style={({ pressed }) => [s.pagHead, pressed && { opacity: 0.6 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Livello attuale</Text>
                <Text style={s.cardSub}>l'ultimo voto di ogni voce</Text>
              </View>
              <View style={s.sparkRow}>
                {pagellino.items.slice(0, 6).map((item) => (
                  <View key={item.itemId} style={s.sparkTrack}>
                    <View style={[s.sparkFill, { height: `${Math.max(12, (item.score / item.scaleMax) * 100)}%` }]} />
                  </View>
                ))}
              </View>
              {pagellino.average != null ? (
                <Text style={s.pagBig}>
                  {pagellino.average.toFixed(1).replace('.', ',')}
                  <Text style={s.statUnit}>/{pagellino.scaleMax}</Text>
                </Text>
              ) : null}
              <Ionicons name={pagellinoOpen ? 'chevron-up' : 'chevron-down'} size={16} color={CLAY.chevron} />
            </Pressable>
            {pagellinoOpen ? (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={s.pagBody}>
                {pagellino.items.map((item) => (
                  <View key={item.itemId} style={[s.pagRow, s.levelRow]}>
                    <Text style={s.pagName} numberOfLines={2}>{item.label}</Text>
                    <View style={s.levelRight}>
                      <StarRating value={item.score} total={item.scaleMax} tone="gold" size={13} readOnly />
                      <Text style={s.pagVal}>
                        <Text style={s.pagValNum}>{item.score}</Text>/{item.scaleMax} · {evaluationLevelDate(item.lastAt)}
                      </Text>
                    </View>
                  </View>
                ))}
                {pagellino.weakest ? (
                  <Text style={s.pagFoot}>
                    Da allenare: <Text style={s.pagFootStrong}>{pagellino.weakest.label}</Text>
                    {` (${pagellino.weakest.score}/${pagellino.weakest.scaleMax})`}
                  </Text>
                ) : null}
              </Animated.View>
            ) : null}
          </ClaySurface>
        </View>
      ) : null}
      {/* Storico: solo le ultime 5 già svolte, il resto in «Vedi tutte» */}
      <ClaySection title="Storico guide">
        {loading ? (
          <ClaySurface padded={false}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[s.skelRow, i > 0 && s.hDivider]}>
                <SkeletonBlock width="52%" height={15} radius={6} />
                <SkeletonBlock width="38%" height={12} radius={6} style={{ marginTop: 8 }} />
              </View>
            ))}
          </ClaySurface>
        ) : past.length === 0 ? (
          <Animated.Text entering={LIST_DISSOLVE} style={s.emptyText}>
            {hiddenByPath === 1
              ? "Nessuna guida in questo percorso. L'altra è sotto «Vedi tutto»."
              : hiddenByPath > 1
                ? `Nessuna guida in questo percorso. Le altre ${hiddenByPath} sono sotto «Vedi tutto».`
                : upcoming.length > 0
                  ? `Ancora nessuna guida svolta con ${firstName}.`
                  : `Ancora nessuna guida con ${firstName}.`}
          </Animated.Text>
        ) : (
          <Animated.View entering={LIST_DISSOLVE}>
            <ClaySurface padded={false}>
              {past.slice(0, HISTORY_PREVIEW).map((appt, idx) => (
                <LessonHistoryRow
                  key={appt.id}
                  appt={appt}
                  divider={idx > 0}
                  roadItem={roadByLesson.get(appt.id)}
                  saving={outcomeSavingId === appt.id}
                  onDetails={openDetails}
                  onOutcome={recordOutcome}
                  onRoad={openRoad}
                />
              ))}
              {past.length > HISTORY_PREVIEW ? (
                <SeeAllRow count={past.length} onPress={() => openHistory('past')} testID="history-see-all" />
              ) : null}
            </ClaySurface>
          </Animated.View>
        )}
      </ClaySection>
    </FormSheet>
  );
};

const s = StyleSheet.create({
  // Niente margine negativo: lo scroll del foglio ritaglia al bordo alto e il
  // volto usciva tagliato piatto. Lo stesso posto lo dà la testata più bassa.
  hero: { alignItems: 'center' },
  sheetHead: { paddingBottom: 6 },
  heroName: { fontSize: 26, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.6, marginTop: 12 },
  heroSub: { fontSize: 15, color: CLAY.ink3, marginTop: 3, textAlign: 'center' },
  pathCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, paddingVertical: 14, paddingHorizontal: 18 },
  link: { fontSize: 14.5, fontWeight: '600', color: CLAY.ink, textDecorationLine: 'underline' },
  stats: { flexDirection: 'row', gap: 10, marginTop: 20 },
  stat: { flex: 1, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12 },
  statArt: { width: 34, height: 34 },
  statNum: { fontSize: 24, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.6, marginTop: 6, fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 14, fontWeight: '500', color: CLAY.ink3 },
  statLbl: { fontSize: 12.5, color: CLAY.ink3, marginTop: 1 },
  card: { marginTop: 12, paddingVertical: 16, paddingHorizontal: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  cardSub: { fontSize: 14.5, color: CLAY.ink3, marginTop: 2 },
  exam: { marginTop: 20, borderRadius: 22, paddingTop: 16, paddingBottom: 16, paddingHorizontal: 18 },
  examTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  examArt: { width: 52, height: 52 },
  examKicker: { fontSize: 13.5, fontWeight: '500', color: CLAY_EXAM.kicker },
  examDay: { fontSize: 21, fontWeight: '600', letterSpacing: -0.5, color: CLAY_EXAM.ink, marginTop: 1 },
  examTime: { fontSize: 15, fontWeight: '500', color: CLAY_EXAM.ink2, marginTop: 2 },
  examRows: { marginTop: 14, paddingTop: 12, gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CLAY_EXAM.hairline },
  examRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  examLabel: { fontSize: 15, color: CLAY_EXAM.label },
  examValue: { flexShrink: 1, fontSize: 15, fontWeight: '500', color: CLAY_EXAM.ink, textAlign: 'right' },
  listGap: { marginTop: 12 },
  pagHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 18 },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 26 },
  sparkTrack: { width: 5, height: '100%', borderRadius: 3, backgroundColor: 'rgba(17,17,17,0.07)', justifyContent: 'flex-end', overflow: 'hidden' },
  sparkFill: { width: '100%', borderRadius: 3, backgroundColor: CLAY.ink },
  pagBig: { fontSize: 22, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  pagBody: { paddingHorizontal: 18, paddingBottom: 16 },
  pagRow: { marginTop: 12 },
  levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  levelRight: { alignItems: 'flex-end' },
  pagName: { flex: 1, fontSize: 15, color: CLAY.ink },
  pagVal: { fontSize: 13, color: CLAY.ink3 },
  pagValNum: { fontWeight: '600', color: CLAY.ink },
  pagFoot: { fontSize: 13.5, color: CLAY.ink3, marginTop: 14 },
  pagFootStrong: { fontWeight: '600', color: CLAY.ink },
  hDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(17,17,17,0.12)' },
  dueTx: { fontSize: 14, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.1 },
  firstBlock: { marginTop: 20 },
  skelRow: { paddingVertical: 14, paddingHorizontal: 18 },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(17,17,17,0.12)',
  },
  seeAllTx: { fontSize: 15.5, fontWeight: '500', color: CLAY.ink },
  emptyText: { fontSize: 15, color: CLAY.ink3, paddingHorizontal: 4 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  callBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: CLAY.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...CLAY_SHADOW.raise,
  },
  waBtn: { flex: 1, alignSelf: 'auto' },
});
