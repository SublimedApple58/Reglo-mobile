import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { regloApi } from '../services/regloApi';
import { RegloApiError } from '../services/apiClient';
import type {
  RoadFreeStartInput,
  RoadHotspotOutcome,
  RoadLesson,
  RoadPlan,
  RoadSessionWithLesson,
  RoadStudentHotspot,
} from '../types/regloApi';
import { roadQueue } from './queue';
import { roadStore, lessonStudentName } from './roadStore';
import { roadUploader } from './uploader';
import { isRoadTrackingActive, startRoadTracking, stopRoadTracking } from './tracking';
import { formatRange, haversineMeters, makeClientId } from './format';
import { fixHistory } from './fixHistory';
import { ROAD_UNDO_SECONDS, roadFreeStarted } from './freeStartStore';

/**
 * REG-638 Reglo Road — azioni (entrata, ripresa, segnalazioni, fine guida).
 * Le schermate chiamano solo queste funzioni: tracking, code e stato restano
 * dietro le quinte.
 */

const PRIVACY_KEY = 'reglo.road.privacySeen.v1';
const DISMISSED_KEY = 'reglo.road.dismissedInvites.v1';

// ─── preferenze del dispositivo ─────────────────────────────────────────────

export async function hasSeenRoadPrivacy(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PRIVACY_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markRoadPrivacySeen() {
  try {
    await AsyncStorage.setItem(PRIVACY_KEY, '1');
  } catch {
    // ignorato: al peggio l'informativa ricompare
  }
}

async function readDismissed(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function isInviteDismissed(appointmentId: string): Promise<boolean> {
  return (await readDismissed()).includes(appointmentId);
}

/** «Non ora»: l'invito non torna per questa guida. */
export async function dismissInvite(appointmentId: string) {
  const list = await readDismissed();
  if (list.includes(appointmentId)) return;
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...list, appointmentId].slice(-30)));
  } catch {
    // ignorato
  }
}

// ─── permesso posizione ─────────────────────────────────────────────────────

function alertPermissionDenied() {
  Alert.alert(
    'Posizione non attiva',
    'Senza la posizione Road non può registrare il percorso. Puoi attivarla in Impostazioni › Reglo › Posizione › «Mentre usi l\'app».',
    [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Apri Impostazioni', onPress: () => Linking.openSettings().catch(() => undefined) },
    ],
  );
}

/**
 * REG-692: con la posizione approssimativa i fix arrivano con un'incertezza di
 * chilometri, il tracking li scarta tutti (soglia 50 m) e la guida si chiude a
 * 0 km. Meglio fermarsi prima e dire cosa fare.
 */
const APPROX_ACCURACY_M = 1000;
const APPROX_PROBE_MS = 2500;

function alertApproximateLocation() {
  Alert.alert(
    'Serve la posizione esatta',
    Platform.OS === 'ios'
      ? 'Con la posizione approssimativa Road non registra il percorso. Attiva Impostazioni › Reglo › Posizione › «Posizione esatta».'
      : 'Con la posizione approssimativa Road non registra il percorso. Attiva Impostazioni › App › Reglo › Autorizzazioni › Posizione › «Usa posizione esatta».',
    [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Apri Impostazioni', onPress: () => Linking.openSettings().catch(() => undefined) },
    ],
  );
}

/**
 * Android lo dice il permesso (coarse). iOS non lo espone a expo-location: un
 * fix approssimativo arriva subito con un'incertezza ≥ 1 km, quello esatto
 * no. Se il fix non arriva in tempo (garage, galleria) si lascia partire:
 * meglio non bloccare per un dubbio.
 */
async function isApproximateLocation(perm: Location.LocationPermissionResponse): Promise<boolean> {
  if (Platform.OS === 'android') return perm.android?.accuracy === 'coarse';
  try {
    // l'ultimo fix recente risponde subito: niente attesa al tocco
    const fix =
      (await Location.getLastKnownPositionAsync({ maxAge: 60_000 })) ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), APPROX_PROBE_MS)),
      ]));
    const acc = fix?.coords.accuracy;
    return typeof acc === 'number' && acc >= APPROX_ACCURACY_M;
  } catch {
    return false;
  }
}

async function ensurePreciseLocation(perm: Location.LocationPermissionResponse): Promise<boolean> {
  if (!(await isApproximateLocation(perm))) return true;
  alertApproximateLocation();
  return false;
}

