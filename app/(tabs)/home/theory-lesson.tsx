import React from 'react';
import { BlockForm } from '../../../src/components/booking/BlockForm';

/* La "Lezione teorica" riusa <BlockForm> (stesso store/endpoint di "Blocca
 * slot"): la modalità è pilotata da blockSheetStore.kind === 'theory', che forza
 * reason "theory_lesson", nasconde il motivo e mostra l'avviso bloccante. */
export default function TheoryLessonScreen() {
  return <BlockForm />;
}
