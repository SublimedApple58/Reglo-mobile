import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type AccordionKey = 'booking' | 'limits' | 'extras';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { SelectableChip } from '../components/SelectableChip';
import { TimePickerDrawer } from '../components/TimePickerDrawer';
import { BottomSheet } from '../components/BottomSheet';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { regloApi } from '../services/regloApi';
import { colors, spacing } from '../theme';

const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;

// Avatar helpers
const getInitials = (firstName: string, lastName: string) => {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return '?';
};
const AVATAR_BG_PALETTE = ['#FCE7F3', '#FEF3C7', '#DBEAFE', '#DCFCE7', '#EDE9FE', '#FFEDD5', '#E0F2FE', '#FEE2E2'];
const AVATAR_FG_PALETTE = ['#BE185D', '#B45309', '#1D4ED8', '#15803D', '#6D28D9', '#C2410C', '#0369A1', '#B91C1C'];
const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const avatarColorsFor = (id: string) => {
  const i = hashStr(id) % AVATAR_BG_PALETTE.length;
  return { bg: AVATAR_BG_PALETTE[i], fg: AVATAR_FG_PALETTE[i] };
};

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
  const [companyDefaults, setCompanyDefaults] = useState<{ bookingSlotDurations: number[]; roundedHoursOnly: boolean; appBookingActors: string; instructorBookingMode: string; swapEnabled: boolean; bookingCutoffEnabled: boolean; bookingCutoffTime: string; weeklyBookingLimitEnabled: boolean; weeklyBookingLimit: number; weeklyAbsenceEnabled: boolean; restrictedTimeRangeEnabled: boolean; restrictedTimeRangeStart: string; restrictedTimeRangeEnd: string }>({
    bookingSlotDurations: [30, 60],
    roundedHoursOnly: false,
    appBookingActors: 'students',
    instructorBookingMode: 'manual_engine',
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
  // Governance prenotazione
  const [appBookingActors, setAppBookingActors] = useState<string | undefined>(undefined);
  const [instructorBookingMode, setInstructorBookingMode] = useState<string | undefined>(undefined);
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
  // Students of the cluster
  const [allStudents, setAllStudents] = useState<Array<{ id: string; firstName: string; lastName: string; assignedInstructorId: string | null }>>([]);
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentsSheetOpen, setStudentsSheetOpen] = useState(false);
  // Draft state while sheet is open — applied on confirm
  const [draftAssignedIds, setDraftAssignedIds] = useState<string[]>([]);
  const openStudentsSheet = () => {
    setDraftAssignedIds(assignedStudentIds);
    setStudentSearch('');
    setStudentsSheetOpen(true);
  };
  const confirmStudentsSelection = () => {
    setAssignedStudentIds(draftAssignedIds);
    setStudentsSheetOpen(false);
  };

  const assignedStudents = useMemo(
    () => allStudents.filter((s) => assignedStudentIds.includes(s.id)),
    [allStudents, assignedStudentIds],
  );

  const filteredSheetStudents = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    const filtered = q
      ? allStudents.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q))
      : allStudents;
    return [...filtered].sort((a, b) => {
      const aAssigned = draftAssignedIds.includes(a.id) ? 0 : 1;
      const bAssigned = draftAssignedIds.includes(b.id) ? 0 : 1;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [allStudents, studentSearch, draftAssignedIds]);
  // Accordion expanded state — only one at a time for clarity
  const [expanded, setExpanded] = useState<AccordionKey | null>(null);
  const toggleAccordion = (key: AccordionKey) => {
    LayoutAnimation.configureNext({
      duration: 320,
      create: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
        duration: 260,
      },
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 0.9,
      },
      delete: {
        type: LayoutAnimation.Types.easeIn,
        property: LayoutAnimation.Properties.opacity,
        duration: 180,
      },
    });
    setExpanded((prev) => (prev === key ? null : key));
  };

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
      setAppBookingActors(res.settings.appBookingActors);
      setInstructorBookingMode(res.settings.instructorBookingMode);
      setSwapEnabled(res.settings.swapEnabled);
      setBookingCutoffEnabled(res.settings.bookingCutoffEnabled);
      setBookingCutoffTime(res.settings.bookingCutoffTime);
      setWeeklyLimitEnabled(res.settings.weeklyBookingLimitEnabled);
      setWeeklyLimit(res.settings.weeklyBookingLimit);
      setWeeklyAbsenceEnabled(res.settings.weeklyAbsenceEnabled);
      setRestrictedTimeEnabled(res.settings.restrictedTimeRangeEnabled);
      setRestrictedTimeStart(res.settings.restrictedTimeRangeStart);
      setRestrictedTimeEnd(res.settings.restrictedTimeRangeEnd);
      setAllStudents(res.students ?? []);
      setAssignedStudentIds(res.assignedStudentIds ?? []);
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
        appBookingActors: appBookingActors as 'students' | 'instructors' | 'both' | undefined,
        instructorBookingMode: instructorBookingMode as 'manual_full' | 'manual_engine' | undefined,
        swapEnabled,
        bookingCutoffEnabled,
        bookingCutoffTime,
        weeklyBookingLimitEnabled: weeklyLimitEnabled,
        weeklyBookingLimit: weeklyLimit,
        weeklyAbsenceEnabled,
        restrictedTimeRangeEnabled: restrictedTimeEnabled,
        restrictedTimeRangeStart: restrictedTimeStart,
        restrictedTimeRangeEnd: restrictedTimeEnd,
        assignStudentIds: assignedStudentIds,
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
            {/* ── Allievi del gruppo (compact — scales to many students) ── */}
            <View style={styles.studentsCard}>
              <View style={styles.studentsHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentsTitle}>Allievi del gruppo</Text>
                  <Text style={styles.studentsSubtitle}>
                    {assignedStudents.length === 0
                      ? 'Non hai ancora aggiunto allievi.'
                      : `${assignedStudents.length} ${assignedStudents.length === 1 ? 'allievo' : 'allievi'} nel tuo gruppo.`}
                  </Text>
                </View>
                <Pressable
                  onPress={openStudentsSheet}
                  style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="create-outline" size={15} color="#BE185D" />
                  <Text style={styles.manageBtnText}>Gestisci</Text>
                </Pressable>
              </View>

              {assignedStudents.length === 0 ? (
                <Pressable
                  onPress={openStudentsSheet}
                  style={({ pressed }) => [styles.emptyStateBtn, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.emptyStateIconCircle}>
                    <Ionicons name="person-add-outline" size={22} color="#BE185D" />
                  </View>
                  <Text style={styles.emptyStateText}>Aggiungi allievi al gruppo</Text>
                </Pressable>
              ) : (
                <View style={styles.avatarStackWrapper}>
                  {/* Show up to 6 avatars + overflow indicator */}
                  {assignedStudents.slice(0, 6).map((student, idx) => {
                    const { bg, fg } = avatarColorsFor(student.id);
                    return (
                      <View
                        key={student.id}
                        style={[
                          styles.avatarCircle,
                          { backgroundColor: bg, marginLeft: idx === 0 ? 0 : -10, zIndex: 10 - idx },
                        ]}
                      >
                        <Text style={[styles.avatarInitials, { color: fg }]}>
                          {getInitials(student.firstName, student.lastName)}
                        </Text>
                      </View>
                    );
                  })}
                  {assignedStudents.length > 6 ? (
                    <View style={[styles.avatarCircle, styles.avatarOverflow, { marginLeft: -10 }]}>
                      <Text style={styles.avatarOverflowText}>
                        +{assignedStudents.length - 6}
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }} />
                </View>
              )}
            </View>

            {/* ── Accordion: Prenotazione guide ── */}
            <View style={styles.accordionCard}>
              <Pressable style={styles.accordionHeader} onPress={() => toggleAccordion('booking')}>
                <View style={styles.accordionIconCircle}>
                  <Ionicons name="calendar-outline" size={18} color="#BE185D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accordionTitle}>Prenotazione guide</Text>
                  <Text style={styles.accordionSubtitle} numberOfLines={1}>
                    {(() => {
                      const parts: string[] = [];
                      const actor = appBookingActors ?? companyDefaults.appBookingActors;
                      if (actor === 'students') parts.push('Solo allievi');
                      else if (actor === 'instructors') parts.push('Solo istruttori');
                      else parts.push('Entrambi');
                      const dur = bookingSlotDurations.map((d) => `${d}`).join('/');
                      parts.push(`${dur} min`);
                      return parts.join(' · ');
                    })()}
                  </Text>
                </View>
                <Ionicons
                  name={expanded === 'booking' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#94A3B8"
                />
              </Pressable>
              {expanded === 'booking' && (
                <View style={styles.accordionBody}>
                  <Text style={styles.chipLabel}>Chi prenota</Text>
                  <View style={styles.chipsRow}>
                    {([
                      { value: undefined, label: 'Default' },
                      { value: 'students', label: 'Solo allievi' },
                      { value: 'instructors', label: 'Solo istruttori' },
                      { value: 'both', label: 'Entrambi' },
                    ] as const).map((opt) => (
                      <SelectableChip
                        key={opt.value ?? '_default'}
                        label={opt.label}
                        active={appBookingActors === opt.value}
                        onPress={() => setAppBookingActors(opt.value)}
                      />
                    ))}
                  </View>

                  <Text style={styles.chipLabel}>Modalità istruttore</Text>
                  <View style={styles.chipsRow}>
                    {([
                      { value: undefined, label: 'Default' },
                      { value: 'manual_full', label: 'Manuale totale' },
                      { value: 'manual_engine', label: 'Manuale + motore' },
                    ] as const).map((opt) => (
                      <SelectableChip
                        key={opt.value ?? '_default'}
                        label={opt.label}
                        active={instructorBookingMode === opt.value}
                        onPress={() => setInstructorBookingMode(opt.value)}
                      />
                    ))}
                  </View>

                  <Text style={styles.chipLabel}>Durata guide</Text>
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

                  <View style={styles.inlineToggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inlineToggleLabel}>Solo orari tondi</Text>
                      <Text style={styles.inlineToggleDesc}>
                        Solo slot che iniziano a ore piene (es. 9:00, 10:00).
                      </Text>
                    </View>
                    <Switch
                      value={roundedHoursOnly}
                      onValueChange={setRoundedHoursOnly}
                      trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
              )}
            </View>

            {/* ── Accordion: Limiti e orari ── */}
            <View style={styles.accordionCard}>
              <Pressable style={styles.accordionHeader} onPress={() => toggleAccordion('limits')}>
                <View style={styles.accordionIconCircle}>
                  <Ionicons name="time-outline" size={18} color="#BE185D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accordionTitle}>Limiti e orari</Text>
                  <Text style={styles.accordionSubtitle} numberOfLines={1}>
                    {(() => {
                      const parts: string[] = [];
                      const cutoffOn = bookingCutoffEnabled ?? companyDefaults.bookingCutoffEnabled;
                      if (cutoffOn) parts.push(`Cutoff ${bookingCutoffTime ?? companyDefaults.bookingCutoffTime}`);
                      const limitOn = weeklyLimitEnabled ?? companyDefaults.weeklyBookingLimitEnabled;
                      if (limitOn) parts.push(`Max ${weeklyLimit ?? companyDefaults.weeklyBookingLimit}/sett.`);
                      const rangeOn = restrictedTimeEnabled ?? companyDefaults.restrictedTimeRangeEnabled;
                      if (rangeOn) parts.push(`Fascia ${restrictedTimeStart ?? companyDefaults.restrictedTimeRangeStart}-${restrictedTimeEnd ?? companyDefaults.restrictedTimeRangeEnd}`);
                      return parts.length ? parts.join(' · ') : 'Nessun limite attivo';
                    })()}
                  </Text>
                </View>
                <Ionicons
                  name={expanded === 'limits' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#94A3B8"
                />
              </Pressable>
              {expanded === 'limits' && (
                <View style={styles.accordionBody}>
                  {/* Cutoff */}
                  <View style={styles.inlineToggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inlineToggleLabel}>Cutoff prenotazione</Text>
                      <Text style={styles.inlineToggleDesc}>
                        {bookingCutoffEnabled === undefined
                          ? `Default: ${companyDefaults.bookingCutoffEnabled ? companyDefaults.bookingCutoffTime : 'Off'}`
                          : bookingCutoffEnabled ? 'Attivo' : 'Disattivo'}
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
                      <Text style={styles.timeRowText}>
                        Orario limite: {bookingCutoffTime ?? companyDefaults.bookingCutoffTime}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                    </Pressable>
                  )}

                  {/* Limite settimanale */}
                  <View style={[styles.inlineToggleRow, { marginTop: 14 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inlineToggleLabel}>Limite settimanale</Text>
                      <Text style={styles.inlineToggleDesc}>
                        {weeklyLimitEnabled === undefined
                          ? `Default: ${companyDefaults.weeklyBookingLimitEnabled ? `${companyDefaults.weeklyBookingLimit} guide` : 'Off'}`
                          : weeklyLimitEnabled ? 'Attivo' : 'Disattivo'}
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
                      {[1, 2, 3, 4, 5, 7, 10].map((n) => (
                        <SelectableChip
                          key={n}
                          label={`${n}`}
                          active={(weeklyLimit ?? companyDefaults.weeklyBookingLimit) === n}
                          onPress={() => setWeeklyLimit(n)}
                        />
                      ))}
                    </View>
                  )}

                  {/* Fascia oraria ristretta */}
                  <View style={[styles.inlineToggleRow, { marginTop: 14 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inlineToggleLabel}>Fascia oraria ristretta</Text>
                      <Text style={styles.inlineToggleDesc}>
                        {restrictedTimeEnabled === undefined
                          ? `Default: ${companyDefaults.restrictedTimeRangeEnabled ? `${companyDefaults.restrictedTimeRangeStart}-${companyDefaults.restrictedTimeRangeEnd}` : 'Off'}`
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
                        <Text style={styles.timeRowText}>
                          Inizio: {restrictedTimeStart ?? companyDefaults.restrictedTimeRangeStart}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                      </Pressable>
                      <Pressable style={styles.timeRow} onPress={() => setRestrictedEndDrawerOpen(true)}>
                        <Ionicons name="time-outline" size={18} color="#64748B" />
                        <Text style={styles.timeRowText}>
                          Fine: {restrictedTimeEnd ?? companyDefaults.restrictedTimeRangeEnd}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ── Accordion: Funzionalità extra ── */}
            <View style={styles.accordionCard}>
              <Pressable style={styles.accordionHeader} onPress={() => toggleAccordion('extras')}>
                <View style={styles.accordionIconCircle}>
                  <Ionicons name="sparkles-outline" size={18} color="#BE185D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accordionTitle}>Funzionalità extra</Text>
                  <Text style={styles.accordionSubtitle} numberOfLines={1}>
                    {(() => {
                      const parts: string[] = [];
                      if (swapEnabled ?? companyDefaults.swapEnabled) parts.push('Scambio');
                      if (weeklyAbsenceEnabled ?? companyDefaults.weeklyAbsenceEnabled) parts.push('Assenza');
                      return parts.length ? parts.join(' · ') : 'Nessuna attiva';
                    })()}
                  </Text>
                </View>
                <Ionicons
                  name={expanded === 'extras' ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#94A3B8"
                />
              </Pressable>
              {expanded === 'extras' && (
                <View style={styles.accordionBody}>
                  <View style={styles.inlineToggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inlineToggleLabel}>Scambio guide</Text>
                      <Text style={styles.inlineToggleDesc}>
                        {swapEnabled === undefined
                          ? `Default: ${companyDefaults.swapEnabled ? 'Attivo' : 'Off'}`
                          : swapEnabled ? 'Attivo' : 'Disattivo'}
                      </Text>
                    </View>
                    <Switch
                      value={swapEnabled ?? companyDefaults.swapEnabled}
                      onValueChange={(v) => setSwapEnabled(v)}
                      trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  <View style={[styles.inlineToggleRow, { marginTop: 14 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inlineToggleLabel}>Assenza settimanale</Text>
                      <Text style={styles.inlineToggleDesc}>
                        {weeklyAbsenceEnabled === undefined
                          ? `Default: ${companyDefaults.weeklyAbsenceEnabled ? 'Attivo' : 'Off'}`
                          : weeklyAbsenceEnabled ? 'Attivo' : 'Disattivo'}
                      </Text>
                    </View>
                    <Switch
                      value={weeklyAbsenceEnabled ?? companyDefaults.weeklyAbsenceEnabled}
                      onValueChange={(v) => setWeeklyAbsenceEnabled(v)}
                      trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
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

      {/* Students management bottom sheet */}
      <BottomSheet
        visible={studentsSheetOpen}
        onClose={() => setStudentsSheetOpen(false)}
        title="Allievi del gruppo"
        showHandle
        titleRight={
          <View style={styles.sheetCounter}>
            <Text style={styles.sheetCounterText}>{draftAssignedIds.length}</Text>
          </View>
        }
        footer={
          <Pressable
            onPress={confirmStudentsSelection}
            style={({ pressed }) => [styles.sheetConfirmBtn, pressed && { opacity: 0.88 }]}
          >
            <Text style={styles.sheetConfirmText}>
              {draftAssignedIds.length === 0
                ? 'Conferma'
                : `Conferma selezione (${draftAssignedIds.length})`}
            </Text>
          </Pressable>
        }
      >
        <View style={styles.sheetSearchRow}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            style={styles.sheetSearchInput}
            placeholder="Cerca allievo..."
            placeholderTextColor="#94A3B8"
            value={studentSearch}
            onChangeText={setStudentSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {studentSearch.length > 0 ? (
            <Pressable onPress={() => setStudentSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#CBD5E1" />
            </Pressable>
          ) : null}
        </View>

        {draftAssignedIds.length > 0 ? (
          <Pressable
            onPress={() => setDraftAssignedIds([])}
            style={({ pressed }) => [styles.clearAllRow, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.clearAllText}>Deseleziona tutti</Text>
          </Pressable>
        ) : null}

        {filteredSheetStudents.length === 0 ? (
          <View style={styles.sheetEmpty}>
            <Ionicons name="search-outline" size={28} color="#CBD5E1" />
            <Text style={styles.sheetEmptyText}>
              {studentSearch ? 'Nessun allievo trovato.' : 'Nessun allievo in autoscuola.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredSheetStudents}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: student }) => {
              const isSelected = draftAssignedIds.includes(student.id);
              const assignedToOther = !isSelected && student.assignedInstructorId;
              const { bg, fg } = avatarColorsFor(student.id);
              return (
                <Pressable
                  onPress={() => {
                    setDraftAssignedIds((prev) =>
                      prev.includes(student.id)
                        ? prev.filter((id) => id !== student.id)
                        : [...prev, student.id],
                    );
                  }}
                  style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.6 }]}
                >
                  <View style={[styles.sheetAvatar, { backgroundColor: bg }]}>
                    <Text style={[styles.sheetAvatarText, { color: fg }]}>
                      {getInitials(student.firstName, student.lastName)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetRowName} numberOfLines={1}>
                      {student.firstName} {student.lastName}
                    </Text>
                    {assignedToOther ? (
                      <Text style={styles.sheetRowSubtext}>Nel gruppo di un altro istruttore</Text>
                    ) : null}
                  </View>
                  <View
                    style={[styles.sheetCheckbox, isSelected && styles.sheetCheckboxChecked]}
                  >
                    {isSelected ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                  </View>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.sheetSeparator} />}
          />
        )}
      </BottomSheet>

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
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
    marginBottom: -2,
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
  accordionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  accordionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  accordionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  accordionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inlineToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  inlineToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  inlineToggleDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  studentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  studentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  studentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  studentsSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FCE7F3',
  },
  manageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#BE185D',
  },
  emptyStateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#F9A8D4',
    backgroundColor: '#FDF2F8',
  },
  emptyStateIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#BE185D',
  },
  avatarStackWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '700',
  },
  avatarOverflow: {
    backgroundColor: '#F1F5F9',
  },
  avatarOverflowText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  // BottomSheet styles
  sheetCounter: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCounterText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#BE185D',
  },
  sheetSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    padding: 0,
  },
  clearAllRow: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  sheetEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  sheetEmptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  sheetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  sheetRowSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  sheetCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCheckboxChecked: {
    backgroundColor: '#EC4899',
    borderColor: '#EC4899',
  },
  sheetSeparator: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  sheetConfirmBtn: {
    height: 52,
    borderRadius: 999,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