/** Solo «Mentre usi l'app»: il permesso "Sempre" non serve. */
export async function ensureRoadLocationPermission(): Promise<boolean> {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      Alert.alert(
        'Localizzazione spenta',
        'Accendi i Servizi di localizzazione del telefono per usare Road.',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Apri Impostazioni', onPress: () => Linking.openSettings().catch(() => undefined) },
        ],
      );
      return false;
    }
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return ensurePreciseLocation(current);
    if (!current.canAskAgain) {
      alertPermissionDenied();
      return false;
    }
    const asked = await Location.requestForegroundPermissionsAsync();
    if (asked.granted) return ensurePreciseLocation(asked);
    alertPermissionDenied();
    return false;
  } catch {
    alertPermissionDenied();
    return false;
  }
}

// ─── sessione ───────────────────────────────────────────────────────────────

async function loadEvaluationEnabled(appointmentId: string) {
  try {
    const ev = await regloApi.getAppointmentEvaluation(appointmentId);
    roadStore.setEvaluationEnabled(!!ev?.enabled);
  } catch {
    roadStore.setEvaluationEnabled(false);
  }
}

async function hydrate(sessionId: string) {
  try {
    const detail = await regloApi.getRoadSession(sessionId);
    roadStore.hydrateFromDetail(detail);
  } catch {
    // la mappa ripartirà dai punti nuovi
  }
}

async function attachAndTrack(session: RoadSessionWithLesson) {
  if (roadQueue.sessionId !== session.id) fixHistory.clear();
  await roadQueue.attach(session.id, session.lastSeq ?? -1);
  roadStore.startSession(session);
  roadUploader.onSessionClosed(handleRemoteClose);
  roadUploader.start();
  await startRoadTracking();
  void loadEvaluationEnabled(session.appointmentId);
}

function messageOf(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * «Entra in Road» su una guida. Ritorna true se la modalità Road è partita
 * (chi chiama naviga su `/road`).
 */
export async function enterRoad(appointmentId: string, plan?: RoadPlan | null): Promise<boolean> {
  if (!(await ensureRoadLocationPermission())) return false;
  let started;
  try {
    started = await regloApi.startRoadSession(appointmentId, plan);
  } catch (err) {
    Alert.alert('Road non disponibile', messageOf(err, 'Non è stato possibile avviare Road. Riprova.'));
    return false;
  }
  if (started.status !== 'active') {
    Alert.alert('Guida già chiusa', 'Questa guida è già stata chiusa in Road.');
    return false;
  }
  try {
    await attachAndTrack(started);
  } catch (err) {
    Alert.alert('GPS non disponibile', messageOf(err, 'Non è stato possibile accendere il GPS.'));
    roadStore.reset();
    return false;
  }
  if (started.resumed) void hydrate(started.id);
  return true;
}

/** Esito di «Parti» in Road libero. */
export type FreeStartOutcome =
  | { kind: 'started' }
  | { kind: 'current'; lesson: RoadLesson }
  | { kind: 'failed' };

function payloadOf(err: unknown): { code?: string; message?: string; lesson?: RoadLesson } {
  const p = err instanceof RegloApiError ? err.payload : null;
  return p && typeof p === 'object' ? (p as { code?: string; message?: string; lesson?: RoadLesson }) : {};
}

const confirmProceed = (title: string, message: string) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(title, message, [
      { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Procedi comunque', onPress: () => resolve(true) },
    ]),
  );

/**
 * Road libero: crea la guida in agenda (adesso, già presente) e parte in Road.
 * Limite settimanale e pausa chiedono conferma come nell'agenda; se c'è già la
 * guida di adesso torna quella, e chi chiama propone di entrare su quella.
 */
export async function enterRoadFree(input: RoadFreeStartInput): Promise<FreeStartOutcome> {
  if (!(await ensureRoadLocationPermission())) return { kind: 'failed' };
  let req: RoadFreeStartInput = { ...input };
  let started;
  for (let attempt = 0; attempt < 4 && !started; attempt += 1) {
    try {
      started = await regloApi.startFreeRoadSession(req);
    } catch (err) {
      const p = payloadOf(err);
      const msg = p.message ?? messageOf(err, 'Non è stato possibile avviare la guida. Riprova.');
      if (p.code === 'CURRENT_LESSON' && p.lesson) return { kind: 'current', lesson: p.lesson };
      if (p.code === 'WEEKLY_LIMIT_CONFIRM' && !req.confirmWeeklyLimit) {
        if (!(await confirmProceed('Limite settimanale', msg))) return { kind: 'failed' };
        req = { ...req, confirmWeeklyLimit: true };
        continue;
      }
      if (p.code === 'STUDENT_BLOCKED_CONFIRM' && !req.confirmStudentBlocked) {
        if (!(await confirmProceed('Prenotazioni bloccate', msg))) return { kind: 'failed' };
        req = { ...req, confirmStudentBlocked: true };
        continue;
      }
      if (p.code === 'LESSON_BUFFER_CONFIRM' && !req.confirmNoBuffer) {
        if (!(await confirmProceed('Niente pausa dopo', msg))) return { kind: 'failed' };
        req = { ...req, confirmNoBuffer: true };
        continue;
      }
      Alert.alert('Guida non avviata', msg);
      return { kind: 'failed' };
    }
  }
  if (!started) return { kind: 'failed' };
  try {
    await attachAndTrack(started);
  } catch (err) {
    Alert.alert('GPS non disponibile', messageOf(err, 'Non è stato possibile accendere il GPS.'));
    roadStore.reset();
    return { kind: 'failed' };
  }
  roadFreeStarted.set({
    sessionId: started.id,
    label: `${formatRange(started.lesson.startsAt, started.lesson.endsAt)} con ${firstNameOf(lessonStudentName(started.lesson))}`,
    bookedMinutes: input.durationMin,
    until: Date.now() + ROAD_UNDO_SECONDS * 1000,
  });
  return { kind: 'started' };
}

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * «Annulla» sul banner nei primi secondi: la guida esce dall'agenda (il
 * server rende il credito), il GPS si spegne e si torna alla tab Road.
 */
