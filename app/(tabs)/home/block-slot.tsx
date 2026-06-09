import React from 'react';
import { BlockForm } from '../../../src/components/booking/BlockForm';

/* The "Blocca slot" form lives in the shared <BlockForm> (also reused embedded
 * by the quick-book sheet). This route is the standalone content-hugging shell. */
export default function BlockSlotScreen() {
  return <BlockForm />;
}
