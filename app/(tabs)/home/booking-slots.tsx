import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookingFlowStore, type BookingFlowState } from '../../../src/stores/bookingFlowStore';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { formatDay, formatTime } from '../../../src/utils/date';
import { firstName, isSameSlot, slotKey, slotLocationMode } from '../../../src/utils/slotLocation';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { GlassCloseButton, HAS_GLASS_CLOSE } from '../../../src/components/GlassCloseButton';

export default function BookingSlotsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [snapshot] = useState(() => bookingFlowStore.get());
  const [selectedSlot, setSelectedSlot] = useState<BookingFlowState['selectedSlot']>(null);
  const [confirming, setConfirming] = useState(false);

  if (!snapshot) return <View style={s.root} />;

  const { preferredDate, durationMinutes, slots, onConfirmBooking } = snapshot;
  // REG-705e: un luogo solo → sotto il titolo; più luoghi → su ogni slot.
  const locationMode = slotLocationMode(slots);
  const ctaLabel =
    locationMode.mode === 'multi' && selectedSlot?.locationName
      ? `Prenota a ${selectedSlot.locationName} \u2192`
      : 'Prenota \u2192';

  const handleConfirm = () => {
    if (!selectedSlot) return;
    bookingFlowStore.set({ selectedSlot });
    setConfirming(true);
    onConfirmBooking();
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 16 }]}>
      {/* X liquid glass solo dove c'è il vetro (iOS 26): altrove lo sheet resta senza X, come prima. */}
      {HAS_GLASS_CLOSE ? (
        <View style={s.glassCloseRow}>
          <GlassCloseButton onPress={() => router.back()} />
        </View>
      ) : null}
      <Text style={s.title}>Scegli un orario</Text>
      <View style={s.subtitleRow}>
        <Text style={s.subtitle} numberOfLines={1}>
          {formatDay(preferredDate.toISOString())} {'\u2022'} {durationMinutes} min
          {locationMode.mode === 'single' ? ` ${'\u2022'} ` : ''}
        </Text>
        {locationMode.mode === 'single' ? (
          <>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={[s.subtitle, { flexShrink: 1 }]} numberOfLines={1}>{locationMode.name}</Text>
          </>
        ) : null}
      </View>

      {slots.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md }}>
          <Ionicons name="calendar-clear-outline" size={28} color="#D4D4D4" />
          <Text style={s.emptyText}>Nessun orario disponibile{'\n'}per questo giorno</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 40, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {slots.map((slot, idx) => {
            const active = isSameSlot(selectedSlot, slot);
            const last = idx === slots.length - 1;
            const instructorName: string | undefined = (slot as any).instructorName;
            return (
              <View key={slotKey(slot)} style={s.tlRow}>
                <View style={s.tlLeft}>
                  <Text style={s.tlHour}>{formatTime(slot.startsAt)}</Text>
                  {!last && <View style={s.tlLine} />}
                </View>
                <Pressable style={[s.tlCard, active && s.tlCardActive]} onPress={() => setSelectedSlot(slot)}>
                  <View style={s.tlCardBody}>
                    <Text style={active ? s.tlCardTextActive : s.tlCardText}>
                      {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
                    </Text>
                    {locationMode.mode === 'multi' && slot.locationName ? (
                      <View style={s.tlMeta}>
                        <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                        <Text style={[s.tlMetaText, { marginTop: 0 }]} numberOfLines={1}>
                          {slot.locationName}
                          {instructorName ? <Text style={s.tlMetaWho}>{` \u00B7 ${firstName(instructorName)}`}</Text> : null}
                        </Text>
                      </View>
                    ) : instructorName ? (
                      <Text style={s.tlMetaText} numberOfLines={1}>{instructorName}</Text>
                    ) : null}
                  </View>
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
            : <Text style={s.ctaText} numberOfLines={1}>{ctaLabel}</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  glassCloseRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, marginBottom: 4 },
  root: { backgroundColor: colors.background, flex: 1 },
  title: { fontSize: 22, fontWeight: '700', color: '#111111', letterSpacing: -0.4, paddingHorizontal: spacing.md, marginBottom: 6 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, marginBottom: 8 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },
  emptyText: { fontSize: 13, color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 18 },
  footer: { paddingTop: spacing.md, paddingBottom: 34, paddingHorizontal: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  cta: { height: 54, paddingHorizontal: 20, borderRadius: 27, alignItems: 'center', justifyContent: 'center', ...primaryCtaShadow },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: -0.2 },
  // Timeline
  tlRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 62 },
  tlLeft: { width: 52, alignItems: 'center', paddingTop: 16 },
  tlHour: { fontSize: 12, fontWeight: '600', color: '#9C9C9C' },
  tlLine: { width: 1.5, flex: 1, backgroundColor: colors.border, marginTop: 8, minHeight: 20 },
  tlCard: { flex: 1, minHeight: 52, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 10, marginBottom: 10, shadowColor: '#111111', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  tlCardActive: { borderColor: '#111111', borderWidth: 2, shadowOpacity: 0.08 },
  tlCardText: { fontSize: 15, fontWeight: '600', color: '#111111' },
  tlCardTextActive: { fontSize: 15, fontWeight: '600', color: '#111111' },
  tlCardBody: { flex: 1, minWidth: 0 },
  tlMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  tlMetaText: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 3 },
  tlMetaWho: { color: colors.textMuted },
  tlCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center' },
  tlCheckText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