export async function undoRoadFree(): Promise<boolean> {
  const info = roadFreeStarted.get();
  const { session } = roadStore.get();
  if (!info || !session || session.id !== info.sessionId) return false;
  try {
    await regloApi.undoFreeRoadSession(info.sessionId);
  } catch (err) {
    Alert.alert('Guida non annullata', messageOf(err, 'Riprova tra poco.'));
    return false;
  }
  roadFreeStarted.set(null);
  await stopRoadTracking();
  roadUploader.stop();
  roadUploader.onSessionClosed(null);
  roadUploader.resetStreet();
  // guida cancellata dal server: i suoi punti non servono più
  await roadQueue.discardSession(info.sessionId);
  roadStore.reset();
  return true;
}

/**
 * Ripresa dopo un kill / riapertura: `/road/state` ha una sessione attiva.
 * Si rientra in Road e, se il GPS si era fermato, lo si riaccende.
 */
export async function resumeRoad(session: RoadSessionWithLesson): Promise<void> {
  const current = roadStore.get();
  const sameActive = current.session?.id === session.id && current.phase !== 'idle';
  if (sameActive && (await isRoadTrackingActive())) {
    // il pagellino può essere stato acceso/spento dal titolare nel frattempo
    void loadEvaluationEnabled(session.appointmentId);
    return;
  }
  if (!sameActive) {
    roadStore.startSession(session);
    void hydrate(session.id);
  }
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && !(await ensureRoadLocationPermission())) return;
    await attachAndTrack(session);
  } catch {
    // GPS non riacceso: la schermata Road resta, l'utente può terminare
  }
}

/**
 * Posizione per una segnalazione: l'ultima del tracking (un'auto ferma al
 * semaforo non manda punti nuovi, quindi va bene fino a 5 minuti), altrimenti
 * l'ultima nota del telefono, e solo in ultimo una lettura fresca (max 5 s:
 * il tocco non deve mai restare appeso al GPS).
 */
async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  const fix = roadStore.get().fix;
  if (fix && Date.now() - fix.t < 5 * 60_000) return { lat: fix.lat, lng: fix.lng };
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
    if (fresh) return { lat: fresh.coords.latitude, lng: fresh.coords.longitude };
  } catch {
    // sotto
  }
  return fix ? { lat: fix.lat, lng: fix.lng } : null;
}

/** REG-696: quanto prima dell'apertura di «Segnala» si guarda (l'errore viene prima del tocco). */
const RETRO_LEAD_MS = 3_000;
/** Sotto questa distanza «qui» e «N s fa» sono lo stesso posto: niente scelta. */
const RETRO_MIN_M = 15;

