import React, { useSyncExternalStore } from 'react';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { locationPickerStore } from '../../../src/stores/locationPickerStore';
import { InlineLocationPicker } from '../../../src/components/InlineLocationPicker';
import { ClayButton } from '../../../src/components/clay';

/**
 * «Cambia luogo» — form sheet unico (FORM_SHEET + FormSheet, REG-639 clay).
 * I luoghi sono righe di una lista clay dentro il foglio (scorre da sé);
 * «Aggiungi nuovo luogo» è la CTA (secondaria) in fondo.
 */
export default function ManageLessonLocationScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(locationPickerStore.subscribe, locationPickerStore.get);

  return (
    <FormSheet
      title="Cambia luogo"
      subtitle="Dove inizia questa guida."
      testID="manage-lesson-location-sheet"
      cta={
        data ? (
          <ClayButton
            title="Aggiungi nuovo luogo"
            variant="secondary"
            onPress={data.onRequestCreate}
            testID="location-add"
          />
        ) : undefined
      }
    >
      {data ? (
        <InlineLocationPicker
          showSearch={false}
          selectedLocationId={data.selectedLocationId}
          onSelect={(loc) => { data.onSelect(loc); router.back(); }}
        />
      ) : null}
    </FormSheet>
  );
}
