import React from 'react';

import { BlockForm } from '../../../src/components/booking/BlockForm';

/** REG-671 — «Blocca l'orario» / «Lezione teorica» dal blocco fantasma dell'agenda. */
export default function QuickBlockScreen() {
  return <BlockForm variant="quick" />;
}