/**
 * Segna una segnalazione. REG-696: va dove era l'auto poco prima di aprire
 * «Segnala» (`openedAt`), non 50–150 m dopo; il toast lascia scegliere «Qui».
 * Se l'auto era ferma o la storia non copre quel momento: posizione attuale.
 */
export async function recordRoadMarker(input: {
  kind: string;
  label: string;
  note?: string | null;
  sentiment: 'good' | 'bad';
  openedAt?: number;
}) {
  const { session } = roadStore.get();
  if (!session) return null;
  const pos = await currentPosition();
  if (!pos) {
    Alert.alert('Posizione non trovata', 'Aspetta qualche secondo che il GPS trovi la posizione e riprova.');
    return null;
  }
  const now = Date.now();
  const back = input.openedAt ? fixHistory.at(input.openedAt - RETRO_LEAD_MS) : null;
  const useBack = !!back && haversineMeters(back.lat, back.lng, pos.lat, pos.lng) >= RETRO_MIN_M;
  const hereAt = new Date(now).toISOString();
  const place = useBack ? { lat: back!.lat, lng: back!.lng, recordedAt: new Date(back!.t).toISOString() } : { ...pos, recordedAt: hereAt };
  const alt = useBack ? { lat: pos.lat, lng: pos.lng, recordedAt: hereAt } : null;
  const retroSec = useBack ? Math.max(1, Math.round((now - back!.t) / 1000)) : null;

  const clientId = makeClientId();
  const street = roadStore.get().street ?? roadUploader.street;
  const note = input.note?.trim() ? input.note.trim().slice(0, 500) : null;
  await roadQueue.pushMarkerOp({
    op: 'add',
    sessionId: session.id,
    input: {
      clientId,
      kind: input.kind,
      // la copia dell'etichetta serve se la voce custom sparisce nel frattempo
      label: input.label,
      note,
      lat: place.lat,
      lng: place.lng,
      street,
      sentiment: input.sentiment,
      recordedAt: place.recordedAt,
    },
  });
  roadStore.addMarker({
    clientId,
    kind: input.kind,
    label: input.label,
    note,
    lat: place.lat,
    lng: place.lng,
    street,
    sentiment: input.sentiment,
    recordedAt: place.recordedAt,
    alt,
    retroSec,
    placed: useBack ? 'retro' : 'here',
  });
  // REG-696: «Fatto bene» vale per una segnalazione sola, poi si torna a «da migliorare».
  if (input.sentiment === 'good') roadStore.setSentimentMode('bad');
  void roadUploader.flush(true);
  return clientId;
}

/** REG-696: dal toast, «Qui» ↔ «N s fa». */
export async function swapRoadMarkerPlace(clientId: string) {
  const { session } = roadStore.get();
  if (!session) return;
  const next = roadStore.swapMarkerPlace(clientId);
  if (!next) return;
  await roadQueue.pushMarkerOp({
    op: 'update',
    sessionId: session.id,
    clientId,
    patch: { lat: next.lat, lng: next.lng, recordedAt: next.recordedAt },
  });
  void roadUploader.flush(true);
}

/**
 * REG-696: correggere una segnalazione dopo i 5 s (riepilogo, percorso):
 * giudizio o cancellazione. Va al server subito (niente aggiornamento
 * ottimistico): l'interfaccia si aggiorna con la risposta.
 */
export async function correctRoadMarker(
  sessionId: string,
  markerIdOrClientId: string,
  change: { sentiment: 'good' | 'bad' } | { remove: true },
): Promise<boolean> {
  try {
    if ('remove' in change) await regloApi.removeRoadMarker(sessionId, markerIdOrClientId);
    else await regloApi.updateRoadMarker(sessionId, markerIdOrClientId, { sentiment: change.sentiment });
    return true;
  } catch (err) {
    Alert.alert('Segnalazione non modificata', messageOf(err, 'Controlla la connessione e riprova.'));
    return false;
  }
}

/**
 * REG-681: ripassando sul punto critico, «Meglio» o «Ancora no» con un tocco.
 * Va nella stessa coda offline delle segnalazioni (idempotente su clientId).
 */
export async function recordHotspotCheck(hotspot: RoadStudentHotspot, outcome: RoadHotspotOutcome) {
  const { session } = roadStore.get();
  if (!session) return null;
  const clientId = makeClientId();
  const recordedAt = new Date().toISOString();
  await roadQueue.pushMarkerOp({
    op: 'check-add',
    sessionId: session.id,
    input: {
      clientId,
      hotspotKey: hotspot.key,
      kind: hotspot.kind,
      label: hotspot.label,
      lat: hotspot.lat,
      lng: hotspot.lng,
      outcome,
      recordedAt,
    },
  });
  roadStore.addCheck({ clientId, hotspotKey: hotspot.key, kind: hotspot.kind, label: hotspot.label, outcome, recordedAt });
  void roadUploader.flush(true);
  return clientId;
}

