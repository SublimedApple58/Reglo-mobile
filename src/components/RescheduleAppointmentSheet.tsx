import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { CalendarDrawer } from './CalendarDrawer';
import { TimePickerDrawer } from './TimePickerDrawer';
import { colors, radii, spacing, typography } from '../theme';
import { regloApi } from '../services/regloApi';
import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

type Props = {
  visible: boolean;
  onClose: () => void;
  lesson: AutoscuolaAppointmentWithRelations | null;
  onSuccess?: (newStartsAt: string, oldStartsAt: string) => void;
  onError?: (message: string) => void;
};

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

const pad = (n: number) => String(n).padStart(2, '0');

const formatSlotLabel = (d: Date) =>
  `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} \u00B7 ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const formatDateOnly = (d: Date) =>
  `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;

const formatTimeOnly = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const buildDiffLabel = (oldD: Date, newD: Date): string | null => {
  const ms = newD.getTime() - oldD.getTime();
  if (ms === 0) return null;
  const sign = ms > 0 ? '+' : '\u2212';
  const abs = Math.abs(ms);
  const dayMs = 86_400_000;
  const hourMs = 3_600_000;
  const minMs = 60_000;
  const days = Math.floor(abs / dayMs);
  const hours = Math.floor((abs - days * dayMs) / hourMs);
  const minutes = Math.floor((abs - days * dayMs - hours * hourMs) / minMs);
  const parts: string[] = [];
  if (days) parts.push(`${sign}${days}g`);
  if (hours) parts.push(`${sign}${hours}h`);
  if (minutes) parts.push(`${sign}${minutes}m`);
  return parts.length ? parts.join(' \u00B7 ') : null;
};

