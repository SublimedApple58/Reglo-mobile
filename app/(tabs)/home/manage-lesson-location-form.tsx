import React, { useSyncExternalStore } from 'react';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { locationFormStore } from '../../../src/stores/locationFormStore';
import { InlineLocationForm } from '../../../src/components/InlineLocationForm';

/**
 * «Aggiungi luogo» — form sheet unico (FORM_SHEET + FormSheet, REG-639 clay):
 * campi clay nel corpo, «Salva luogo» nella CTA in fondo.
 */
export default function ManageLessonLocationFormScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(locationFormStore.subscribe, locationFormStore.get);

  if (!data) {
    return <FormSheet title="Aggiungi luogo" subtitle="Crea un nuovo punto di ritrovo." />;
  }

  return (
    <InlineLocationForm
      initialValue={data.initial}
      onCancel={() => router.back()}
      onSubmit={async (values) => {
        await data.onSubmit(values);
        router.back();
      }}
      renderLayout={({ body, cta }) => (
        <FormSheet
          title="Aggiungi luogo"
          subtitle="Crea un nuovo punto di ritrovo."
          cta={cta}
          testID="manage-lesson-location-form-sheet"
        >
          {body}
        </FormSheet>
      )}
    />
  );
}
