import { ActionSheetIOS, Alert, Platform } from 'react-native';

/**
 * Esito di un esame (REG-513) — gemello mobile di
 * `reglo/lib/autoscuole/exam-outcome.ts`. Stesse etichette, stessi colori,
 * stessa regola su quando un esito è registrabile: due schermate dell'app (il
 * foglio esame e il dettaglio allievo) devono raccontare la stessa cosa.
 */

export const EXAM_OUTCOMES = ['idoneo', 'respinto'] as const;
export type ExamOutcome = (typeof EXAM_OUTCOMES)[number];

export const EXAM_OUTCOME_LABELS: Record<ExamOutcome, string> = {
  idoneo: 'Idoneo',
  respinto: 'Respinto',
};

/** Null-safe: qualunque cosa non sia un esito noto vale "non registrato". */
export const asExamOutcome = (value: unknown): ExamOutcome | null =>
  typeof value === 'string' && (EXAM_OUTCOMES as readonly string[]).includes(value)
    ? (value as ExamOutcome)
    : null;

/** Tinte identiche al web (pill "Idoneo"/"Respinto" del registro allievo). */
export const EXAM_OUTCOME_TONE: Record<ExamOutcome, { border: string; bg: string; ink: string }> = {
  idoneo: { border: '#C5E8D4', bg: '#F0FAF4', ink: '#1A7F50' },
  respinto: { border: '#FAD4CC', bg: '#FFF4F2', ink: '#C13515' },
};

/**
 * Un esito si registra solo su un esame vero (non un segnaposto senza
 * iscritti), non annullato, e non prima che l'esame sia iniziato: un esame di
 * domani non ha un esito, ha una data. La tolleranza di 10 minuti è la stessa
 * dell'esito delle guide.
 */
export const EXAM_OUTCOME_LEAD_MS = 10 * 60 * 1000;

export function canRecordExamOutcome(
  appointment: {
    id?: string;
    type?: string | null;
    status?: string | null;
    studentId?: string | null;
    startsAt: string | Date;
  },
  now: Date = new Date(),
): boolean {
  if ((appointment.type ?? '').trim().toLowerCase() !== 'esame') return false;
  if (!appointment.studentId) return false;
  // Riga ancora non salvata lato server (foglio esame): niente da aggiornare.
  if (appointment.id?.startsWith('pending-')) return false;
  const status = (appointment.status ?? '').trim().toLowerCase();
  if (status === 'cancelled' || status === 'proposal') return false;
  const startsAt =
    appointment.startsAt instanceof Date ? appointment.startsAt : new Date(appointment.startsAt);
  if (Number.isNaN(startsAt.getTime())) return false;
  return startsAt.getTime() - EXAM_OUTCOME_LEAD_MS <= now.getTime();
}

/**
 * Il menu "Esito esame": ActionSheet su iOS, Alert su Android. `onPick` riceve
 * `null` quando si toglie l'esito (voce presente solo se un esito c'è già).
 *
 * Il **numero di patente** non si chiede da qui — arriva quasi sempre giorni
 * dopo, e lo inserisce dal web chi ha la tastiera davanti. Ometterlo non
 * cancella quello eventualmente già registrato.
 */
export function askExamOutcome(opts: {
  title: string;
  current: ExamOutcome | null;
  onPick: (outcome: ExamOutcome | null) => void;
}) {
  const { title, current, onPick } = opts;
  const options = ['Idoneo', 'Respinto', ...(current ? ['Togli esito'] : []), 'Annulla'];
  const cancelIndex = options.length - 1;
  const pick = (i: number) => {
    if (i === 0) onPick('idoneo');
    else if (i === 1) onPick('respinto');
    else if (current && i === 2) onPick(null);
  };
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options,
        cancelButtonIndex: cancelIndex,
        destructiveButtonIndex: current ? 2 : undefined,
      },
      pick,
    );
  } else {
    Alert.alert('Esito esame', title, [
      { text: 'Idoneo', onPress: () => pick(0) },
      { text: 'Respinto', onPress: () => pick(1) },
      ...(current ? [{ text: 'Togli esito', style: 'destructive' as const, onPress: () => pick(2) }] : []),
      { text: 'Annulla', style: 'cancel' as const },
    ]);
  }
}
