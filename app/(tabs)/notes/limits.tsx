import React, { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayList } from '../../../src/components/clay';
import { SettingStepperRow, SettingToggleRow, SettingValueRow } from '../../../src/components/SettingsRows';
import { clusterSettingsStore } from '../../../src/stores/clusterSettingsStore';

const WEEKLY_MIN = 1;
const WEEKLY_MAX = 14;

/**
 * «Limiti e orari» del gruppo (REG-639, giro dopo la prova sull'iPhone):
 * form sheet clay alto quanto il contenuto, righe da Impostazioni iOS.
 * Il limite settimanale è uno stepper, gli orari aprono il time picker.
 */
export default function LimitsScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(clusterSettingsStore.subscribe, clusterSettingsStore.get);
  if (!data) return <View style={s.empty} />;

  const {
    companyDefaults: cd,
    bookingCutoffEnabled, setBookingCutoffEnabled,
    bookingCutoffTime, setBookingCutoffTime,
    weeklyLimitEnabled, setWeeklyLimitEnabled,
    weeklyLimit, setWeeklyLimit,
    restrictedTimeEnabled, setRestrictedTimeEnabled,
    restrictedTimeStart, setRestrictedTimeStart,
    restrictedTimeEnd, setRestrictedTimeEnd,
    openTimePicker, saving, onSave,
  } = data;

  const cutoffOn = bookingCutoffEnabled ?? cd.bookingCutoffEnabled;
  const limitOn = weeklyLimitEnabled ?? cd.weeklyBookingLimitEnabled;
  const rangeOn = restrictedTimeEnabled ?? cd.restrictedTimeRangeEnabled;
  const cutoff = bookingCutoffTime ?? cd.bookingCutoffTime;
  const start = restrictedTimeStart ?? cd.restrictedTimeRangeStart;
  const end = restrictedTimeEnd ?? cd.restrictedTimeRangeEnd;

  return (
    <FormSheet
      title="Limiti e orari"
      subtitle="Fino a quando e quanto si prenota"
      busy={saving}
      testID="limits-sheet"
      cta={
        <ClayButton
          title="Salva"
          loading={saving}
          onPress={saving ? undefined : async () => { await onSave(); router.back(); }}
          testID="limits-save"
        />
      }
    >
      <ClayList>
        <SettingToggleRow title="Cutoff prenotazione" subtitle="Dopo quest’ora non si prenota per il giorno dopo" value={cutoffOn} onValueChange={setBookingCutoffEnabled} testID="limits-cutoff" />
        {cutoffOn ? (
          <SettingValueRow title="Orario limite" value={cutoff} onPress={() => openTimePicker(cutoff, setBookingCutoffTime)} testID="limits-cutoff-time" />
        ) : null}
      </ClayList>

      <ClayList style={s.group}>
        <SettingToggleRow title="Limite settimanale" subtitle="Quante guide può prenotare ogni allievo" value={limitOn} onValueChange={setWeeklyLimitEnabled} testID="limits-weekly" />
        {limitOn ? (
          <SettingStepperRow
            title="Guide a settimana"
            value={weeklyLimit ?? cd.weeklyBookingLimit}
            min={WEEKLY_MIN}
            max={WEEKLY_MAX}
            onChange={setWeeklyLimit}
            testID="limits-weekly-stepper"
          />
        ) : null}
      </ClayList>

      <ClayList style={s.group}>
        <SettingToggleRow title="Fascia oraria ristretta" subtitle="Gli allievi prenotano solo in questa fascia" value={rangeOn} onValueChange={setRestrictedTimeEnabled} testID="limits-range" />
        {rangeOn ? (
          <SettingValueRow title="Dalle" value={start} onPress={() => openTimePicker(start, setRestrictedTimeStart)} testID="limits-range-start" />
        ) : null}
        {rangeOn ? (
          <SettingValueRow title="Alle" value={end} onPress={() => openTimePicker(end, setRestrictedTimeEnd)} testID="limits-range-end" />
        ) : null}
      </ClayList>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  group: { marginTop: 18 },
});
