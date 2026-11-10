/**
 * Prenotazione allievi «solo eccezioni»: lettura unica dello stato deciso dal
 * server (`booking-options.bookingPolicy`) + testi condivisi, così home, fogli e
 * avvisi dicono la stessa cosa. Il telefono non decide nulla da solo.
 *
 * Backend precedente (niente `bookingPolicy`): si ricava dai campi storici —
 * `appBookingActors === 'instructors'` → «disattiva», `bookingBlocked` → sospeso.
 */
import type {
  MobileBookingOptions,
  StudentBookingHold,
  StudentBookingMode,
  StudentBookingPolicy,
} from '../types/regloApi';

export type ResolvedStudentBookingPolicy = StudentBookingPolicy & {
  /** Può aprire la prenotazione libera (con la finestra se ultimo minuto). */
  canBookFreely: boolean;
  /** Può prenotare ADESSO qualcosa da solo (libera, ultimo minuto o eccezioni). */
  canTakeSomething: boolean;
};

const OFF = { slotFill: false, groupSeats: false, lastMinute: false, lastMinuteHours: 24 };

export function resolveStudentBookingPolicy(
  options: MobileBookingOptions | null | undefined,
): ResolvedStudentBookingPolicy | null {
  if (!options) return null;
  const policy: StudentBookingPolicy = options.bookingPolicy ?? {
    mode: options.appBookingActors === 'instructors' ? 'closed' : 'open',
    hold: options.bookingBlocked ? 'blocked' : null,
    exceptions: OFF,
    lastMinuteUntil: null,
  };
  const free =
    !policy.hold &&
    (policy.mode === 'open' || (policy.mode === 'exceptions' && policy.exceptions.lastMinute));
  const any =
    free ||
    (!policy.hold &&
      policy.mode === 'exceptions' &&
      (policy.exceptions.slotFill || policy.exceptions.groupSeats));
  return { ...policy, canBookFreely: free, canTakeSomething: any };
}

/** I casi in cui l'allievo può prenotare da solo, per la home e i fogli. */
export type BookingExceptionCase = {
  key: 'slotFill' | 'groupSeats' | 'lastMinute';
  title: string;
  detail: string;
};

export function bookingExceptionCases(policy: StudentBookingPolicy): BookingExceptionCase[] {
  if (policy.mode !== 'exceptions') return [];
  const out: BookingExceptionCase[] = [];
  if (policy.exceptions.slotFill) {
    out.push({
      key: 'slotFill',
      title: 'Un altro allievo annulla la sua guida',
      detail: 'Ti arriva una notifica e il posto è del primo che conferma.',
    });
  }
  if (policy.exceptions.groupSeats) {
    out.push({
      key: 'groupSeats',
      title: 'Si libera un posto in una guida di gruppo',
      detail: 'Lo trovi qui, sotto «Posti liberi».',
    });
  }
  if (policy.exceptions.lastMinute) {
    out.push({
      key: 'lastMinute',
      title: `Restano posti vuoti nelle prossime ${policy.exceptions.lastMinuteHours} ore`,
      detail: 'Li trovi qui, sotto «Posti liberi».',
    });
  }
  return out;
}

const NUMBER_WORDS = ['nessun', 'un', 'due', 'tre'];

/** «Dall'app puoi prenotare solo in questi due casi:» */
export function bookingExceptionsLead(count: number) {
  if (count === 1) return "Dall'app puoi prenotare solo in questo caso:";
  return `Dall'app puoi prenotare solo in questi ${NUMBER_WORDS[count] ?? count} casi:`;
}

/** Perché ora non può prenotare, a parole (null = nessun blocco). */
export function bookingHoldMessage(hold: StudentBookingHold): string | null {
  switch (hold) {
    case 'blocked':
      return 'Le tue prenotazioni sono sospese. Per sbloccarle parla con la segreteria.';
    case 'awaiting':
      return "Il tuo percorso non è ancora stato attivato dall'autoscuola.";
    case 'theory':
      return "Le guide arrivano dopo l'esame di teoria.";
    case 'license_missing':
      return 'Scegli il tuo percorso patente per iniziare a prenotare.';
    default:
      return null;
  }
}

export const isMode = (policy: { mode: StudentBookingMode } | null | undefined, mode: StudentBookingMode) =>
  policy?.mode === mode;
