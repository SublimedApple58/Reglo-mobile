import React, { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FormSheet } from '../SheetScaffold';
import { ClayList, ClayListRow } from '../clay';
import { StudentWeekStrip } from './StudentWeekStrip';
import { NotAvailable } from './StudentAvailabilityEditor';
import { studentAvailabilitySheetStore } from '../../stores/studentAvailabilitySheetStore';
import { CLAY } from '../../theme/clay';
import { DEFAULT_BANDS, WEEK, bandsText, hoursText } from '../../utils/studentAvailability';

const confirmedLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'Europe/Rome' });

/**
 * REG-802 — «Disponibilità di Giulia»: quello che l'allievo ha indicato, in
 * sola lettura per istruttore e titolare (nessuna CTA). Si apre dal dettaglio
 * allievo; i dati li ha già caricati lui.
 */
export function StudentAvailabilityStaffSheet() {
  const data = useSyncExternalStore(studentAvailabilitySheetStore.subscribe, studentAvailabilitySheetStore.get);
  if (!data) return <View style={s.empty} />;
  const { firstName, payload } = data;
  const bands = payload?.bands?.length ? payload.bands : DEFAULT_BANDS;
  const days = payload?.days ?? {};
  const has = Boolean(payload?.hasAvailability);
  const subtitle = !has
    ? 'Non ancora indicate'
    : payload?.confirmedAt
      ? `Indicate da ${firstName} il ${confirmedLabel(payload.confirmedAt)}`
      : `Indicate da ${firstName}`;

  return (
    <FormSheet title={`Disponibilità di ${firstName}`} subtitle={subtitle} testID="student-availability-staff-sheet">
      <StudentWeekStrip days={days} bands={bands} title={`La settimana di ${firstName}`} />
      <ClayList style={s.gap}>
        {WEEK.map((d) => {
          const label = bandsText(days[d.key], bands);
          return (
            <ClayListRow
              key={d.key}
              title={d.full}
              subtitle={label ? `${label} · ${hoursText(days[d.key], bands)}` : <NotAvailable />}
            />
          );
        })}
      </ClayList>
      <Text style={s.foot}>
        {has
          ? `Non vincolano le prenotazioni: ${firstName} può prenotare anche in altri orari.`
          : `L'app gliele chiede al prossimo accesso. Finché mancano non riceve gli avvisi dei posti liberi.`}
      </Text>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { flex: 1, backgroundColor: '#FFFFFF' },
  gap: { marginTop: 14 },
  foot: { fontSize: 13.5, lineHeight: 19, color: CLAY.ink3, marginTop: 14, paddingHorizontal: 4 },
});
