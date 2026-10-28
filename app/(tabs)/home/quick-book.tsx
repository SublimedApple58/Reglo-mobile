import React, { useState } from 'react';

import { BookingForm } from '../../../src/components/booking/BookingForm';
import { BlockForm } from '../../../src/components/booking/BlockForm';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClaySegmented } from '../../../src/components/clay';

type Mode = 'lesson' | 'block';

/* ───────── Quick-book sheet ─────────
 * Si apre dal buco libero della vista Giorno o dal blocco fantasma della
 * Settimana. Il form sheet unico (FORM_SHEET + FormSheet, REG-639 clay): la
 * testata è il segmentato clay, il corpo è uno degli STESSI moduli delle route
 * dedicate — <BookingForm> / <BlockForm> in modalità `embedded`, che rendono
 * contenuto + riepilogo + CTA in coda. Il genitore (IstruttoreHomeScreen) riempie
 * bookingSheetStore + blockSheetStore con l'orario. Cambiando modalità i due
 * moduli si scambiano in dissolvenza (`contentKey`). */
export default function QuickBookScreen() {
  const [mode, setMode] = useState<Mode>('lesson');

  return (
    <FormSheet
      title={
        <ClaySegmented
          options={[
            { value: 'lesson', label: 'Prenota guida', testID: 'quick-book-lesson' },
            { value: 'block', label: 'Blocca orario', testID: 'quick-book-block' },
          ]}
          value={mode}
          onChange={setMode}
        />
      }
      contentKey={mode}
      testID="quick-book-sheet"
    >
      {mode === 'lesson' ? <BookingForm embedded /> : <BlockForm embedded />}
    </FormSheet>
  );
}
