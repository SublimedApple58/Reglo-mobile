import React, { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { bookingFlowStore, type BookingFlowState } from '../../../src/stores/bookingFlowStore';
import { FormSheet } from '../../../src/components/SheetScaffold';
import {
  ClayButton,
  ClayEmpty,
  ClayList,
  ClayListRow,
  ClaySection,
  markClayRow,
  type ClayRowPosition,
} from '../../../src/components/clay';
import { MORALE_ART } from '../../../src/theme/moraleArt';
import { CLAY } from '../../../src/theme/clay';
import { isSameSlot, slotKey, slotLocationMode } from '../../../src/utils/slotLocation';
import type { AvailableSlot } from '../../../src/types/regloApi';

/**
 * «Orari liberi» (allievo) — clay (anteprima approvata mob-8b, 10/11/2026):
 * IL form sheet con il giorno nel titolo, «60 min · 5 orari liberi» sotto,
 * orari raggruppati in Mattina / Pomeriggio / Sera in liste clay, spunta nera
 * sull'orario scelto, CTA nera «Prenota alle 15:00» con lo spinner.
 * La conferma resta `onConfirmBooking` dello store (niente optimistic update:
 * chiude il genitore a risposta arrivata).
 */

const WEEKDAYS_LONG = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MONTHS_LONG = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];
const formatLongDay = (d: Date) => `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;

/** «9:00» (senza lo zero davanti, come nell'anteprima). */
const hm = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

type SlotWithInstructor = AvailableSlot & { instructorName?: string | null };

const PARTS: Array<{ key: string; title: string; until: number }> = [
  { key: 'morning', title: 'Mattina', until: 13 },
  { key: 'afternoon', title: 'Pomeriggio', until: 19 },
  { key: 'evening', title: 'Sera', until: 24 },
];

export default function BookingSlotsScreen() {
  const router = useRouter();
  const [snapshot] = useState(() => bookingFlowStore.get());
  const [selectedSlot, setSelectedSlot] = useState<BookingFlowState['selectedSlot']>(null);
  const [confirming, setConfirming] = useState(false);

  const slots = (snapshot?.slots ?? []) as SlotWithInstructor[];
  // REG-705e: un luogo solo → nel sottotitolo; più luoghi → su ogni orario.
  const locationMode = useMemo(() => slotLocationMode(slots), [slots]);
  const groups = useMemo(
    () =>
      PARTS.map((part, i) => {
        const from = i === 0 ? 0 : PARTS[i - 1].until;
        return {
          ...part,
          slots: slots.filter((sl) => {
            const h = new Date(sl.startsAt).getHours();
            return h >= from && h < part.until;
          }),
        };
      }).filter((g) => g.slots.length > 0),
    [slots],
  );

  const select = useCallback((slot: SlotWithInstructor) => {
    Haptics.selectionAsync().catch(() => undefined);
    setSelectedSlot(slot);
  }, []);

  if (!snapshot) return <View style={s.empty} />;

  const { preferredDate, durationMinutes, onConfirmBooking } = snapshot;

  const handleConfirm = () => {
    if (!selectedSlot || confirming) return;
    bookingFlowStore.set({ selectedSlot });
    setConfirming(true);
    onConfirmBooking();
  };

  const count = slots.length;
  const subtitle = [
    `${durationMinutes} min`,
    count === 1 ? '1 orario libero' : `${count} orari liberi`,
    locationMode.mode === 'single' ? locationMode.name : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <FormSheet
      title={formatLongDay(preferredDate)}
      subtitle={count ? subtitle : `${durationMinutes} min`}
      testID="booking-slots-sheet"
      busy={confirming}
      cta={
        count ? (
          <ClayButton
            title={selectedSlot ? `Prenota alle ${hm(selectedSlot.startsAt)}` : 'Prenota'}
            onPress={handleConfirm}
            loading={confirming}
            disabled={!selectedSlot}
            testID="booking-slots-confirm"
          />
        ) : undefined
      }
    >
      {count === 0 ? (
        <ClayEmpty
          icon={MORALE_ART.espresso}
          title="Nessun orario libero"
          text="Per questo giorno non ci sono guide libere. Prova un altro giorno."
          action={<ClayButton variant="secondary" title="Cambia giorno" onPress={() => router.back()} />}
          testID="booking-slots-empty"
        />
      ) : (
        groups.map((group, gi) => (
          <ClaySection key={group.key} title={group.title} style={gi === 0 ? s.firstSection : s.section}>
            <ClayList>
              {group.slots.map((slot) => (
                <SlotRow
                  key={slotKey(slot)}
                  slot={slot}
                  active={isSameSlot(selectedSlot, slot)}
                  showLocation={locationMode.mode === 'multi'}
                  onSelect={select}
                />
              ))}
            </ClayList>
          </ClaySection>
        ))
      )}
    </FormSheet>
  );
}

/** Riga di un orario: «9:00 – 10:00», sotto istruttore · luogo, spunta se scelto. */
const SlotRow = markClayRow(
  memo(function SlotRow({
    slot,
    active,
    showLocation,
    onSelect,
    ...pos
  }: ClayRowPosition & {
    slot: SlotWithInstructor;
    active: boolean;
    showLocation: boolean;
    onSelect: (slot: SlotWithInstructor) => void;
  }) {
    const meta = [slot.instructorName, showLocation ? slot.locationName : null].filter(Boolean).join(' · ');
    return (
      <ClayListRow
        {...pos}
        title={`${hm(slot.startsAt)} – ${hm(slot.endsAt)}`}
        subtitle={meta || undefined}
        chevron={false}
        onPress={() => onSelect(slot)}
        trailing={<View style={s.check}>{active ? <Ionicons name="checkmark" size={21} color={CLAY.ink} /> : null}</View>}
        testID={`booking-slot-${hm(slot.startsAt)}`}
      />
    );
  }),
);

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  firstSection: { marginTop: 6 },
  section: { marginTop: 24 },
  check: { width: 22, alignItems: 'center' },
});
