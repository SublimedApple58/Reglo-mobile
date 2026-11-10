/**
 * Road novembre R5 (Tiziano 10/11/2026): la scheda allievo si apre anche da
 * Road, sopra la mappa, completa di tutto. I fogli che la scheda apre
 * (storico, pagamenti, impostazioni, luoghi, Road dell'allievo, percorso…)
 * vivono in tre stack: `home` e `notes` nelle tab, `road` fuori dalle tab.
 * Da Road vanno aperti DENTRO lo stack `/road` (registrati in
 * `app/road/_layout.tsx`): una rotta delle tab farebbe uscire da Road e il
 * `RoadController` riporterebbe subito alla mappa.
 */
export type StudentSheetStack = 'home' | 'notes' | 'drive' | 'road';

/** Lo stack in cui sta la schermata che apre il foglio. */
export function studentSheetStack(segments: readonly string[]): StudentSheetStack {
  if (segments[0] === 'road') return 'road';
  if (segments.includes('notes')) return 'notes';
  if (segments[1] === 'drive') return 'drive';
  return 'home';
}

/** La rotta del foglio `name` nello stack giusto. */
export function studentSheetHref(stack: StudentSheetStack, name: string): string {
  return stack === 'road' ? `/road/${name}` : `/(tabs)/${stack}/${name}`;
}
