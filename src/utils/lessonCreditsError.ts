/**
 * REG-784 — il server rifiuta la prenotazione dell'allievo con
 * `code: "LESSON_CREDITS_REQUIRED"` e `lessonCreditsData` quando i crediti non
 * coprono la guida. Qui diventano i parametri del foglio `home/credits-needed`.
 */
export type CreditsSheetParams = { title: string; line: string; cta: string };

export function lessonCreditsSheetParams(err: unknown): CreditsSheetParams | null {
  const payload = (err as { payload?: Record<string, unknown> } | null)?.payload;
  if (payload?.code !== 'LESSON_CREDITS_REQUIRED') return null;
  const data = (payload.lessonCreditsData ?? {}) as {
    title?: string;
    unit?: string;
    available?: number;
    availableLabel?: string;
  };
  const partial = data.unit === 'minutes' && (data.available ?? 0) > 0;
  return {
    title: data.title || 'Crediti finiti',
    line: partial ? `Hai ${data.availableLabel}: scegli una guida più corta.` : 'Ricarica in segreteria e prenoti.',
    cta: partial ? 'Scegli un’altra guida' : 'Ho capito',
  };
}
