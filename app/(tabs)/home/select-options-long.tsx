import React from 'react';

import { OptionsPickerSheet } from '../../../src/components/OptionsPickerSheet';

/** Full-height page sheet with a scrollable body — LONG lists (students, fleets). */
export default function SelectOptionsLongScreen() {
  return <OptionsPickerSheet scrollable />;
}
