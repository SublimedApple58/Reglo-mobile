import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { lessonDetailsStore } from '../stores/lessonDetailsStore';
import { optionsPickerStore, LONG_PICKER_THRESHOLD } from '../stores/optionsPickerStore';
import { studentSettingsStore } from '../stores/studentSettingsStore';
import { studentPaymentsStore, StudentPaymentsSettings } from '../stores/studentPaymentsStore';
import { isCompanyManualMode, isLessonUnpaid, canManageLessonPayments } from '../utils/lessonPayments';
import { EXAM_TIME_TBD, examTimeIsTbd } from '../utils/examTime';
import { useSession } from '../context/SessionContext';
import { resolveInitialLessonTypes } from '../utils/lessonTypes';
import { StarRating } from '../components/StarRating';
import {
  aggregateStudentEvaluations,
  evaluationSummary,
  evaluationSummaryLabel,
} from '../utils/evaluationSheet';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock } from '../components/Skeleton';
import { regloApi } from '../services/regloApi';
import { FormSheet } from '../components/SheetScaffold';
import { Avatar, ClayButton, ClayList, ClayListRow, ClayPressable, ClaySection, ClaySurface, Icon3D } from '../components/clay';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
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
import { formatDay, formatTime } from '../utils/date';
import { transmissionLabel } from '../utils/license';
import { asMotoLessonType, MOTO_LESSON_TYPE_LABELS } from '../utils/motoLessonType';
import {
  asExamOutcome,
  askExamOutcome,
  canRecordExamOutcome,
  EXAM_OUTCOME_LABELS,
  EXAM_OUTCOME_TONE,
  type ExamOutcome,
} from '../utils/examOutcome';
import { impactAsync, ImpactFeedbackStyle } from '../utils/haptics';
import { RoadHistoryChip } from '../components/road/RoadLessonCard';
import { useRoadEnabled } from '../hooks/useRoadEnabled';
import { openRoadPercorso } from '../road/openRoadPercorso';
import type { RoadStudentItem } from '../types/regloApi';
import { isMandatoryLessonDuration } from '../utils/mandatoryLessons';

// Sentinella per "Sede dell'autoscuola" nel picker (= nessun default -> sede).
const SEDE_OPTION = '__sede__';


function outcomeFromStatus(status?: string | null): 'checked_in' | 'no_show' | null {
  const s = (status ?? '').toLowerCase();
  if (s === 'checked_in' || s === 'completed') return 'checked_in';
  if (s === 'no_show') return 'no_show';
  return null;
}

