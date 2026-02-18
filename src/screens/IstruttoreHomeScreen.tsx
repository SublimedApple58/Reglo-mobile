import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassBadge } from '../components/GlassBadge';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { BottomSheet } from '../components/BottomSheet';
import { SelectableChip } from '../components/SelectableChip';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import { AutoscuolaAppointmentWithRelations } from '../types/regloApi';
import { colors, spacing, typography } from '../theme';
import { formatDay, formatTime } from '../utils/date';
import { useSession } from '../context/SessionContext';

type InstructorActionStatus = 'checked_in' | 'no_show';
type DrawerAction = InstructorActionStatus | 'save_details';
type LessonTypeOption = {
  value: string;
  label: string;
};

const LESSON_TYPE_OPTIONS: LessonTypeOption[] = [
  { value: 'manovre', label: 'Manovre' },
  { value: 'urbano', label: 'Urbano' },
  { value: 'extraurbano', label: 'Extraurbano' },
  { value: 'notturna', label: 'Notturna' },
  { value: 'autostrada', label: 'Autostrada' },
  { value: 'parcheggio', label: 'Parcheggio' },
  { value: 'altro', label: 'Altro' },
];

const normalizeStatus = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const ALLOWED_ACTION_STATUSES = new Set(['scheduled', 'confirmed', 'proposal']);
const CLOSED_ACTION_STATUSES = new Set(['cancelled', 'completed', 'no_show']);
const VISIBLE_LESSON_STATUSES = new Set(['scheduled', 'confirmed', 'proposal', 'checked_in']);
const DETAILS_EDITABLE_STATUSES = new Set([
  'scheduled',
  'confirmed',
  'proposal',
  'checked_in',
  'completed',
  'no_show',
]);

const STATUS_PRIORITY: Record<string, number> = {
  checked_in: 5,
  completed: 4,
  no_show: 3,
  scheduled: 2,
  confirmed: 2,
  proposal: 1,
  cancelled: 0,
};

const isSameDay = (date: Date, iso: string) => {
  const target = new Date(iso);
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
};

const getStartsAtTs = (lesson: AutoscuolaAppointmentWithRelations) =>
  new Date(lesson.startsAt).getTime();

const getUpdatedAtTs = (lesson: AutoscuolaAppointmentWithRelations) =>
  new Date(lesson.updatedAt).getTime();

const getLessonIdentityKey = (lesson: AutoscuolaAppointmentWithRelations) => {
  if (lesson.slotId) return `slot:${lesson.slotId}`;
  return [
    'fallback',
    lesson.studentId,
    lesson.instructorId ?? '',
    lesson.vehicleId ?? '',
    lesson.startsAt,
    lesson.endsAt ?? '',
  ].join(':');
};

