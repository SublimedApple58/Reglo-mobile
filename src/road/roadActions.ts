import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { regloApi } from '../services/regloApi';
import { RegloApiError } from '../services/apiClient';
import type { RoadFreeStartInput, RoadLesson, RoadSessionWithLesson } from '../types/regloApi';
import { roadQueue } from './queue';
import { roadStore, lessonStudentName } from './roadStore';
import { roadUploader } from './uploader';
import { isRoadTrackingActive, startRoadTracking, stopRoadTracking } from './tracking';
import { makeClientId } from './format';

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
    if (current.granted) return true;
    if (!current.canAskAgain) {
      alertPermissionDenied();
      return false;
    }
    const asked = await Location.requestForegroundPermissionsAsync();
    if (asked.granted) return true;
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
export async function enterRoad(appointmentId: string): Promise<boolean> {
  if (!(await ensureRoadLocationPermission())) return false;
  let started;
  try {
    started = await regloApi.startRoadSession(appointmentId);
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
  for (let attempt = 0; attempt < 3 && !started; attempt += 1) {
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
  return { kind: 'started' };
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

/** Segna una segnalazione sul punto in cui si è ora. */
export async function recordRoadMarker(input: {
  kind: string;
  label: string;
  note?: string | null;
  sentiment: 'good' | 'bad';
}) {
  const { session } = roadStore.get();
  if (!session) return null;
  const pos = await currentPosition();
  if (!pos) {
    Alert.alert('Posizione non trovata', 'Aspetta qualche secondo che il GPS trovi la posizione e riprova.');
    return null;
  }
  const clientId = makeClientId();
  const street = roadStore.get().street ?? roadUploader.street;
  const recordedAt = new Date().toISOString();
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
      lat: pos.lat,
      lng: pos.lng,
      street,
      sentiment: input.sentiment,
      recordedAt,
    },
  });
  roadStore.addMarker({
    clientId,
    kind: input.kind,
    label: input.label,
    note,
    lat: pos.lat,
    lng: pos.lng,
    street,
    sentiment: input.sentiment,
    recordedAt,
  });
  void roadUploader.flush(true);
  return clientId;
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
 */
export async function endRoad(): Promise<boolean> {
  const { session } = roadStore.get();
  if (!session) return false;
  roadStore.setPhase('ending');
  await roadUploader.refreshStreet(true);
  await roadUploader.flush(true);
  await stopRoadTracking();
  await roadUploader.flush(true);
  try {
    const detail = await regloApi.endRoadSession(session.id);
    roadUploader.stop();
    roadUploader.onSessionClosed(null);
    roadUploader.resetStreet();
    await roadQueue.detach();
    roadStore.showSummary(detail);
    // segnalazioni ancora in coda (offline): il server le accetta fino a 2 h
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
