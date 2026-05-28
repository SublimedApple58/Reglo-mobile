import React, { useEffect, useSyncExternalStore } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { bookingFlowStore } from '../../../src/stores/bookingFlowStore';
import { formatDay, formatTime } from '../../../src/utils/date';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { SkeletonBlock } from '../../../src/components/Skeleton';

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

  useEffect(() => () => { bookingFlowStore.clear(); }, []);

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
        {step === 1 ? (
          <>
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
          </>
        ) : (
          <>
            {/* Step 2 — Slot selection */}
            <Pressable onPress={() => setField('step', 1)} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}>
              <Ionicons name="arrow-back" size={14} color="#EC4899" />
              <Text style={s.backBtnText}>Cambia preferenze</Text>
            </Pressable>

            <Text style={s.subtitle}>{formatDay(preferredDate.toISOString())} {'\u2022'} {durationMinutes} min</Text>
            <Text style={[s.sectionLabel, { marginBottom: 10 }]}>Orari disponibili</Text>

            {slotsLoading && slots.length === 0 ? (
              <View style={{ minHeight: 280 }}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={s.tlRow}>
                    <View style={s.tlLeft}><SkeletonBlock width={32} height={12} radius={6} />{i < 3 && <View style={s.tlLine} />}</View>
                    <View style={[s.tlCard, { borderColor: 'transparent' }]}><SkeletonBlock width="60%" height={16} radius={8} /></View>
                  </View>
                ))}
              </View>
            ) : slots.length === 0 ? (
              <View style={{ minHeight: 280, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="calendar-clear-outline" size={28} color="rgba(26,18,10,0.15)" />
                <Text style={[s.caption, { marginTop: 8, textAlign: 'center' }]}>Nessun orario disponibile{'\n'}per questo giorno</Text>
              </View>
            ) : (
              <View style={{ paddingBottom: 12 }}>
                {slots.map((slot, idx) => {
                  const active = selectedSlot?.startsAt === slot.startsAt;
                  const last = idx === slots.length - 1;
                  return (
                    <View key={slot.startsAt} style={s.tlRow}>
                      <View style={s.tlLeft}>
                        <Text style={s.tlHour}>{formatTime(slot.startsAt)}</Text>
                        {!last && <View style={s.tlLine} />}
                      </View>
                      <Pressable style={[s.tlCard, active && s.tlCardActive]} onPress={() => setField('selectedSlot', slot)}>
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
              </View>
            )}
          </>
        )}
      </View>

      {/* Footer */}
      <View style={s.footer}>
        {step === 1 ? (
          <>
            {!isDateAvailable && <Text style={s.unavailable}>Nessuna disponibilità per il giorno selezionato</Text>}
            <Pressable
              onPress={loading || !isDateAvailable ? undefined : onSearchSlots}
              disabled={loading || !isDateAvailable}
              style={[s.cta, (loading || !isDateAvailable) && { opacity: 0.5 }]}
            >
              <Text style={s.ctaText}>{loading ? 'Attendi...' : 'Cerca disponibilit\u00e0'}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={loading || !selectedSlot ? undefined : onConfirmBooking}
            disabled={loading || !selectedSlot}
            style={[s.cta, (loading || !selectedSlot) && { opacity: 0.4 }]}
          >
            <Text style={s.ctaText}>{loading ? 'Attendi...' : 'Prenota \u2192'}</Text>
          </Pressable>
        )}
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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.6)', alignSelf: 'flex-start' },
  backBtnText: { fontSize: 12, fontWeight: '600', color: '#EC4899' },
  subtitle: { fontSize: 14, fontWeight: '500', color: '#9CA3AF', marginBottom: 16 },
  footer: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  cta: { backgroundColor: colors.primary, height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  unavailable: { fontSize: 13, fontWeight: '600', color: '#c4334e', textAlign: 'center', marginBottom: 8 },
  // Timeline
  tlRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 62 },
  tlLeft: { width: 52, alignItems: 'center', paddingTop: 16 },
  tlHour: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  tlLine: { width: 1.5, flex: 1, backgroundColor: 'rgba(26,18,10,0.08)', marginTop: 8, minHeight: 20 },
  tlCard: { flex: 1, height: 52, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(26,18,10,0.08)', backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 5 },
  tlCardActive: { backgroundColor: '#1a120a', borderColor: '#1a120a', shadowColor: '#1a120a', shadowOpacity: 0.2 },
  tlCardText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a120a' },
  tlCardTextActive: { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFF' },
  tlCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#ec4899', alignItems: 'center', justifyContent: 'center' },
  tlCheckText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
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
