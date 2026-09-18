import type { AutoscuolaAppointment, AutoscuolaSettings } from '../types/regloApi';

/**
 * Pagamento manuale delle guide (REG-450) — lato istruttore/titolare.
 *
 * GEMELLO di `reglo/lib/autoscuole/unpaid-auto-block.ts` (`isCompanyManualMode`,
 * `isLessonUnpaid`): è la STESSA definizione di "guida da pagare" che alimenta
 * il badge del dettaglio allievo web, il contatore della lista allievi e il
 * blocco automatico delle prenotazioni per debito. Le due copie vanno cambiate
 * insieme, altrimenti l'app conta guide diverse dal backend.
 */

const normalizeStatus = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

/** Guide "effettuate": contano come da pagare in modalità manuale. */
const DONE_STATUSES = ['completed', 'checked_in'];
/** Guide saltate: contano solo se l'autoscuola ha deciso di addebitare la penale. */
const MISSED_STATUSES = ['cancelled', 'no_show'];

/**
 * L'autoscuola incassa a mano quando NON usa i pagamenti automatici Stripe e
 * non ha un flusso a crediti, oppure quando i crediti ci sono ma non sono
 * obbligatori per prenotare. Fuori da questa modalità il concetto di "segna
 * pagata" non esiste: i soldi passano dalla sezione Pagamenti.
 */
export function isCompanyManualMode(
  settings: Pick<
    AutoscuolaSettings,
    'autoPaymentsEnabled' | 'lessonCreditFlowEnabled' | 'lessonCreditsRequired'
  > | null | undefined,
): boolean {
  if (!settings) return false;
  const auto = settings.autoPaymentsEnabled === true;
  const credits = settings.lessonCreditFlowEnabled === true;
  // Il BE tratta l'assenza del flag come `true` (credito obbligatorio).
  const creditsRequired = settings.lessonCreditsRequired !== false;
  return (!auto && !credits) || (credits && !creditsRequired);
}

/** Predicato "guida da pagare non saldata". Copia esatta della regola backend. */
export function isLessonUnpaid(
  lesson: Pick<
    AutoscuolaAppointment,
    'status' | 'manualPaymentStatus' | 'creditApplied' | 'lateCancellationAction'
  >,
  manualMode: boolean,
): boolean {
  if (lesson.creditApplied) return false;
  if (lesson.manualPaymentStatus === 'paid') return false;
  const s = normalizeStatus(lesson.status);
  return (
    (DONE_STATUSES.includes(s) && manualMode) ||
    (MISSED_STATUSES.includes(s) &&
      lesson.lateCancellationAction === 'charged' &&
      lesson.manualPaymentStatus === 'unpaid')
  );
}

/**
 * Penale tardiva addebitata e non ancora saldata: è il caso in cui una guida
 * ANNULLATA finisce comunque tra le "da pagare".
 */
export function isPenaltyCharged(
  lesson: Pick<
    AutoscuolaAppointment,
    'status' | 'manualPaymentStatus' | 'lateCancellationAction'
  >,
): boolean {
  return (
    MISSED_STATUSES.includes(normalizeStatus(lesson.status)) &&
    lesson.lateCancellationAction === 'charged' &&
    lesson.manualPaymentStatus === 'unpaid'
  );
}

/** Penale tardiva già saldata. */
export function isPenaltyPaid(
  lesson: Pick<
    AutoscuolaAppointment,
    'status' | 'manualPaymentStatus' | 'lateCancellationAction'
  >,
): boolean {
  return (
    MISSED_STATUSES.includes(normalizeStatus(lesson.status)) &&
    lesson.lateCancellationAction === 'charged' &&
    lesson.manualPaymentStatus === 'paid'
  );
}

/**
 * La riga mostra i pulsanti "Segna pagata / Segna da pagare"?
 * Ricalca `showPaymentToggle` del dettaglio allievo web: con i crediti
 * OBBLIGATORI non si segna nulla a mano (paga il pacchetto); con i crediti
 * facoltativi solo le guide effettuate; senza crediti anche quelle già marcate
 * "unpaid" (tipicamente un posto di guida di gruppo).
 */
export function canToggleLessonPayment(
  lesson: Pick<
    AutoscuolaAppointment,
    'status' | 'manualPaymentStatus' | 'creditApplied' | 'lateCancellationAction'
  >,
  settings: Pick<
    AutoscuolaSettings,
    'autoPaymentsEnabled' | 'lessonCreditFlowEnabled' | 'lessonCreditsRequired'
  > | null | undefined,
): boolean {
  // Una guida coperta da credito è già saldata: nessuna azione.
  if (lesson.creditApplied) return false;

  // Le penali tardive si segnano sempre, anche fuori dai casi qui sotto.
  if (isPenaltyCharged(lesson) || isPenaltyPaid(lesson)) return true;

  if (!isCompanyManualMode(settings)) return false;
  const credits = settings?.lessonCreditFlowEnabled === true;
  const creditsRequired = settings?.lessonCreditsRequired !== false;
  if (credits && creditsRequired) return false;

  const s = normalizeStatus(lesson.status);
  const done = DONE_STATUSES.includes(s);
  return credits ? done : done || lesson.manualPaymentStatus === 'unpaid';
}

/**
 * L'istruttore incassa solo le proprie guide (guardia speculare a quella del
 * backend). Il titolare non ha restrizioni.
 */
export function canActOnLessonPayment(params: {
  lesson: Pick<AutoscuolaAppointment, 'instructorId'>;
  isOwner: boolean;
  /** `session.instructorId` dell'utente corrente, se è un istruttore. */
  myInstructorId: string | null | undefined;
}): boolean {
  if (params.isOwner) return true;
  if (!params.myInstructorId) return false;
  return params.lesson.instructorId === params.myInstructorId;
}