const monthsShort = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const formatExamDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${monthsShort[d.getMonth()]} ${d.getFullYear()}`;
};

/** Le righe si riassestano quando un pagellino si apre o si chiude. Preesiste
 *  al filtro per percorso, che invece NON usa transizioni di layout: una
 *  lista che scivola di molla a ogni cambio di filtro ondeggia. */
const EVAL_LAYOUT = LinearTransition.springify().damping(22).stiffness(240).mass(0.6);

/** REG-458 — cambiando percorso lo storico guide è un altro elenco: sfuma una
 *  volta, come contenuto che si sostituisce.
 *
 *  ⚠️ **Una sola dissolvenza sul contenitore, non una per riga.** La versione
 *  con entrata/uscita e cascata per riga è stata bocciata (10/10): righe che
 *  salgono una dopo l'altra mentre il resto scivola di molla fanno ondeggiare
 *  la scheda e sembrare l'app un giocattolo. Qui non si muove niente: cambia
 *  solo l'opacità, una volta, in 180ms. */
const LIST_DISSOLVE = FadeIn.duration(180).reduceMotion(ReduceMotion.Never);

/** L'unico movimento del filtro: toccando «Vedi tutto» lo storico si apre o si
 *  chiude e **l'altezza scorre**, invece di saltare, così quello che sta sotto
 *  scivola al suo posto.
 *
 *  ⚠️ `duration` + `easing` e **niente `springify()`**: una molla qui fa
 *  ondeggiare la scheda, ed è esattamente quello che è stato bocciato. 240ms
 *  con decelerazione semplice: si vede che si apre, non si vede l'animazione.
 *  Con «Riduci movimento» si disattiva da sé (`ReduceMotion.System` è il
 *  default delle transizioni di layout). */
const HEIGHT_GLIDE = LinearTransition.duration(240).easing(Easing.out(Easing.cubic));

/** I numeri cambiano valore restando dove sono: dissolvenza corta, perché una
 *  cifra grossa che si sostituisce di colpo è lo scatto più visibile. */
const STAT_DISSOLVE = FadeIn.duration(160).reduceMotion(ReduceMotion.Never);

export const StudentNotesDetailScreen = () => {
  const router = useRouter();
  const segments = useSegments() as string[];
  const { studentId, name } = useLocalSearchParams<{ studentId: string; name: string }>();
  // REG-638: percorsi Road delle guide dello storico (chip «Percorso»).
  const { enabled: roadEnabled } = useRoadEnabled();
  const [roadByLesson, setRoadByLesson] = useState<Map<string, RoadStudentItem>>(new Map());
  useEffect(() => {
    if (!roadEnabled || !studentId) return;
    let alive = true;
    regloApi
      .getRoadForStudent(String(studentId))
      .then((res) => {
        if (alive) setRoadByLesson(new Map(res.items.map((it) => [it.appointmentId, it])));
      })
      .catch(() => undefined);
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
  const [openEvalId, setOpenEvalId] = useState<string | null>(null);
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
  const [locations, setLocations] = useState<Array<{ id: string; name: string; isDefault: boolean; isPrecise: boolean }>>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [defaultLocationName, setDefaultLocationName] = useState<string | null>(null);
  const [locSaving, setLocSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

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
        })),
      );
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
      }
    } catch {
      setToast({ text: 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [studentId, name]);

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
            const res = await regloApi.setExamOutcome(appt.id, outcome);
            // Nessun update ottimistico: si ricarica dal BE, che intanto può
            // aver portato l'allievo a PATENTATO (la fase in testa alla
            // schermata deve muoversi insieme all'esito).
            await loadData();
            setToast({
              text:
                outcome === null
                  ? 'Esito rimosso.'
                  : res?.data?.promoted
                    ? `${EXAM_OUTCOME_LABELS[outcome]} · allievo ora patentato.`
                    : `Esito registrato: ${EXAM_OUTCOME_LABELS[outcome]}.`,
              tone: 'success',
            });
          } catch (err) {
            setToast({
              text: err instanceof Error ? err.message : 'Impossibile registrare l\u2019esito.',
              tone: 'danger',
            });
          } finally {
            setOutcomeSavingId(null);
          }
        },
      });
    },
    [loadData, name],
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
            setToast({ text: e instanceof Error ? e.message : 'Errore nel salvataggio', tone: 'danger' });
            return false;
          }
        },
      });
      const stack = segments[1] === 'notes' ? 'notes' : 'home';
      router.push(`/(tabs)/${stack}/manage-lesson-details`);
    },
    [loadData, router, segments],
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
        setToast({ text: 'Luogo di default aggiornato.', tone: 'success' });
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : 'Errore.', tone: 'danger' });
      } finally {
        setLocSaving(false);
      }
    },
    [studentId, locSaving],
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
    const stack = segments[1] === 'notes' ? 'notes' : 'home';
    const long = custom.length + 1 > LONG_PICKER_THRESHOLD;
    router.push(`/(tabs)/${stack}/select-options${long ? '-long' : ''}`);
  }, [locations, defaultLocationId, applyDefaultLocation, router, segments]);

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
                setToast({ text: next ? 'Abilitato alle guide di gruppo.' : 'Disabilitato dalle guide di gruppo.', tone: 'success' });
              } catch (e) {
                setGroupOptIn(!next);
                setToast({ text: e instanceof Error ? e.message : 'Errore.', tone: 'danger' });
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
                setToast({ text: next ? 'Allievo segnato pronto per l\'esame.' : 'Rimosso dai pronti.', tone: 'success' });
              } catch (e) {
                setExamReady(!next);
                setToast({ text: e instanceof Error ? e.message : 'Errore.', tone: 'danger' });
              } finally {
                setExamReadySaving(false);
              }
            },
          }
        : null,
      location: locations.length
        ? { label: defaultLocationName ?? 'Sede dell\u2019autoscuola', onPress: openLocationPicker }
        : null,
    });
    const stack = segments[1] === 'notes' ? 'notes' : 'home';
    router.push(`/(tabs)/${stack}/student-settings`);
  }, [
    name, groupEnabled, groupOptIn, groupSaving, studentPhase, examReady, examReadySaving,
    locations.length, defaultLocationName, openLocationPicker, studentId, router, segments, setToast,
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
    const stack = segments[1] === 'notes' ? 'notes' : 'home';
    router.push(`/(tabs)/${stack}/student-payments`);
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

  // Obbligo: contano SOLO le guide da 60 minuti (stesso criterio del BE e dei
  // colori dell'agenda). Le guide da 30 minuti finivano qui dentro per errore.
  const completedCount = useMemo(
    () => appointments.filter((a) => {
      const s = (a.status ?? '').trim().toLowerCase();
      if (s !== 'completed' && s !== 'checked_in') return false;
      return isMandatoryLessonDuration(a);
    }).length,
    [appointments],
  );

  /** Media per voce su tutto lo storico: alimenta sia il blocco "Pagellino"
   *  sia la statistica "voto medio" della card profilo. */
  const pagellino = useMemo(() => aggregateStudentEvaluations(appointments), [appointments]);

  const avgRating = useMemo(() => {
    // Il "voto medio" è la media del PAGELLINO: la stellina singola non si
    // compila più, quindi su un allievo nuovo resterebbe vuota per sempre.
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

  const upcomingExam = useMemo(() => {
    const now = new Date();
    for (const c of cases) {
      if (c.drivingExamAt && new Date(c.drivingExamAt) > now) return { type: 'guida', date: c.drivingExamAt };
      if (c.theoryExamAt && new Date(c.theoryExamAt) > now) return { type: 'teoria', date: c.theoryExamAt };
    }
    for (const appt of appointments) {
      if ((appt.type ?? '').toLowerCase() === 'esame' && new Date(appt.startsAt) > now) {
        return { type: 'guida', date: appt.startsAt };
      }
    }
    return null;
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
  /** La prossima guida (o esame) in programma, la più vicina. */
  const nextLesson = useMemo(() => {
    const now = Date.now();
    return [...allAppointments]
      .filter((a) => ['scheduled', 'confirmed'].includes((a.status ?? '').trim().toLowerCase()))
      .filter((a) => new Date(a.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] ?? null;
  }, [allAppointments]);
  const showSettings = groupEnabled || studentPhase === 'PRATICA' || locations.length > 0;

  // REG-639 «vita ovunque» (Tiziano 28/10): il dettaglio allievo è un FORM SHEET
  // nativo alto quanto il contenuto (FORM_SHEET + FormSheet); scorre da sé solo
  // se supera lo schermo. In testa il volto grande, poi i numeri che contano.
  return (
    <FormSheet
      testID="student-detail-sheet"
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
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      {/* Volto, nome, patente */}
      <View style={s.hero}>
        <Avatar userId={studentId ?? null} name={fullName} size={88} />
        <Text style={s.heroName} numberOfLines={1}>{fullName}</Text>
        {subtitleLine ? <Text style={s.heroSub} numberOfLines={2}>{subtitleLine}</Text> : null}
        {!loading ? (
          // REG-639 «memorabile»: il prossimo passo, subito sotto il nome.
          <Animated.Text entering={STAT_DISSOLVE} style={s.nextTx} numberOfLines={1}>
            {nextLesson
              ? `Prossima guida ${formatDay(nextLesson.startsAt)} · ${formatTime(nextLesson.startsAt)}`
              : 'Nessuna guida in programma'}
          </Animated.Text>
        ) : null}
      </View>

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
          { art: VITA_ART.volante, value: String(completedCount), unit: '', label: completedCount === 1 ? 'guida fatta' : 'guide fatte' },
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

      {/* Esame in arrivo */}
      {!loading && upcomingExam ? (
        <ClaySurface radius={22} style={[s.card, s.examCard]}>
          <Image source={VITA_ART.esame} style={s.examArt} />
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Esame {upcomingExam.type === 'teoria' ? 'di teoria' : 'di guida'}</Text>
            <Text style={s.cardSub}>{formatExamDate(upcomingExam.date)}</Text>
          </View>
        </ClaySurface>
      ) : null}

      {/* Pagamenti e impostazioni: una lista sola */}
      {!loading && (paymentsManualMode || showSettings) ? (
        <ClayList style={s.listGap}>
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

      {/* Pagellino: una riga, il dettaglio si apre al tocco */}
      {!loading && pagellino ? (
        <Animated.View layout={EVAL_LAYOUT} style={s.listGap}>
          <ClaySurface radius={22} padded={false}>
            <Pressable
              onPress={() => setPagellinoOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: pagellinoOpen }}
              style={({ pressed }) => [s.pagHead, pressed && { opacity: 0.6 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Pagellino</Text>
                <Text style={s.cardSub}>
                  {pagellino.lessonCount === 1 ? '1 guida valutata' : `${pagellino.lessonCount} guide valutate`}
                </Text>
              </View>
              <View style={s.sparkRow}>
                {pagellino.items.slice(0, 6).map((item) => (
                  <View key={item.itemId} style={s.sparkTrack}>
                    <View style={[s.sparkFill, { height: `${Math.max(12, (item.average / item.scaleMax) * 100)}%` }]} />
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
                  <View key={item.itemId} style={s.pagRow}>
                    <View style={s.rowBetween}>
                      <Text style={s.pagName} numberOfLines={1}>{item.label}</Text>
                      <Text style={s.pagVal}>
                        <Text style={s.pagValNum}>{item.average.toFixed(1).replace('.', ',')}</Text>
                        /{item.scaleMax} · {item.count === 1 ? '1 guida' : `${item.count} guide`}
                      </Text>
                    </View>
                    <View style={s.pagTrack}>
                      <View style={[s.pagFill, { width: `${(item.average / item.scaleMax) * 100}%` }]} />
                    </View>
                  </View>
                ))}
                {pagellino.weakest ? (
                  <Text style={s.pagFoot}>
                    Da allenare: <Text style={s.pagFootStrong}>{pagellino.weakest.label}</Text>
                    {` (${pagellino.weakest.average.toFixed(1).replace('.', ',')}/${pagellino.weakest.scaleMax})`}
                  </Text>
                ) : null}
              </Animated.View>
            ) : null}
          </ClaySurface>
        </Animated.View>
      ) : null}

      {/* Storico guide */}
      <ClaySection title="Storico guide">
        <Animated.View layout={HEIGHT_GLIDE}>
          {loading ? (
            <ClaySurface padded={false}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[s.hRow, i > 0 && s.hDivider]}>
                  <SkeletonBlock width="52%" height={15} radius={6} />
                  <SkeletonBlock width="38%" height={12} radius={6} style={{ marginTop: 8 }} />
                </View>
              ))}
            </ClaySurface>
          ) : appointments.length === 0 ? (
            <Animated.Text key={`empty-${hiddenByPath}`} entering={LIST_DISSOLVE} style={s.emptyText}>
              {hiddenByPath === 1
                ? "Nessuna guida in questo percorso. L'altra è sotto «Vedi tutto»."
                : hiddenByPath > 1
                  ? `Nessuna guida in questo percorso. Le altre ${hiddenByPath} sono sotto «Vedi tutto».`
                  : `Ancora nessuna guida con ${firstName}.`}
            </Animated.Text>
          ) : (
            <Animated.View key={shownPathId ?? 'all'} entering={LIST_DISSOLVE}>
              <ClaySurface padded={false}>
                {appointments.map((appt, idx) => {
                  const isExam = (appt.type ?? '').trim().toLowerCase() === 'esame';
                  const isGroup = (appt.type ?? '').trim().toLowerCase() === 'group_lesson' || !!appt.groupLessonId;
                  const isMotoGroup = appt.groupLessonKind === 'moto';
                  const motoType = asMotoLessonType(appt.motoLessonType);
                  const allTypes = (appt.types?.length ? appt.types : (appt.type ? [appt.type] : []))
                    .filter((t: string) => t !== 'guida' && t !== 'group_lesson' && t.toLowerCase() !== 'esame')
                    .map((t: string) => t.charAt(0).toUpperCase() + t.slice(1));
                  const kind = isExam
                    ? 'Esame'
                    : isGroup
                      ? `${isMotoGroup ? 'Gruppo moto' : 'Guida di gruppo'}${appt.groupLessonCapacity ? ` · ${appt.groupLessonFilled ?? 0}/${appt.groupLessonCapacity}` : ''}`
                      : [...allTypes, motoType ? MOTO_LESSON_TYPE_LABELS[motoType] : null].filter(Boolean).join(' · ');
                  const vehicles = [appt.vehicle?.name, ...(appt.extraMotoVehicles ?? []).map((v) => v.name), appt.followVehicle?.name]
                    .filter(Boolean)
                    .join(' + ');
                  const meta = isExam ? kind : [appt.instructor?.name ?? 'Istruttore', vehicles || null, kind || null].filter(Boolean).join(' · ');
                  const summary = evaluationSummary(appt.evaluations);
                  const open = openEvalId === appt.id;
                  const outcome = isExam ? asExamOutcome(appt.examOutcome) : null;
                  const recordable = isExam && canRecordExamOutcome(appt);
                  const saving = outcomeSavingId === appt.id;
                  return (
                    <View key={appt.id} style={[s.hRow, idx > 0 && s.hDivider]}>
                      <View style={s.rowBetween}>
                        <Text style={s.hDate}>
                          {formatDay(appt.startsAt)} ·{' '}
                          {examTimeIsTbd(appt) ? EXAM_TIME_TBD : formatTime(appt.startsAt)}
                        </Text>
                        {appt.rating != null && !appt.evaluations?.length ? (
                          <StarRating value={appt.rating} readOnly size={13} tone="gold" />
                        ) : null}
                      </View>
                      <Text style={s.hMeta} numberOfLines={2}>{meta}</Text>

                      {isExam && (outcome || recordable) ? (
                        <Pressable
                          onPress={recordable && !saving ? () => recordOutcome(appt) : undefined}
                          disabled={!recordable || saving}
                          hitSlop={6}
                          accessibilityRole={recordable ? 'button' : 'text'}
                          style={({ pressed }) => [s.inlineAction, (pressed || saving) && { opacity: 0.6 }]}
                        >
                          <Text
                            style={[
                              s.inlineActionTx,
                              outcome ? { color: EXAM_OUTCOME_TONE[outcome].ink, textDecorationLine: 'none' } : null,
                            ]}
                          >
                            {outcome ? `Esito: ${EXAM_OUTCOME_LABELS[outcome]}` : 'Registra esito'}
                          </Text>
                        </Pressable>
                      ) : null}

                      {summary ? (
                        <Animated.View layout={EVAL_LAYOUT}>
                          <Pressable
                            onPress={() => setOpenEvalId((cur) => (cur === appt.id ? null : appt.id))}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: open }}
                            style={({ pressed }) => [s.evalRow, pressed && { opacity: 0.6 }]}
                          >
                            <Ionicons name="star" size={12} color="#F5A524" />
                            <Text style={s.evalTx}>{evaluationSummaryLabel(summary)}</Text>
                            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={CLAY.ink4} />
                          </Pressable>
                          {open ? (
                            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={s.voci}>
                              {(appt.evaluations ?? [])
                                .filter((row) => row.notApplicable || row.score != null)
                                .map((row, i) => (
                                  <View key={row.itemId} style={[s.voce, i > 0 && s.hDivider]}>
                                    <Text style={s.voceName} numberOfLines={2}>{row.label}</Text>
                                    {row.notApplicable || row.score == null ? (
                                      <Text style={s.voceNa}>non valutabile</Text>
                                    ) : (
                                      <StarRating value={row.score} total={row.scaleMax} readOnly size={13} tone="gold" />
                                    )}
                                  </View>
                                ))}
                            </Animated.View>
                          ) : null}
                        </Animated.View>
                      ) : null}

                      {roadByLesson.get(appt.id) ? (
                        <RoadHistoryChip
                          item={roadByLesson.get(appt.id)!}
                          onPress={() => void openRoadPercorso(router, segments[1] === 'notes' ? 'notes' : 'home', appt.id)}
                        />
                      ) : null}

                      <Pressable
                        onPress={() => openDetails(appt)}
                        accessibilityRole="button"
                        accessibilityLabel={appt.notes?.trim() ? 'Modifica dettagli' : 'Aggiungi dettagli'}
                        hitSlop={10}
                        style={({ pressed }) => [
                          s.noteRow,
                          // Senza note la matita sale accanto alla data (se lì
                          // non c'è già la vecchia stellina).
                          !appt.notes?.trim() && !(appt.rating != null && !appt.evaluations?.length) && s.noteRowEmpty,
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        {/* Senza note resta solo la matita: «Aggiungi dettagli» su
                            ogni riga era rumore (REG-639 «memorabile»). */}
                        {appt.notes?.trim() ? <Text style={s.note}>{appt.notes.trim()}</Text> : <View style={{ flex: 1 }} />}
                        <Ionicons name="create-outline" size={15} color={CLAY.ink4} />
                      </Pressable>
                    </View>
                  );
                })}
              </ClaySurface>
            </Animated.View>
          )}
        </Animated.View>
      </ClaySection>

      {/* Contatti (prima sul retro della card che si girava) */}
      {!loading && (email || phone || obtained.length > 0) ? (
        <ClaySection title="Contatti">
          <ClayList>
            {phone ? <ClayListRow title="Telefono" subtitle={phone} /> : null}
            {email ? <ClayListRow title="Email" subtitle={email} /> : null}
            {obtained.length > 0 ? (
              <ClayListRow
                title={obtained.length === 1 ? 'Patente già conseguita' : 'Patenti già conseguite'}
                subtitle={obtained.map(obtainedLabel).filter(Boolean).join(' · ')}
              />
            ) : null}
          </ClayList>
        </ClaySection>
      ) : null}
    </FormSheet>
  );
};

const s = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: -8 },
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
  examCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  examArt: { width: 46, height: 46 },
  listGap: { marginTop: 12 },
  pagHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 18 },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 26 },
  sparkTrack: { width: 5, height: '100%', borderRadius: 3, backgroundColor: 'rgba(17,17,17,0.07)', justifyContent: 'flex-end', overflow: 'hidden' },
  sparkFill: { width: '100%', borderRadius: 3, backgroundColor: CLAY.ink },
  pagBig: { fontSize: 22, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  pagBody: { paddingHorizontal: 18, paddingBottom: 16 },
  pagRow: { marginTop: 12 },
  pagName: { flex: 1, fontSize: 15, color: CLAY.ink },
  pagVal: { fontSize: 13, color: CLAY.ink3 },
  pagValNum: { fontWeight: '600', color: CLAY.ink },
  pagTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(17,17,17,0.07)', overflow: 'hidden', marginTop: 6 },
  pagFill: { height: '100%', borderRadius: 3, backgroundColor: CLAY.ink },
  pagFoot: { fontSize: 13.5, color: CLAY.ink3, marginTop: 14 },
  pagFootStrong: { fontWeight: '600', color: CLAY.ink },
  hRow: { paddingVertical: 14, paddingHorizontal: 18 },
  hDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(17,17,17,0.12)' },
  hDate: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25 },
  hMeta: { fontSize: 14, color: CLAY.ink3, marginTop: 3 },
  inlineAction: { alignSelf: 'flex-start', marginTop: 8 },
  inlineActionTx: { fontSize: 14.5, fontWeight: '600', color: CLAY.ink, textDecorationLine: 'underline' },
  evalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8 },
  evalTx: { fontSize: 14, fontWeight: '500', color: CLAY.ink2 },
  voci: { marginTop: 6 },
  voce: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8 },
  voceName: { flex: 1, fontSize: 14, color: CLAY.ink },
  voceNa: { fontSize: 13, color: CLAY.ink4 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  note: { flex: 1, fontSize: 15, color: CLAY.ink, lineHeight: 20 },
  noteRowEmpty: { position: 'absolute', top: 16, right: 18, marginTop: 0 },
  dueTx: { fontSize: 14, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.1 },
  nextTx: { fontSize: 15, color: CLAY.ink, marginTop: 10, textAlign: 'center', letterSpacing: -0.2 },
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
