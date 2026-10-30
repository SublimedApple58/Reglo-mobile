import React from 'react';
import { BlockForm } from '../../../src/components/booking/BlockForm';

/* The "Blocca slot" form lives in the shared <BlockForm> (the agenda's
 * ghost uses its `quick` variant, `home/quick-block`). Renders its own FormSheet (FORM_SHEET). */
export default function BlockSlotScreen() {
  return <BlockForm />;
}
