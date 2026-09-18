import React from 'react';

import { StudentPaymentsScreen } from '../../../src/screens/StudentPaymentsScreen';

/**
 * Registro pagamenti guide dell'allievo (REG-450) — registrato in ENTRAMBI gli
 * stack che aprono la scheda allievo (home `student-detail` e notes
 * `[studentId]`): i due stack non condividono le route.
 */
export default function StudentPaymentsRoute() {
  return <StudentPaymentsScreen />;
}
