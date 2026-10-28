import React from 'react';
import { BlockForm } from '../../../src/components/booking/BlockForm';

/* The "Blocca slot" form lives in the shared <BlockForm> (also reused embedded
 * by the quick-book sheet). Standalone it renders its own FormSheet (FORM_SHEET). */
export default function BlockSlotScreen() {
  return <BlockForm />;
}
