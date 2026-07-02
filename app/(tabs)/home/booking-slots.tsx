import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookingFlowStore, type BookingFlowState } from '../../../src/stores/bookingFlowStore';
import { GradientCTABackground } from '../../../src/components/GradientCTA';
import { formatDay, formatTime } from '../../../src/utils/date';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function BookingSlotsScreen() {
  const insets = useSafeAreaInsets();
  const [snapshot] = useState(() => bookingFlowStore.get());
  const [selectedSlot, setSelectedSlot] = useState<BookingFlowState['selectedSlot']>(null);
  const [confirming, setConfirming] = useState(false);

  if (!snapshot) return <View style={s.root} />;

  const { preferredDate, durationMinutes, slots, onConfirmBooking } = snapshot;

  const handleConfirm = () => {
    if (!selectedSlot) return;
    bookingFlowStore.set({ selectedSlot });
    setConfirming(true);
    onConfirmBooking();
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 16 }]}>
      <Text style={s.title}>Scegli un orario</Text>
      <Text style={s.subtitle}>
        {formatDay(preferredDate.toISOString())} {'\u2022'} {durationMinutes} min
      </Text>

      {slots.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md }}>
          <Ionicons name="calendar-clear-outline" size={28} color="#CBD5E1" />
          <Text style={s.emptyText}>Nessun orario disponibile{'\n'}per questo giorno</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 40, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {slots.map((slot, idx) => {
            const active = selectedSlot?.startsAt === slot.startsAt;
            const last = idx === slots.length - 1;
            return (
              <View key={slot.startsAt} style={s.tlRow}>
                <View style={s.tlLeft}>
                  <Text style={s.tlHour}>{formatTime(slot.startsAt)}</Text>
                  {!last && <View style={s.tlLine} />}
                </View>
                <Pressable style={[s.tlCard, active && s.tlCardActive]} onPress={() => setSelectedSlot(slot)}>
                  <Text style={active ? s.tlCardTextActive : s.tlCardText}>
                    {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
                  </Text>
                  {(slot as any).instructorName && (
                    <Text style={[active ? s.tlCardTextActive : s.tlCardText, { fontSize: 12, fontWeight: '400', flex: 0 }]}>
                      {(slot as any).instructorName}
                    </Text>
                  )}
                  {active && <View style={s.tlCheck}><Text style={s.tlCheckText}>{'\u2713'}</Text></View>}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Footer */}
      <View style={s.footer}>
        <Pressable
          onPress={confirming || !selectedSlot ? undefined : handleConfirm}
          disabled={confirming || !selectedSlot}
          style={[s.cta, (confirming || !selectedSlot) && { opacity: 0.4 }]}
        >
          <GradientCTABackground radius={27} />
          {confirming
            ? <ActivityIndicator color="#FFF" />
            : <Text style={s.ctaText}>Prenota {'\u2192'}</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, flex: 1 },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.4, paddingHorizontal: spacing.md, marginBottom: 6 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted, paddingHorizontal: spacing.md, marginBottom: 8 },
  emptyText: { fontSize: 13, color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 18 },
  footer: { paddingTop: spacing.md, paddingBottom: 34, paddingHorizontal: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  cta: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: -0.2 },
  // Timeline
  tlRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 62 },
  tlLeft: { width: 52, alignItems: 'center', paddingTop: 16 },
  tlHour: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  tlLine: { width: 1.5, flex: 1, backgroundColor: colors.border, marginTop: 8, minHeight: 20 },
  tlCard: { flex: 1, minHeight: 52, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 10, marginBottom: 10, shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  tlCardActive: { borderColor: '#1A1A2E', borderWidth: 2, shadowOpacity: 0.08 },
  tlCardText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  tlCardTextActive: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  tlCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  tlCheckText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
