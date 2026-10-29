import React from 'react';

import { LessonHistorySheet } from '../../../src/screens/LessonHistorySheet';

/** «Tutte le guide» del dettaglio allievo — registrato in entrambi gli stack
 *  che aprono la scheda allievo (home `student-detail` e notes `[studentId]`). */
export default function LessonHistoryRoute() {
  return <LessonHistorySheet />;
}
