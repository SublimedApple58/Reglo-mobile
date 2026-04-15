import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { SelectableChip } from '../components/SelectableChip';
import { TimePickerDrawer } from '../components/TimePickerDrawer';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { regloApi } from '../services/regloApi';
import { colors, spacing } from '../theme';

const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;

const timeStringToDate = (hhmm: string | undefined | null): Date => {
  const safe = hhmm ?? '08:00';
  const [h, m] = safe.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 8, m ?? 0, 0, 0);
  return d;
};

const dateToTimeString = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export const ClusterSettingsScreen = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [bookingSlotDurations, setBookingSlotDurations] = useState<number[]>([30, 60]);
  const [roundedHoursOnly, setRoundedHoursOnly] = useState(false);
  const [companyDefaults, setCompanyDefaults] = useState<{ bookingSlotDurations: number[]; roundedHoursOnly: boolean; swapEnabled: boolean; bookingCutoffEnabled: boolean; bookingCutoffTime: string; weeklyBookingLimitEnabled: boolean; weeklyBookingLimit: number; weeklyAbsenceEnabled: boolean; restrictedTimeRangeEnabled: boolean; restrictedTimeRangeStart: string; restrictedTimeRangeEnd: string }>({
    bookingSlotDurations: [30, 60],
    roundedHoursOnly: false,
    swapEnabled: false,
    bookingCutoffEnabled: false,
    bookingCutoffTime: '18:00',
    weeklyBookingLimitEnabled: false,
    weeklyBookingLimit: 3,
    weeklyAbsenceEnabled: false,
    restrictedTimeRangeEnabled: false,
    restrictedTimeRangeStart: '08:00',
    restrictedTimeRangeEnd: '13:00',
  });
  const [saving, setSaving] = useState(false);
  // New cluster booking settings
  const [swapEnabled, setSwapEnabled] = useState<boolean | undefined>(undefined);
  const [bookingCutoffEnabled, setBookingCutoffEnabled] = useState<boolean | undefined>(undefined);
  const [bookingCutoffTime, setBookingCutoffTime] = useState<string | undefined>(undefined);
  const [weeklyLimitEnabled, setWeeklyLimitEnabled] = useState<boolean | undefined>(undefined);
  const [weeklyLimit, setWeeklyLimit] = useState<number | undefined>(undefined);
  const [weeklyAbsenceEnabled, setWeeklyAbsenceEnabled] = useState<boolean | undefined>(undefined);
  const [restrictedTimeEnabled, setRestrictedTimeEnabled] = useState<boolean | undefined>(undefined);
  const [restrictedTimeStart, setRestrictedTimeStart] = useState<string | undefined>(undefined);
  const [restrictedTimeEnd, setRestrictedTimeEnd] = useState<string | undefined>(undefined);
  // Drawer visibility
  const [cutoffDrawerOpen, setCutoffDrawerOpen] = useState(false);
  const [restrictedStartDrawerOpen, setRestrictedStartDrawerOpen] = useState(false);
  const [restrictedEndDrawerOpen, setRestrictedEndDrawerOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await regloApi.getInstructorSettings();
      setCompanyDefaults(res.companyDefaults);
      setBookingSlotDurations(
        res.settings.bookingSlotDurations ?? res.companyDefaults.bookingSlotDurations,
      );
      setRoundedHoursOnly(
        res.settings.roundedHoursOnly ?? res.companyDefaults.roundedHoursOnly,
      );
      setSwapEnabled(res.settings.swapEnabled);
      setBookingCutoffEnabled(res.settings.bookingCutoffEnabled);
      setBookingCutoffTime(res.settings.bookingCutoffTime);
      setWeeklyLimitEnabled(res.settings.weeklyBookingLimitEnabled);
      setWeeklyLimit(res.settings.weeklyBookingLimit);
      setWeeklyAbsenceEnabled(res.settings.weeklyAbsenceEnabled);
      setRestrictedTimeEnabled(res.settings.restrictedTimeRangeEnabled);
      setRestrictedTimeStart(res.settings.restrictedTimeRangeStart);
      setRestrictedTimeEnd(res.settings.restrictedTimeRangeEnd);
    } catch {
      setToast({ text: 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleDuration = (dur: number) => {
    setBookingSlotDurations((prev) =>
      prev.includes(dur) ? prev.filter((d) => d !== dur) : [...prev, dur].sort((a, b) => a - b),
    );
  };

  const handleSave = async () => {
    if (!bookingSlotDurations.length) {
      setToast({ text: 'Seleziona almeno una durata', tone: 'danger' });
      return;
    }
    setSaving(true);
    try {
      await regloApi.updateInstructorSettings({
        bookingSlotDurations,
        roundedHoursOnly,
        swapEnabled,
        bookingCutoffEnabled,
        bookingCutoffTime,
        weeklyBookingLimitEnabled: weeklyLimitEnabled,
        weeklyBookingLimit: weeklyLimit,
        weeklyAbsenceEnabled,
        restrictedTimeRangeEnabled: restrictedTimeEnabled,
        restrictedTimeRangeStart: restrictedTimeStart,
        restrictedTimeRangeEnd: restrictedTimeEnd,
      });
      setToast({ text: 'Impostazioni salvate', tone: 'success' });
    } catch {
      setToast({ text: 'Errore nel salvataggio', tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={loadData} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Header */}
        <Pressable style={styles.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
          <Text style={styles.backTitle}>Il mio gruppo</Text>
        </Pressable>

        <Text style={styles.pageDesc}>
          Configura come i tuoi allievi possono prenotare le guide con te.
        </Text>

        {loading ? (
          <SkeletonCard style={{ padding: 16, borderRadius: 20 }}>
            <SkeletonBlock width="60%" height={16} radius={6} />
            <SkeletonBlock width="80%" height={40} radius={12} />
            <SkeletonBlock width="50%" height={16} radius={6} />
          </SkeletonCard>
        ) : (
          <>
            {/* Durata guide */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Durata guide</Text>
              <Text style={styles.sectionDesc}>
                Seleziona le durate che i tuoi allievi possono prenotare.
                {'\n'}Predefinito autoscuola: {companyDefaults.bookingSlotDurations.map((d) => `${d} min`).join(', ')}
              </Text>
              <View style={styles.chipsRow}>
                {DURATION_OPTIONS.map((dur) => (
                  <SelectableChip
                    key={dur}
                    label={`${dur} min`}
                    active={bookingSlotDurations.includes(dur)}
                    onPress={() => toggleDuration(dur)}
                  />
                ))}
              </View>
            </View>

            {/* Solo orari tondi */}
            <View style={styles.toggleCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Solo orari tondi</Text>
                <Text style={styles.toggleDesc}>
                  Gli allievi vedranno solo slot che iniziano a ore piene (es. 9:00, 10:00).
                </Text>
              </View>
              <Switch
                value={roundedHoursOnly}
                onValueChange={setRoundedHoursOnly}
                trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Scambio guide */}
            <View style={styles.toggleCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Scambio guide</Text>
                <Text style={styles.toggleDesc}>
                  {swapEnabled === undefined ? `Default azienda: ${companyDefaults.swapEnabled ? 'Attivo' : 'Disattivo'}` : swapEnabled ? 'Attivo' : 'Disattivo'}
                </Text>
              </View>
              <Switch
                value={swapEnabled ?? companyDefaults.swapEnabled}
                onValueChange={(v) => setSwapEnabled(v)}
                trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Cutoff prenotazione */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Cutoff prenotazione</Text>
                  <Text style={styles.sectionDesc}>
                    {bookingCutoffEnabled === undefined ? `Default azienda: ${companyDefaults.bookingCutoffEnabled ? companyDefaults.bookingCutoffTime : 'Disattivo'}` : bookingCutoffEnabled ? 'Attivo' : 'Disattivo'}
                  </Text>
                </View>
                <Switch
                  value={bookingCutoffEnabled ?? companyDefaults.bookingCutoffEnabled}
                  onValueChange={(v) => setBookingCutoffEnabled(v)}
                  trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {(bookingCutoffEnabled ?? companyDefaults.bookingCutoffEnabled) && (
                <Pressable style={styles.timeRow} onPress={() => setCutoffDrawerOpen(true)}>
                  <Ionicons name="time-outline" size={18} color="#64748B" />
                  <Text style={styles.timeRowText}>Orario limite: {bookingCutoffTime ?? companyDefaults.bookingCutoffTime}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
              )}
            </View>

            {/* Limite settimanale */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Limite settimanale</Text>
                  <Text style={styles.sectionDesc}>
                    {weeklyLimitEnabled === undefined ? `Default azienda: ${companyDefaults.weeklyBookingLimitEnabled ? `${companyDefaults.weeklyBookingLimit} guide` : 'Disattivo'}` : weeklyLimitEnabled ? 'Attivo' : 'Disattivo'}
                  </Text>
                </View>
                <Switch
                  value={weeklyLimitEnabled ?? companyDefaults.weeklyBookingLimitEnabled}
                  onValueChange={(v) => setWeeklyLimitEnabled(v)}
                  trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {(weeklyLimitEnabled ?? companyDefaults.weeklyBookingLimitEnabled) && (
                <View style={styles.chipsRow}>
                  {[1,2,3,4,5,7,10].map((n) => (
                    <SelectableChip
                      key={n}
                      label={`${n}`}
                      active={(weeklyLimit ?? companyDefaults.weeklyBookingLimit) === n}
                      onPress={() => setWeeklyLimit(n)}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Assenza settimanale */}
            <View style={styles.toggleCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Assenza settimanale</Text>
                <Text style={styles.toggleDesc}>
                  {weeklyAbsenceEnabled === undefined ? `Default azienda: ${companyDefaults.weeklyAbsenceEnabled ? 'Attivo' : 'Disattivo'}` : weeklyAbsenceEnabled ? 'Attivo' : 'Disattivo'}
                </Text>
              </View>
              <Switch
                value={weeklyAbsenceEnabled ?? companyDefaults.weeklyAbsenceEnabled}
                onValueChange={(v) => setWeeklyAbsenceEnabled(v)}
                trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Fascia oraria ristretta */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Fascia oraria ristretta</Text>
                  <Text style={styles.sectionDesc}>
                    {restrictedTimeEnabled === undefined
                      ? `Default azienda: ${companyDefaults.restrictedTimeRangeEnabled ? `${companyDefaults.restrictedTimeRangeStart}-${companyDefaults.restrictedTimeRangeEnd}` : 'Disattivo'}`
                      : restrictedTimeEnabled ? 'Attivo' : 'Disattivo'}
                  </Text>
                </View>
                <Switch
                  value={restrictedTimeEnabled ?? companyDefaults.restrictedTimeRangeEnabled}
                  onValueChange={(v) => setRestrictedTimeEnabled(v)}
                  trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {(restrictedTimeEnabled ?? companyDefaults.restrictedTimeRangeEnabled) && (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Pressable style={styles.timeRow} onPress={() => setRestrictedStartDrawerOpen(true)}>
                    <Ionicons name="time-outline" size={18} color="#64748B" />
                    <Text style={styles.timeRowText}>Inizio: {restrictedTimeStart ?? companyDefaults.restrictedTimeRangeStart}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </Pressable>
                  <Pressable style={styles.timeRow} onPress={() => setRestrictedEndDrawerOpen(true)}>
                    <Ionicons name="time-outline" size={18} color="#64748B" />
                    <Text style={styles.timeRowText}>Fine: {restrictedTimeEnd ?? companyDefaults.restrictedTimeRangeEnd}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </Pressable>
                </View>
              )}
            </View>

            {/* Save */}
            <Pressable
              onPress={saving ? undefined : handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && { opacity: 0.85 },
                saving && { opacity: 0.6 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Salva impostazioni</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Time picker drawers */}
      <TimePickerDrawer
        visible={cutoffDrawerOpen}
        onClose={() => setCutoffDrawerOpen(false)}
        selectedTime={timeStringToDate(bookingCutoffTime ?? companyDefaults.bookingCutoffTime)}
        onSelectTime={(d) => setBookingCutoffTime(dateToTimeString(d))}
      />
      <TimePickerDrawer
        visible={restrictedStartDrawerOpen}
        onClose={() => setRestrictedStartDrawerOpen(false)}
        selectedTime={timeStringToDate(restrictedTimeStart ?? companyDefaults.restrictedTimeRangeStart)}
        onSelectTime={(d) => setRestrictedTimeStart(dateToTimeString(d))}
      />
      <TimePickerDrawer
        visible={restrictedEndDrawerOpen}
        onClose={() => setRestrictedEndDrawerOpen(false)}
        selectedTime={timeStringToDate(restrictedTimeEnd ?? companyDefaults.restrictedTimeRangeEnd)}
        onSelectTime={(d) => setRestrictedTimeEnd(dateToTimeString(d))}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: 20,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  pageDesc: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginTop: -4,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  toggleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  toggleDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  timeRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  saveBtn: {
    height: 52,
    borderRadius: 999,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