const dedupeAppointments = (items: AutoscuolaAppointmentWithRelations[]) => {
  const map = new Map<string, AutoscuolaAppointmentWithRelations>();
  for (const item of items) {
    const key = getLessonIdentityKey(item);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }

    const itemPriority = STATUS_PRIORITY[normalizeStatus(item.status)] ?? 0;
    const prevPriority = STATUS_PRIORITY[normalizeStatus(prev.status)] ?? 0;
    if (itemPriority > prevPriority) {
      map.set(key, item);
      continue;
    }
    if (itemPriority < prevPriority) {
      continue;
    }
    if (getUpdatedAtTs(item) >= getUpdatedAtTs(prev)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
};

const durationLabel = (lesson: AutoscuolaAppointmentWithRelations) => {
  const start = new Date(lesson.startsAt).getTime();
  const end = lesson.endsAt ? new Date(lesson.endsAt).getTime() : start + 30 * 60 * 1000;
  const minutes = Math.round((end - start) / 60000);
  return `${minutes} min`;
};

const getLessonEnd = (lesson: AutoscuolaAppointmentWithRelations) =>
  lesson.endsAt ? new Date(lesson.endsAt) : new Date(new Date(lesson.startsAt).getTime() + 30 * 60 * 1000);

const computeStatusWindow = (lesson: AutoscuolaAppointmentWithRelations) => {
  const startsAt = new Date(lesson.startsAt);
  const opensAt = new Date(startsAt.getTime() - 10 * 60 * 1000);
  const closesAt = new Date(startsAt);
  closesAt.setHours(23, 59, 59, 999);
  return { opensAt, closesAt };
};

const toClockLabel = (value: Date) =>
  value.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

const getActionAvailability = (
  lesson: AutoscuolaAppointmentWithRelations,
  now: Date,
) => {
  const status = normalizeStatus(lesson.status);
  if (status === 'checked_in') {
    return { enabled: false, reason: null as string | null };
  }
  if (CLOSED_ACTION_STATUSES.has(status)) {
    return { enabled: false, reason: null as string | null };
  }
  if (!ALLOWED_ACTION_STATUSES.has(status)) {
    return { enabled: false, reason: null as string | null };
  }
  const { opensAt, closesAt } = computeStatusWindow(lesson);
  if (now < opensAt) {
    return { enabled: false, reason: `Disponibile dalle ${toClockLabel(opensAt)}` };
  }
  if (now > closesAt) {
    return { enabled: false, reason: 'Azione disponibile fino a fine giornata.' };
  }
  return { enabled: true, reason: '' };
};

const getLessonStateMeta = (lesson: AutoscuolaAppointmentWithRelations, now: Date) => {
  const status = normalizeStatus(lesson.status);
  if (!VISIBLE_LESSON_STATUSES.has(status)) return null;
  const startsAt = new Date(lesson.startsAt);
  const endsAt = getLessonEnd(lesson);

  if (status === 'checked_in' && now >= startsAt && now < endsAt) {
    return { label: 'In corso', tone: 'live' as const };
  }
  if (status === 'checked_in') {
    return { label: 'Confermata', tone: 'confirmed' as const };
  }
  return { label: 'Programmata', tone: 'scheduled' as const };
};

const normalizeLessonType = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const normalizeNotes = (value: string | null | undefined) => (value ?? '').trim();

const resolveInitialLessonType = (value: string | null | undefined) => {
  const normalized = normalizeLessonType(value);
  const match = LESSON_TYPE_OPTIONS.find((option) => option.value === normalized);
  return match?.value ?? '';
};

const isDetailsEditable = (lesson: AutoscuolaAppointmentWithRelations, now: Date) => {
  const status = normalizeStatus(lesson.status);
  if (!DETAILS_EDITABLE_STATUSES.has(status)) return false;
  if (status === 'cancelled') return false;
  if (status === 'completed' || status === 'no_show' || status === 'checked_in') {
    const { closesAt } = computeStatusWindow(lesson);
    return now <= closesAt;
  }
  return true;
};

const getCheckinStateText = (lesson: AutoscuolaAppointmentWithRelations, now: Date) => {
  const status = normalizeStatus(lesson.status);
  if (status === 'checked_in' || CLOSED_ACTION_STATUSES.has(status)) return null;

  const availability = getActionAvailability(lesson, now);
  if (availability.enabled) return null;
  return availability.reason ?? null;
};

const getLessonStateLabel = (lesson: AutoscuolaAppointmentWithRelations, now: Date) => {
  const meta = getLessonStateMeta(lesson, now);
  return meta?.label ?? lesson.status;
};

const getTodayLessonTimingMeta = (lesson: AutoscuolaAppointmentWithRelations, now: Date) => {
  const start = new Date(lesson.startsAt);
  const end = getLessonEnd(lesson);
  if (now < start) return { label: 'Futura', tone: 'future' as const };
  if (now >= start && now < end) return { label: 'In corso', tone: 'live' as const };
  return { label: 'Passata', tone: 'past' as const };
};

export const IstruttoreHomeScreen = () => {
  const { instructorId } = useSession();
  const [appointments, setAppointments] = useState<AutoscuolaAppointmentWithRelations[]>([]);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [sheetLesson, setSheetLesson] = useState<AutoscuolaAppointmentWithRelations | null>(null);
  const [selectedLessonType, setSelectedLessonType] = useState('');
  const [lessonNotes, setLessonNotes] = useState('');
  const [pendingAction, setPendingAction] = useState<DrawerAction | null>(null);

  const loadData = useCallback(async (): Promise<AutoscuolaAppointmentWithRelations[]> => {
    if (!instructorId) return [];
    setLoading(true);
    setError(null);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      const to = new Date();
      to.setDate(to.getDate() + 2);
      to.setHours(23, 59, 59, 999);

      const appointmentsResponse = await regloApi.getAppointments({
        instructorId,
        from: from.toISOString(),
        to: to.toISOString(),
        limit: 400,
      });
      const nextAppointments = dedupeAppointments(
        appointmentsResponse.filter((item) => item.instructorId === instructorId),
      );
      setAppointments(nextAppointments);
      return nextAppointments;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
      return [];
    } finally {
      setLoading(false);
    }
  }, [instructorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      setClockTick(Date.now());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const now = useMemo(() => new Date(clockTick), [clockTick]);
  const activeLessons = useMemo(
    () => appointments.filter((item) => VISIBLE_LESSON_STATUSES.has(normalizeStatus(item.status))),
    [appointments],
  );
  const inProgressLesson = useMemo(() => {
    return [...activeLessons]
      .filter((item) => {
        const status = normalizeStatus(item.status);
        if (status !== 'checked_in') return false;
        const startsAt = new Date(item.startsAt);
        const endsAt = getLessonEnd(item);
        return now >= startsAt && now < endsAt;
      })
      .sort((a, b) => getStartsAtTs(a) - getStartsAtTs(b))[0];
  }, [activeLessons, now]);

  const upcomingLessons = useMemo(() => {
    return [...activeLessons]
      .filter((item) => {
        const status = normalizeStatus(item.status);
        if (status === 'checked_in') return getLessonEnd(item) >= now;
        return new Date(item.startsAt) >= now;
      })
      .sort((a, b) => getStartsAtTs(a) - getStartsAtTs(b));
  }, [activeLessons, now]);

  const todayLessons = useMemo(() => {
    return [...appointments]
      .filter((item) => isSameDay(now, item.startsAt))
      .filter((item) => normalizeStatus(item.status) !== 'cancelled')
      .sort((a, b) => getStartsAtTs(b) - getStartsAtTs(a));
  }, [appointments, now]);

  const featuredLesson = inProgressLesson ?? upcomingLessons[0] ?? null;
  const isSheetDetailsEditable = sheetLesson ? isDetailsEditable(sheetLesson, now) : false;

  const openLessonDrawer = (lesson: AutoscuolaAppointmentWithRelations) => {
    if (!isDetailsEditable(lesson, now)) {
      setToast({ text: 'Guida non modificabile.', tone: 'info' });
      return;
    }
    setSheetLesson(lesson);
    setSelectedLessonType(resolveInitialLessonType(lesson.type));
    setLessonNotes(lesson.notes ?? '');
  };

  const isPending = pendingAction !== null;
  const sheetActionAvailability = useMemo(() => {
    if (!sheetLesson) return null;
    return getActionAvailability(sheetLesson, now);
  }, [sheetLesson, now]);
  const featuredActionAvailability = useMemo(() => {
    if (!featuredLesson) return null;
    return getActionAvailability(featuredLesson, now);
  }, [featuredLesson, now]);

  const canRunStatusAction = Boolean(sheetActionAvailability?.enabled);
  const featuredCheckinHint = featuredLesson ? getCheckinStateText(featuredLesson, now) : null;
  const sheetStateMeta = useMemo(
    () => (sheetLesson ? getLessonStateMeta(sheetLesson, now) : null),
    [sheetLesson, now],
  );

  const refreshAndSyncDrawer = useCallback(
    async (lessonId: string) => {
      const refreshed = await loadData();
      const refreshedLesson = refreshed.find((item) => item.id === lessonId) ?? null;
      if (!refreshedLesson) {
        setSheetLesson(null);
        return;
      }
      setSheetLesson(refreshedLesson);
      setSelectedLessonType(resolveInitialLessonType(refreshedLesson.type));
      setLessonNotes(refreshedLesson.notes ?? '');
    },
    [loadData],
  );

  const executeStatusAction = useCallback(
    async (
      lesson: AutoscuolaAppointmentWithRelations,
      action: InstructorActionStatus,
      options?: { lessonType?: string; closeDrawerOnSuccess?: boolean },
    ) => {
      setToast(null);
      const availability = getActionAvailability(lesson, new Date());
      if (!availability.enabled) {
        if (availability.reason) {
          setToast({ text: availability.reason, tone: 'info' });
        }
        return;
      }

      const normalizedType = normalizeLessonType(options?.lessonType);
      if (action === 'checked_in' && !normalizedType && !normalizeLessonType(lesson.type)) {
        setToast({
          text: 'Seleziona prima il tipo guida dal dettaglio.',
          tone: 'info',
        });
        return;
      }

      setPendingAction(action);
      setError(null);

      try {
        await regloApi.updateAppointmentStatus(lesson.id, {
          status: action,
          lessonType: normalizedType || undefined,
        });
        setToast({ text: 'Stato aggiornato', tone: 'success' });
        if (options?.closeDrawerOnSuccess) {
          setSheetLesson(null);
        } else if (sheetLesson?.id === lesson.id) {
          await refreshAndSyncDrawer(lesson.id);
        } else {
          await loadData();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore aggiornando stato';
        setError(message);
        setToast({ text: message, tone: 'danger' });
      } finally {
        setPendingAction(null);
      }
    },
    [loadData, refreshAndSyncDrawer, sheetLesson?.id],
  );

  const handleSaveDetails = async () => {
    if (!sheetLesson) return;
    if (!isDetailsEditable(sheetLesson, now)) {
      setToast({ text: 'Guida non modificabile.', tone: 'danger' });
      return;
    }

    const payload: { lessonType?: string; notes?: string | null } = {};
    const initialLessonType = resolveInitialLessonType(sheetLesson.type);
    if (selectedLessonType && selectedLessonType !== initialLessonType) {
      payload.lessonType = selectedLessonType;
    }

    const currentNotes = normalizeNotes(lessonNotes);
    const initialNotes = normalizeNotes(sheetLesson.notes);
    if (currentNotes !== initialNotes) {
      payload.notes = currentNotes || null;
    }

    if (!Object.keys(payload).length) {
      setToast({ text: 'Nessuna modifica da salvare.', tone: 'info' });
      return;
    }

    setPendingAction('save_details');
    setToast(null);
    setError(null);

    try {
      await regloApi.updateAppointmentDetails(sheetLesson.id, payload);
      await refreshAndSyncDrawer(sheetLesson.id);
      setToast({ text: 'Dettagli guida salvati.', tone: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore aggiornando dettagli';
      setError(message);
      setToast({ text: message, tone: 'danger' });
    } finally {
      setPendingAction(null);
    }
  };

  const handleStatusAction = async (action: InstructorActionStatus) => {
    if (!sheetLesson) return;
    await executeStatusAction(sheetLesson, action, {
      lessonType: selectedLessonType,
      closeDrawerOnSuccess: true,
    });
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (!instructorId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <View style={styles.emptyState}>
          <GlassCard title="Profilo istruttore mancante">
            <Text style={styles.emptyText}>
              Il tuo account non e ancora collegato a un profilo istruttore.
            </Text>
          </GlassCard>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Ciao, Istruttore</Text>
            <Text style={styles.subtitle}>Agenda di oggi e azioni rapide</Text>
          </View>
          <GlassBadge label="Istruttore" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <GlassCard title="Prossima guida" subtitle={loading ? 'Aggiornamento...' : 'In programma'}>
          {featuredLesson ? (
            <View style={styles.lessonRow}>
              <View style={styles.lessonInfo}>
                {getLessonStateMeta(featuredLesson, now) ? (
                  <LessonStateTag meta={getLessonStateMeta(featuredLesson, now)!} />
                ) : null}
                <Text style={styles.lessonTime}>
                  {formatDay(featuredLesson.startsAt)} · {formatTime(featuredLesson.startsAt)}
                </Text>
                <Text style={styles.lessonMeta}>
                  Allievo: {featuredLesson.student?.firstName} {featuredLesson.student?.lastName}
                </Text>
                <Text style={styles.lessonMeta}>Durata: {durationLabel(featuredLesson)}</Text>
                <Text style={styles.lessonMeta}>
                  Veicolo: {featuredLesson.vehicle?.name ?? 'Da assegnare'}
                </Text>
              </View>
              <View style={styles.topActions}>
                <View style={styles.topActionsRow}>
                  <View style={styles.actionHalf}>
                    <GlassButton
                      label={pendingAction === 'checked_in' ? 'Attendi...' : 'Check-in'}
                      tone="primary"
                      onPress={
                        !pendingAction && featuredActionAvailability?.enabled
                          ? () => executeStatusAction(featuredLesson, 'checked_in')
                          : undefined
                      }
                      disabled={Boolean(pendingAction) || !featuredActionAvailability?.enabled}
                      fullWidth
                    />
                  </View>
                  <View style={styles.actionHalf}>
                    <GlassButton
                      label={pendingAction === 'no_show' ? 'Attendi...' : 'No-show'}
                      tone="danger"
                      onPress={
                        !pendingAction && featuredActionAvailability?.enabled
                          ? () => executeStatusAction(featuredLesson, 'no_show')
                          : undefined
                      }
                      disabled={Boolean(pendingAction) || !featuredActionAvailability?.enabled}
                      fullWidth
                    />
                  </View>
                </View>
                <GlassButton
                  label="Apri dettagli guida"
                  tone="standard"
                  onPress={!pendingAction ? () => openLessonDrawer(featuredLesson) : undefined}
                  disabled={Boolean(pendingAction)}
                  fullWidth
                />
                {!featuredActionAvailability?.enabled && featuredCheckinHint ? (
                  <Text style={styles.actionHint}>{featuredCheckinHint}</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>Nessuna guida prevista.</Text>
          )}
        </GlassCard>

        <GlassCard title="Guide di oggi" subtitle="Future e passate della giornata">
          <View style={styles.agendaList}>
            {todayLessons.map((lesson) => {
              const timeMeta = getTodayLessonTimingMeta(lesson, now);
              const lessonStateMeta = getLessonStateMeta(lesson, now);
              return (
                <View
                  key={lesson.id}
                  style={[styles.agendaRow, timeMeta.tone === 'past' ? styles.agendaRowPast : null]}
                >
                  <View style={styles.lessonInfo}>
                    <Text style={styles.lessonTime}>
                      {formatDay(lesson.startsAt)} · {formatTime(lesson.startsAt)}
                    </Text>
                    {timeMeta.tone !== 'live' ? (
                      <Text
                        style={[
                          styles.timeMetaTag,
                          timeMeta.tone === 'past'
                            ? styles.timeMetaTagPast
                            : styles.timeMetaTagFuture,
                        ]}
                      >
                        {timeMeta.label}
                      </Text>
                    ) : null}
                    <Text style={styles.lessonMeta}>
                      Allievo: {lesson.student?.firstName} {lesson.student?.lastName}
                    </Text>
                    <Text style={styles.lessonMeta}>Durata: {durationLabel(lesson)}</Text>
                    <Text style={styles.lessonMeta}>
                      Veicolo: {lesson.vehicle?.name ?? 'Da assegnare'}
                    </Text>
                    {lesson.notes ? (
                      <Text numberOfLines={1} style={styles.lessonMeta}>
                        Note: {lesson.notes}
                      </Text>
                    ) : null}
                    {lessonStateMeta ? <LessonStateTag meta={lessonStateMeta} compact /> : null}
                  </View>
                  <View style={styles.agendaActionWrap}>
                    <GlassButton
                      label="Dettagli"
                      tone="standard"
                      onPress={isDetailsEditable(lesson, now) ? () => openLessonDrawer(lesson) : undefined}
                      disabled={!isDetailsEditable(lesson, now)}
                      fullWidth
                    />
                  </View>
                </View>
              );
            })}
            {!todayLessons.length ? <Text style={styles.emptyText}>Nessuna guida oggi.</Text> : null}
          </View>
        </GlassCard>
      </ScrollView>

      <BottomSheet
        visible={Boolean(sheetLesson)}
        onClose={() => {
          if (!isPending) setSheetLesson(null);
        }}
        closeDisabled={isPending}
        title="Gestisci guida"
        footer={
          <View style={styles.sheetFooterActions}>
            <GlassButton
              label={pendingAction === 'save_details' ? 'Salvataggio...' : 'Salva dettagli'}
              tone="standard"
              onPress={!isPending && isSheetDetailsEditable ? handleSaveDetails : undefined}
              disabled={isPending || !isSheetDetailsEditable}
              fullWidth
            />
            {canRunStatusAction ? (
              <>
                <GlassButton
                  label={pendingAction === 'checked_in' ? 'Attendi...' : 'Check-in'}
                  tone="primary"
                  onPress={isPending ? undefined : () => handleStatusAction('checked_in')}
                  disabled={isPending}
                  fullWidth
                />
                <GlassButton
                  label={pendingAction === 'no_show' ? 'Attendi...' : 'No-show'}
                  tone="danger"
                  onPress={isPending ? undefined : () => handleStatusAction('no_show')}
                  disabled={isPending}
                  fullWidth
                />
              </>
            ) : null}
          </View>
        }
      >
        {sheetLesson ? (
          <View style={styles.sheetContent}>
            <Text style={styles.sheetMeta}>
              {formatDay(sheetLesson.startsAt)} · {formatTime(sheetLesson.startsAt)} · {durationLabel(sheetLesson)}
            </Text>
            <Text style={styles.sheetMeta}>
              Allievo: {sheetLesson.student?.firstName} {sheetLesson.student?.lastName}
            </Text>
            <Text style={styles.sheetMeta}>
              Veicolo: {sheetLesson.vehicle?.name ?? 'Da assegnare'}
            </Text>
            <View style={styles.sheetStatusRow}>
              <Text style={styles.sheetMeta}>Stato guida:</Text>
              {sheetStateMeta ? (
                <LessonStateTag meta={sheetStateMeta} compact />
              ) : (
                <Text style={styles.sheetMeta}>{getLessonStateLabel(sheetLesson, now)}</Text>
              )}
            </View>

            <View style={styles.lessonTypeBlock}>
              <Text style={styles.lessonTypeTitle}>Tipo guida</Text>
              <View style={styles.lessonTypeList}>
                {LESSON_TYPE_OPTIONS.map((option) => (
                  <SelectableChip
                    key={option.value}
                    label={option.label}
                    active={selectedLessonType === option.value}
                    onPress={() => setSelectedLessonType(option.value)}
                    style={styles.lessonTypeChip}
                  />
                ))}
              </View>
            </View>

            <View style={styles.notesBlock}>
              <Text style={styles.notesTitle}>Note guida</Text>
              <TextInput
                value={lessonNotes}
                onChangeText={setLessonNotes}
                placeholder="Aggiungi note operative o osservazioni."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                style={styles.notesInput}
                editable={!isPending}
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
};

const LessonStateTag = ({
  meta,
  compact = false,
}: {
  meta: { label: string; tone: 'live' | 'confirmed' | 'scheduled' };
  compact?: boolean;
}) => (
  <View
    style={[
      styles.stateTag,
      meta.tone === 'live'
        ? styles.stateTagLive
        : meta.tone === 'scheduled'
          ? styles.stateTagScheduled
          : styles.stateTagConfirmed,
      compact && styles.stateTagCompact,
    ]}
  >
    <Text numberOfLines={1} style={[styles.stateTagText, compact && styles.stateTagTextCompact]}>
      {meta.label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  lessonRow: {
    gap: spacing.md,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTime: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  lessonMeta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  agendaList: {
    gap: spacing.md,
  },
  agendaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  agendaRowPast: {
    opacity: 0.85,
  },
  agendaActionWrap: {
    width: 116,
  },
  topActions: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(50, 77, 122, 0.1)',
    paddingTop: spacing.sm,
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionHalf: {
    flex: 1,
  },
  actionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  timeMetaTag: {
    ...typography.caption,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    fontWeight: '700',
  },
  timeMetaTagFuture: {
    backgroundColor: 'rgba(50, 77, 122, 0.12)',
    color: colors.textSecondary,
  },
  timeMetaTagPast: {
    backgroundColor: 'rgba(124, 140, 170, 0.18)',
    color: '#5D6D88',
  },
  stateTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: spacing.xs,
  },
  stateTagLive: {
    backgroundColor: '#1FD38A',
  },
  stateTagConfirmed: {
    backgroundColor: '#49C99C',
  },
  stateTagScheduled: {
    backgroundColor: '#6F85AB',
  },
  stateTagText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0,
    flexShrink: 0,
  },
  stateTagCompact: {
    marginTop: spacing.xs,
    marginBottom: 0,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  stateTagTextCompact: {
    fontSize: 10,
  },
  sheetContent: {
    gap: spacing.sm,
  },
  sheetMeta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sheetStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lessonTypeBlock: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  lessonTypeTitle: {
    ...typography.body,
    color: colors.textPrimary,
  },
  lessonTypeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  lessonTypeChip: {
    marginRight: spacing.xs,
  },
  notesBlock: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  notesTitle: {
    ...typography.body,
    color: colors.textPrimary,
  },
  notesInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.18)',
    borderRadius: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    textAlignVertical: 'top',
    ...typography.body,
  },
  sheetFooterActions: {
    gap: spacing.sm,
    width: '100%',
  },
  emptyState: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
});
