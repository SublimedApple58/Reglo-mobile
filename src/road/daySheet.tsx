import React, { type ComponentType } from 'react';
import { SheetNightContext } from '../theme/night';

/**
 * Road novembre R5: i fogli della scheda allievo aperti da Road sono gli
 * STESSI della home (Tiziano: «l'esatto sheet, completo di tutto»). Non hanno
 * una variante notte: di notte restano chiari come nelle tab, invece di
 * prendere a metà i colori scuri dei componenti clay (testo scuro su scuro).
 */
export function dayOnly<P extends object>(Screen: ComponentType<P>) {
  function DaySheet(props: P) {
    return (
      <SheetNightContext.Provider value={false}>
        <Screen {...props} />
      </SheetNightContext.Provider>
    );
  }
  DaySheet.displayName = `DaySheet(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return DaySheet;
}
