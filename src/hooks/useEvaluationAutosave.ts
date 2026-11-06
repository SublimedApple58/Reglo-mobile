import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { regloApi } from '../services/regloApi';
import { isOfflineError, queueLessonPatch } from '../road/offlineLesson';

type EvaluationPayload = Array<{ itemId: string; score: number | null; notApplicable?: boolean }>;

/** Attesa dopo l'ultima stellina prima di salvare: un giro di voti = una PATCH. */
const DEBOUNCE_MS = 700;

/**
 * REG-727 (segnalazione Ricca, 06/11): il pagellino del foglio «Dettagli guida»
 * si salva DA SOLO mentre l'istruttore lo compila, così non si perde niente se
 * il foglio si chiude o l'app va in background (prima solo «Salva», che
 * sull'iPad restava fuori dallo schermo).
 *
 * - Ogni cambio di voti parte dopo `DEBOUNCE_MS`; chiusura del foglio e
 *   background mandano SUBITO quello che è in attesa.
 * - Si salva solo il pagellino (`{ evaluations }`, sostituzione integrale come
 *   il Salva): tipo, note ed esito restano sul Salva.
 * - Da Road senza rete i voti vanno in coda (REG-714) e partono da soli.
 * - `onSaved(key)` arriva solo a salvataggio riuscito (o in coda): è lì che il
 *   foglio sposta la sua firma «salvata». Se fallisce la modifica resta non
 *   salvata e il Salva / la conferma di chiusura la coprono come prima.
 */
export function useEvaluationAutosave(opts: {
  appointmentId: string | null;
  /** false = non salvare (non caricato, non modificabile, guida non ancora effettuata). */
  enabled: boolean;
  fromRoad: boolean;
  /** Firma del pagellino corrente e di quello salvato (`evalKeyOf`). */
  currentKey: string;
  savedKey: string;
  payload: EvaluationPayload;
  onSaved: (key: string) => void;
  /** Una volta, alla chiusura, se almeno un salvataggio è andato: chi ha aperto il foglio rilegge. */
  onClosedAfterSave?: () => void;
}) {
  const latest = useRef(opts);
  latest.current = opts;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedOnce = useRef(false);

  const flush = useRef(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const o = latest.current;
    if (!o.enabled || !o.appointmentId || o.currentKey === o.savedKey) return;
    const { appointmentId, currentKey, payload, fromRoad } = o;
    try {
      await regloApi.updateAppointmentDetails(appointmentId, { evaluations: payload });
    } catch (err) {
      if (!fromRoad || !isOfflineError(err)) return;
      await queueLessonPatch(appointmentId, 'evaluations', { evaluations: payload });
    }
    savedOnce.current = true;
    latest.current.onSaved(currentKey);
  }).current;

  useEffect(() => {
    if (!opts.enabled || opts.currentKey === opts.savedKey) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
  }, [opts.enabled, opts.currentKey, opts.savedKey, flush]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flush();
    });
    return () => {
      sub.remove();
      // Chiusura: parte quello che è in attesa, poi chi ha aperto rilegge.
      void flush()
        .catch(() => undefined)
        .then(() => {
          if (savedOnce.current) latest.current.onClosedAfterSave?.();
        });
    };
  }, [flush]);

  /** Per il Salva: manda il pagellino nella sua PATCH, il timer non serve più. */
  return {
    cancelPending: () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    },
  };
}
