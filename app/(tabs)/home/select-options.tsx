import React from 'react';

import { OptionsPickerSheet } from '../../../src/components/OptionsPickerSheet';

/** Content-hugging form sheet — SHORT lists only (see optionsPickerPath). */
export default function SelectOptionsScreen() {
  return <OptionsPickerSheet scrollable={false} />;
}
