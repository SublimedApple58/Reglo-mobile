/**
 * REG-667 — quale giro apre il foglio «Il giro» (la guida, allievo e durata).
 * Chi apre il foglio lo imposta prima del push; il foglio legge il giro e la
 * linea dal `planStore`, già scaldati dalla riga del dettaglio.
 */
export type GiroSheetData = { appointmentId: string; studentId: string; durationMin: number; studentName?: string | null };

let data: GiroSheetData | null = null;

export const giroSheetStore = {
  set(next: GiroSheetData) {
    data = next;
  },
  get: () => data,
};

export const GIRO_SHEET_ROUTE = '/(tabs)/home/giro';