export async function undoHotspotCheck(clientId: string) {
  const { session } = roadStore.get();
  if (!session) return;
  roadStore.removeCheck(clientId);
  await roadQueue.pushMarkerOp({ op: 'check-remove', sessionId: session.id, clientId });
  void roadUploader.flush(true);
}

/** «Annulla» sul toast. */
export async function undoRoadMarker(clientId: string) {
  const { session } = roadStore.get();
  if (!session) return;
  roadStore.removeMarker(clientId);
  await roadQueue.pushMarkerOp({ op: 'remove', sessionId: session.id, clientId });
  void roadUploader.flush(true);
}

/**
 * «Termina guida»: svuota le code, spegne il GPS, chiude la sessione (la
 * guida diventa completata) e mostra il riepilogo coi numeri del server.
 *
 * REG-691: i punti che non sono riusciti a partire (rete ballerina) NON si
 * buttano più: restano in coda e si spediscono dopo la chiusura (il server li
 * accetta fino a 2 h e ricalcola km e giro). Il riepilogo lo dice e si
 * aggiorna da solo quando arrivano.
 */
export async function endRoad(): Promise<boolean> {
  const { session } = roadStore.get();
  if (!session) return false;
  roadStore.setPhase('ending');
  await roadUploader.refreshStreet(true);
  await roadUploader.flush(true);
  await stopRoadTracking();
  await roadUploader.flush(true);
  // un secondo tentativo prima di chiudere: spesso basta (lotto in volo scaduto)
  if (roadQueue.pendingFor(session.id) > 0) await roadUploader.flush(true);
  try {
    const detail = await regloApi.endRoadSession(session.id);
    roadUploader.onSessionClosed(null);
    roadUploader.resetStreet();
    await roadQueue.detach();
    const late = roadQueue.pendingFor(session.id) > 0;
    roadStore.showSummary(detail, late);
    if (late) watchLateSync(session.id);
    // punti e segnalazioni ancora in coda (offline): partono quando torna la rete
    roadUploader.stop();
    void roadUploader.flush(true);
    return true;
  } catch (err) {
    roadStore.setPhase('active');
    try {
      await startRoadTracking();
    } catch {
      // resta spento: si riprova a terminare
    }
    const offline = !(err instanceof RegloApiError) || !err.status;
    Alert.alert(
      'Guida non terminata',
      offline
        ? 'Serve la connessione per chiudere la guida. Il percorso continua: riprova tra poco.'
        : messageOf(err, 'Riprova tra poco.'),
    );
    return false;
  }
}

/** Quando gli ultimi punti della guida chiusa arrivano, il riepilogo si ricarica coi km giusti. */
function watchLateSync(sessionId: string) {
  const off = roadUploader.onSessionSynced((id) => {
    if (id !== sessionId) return;
    off();
    const { summary } = roadStore.get();
    if (summary?.id !== sessionId) return;
    regloApi
      .getRoadSession(sessionId)
      .then((d) => roadStore.updateSummary(d, false))
      .catch(() => roadStore.updateSummary(summary, false));
  });
}

/** Ricarica il riepilogo (dopo aver salvato il pagellino). */
export async function refreshRoadSummary() {
  const { summary } = roadStore.get();
  if (!summary) return;
  try {
    roadStore.updateSummary(await regloApi.getRoadSession(summary.id));
  } catch {
    // resta il riepilogo di prima
  }
}

/** «Chiudi» il riepilogo: fuori da Road. */
export async function exitRoad() {
  roadStore.reset();
}

/** La sessione è stata chiusa altrove (web, job di manutenzione). */
function handleRemoteClose() {
  const { session } = roadStore.get();
  void stopRoadTracking();
  roadUploader.stop();
  roadUploader.onSessionClosed(null);
  void roadQueue.detach();
  roadStore.reset();
  Alert.alert(
    'Guida chiusa',
    session
      ? `La guida con ${lessonStudentName(session.lesson)} è stata chiusa e il GPS si è spento.`
      : 'La guida è stata chiusa e il GPS si è spento.',
  );
}
