import React, { useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { bookingFlowStore } from '../../../src/stores/bookingFlowStore';
import { formatDay } from '../../../src/utils/date';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const formatLessonType = (value: string | null | undefined) => {
  const map: Record<string, string> = {
    manovre: 'Manovre', urbano: 'Urbano', extraurbano: 'Extraurbano',
    notturna: 'Notturna', autostrada: 'Autostrada', guida: 'Guida',
  };
  return map[(value ?? '').trim().toLowerCase()] ?? value ?? 'Guida';
};

const BOOKING_WEEKDAYS = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'] as const;

export default function BookingFlowScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(bookingFlowStore.subscribe, bookingFlowStore.get);

  // Don't clear store on unmount — booking-slots reads from it.
  // Store is cleared by onClose callback when navigating back to home.

  if (!data) return <View style={s.root} />;

  const {
    step, preferredDate, durationMinutes, selectedLessonTypes, selectedInstructorId,
    slots, slotsLoading, selectedSlot, loading, preferredDateAvailable,
    availableDurations, availableLessonTypes, canSelectLessonType, canSelectInstructor,
    isLockedToInstructor, assignedInstructorName, visibleInstructors,
    creditFlowEnabled, creditsAvailable, autoPaymentsEnabled,
    calendarOpen, calendarMonths, bookingMaxDate, bookedDatesSet, unavailableDatesSet,
    onSearchSlots, onConfirmBooking, onClose,
  } = data;

  const setField = <K extends keyof typeof data>(key: K, value: (typeof data)[K]) =>
    bookingFlowStore.set({ [key]: value } as any);

  // Recompute availability from current preferredDate + unavailableDatesSet
  const dateKey = `${preferredDate.getFullYear()}-${preferredDate.getMonth()}-${preferredDate.getDate()}`;
  const isDateAvailable = !unavailableDatesSet.has(dateKey);

  const handleClose = () => { router.back(); onClose(); };

  return (
    <View style={s.root}>
      {/* Title row */}
      <View style={s.titleRow}>
        <Text style={s.title}>{step === 1 ? 'Prenota una guida' : 'Scegli un orario'}</Text>
        {(autoPaymentsEnabled || creditFlowEnabled) && (
          <View style={s.creditsBadge}>
            <Text style={s.creditsText}>Crediti: {creditsAvailable}</Text>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: spacing.md, paddingBottom: 20, gap: 28 }}>
        {/* Giorno */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Giorno</Text>
          <Pressable
            style={({ pressed }) => [s.dateCard, pressed && { opacity: 0.85 }]}
            onPress={() => setField('calendarOpen', true)}
          >
            <Image source={require('../../../assets/icons/fluent-calendar.png')} style={s.dateIcon} />
            <View style={{ flex: 1 }}>
              <Text style={s.dateText}>{formatDay(preferredDate.toISOString())}</Text>
              <Text style={s.dateHint}>Scegli quando guidare</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Durata */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Durata</Text>
          {availableDurations.length === 1 ? (
            <Text style={s.durationSingle}>{availableDurations[0]} min</Text>
          ) : (
            <View style={s.chipRow}>
              {availableDurations.map((d) => {
                const active = durationMinutes === d;
                const label = d >= 60 ? (d === 60 ? '1 ora' : d === 90 ? '1 ora e mezza' : `${d / 60} ore`) : `${d} min`;
                return (
                  <Pressable key={d} style={[s.chip, active && s.chipActive]} onPress={() => setField('durationMinutes', d)}>
                    <Text style={active ? s.chipTextActive : s.chipText}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Tipo guida */}
        {canSelectLessonType && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Tipo guida</Text>
            <View style={s.chipRow}>
              {availableLessonTypes.map((lt) => {
                const active = selectedLessonTypes.includes(lt);
                return (
                  <Pressable key={lt} style={[s.chip, active && s.chipActive]} onPress={() => {
                    const next = active
                      ? selectedLessonTypes.filter((t) => t !== lt)
                      : [...selectedLessonTypes, lt];
                    setField('selectedLessonTypes', next.length ? next : [lt]);
                  }}>
                    <Text style={active ? s.chipTextActive : s.chipText}>{formatLessonType(lt)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Istruttore */}
        {isLockedToInstructor && assignedInstructorName ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Istruttore</Text>
            <View style={s.chipRow}>
              <View style={[s.chip, s.chipActive, { opacity: 1 }]}>
                <Text style={s.chipTextActive}>{assignedInstructorName}</Text>
              </View>
            </View>
            <Text style={s.caption}>Istruttore assegnato dal tuo cluster.</Text>
          </View>
        ) : canSelectInstructor && visibleInstructors.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Istruttore</Text>
            <View style={s.chipRow}>
              {visibleInstructors.length > 1 && (
                <Pressable style={[s.chip, !selectedInstructorId && s.chipActive]} onPress={() => setField('selectedInstructorId', null)}>
                  <Text style={!selectedInstructorId ? s.chipTextActive : s.chipText}>Tutti</Text>
                </Pressable>
              )}
              {visibleInstructors.map((instr) => {
                const active = selectedInstructorId === instr.id;
                return (
                  <Pressable key={instr.id} style={[s.chip, active && s.chipActive]} onPress={() => setField('selectedInstructorId', instr.id)}>
                    <Text style={active ? s.chipTextActive : s.chipText}>{instr.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.caption}>
              {visibleInstructors.length < 10 ? 'Solo gli istruttori disponibili per questo giorno.' : 'Se non scegli, vedrai proposte con tutti gli istruttori.'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Footer */}
      <View style={s.footer}>
        {!isDateAvailable && <Text style={s.unavailable}>Nessuna disponibilità per il giorno selezionato</Text>}
        <Pressable
          onPress={loading || !isDateAvailable ? undefined : onSearchSlots}
          disabled={loading || !isDateAvailable}
          style={({ pressed }) => [s.cta, (loading || !isDateAvailable) && { opacity: 0.5 }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={s.ctaText}>Cerca disponibilità</Text>
          }
        </Pressable>
      </View>

      {/* Calendar modal */}
      <Modal visible={calendarOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setField('calendarOpen', false)}>
        <View style={s.calRoot}>
          <View style={s.calHandle} />
          <View style={s.calTitleRow}>
            <Text style={s.calTitle}>Scegli il giorno</Text>
            <Pressable onPress={() => setField('calendarOpen', false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: spacing.md, marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>{formatDay(preferredDate.toISOString())}</Text>
          </View>
          <View style={[s.wdRow, { paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: 8 }]}>
            {BOOKING_WEEKDAYS.map((wd) => <View key={wd} style={s.wdCell}><Text style={s.wdText}>{wd}</Text></View>)}
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {calendarMonths.map((mo) => {
              const todayNow = new Date(); todayNow.setHours(0, 0, 0, 0);
              return (
                <View key={`${mo.year}-${mo.month}`} style={{ marginTop: 24 }}>
                  <Text style={s.monthLabel}>{mo.label}</Text>
                  <View style={[s.grid, { marginTop: 12 }]}>
                    {mo.cells.map((date, idx) => {
                      const inMonth = date.getMonth() === mo.month && date.getFullYear() === mo.year;
                      const isToday = date.getTime() === todayNow.getTime();
                      const isSel = date.getFullYear() === preferredDate.getFullYear() && date.getMonth() === preferredDate.getMonth() && date.getDate() === preferredDate.getDate();
                      const inRange = date >= todayNow && date <= bookingMaxDate;
                      const dk = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                      const isUnavail = inMonth && inRange && unavailableDatesSet.has(dk);
                      const tappable = inMonth && inRange && !isUnavail;
                      const hasBooking = inMonth && bookedDatesSet.has(dk);
                      if (!inMonth) return <View key={`e-${mo.month}-${idx}`} style={s.dayWrap} />;
                      return (
                        <Pressable key={`c-${mo.month}-${idx}`} onPress={tappable ? () => { bookingFlowStore.set({ preferredDate: date, calendarOpen: false }); } : undefined} disabled={!tappable} style={s.dayWrap}>
                          <View style={[s.dayCell, isToday && s.dayCellToday, isSel && s.dayCellSel]}>
                            <Text style={[s.dayText, isToday && s.dayTextToday, isSel && s.dayTextSel, (inMonth && (!inRange || isUnavail)) && { color: 'rgba(26,18,10,0.25)' }]}>{date.getDate()}</Text>
                          </View>
                          {hasBooking && <View style={[s.dayDot, (isSel || isToday) && { backgroundColor: '#fff' }]} />}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
  creditsBadge: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(26,18,10,0.08)', paddingHorizontal: 12, paddingVertical: 5 },
  creditsText: { fontSize: 12, fontWeight: '700', color: '#1a120a' },
  section: { gap: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  dateCard: { backgroundColor: '#FFF', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(26,18,10,0.08)', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 5 },
  dateIcon: { width: 42, height: 42 },
  dateText: { fontSize: 16, fontWeight: '700', color: '#1a120a' },
  dateHint: { fontSize: 12, fontWeight: '400', color: '#9CA3AF', marginTop: 2 },
  durationSingle: { fontSize: 16, fontWeight: '700', color: '#1a120a' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { height: 46, paddingHorizontal: 22, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#1a120a', borderColor: '#1a120a' },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  caption: { fontSize: 12, color: '#9CA3AF', marginTop: 6, lineHeight: 16 },
  footer: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  cta: { backgroundColor: colors.primary, height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  unavailable: { fontSize: 13, fontWeight: '600', color: '#c4334e', textAlign: 'center', marginBottom: 8 },
  // Calendar
  calRoot: { flex: 1, backgroundColor: colors.background, paddingTop: 12 },
  calHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 16 },
  calTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginBottom: 16 },
  calTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
  wdRow: { flexDirection: 'row', marginBottom: 6 },
  wdCell: { flex: 1, alignItems: 'center' },
  wdText: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayWrap: { width: '14.28%', alignItems: 'center', paddingVertical: 4 },
  dayCell: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayCellToday: { borderWidth: 2, borderColor: '#ec4899' },
  dayCellSel: { backgroundColor: '#1a120a' },
  dayText: { fontSize: 15, fontWeight: '500', color: '#1a120a' },
  dayTextToday: { fontWeight: '700', color: '#ec4899' },
  dayTextSel: { fontWeight: '700', color: '#FFF' },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#ec4899', marginTop: 2 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#1a120a' },
});
