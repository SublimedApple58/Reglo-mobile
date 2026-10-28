import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { Avatar, ClayEmpty, ClayList, ClayListRow, ClaySearchField, ClaySection } from '../../../src/components/clay';
import { swapStore } from '../../../src/stores/swapStore';
import type { AutoscuolaAppointmentWithRelations } from '../../../src/types/regloApi';
import { CLAY } from '../../../src/theme/clay';

const capitalize = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function SwapLessonScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(swapStore.subscribe, swapStore.get);
  const [search, setSearch] = useState('');

  const candidates = data?.candidates ?? [];

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? candidates.filter((a) =>
          `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.toLowerCase().includes(q),
        )
      : candidates;
    const groups: Array<{ title: string; data: AutoscuolaAppointmentWithRelations[] }> = [];
    let key = '';
    let bucket: AutoscuolaAppointmentWithRelations[] = [];
    for (const appt of filtered) {
      const k = new Date(appt.startsAt).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
      if (k !== key) {
        if (bucket.length) groups.push({ title: key, data: bucket });
        key = k;
        bucket = [appt];
      } else {
        bucket.push(appt);
      }
    }
    if (bucket.length) groups.push({ title: key, data: bucket });
    return groups;
  }, [candidates, search]);

  const confirmSwap = (appt: AutoscuolaAppointmentWithRelations) => {
    if (!data) return;
    const targetName = `${appt.student?.firstName ?? ''} ${appt.student?.lastName ?? ''}`.trim() || 'Allievo';
    Alert.alert(
      'Conferma scambio',
      `Scambiare ${data.sourceName} con ${targetName}?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Scambia',
          onPress: async () => {
            const ok = await data.onSwap(appt);
            if (ok) router.back();
          },
        },
      ],
    );
  };

  // REG-639 clay: il form sheet unico che scorre da sé. Ricerca clay, guide
  // raggruppate per giorno in liste clay, orario a destra in testo.
  return (
    <FormSheet
      title="Scambia con…"
      subtitle="Scegli una guida con cui scambiare."
      testID="swap-lesson-sheet"
    >
      <ClaySearchField placeholder="Cerca allievo…" value={search} onChangeText={setSearch} />

      {grouped.length === 0 ? (
        <ClayEmpty title="Nessuna guida disponibile per lo scambio" />
      ) : (
        grouped.map((section, i) => (
          <ClaySection key={section.title} title={capitalize(section.title)} style={i === 0 ? s.first : undefined}>
            <ClayList>
              {section.data.map((appt) => {
                const start = new Date(appt.startsAt);
                const end = appt.endsAt ? new Date(appt.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
                const name = `${appt.student?.firstName ?? ''} ${appt.student?.lastName ?? ''}`.trim();
                return (
                  <ClayListRow
                    key={appt.id}
                    leading={<Avatar userId={appt.student?.id} name={name || '?'} size={40} />}
                    title={name}
                    subtitle={data?.vehiclesEnabled && appt.vehicle?.name ? appt.vehicle.name : undefined}
                    onPress={() => confirmSwap(appt)}
                    chevron={false}
                    trailing={<Text style={s.time}>{hhmm(start)} – {hhmm(end)}</Text>}
                  />
                );
              })}
            </ClayList>
          </ClaySection>
        ))
      )}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  first: { marginTop: 22 },
  time: { fontSize: 15, fontWeight: '500', color: CLAY.ink2 },
});
