import React, { useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayList } from '../../../src/components/clay';
import { SettingStepperRow, SettingToggleRow } from '../../../src/components/SettingsRows';
import { bookingExceptionsDraftStore } from '../../../src/stores/bookingExceptionsDraftStore';
import type { BookingExceptionCases } from '../../../src/stores/bookingExceptionsDraftStore';
import { CLAY } from '../../../src/theme/clay';

const HOURS_MIN = 1;
const HOURS_MAX = 168;

/**
 * «Solo eccezioni»: i casi in cui gli allievi prenotano da soli (stesse voci
 * della web app). Bozza locale, «Fatto» la restituisce al foglio padre che
 * salva tutto insieme.
 */
export default function BookingExceptionsScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(bookingExceptionsDraftStore.subscribe, bookingExceptionsDraftStore.get);
  const [draft, setDraft] = useState<BookingExceptionCases | null>(() => (data ? { ...data.value } : null));
  if (!data || !draft) return <View style={s.empty} />;

  const patch = (p: Partial<BookingExceptionCases>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const anyOn = draft.slotFill || draft.groupSeats || draft.lastMinute;

  return (
    <FormSheet
      title="Solo eccezioni"
      subtitle={data.subtitle}
      testID="booking-exceptions-sheet"
      cta={
        <ClayButton
          title="Fatto"
          disabled={!anyOn}
          onPress={() => {
            data.onConfirm(draft);
            router.back();
          }}
          testID="booking-exceptions-done"
        />
      }
    >
      <ClayList>
        <SettingToggleRow
          title="Slot liberato da un annullamento"
          subtitle="Quando un allievo annulla, gli altri ricevono una notifica: il primo che conferma prende il posto."
          value={draft.slotFill}
          onValueChange={(v) => patch({ slotFill: v })}
          testID="booking-exceptions-slot-fill"
        />
        <SettingToggleRow
          title="Posti liberi nelle guide di gruppo"
          subtitle="Quando si libera un posto in una guida di gruppo, chi partecipa alle guide di gruppo può prenderlo."
          value={draft.groupSeats}
          onValueChange={(v) => patch({ groupSeats: v })}
          testID="booking-exceptions-group-seats"
        />
        <SettingToggleRow
          title="Ultimo minuto"
          subtitle="Gli allievi prenotano da soli i posti ancora vuoti nelle prossime ore."
          value={draft.lastMinute}
          onValueChange={(v) => patch({ lastMinute: v })}
          testID="booking-exceptions-last-minute"
        />
        {draft.lastMinute ? (
          <SettingStepperRow
            title="Ore prima della guida"
            value={draft.lastMinuteHours}
            min={HOURS_MIN}
            max={HOURS_MAX}
            onChange={(v) => patch({ lastMinuteHours: v })}
            testID="booking-exceptions-hours"
          />
        ) : null}
      </ClayList>
      <Text style={s.note}>
        {anyOn
          ? 'Fuori da questi casi le guide le fissi tu. Gli scambi tra allievi non dipendono da qui.'
          : 'Accendi almeno un caso. Se non ne vuoi nessuno, scegli «Disattiva».'}
      </Text>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  note: { fontSize: 13.5, lineHeight: 19, color: CLAY.ink3, marginTop: 12, marginHorizontal: 4 },
});