export const RescheduleAppointmentSheet = ({
  visible,
  onClose,
  lesson,
  onSuccess,
  onError,
}: Props) => {
  const originalStart = useMemo(
    () => (lesson ? new Date(lesson.startsAt) : null),
    [lesson],
  );
  const originalEnd = useMemo(
    () => (lesson?.endsAt ? new Date(lesson.endsAt) : null),
    [lesson],
  );
  const durationMs = useMemo(() => {
    if (!originalStart || !originalEnd) return 60 * 60 * 1000;
    return originalEnd.getTime() - originalStart.getTime();
  }, [originalStart, originalEnd]);

  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newTime, setNewTime] = useState<Date | null>(null);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Serial modal management: only one native Modal at a time.
  // sheetOpen controls the reschedule BottomSheet visibility independently
  // of the parent `visible` prop, so we can temporarily hide it while a
  // picker is shown and re-open it afterwards.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const pendingPickerRef = useRef<'calendar' | 'time' | null>(null);

  // Sync sheetOpen with parent visible prop
  useEffect(() => {
    if (visible) {
      setSheetOpen(true);
    } else {
      setSheetOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !originalStart) return;
    setNewDate(new Date(originalStart));
    setNewTime(new Date(originalStart));
    setServerError(null);
    setPending(false);
    pendingPickerRef.current = null;
  }, [visible, originalStart]);

  if (!lesson || !originalStart) return null;

  const newStart = (() => {
    if (!newDate || !newTime) return null;
    const out = new Date(newDate);
    out.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);
    return out;
  })();
  const isSameAsOriginal =
    newStart !== null && newStart.getTime() === originalStart.getTime();
  const isPast = newStart ? newStart.getTime() < Date.now() : false;
  const newEnd = newStart ? new Date(newStart.getTime() + durationMs) : null;
  const diff = newStart ? buildDiffLabel(originalStart, newStart) : null;

  const canSubmit =
    newStart !== null && !isSameAsOriginal && !isPast && !pending;

  const studentName =
    `${lesson.student?.firstName ?? ''} ${lesson.student?.lastName ?? ''}`.trim() ||
    'allievo';

  // Close the sheet first, then open the picker after the Modal unmounts.
  const requestPicker = (picker: 'calendar' | 'time') => {
    if (pending) return;
    pendingPickerRef.current = picker;
    setSheetOpen(false);
  };

  const handleSheetClosed = () => {
    const picker = pendingPickerRef.current;
    pendingPickerRef.current = null;
    if (picker === 'calendar') {
      setCalendarOpen(true);
    } else if (picker === 'time') {
      setTimePickerOpen(true);
    }
    // If no pending picker (e.g. user swiped down), propagate close to parent.
    if (!picker && !calendarOpen && !timePickerOpen) {
      onClose();
    }
  };

  const handleCalendarSelect = (d: Date) => {
    setNewDate(d);
    setCalendarOpen(false);
    setServerError(null);
    // Re-open the reschedule sheet after the calendar Modal is gone.
    setTimeout(() => setSheetOpen(true), 350);
  };

  const handleCalendarClose = () => {
    setCalendarOpen(false);
    setTimeout(() => setSheetOpen(true), 350);
  };

  const handleTimeSelect = (d: Date) => {
    setNewTime(d);
    setTimePickerOpen(false);
    setServerError(null);
    setTimeout(() => setSheetOpen(true), 350);
  };

  const handleTimeClose = () => {
    setTimePickerOpen(false);
    setTimeout(() => setSheetOpen(true), 350);
  };

  const handleSubmit = async () => {
    if (!newStart || !newEnd) return;
    setPending(true);
    setServerError(null);
    try {
      const res = await regloApi.rescheduleAppointment(lesson.id, {
        startsAt: newStart.toISOString(),
        endsAt: newEnd.toISOString(),
      });
      const successStart =
        (res as { startsAt?: string } | undefined)?.startsAt ??
        newStart.toISOString();
      onSuccess?.(successStart, originalStart.toISOString());
      onClose();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Impossibile spostare la guida.';
      setServerError(message);
      onError?.(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <BottomSheet
        visible={sheetOpen}
        onClose={() => {
          if (pending) return;
          // If closing without a pending picker, we're truly closing.
          if (!pendingPickerRef.current) {
            pendingPickerRef.current = null;
          }
          setSheetOpen(false);
        }}
        onClosed={handleSheetClosed}
        title={`Sposta guida di ${studentName}`}
        showHandle
        closeDisabled={pending}
        footer={
          <View style={styles.footer}>
            <Button
              label={pending ? 'Spostando...' : 'Conferma spostamento'}
              tone="primary"
              onPress={canSubmit ? handleSubmit : undefined}
              disabled={!canSubmit}
              fullWidth
            />
            <Button
              label="Annulla"
              tone="standard"
              onPress={pending ? undefined : onClose}
              disabled={pending}
              fullWidth
            />
          </View>
        }
      >
        <View style={styles.body}>
          <Text style={styles.subtitle}>
            Oggi: {formatSlotLabel(originalStart)}
          </Text>

          <Pressable
            style={styles.row}
            onPress={() => requestPicker('calendar')}
            disabled={pending}
          >
            <View style={[styles.iconBox, styles.iconBoxPink]}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Cambia data</Text>
              <Text style={styles.rowValue}>
                {newDate ? formatDateOnly(newDate) : '\u2014'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={styles.row}
            onPress={() => requestPicker('time')}
            disabled={pending}
          >
            <View style={[styles.iconBox, styles.iconBoxYellow]}>
              <Ionicons name="time-outline" size={20} color="#CA8A04" />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Cambia orario</Text>
              <Text style={styles.rowValue}>
                {newTime ? formatTimeOnly(newTime) : '\u2014'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          {newStart && !isSameAsOriginal ? (
            <View style={styles.previewPanel}>
              <View style={styles.previewRow}>
                <View style={styles.previewBadge}>
                  <Text style={styles.previewBadgeText}>NUOVA</Text>
                </View>
                <Text style={styles.previewSlot}>
                  {formatSlotLabel(newStart)}
                </Text>
              </View>
              {diff ? (
                <View style={styles.diffPill}>
                  <Text style={styles.diffPillText}>{diff}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {isPast ? (
            <View style={styles.warnBanner}>
              <Ionicons name="alert-circle" size={16} color="#B45309" />
              <Text style={styles.warnText}>
                Non puoi spostare la guida a un orario passato.
              </Text>
            </View>
          ) : null}

          {serverError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={colors.destructive} />
              <Text style={styles.errorText}>{serverError}</Text>
            </View>
          ) : null}
        </View>
      </BottomSheet>

      <CalendarDrawer
        visible={calendarOpen}
        onClose={handleCalendarClose}
        onSelectDate={handleCalendarSelect}
        selectedDate={newDate ?? originalStart}
        unlimitedNavigation
      />

      <TimePickerDrawer
        visible={timePickerOpen}
        onClose={handleTimeClose}
        onSelectTime={handleTimeSelect}
        selectedTime={newTime ?? originalStart}
      />
    </>
  );
};

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxPink: {
    backgroundColor: colors.pink[50],
  },
  iconBoxYellow: {
    backgroundColor: colors.yellow[50],
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  rowValue: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 2,
  },
  previewPanel: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.pink[200],
    backgroundColor: colors.pink[50],
    padding: spacing.md,
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewBadge: {
    backgroundColor: colors.primary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  previewBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  previewSlot: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.textPrimary,
    flex: 1,
  },
  diffPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.pink[100],
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  diffPillText: {
    color: colors.pink[700],
    fontSize: 12,
    fontWeight: '600',
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  warnText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '500',
  },
  footer: {
    gap: 8,
  },
});
