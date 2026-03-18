import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { BottomSheet } from '../components/BottomSheet';
import { TimePickerDrawer } from '../components/TimePickerDrawer';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import { AutoscuolaVehicle, AutoscuolaSettings } from '../types/regloApi';
import { colors, radii, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';

const dayLetters = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

const buildTime = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const pad = (value: number) => value.toString().padStart(2, '0');

const toDateString = (value: Date) => {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, amount: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
};
const toTimeString = (value: Date) => value.toTimeString().slice(0, 5);

type AvailabilityEditorProps = {
  title: string;
  ownerType: 'student' | 'instructor' | 'vehicle';
  ownerId: string | null;
  weeks: number;
  onToast?: (text: string, tone?: ToastTone) => void;
};

const AvailabilityEditor = ({
  title,
  ownerType,
  ownerId,
  weeks,
  onToast,
}: AvailabilityEditorProps) => {
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState(buildTime(9, 0));
  const [endTime, setEndTime] = useState(buildTime(18, 0));
  const [hasSecondRange, setHasSecondRange] = useState(false);
  const [startTime2, setStartTime2] = useState(buildTime(14, 0));
  const [endTime2, setEndTime2] = useState(buildTime(18, 0));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [startTimePickerOpen, setStartTimePickerOpen] = useState(false);
  const [endTimePickerOpen, setEndTimePickerOpen] = useState(false);
  const [startTimePicker2Open, setStartTimePicker2Open] = useState(false);
  const [endTimePicker2Open, setEndTimePicker2Open] = useState(false);

  const toggleDay = (day: number) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort()));
  };

  const loadPreset = useCallback(async () => {
    if (!ownerId) {
      setDays([]);
      setStartTime(buildTime(9, 0));
      setEndTime(buildTime(18, 0));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const dates = Array.from({ length: 7 }, (_, index) => addDays(anchor, index));
      const responses = await Promise.all(
        dates.map((day) =>
          regloApi.getAvailabilitySlots({
            ownerType,
            ownerId,
            date: toDateString(day),
          }),
        ),
      );

      const GAP_THRESHOLD = 30; // minutes gap to detect a second range
      const ranges: Array<{
        dayIndex: number;
        startMin: number;
        endMin: number;
        startMin2?: number;
        endMin2?: number;
      }> = [];
      responses.forEach((response, index) => {
        if (!response || response.length === 0) return;
        const usableSlots = response
          .filter((slot) => slot.status !== 'cancelled')
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
        if (!usableSlots.length) return;

        // Detect gap to identify two ranges
        let gapIndex = -1;
        for (let i = 1; i < usableSlots.length; i++) {
          const prevEnd = new Date(usableSlots[i - 1].endsAt).getTime();
          const currStart = new Date(usableSlots[i].startsAt).getTime();
          if ((currStart - prevEnd) / 60000 >= GAP_THRESHOLD) {
            gapIndex = i;
            break;
          }
        }

        const first = new Date(usableSlots[0].startsAt);
        if (gapIndex > 0) {
          // Two ranges
          const lastOfFirst = new Date(usableSlots[gapIndex - 1].endsAt);
          const firstOfSecond = new Date(usableSlots[gapIndex].startsAt);
          const lastOfSecond = new Date(usableSlots[usableSlots.length - 1].endsAt);
          ranges.push({
            dayIndex: dates[index].getDay(),
            startMin: first.getHours() * 60 + first.getMinutes(),
            endMin: lastOfFirst.getHours() * 60 + lastOfFirst.getMinutes(),
            startMin2: firstOfSecond.getHours() * 60 + firstOfSecond.getMinutes(),
            endMin2: lastOfSecond.getHours() * 60 + lastOfSecond.getMinutes(),
          });
        } else {
          const last = new Date(usableSlots[usableSlots.length - 1].endsAt);
          ranges.push({
            dayIndex: dates[index].getDay(),
            startMin: first.getHours() * 60 + first.getMinutes(),
            endMin: last.getHours() * 60 + last.getMinutes(),
          });
        }
      });

      if (!ranges.length) {
        setDays([]);
        setStartTime(buildTime(9, 0));
        setEndTime(buildTime(18, 0));
        setHasSecondRange(false);
        return;
      }
      const daySet = Array.from(new Set(ranges.map((item) => item.dayIndex))).sort();
      const minStart = Math.min(...ranges.map((item) => item.startMin));
      const maxEnd1 = Math.max(...ranges.map((item) => item.endMin));
      setDays(daySet);
      setStartTime(buildTime(Math.floor(minStart / 60), minStart % 60));
      setEndTime(buildTime(Math.floor(maxEnd1 / 60), maxEnd1 % 60));

      // Detect second range from any day that has it
      const withSecond = ranges.find((r) => r.startMin2 != null && r.endMin2 != null);
      if (withSecond && withSecond.startMin2 != null && withSecond.endMin2 != null) {
        setHasSecondRange(true);
        setStartTime2(buildTime(Math.floor(withSecond.startMin2 / 60), withSecond.startMin2 % 60));
        setEndTime2(buildTime(Math.floor(withSecond.endMin2 / 60), withSecond.endMin2 % 60));
      } else {
        setHasSecondRange(false);
      }
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Errore caricando disponibilita', 'danger');
    } finally {
      setLoading(false);
    }
  }, [ownerId, ownerType]);

  useEffect(() => {
    loadPreset();
  }, [loadPreset]);

  const buildAnchorRange = () => {
    const anchor = new Date();
    anchor.setHours(0, 0, 0, 0);
    const start = new Date(anchor);
    start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    const end = new Date(anchor);
    end.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    return { start, end };
  };

  const handleCreate = async () => {
    if (!ownerId) return;
    if (!days.length) {
      onToast?.('Seleziona almeno un giorno', 'danger');
      return;
    }
    if (endTime <= startTime) {
      onToast?.('Orario non valido', 'danger');
      return;
    }
    setSaving(true);
    try {
      const { start, end } = buildAnchorRange();
      const resetStart = new Date(start);
      resetStart.setHours(0, 0, 0, 0);
      const resetEnd = new Date(start);
      resetEnd.setHours(23, 59, 0, 0);
      try {
        await regloApi.deleteAvailabilitySlots({
          ownerType,
          ownerId,
          startsAt: resetStart.toISOString(),
          endsAt: resetEnd.toISOString(),
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          weeks,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/nessuno slot/i.test(message)) {
          throw err;
        }
      }
      const secondRange = hasSecondRange ? (() => {
        const anchor = new Date();
        anchor.setHours(0, 0, 0, 0);
        const s2 = new Date(anchor);
        s2.setHours(startTime2.getHours(), startTime2.getMinutes(), 0, 0);
        const e2 = new Date(anchor);
        e2.setHours(endTime2.getHours(), endTime2.getMinutes(), 0, 0);
        return { startsAt2: s2.toISOString(), endsAt2: e2.toISOString() };
      })() : {};

      await regloApi.createAvailabilitySlots({
        ownerType,
        ownerId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        ...secondRange,
        daysOfWeek: days,
        weeks,
      });
      onToast?.('Disponibilita salvata', 'success');
      await loadPreset();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Errore salvando disponibilita', 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.availabilityCard}>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Caricamento disponibilita...</Text>
        </View>
      ) : null}
      <View style={[styles.editorContent, loading && styles.editorContentLoading]} pointerEvents={loading ? 'none' : 'auto'}>
        <Text style={styles.sectionLabel}>LA TUA DISPONIBILIT&Agrave;</Text>
        <Text style={styles.weeksSubtitle}>Ripetizione ogni {weeks} settimane</Text>

        <View style={styles.dayCircleRow}>
          {dayLetters.map((letter, index) => (
            <Pressable
              key={`day-${index}`}
              onPress={() => toggleDay(index)}
              style={[
                styles.dayCircle,
                days.includes(index) ? styles.dayCircleActive : styles.dayCircleInactive,
              ]}
            >
              <Text
                style={[
                  styles.dayCircleText,
                  days.includes(index) ? styles.dayCircleTextActive : styles.dayCircleTextInactive,
                ]}
              >
                {letter}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.timeCardsRow}>
          <Pressable
            onPress={() => setStartTimePickerOpen(true)}
            style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.timeCardLabel}>Inizio</Text>
            <View style={styles.timeCardRow}>
              <Ionicons name="time-outline" size={16} color="#EC4899" />
              <Text style={styles.timeCardValue}>{toTimeString(startTime)}</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setEndTimePickerOpen(true)}
            style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.timeCardLabel}>Fine</Text>
            <View style={styles.timeCardRow}>
              <Ionicons name="time-outline" size={16} color="#EC4899" />
              <Text style={styles.timeCardValue}>{toTimeString(endTime)}</Text>
            </View>
          </Pressable>
        </View>

        {/* Second range toggle + cards */}
        {!hasSecondRange ? (
          <Pressable
            onPress={() => setHasSecondRange(true)}
            style={({ pressed }) => [styles.addRangeBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="add-circle-outline" size={18} color="#CA8A04" />
            <Text style={styles.addRangeBtnText}>Aggiungi seconda fascia</Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.secondRangeHeader}>
              <Text style={styles.sectionLabel}>SECONDA FASCIA</Text>
              <Pressable onPress={() => setHasSecondRange(false)}>
                <Text style={styles.removeRangeText}>Rimuovi</Text>
              </Pressable>
            </View>
            <View style={styles.timeCardsRow}>
              <Pressable
                onPress={() => setStartTimePicker2Open(true)}
                style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.timeCardLabel}>Inizio</Text>
                <View style={styles.timeCardRow}>
                  <Ionicons name="time-outline" size={16} color="#EC4899" />
                  <Text style={styles.timeCardValue}>{toTimeString(startTime2)}</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => setEndTimePicker2Open(true)}
                style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.timeCardLabel}>Fine</Text>
                <View style={styles.timeCardRow}>
                  <Ionicons name="time-outline" size={16} color="#EC4899" />
                  <Text style={styles.timeCardValue}>{toTimeString(endTime2)}</Text>
                </View>
              </Pressable>
            </View>
          </>
        )}

        <Pressable
          onPress={handleCreate}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveCta,
            pressed && styles.saveCtaPressed,
            saving && styles.saveCtaDisabled,
          ]}
        >
          <Text style={styles.saveCtaText}>
            {saving ? 'Salvataggio...' : 'Salva disponibilità'}
          </Text>
        </Pressable>
      </View>

      <TimePickerDrawer
        visible={startTimePickerOpen}
        selectedTime={startTime}
        onSelectTime={setStartTime}
        onClose={() => setStartTimePickerOpen(false)}
      />
      <TimePickerDrawer
        visible={endTimePickerOpen}
        selectedTime={endTime}
        onSelectTime={setEndTime}
        onClose={() => setEndTimePickerOpen(false)}
      />
      <TimePickerDrawer
        visible={startTimePicker2Open}
        selectedTime={startTime2}
        onSelectTime={setStartTime2}
        onClose={() => setStartTimePicker2Open(false)}
      />
      <TimePickerDrawer
        visible={endTimePicker2Open}
        selectedTime={endTime2}
        onSelectTime={setEndTime2}
        onClose={() => setEndTimePicker2Open(false)}
      />
    </View>
  );
};

export const InstructorManageScreen = () => {
  const { instructorId } = useSession();
  const [vehicles, setVehicles] = useState<AutoscuolaVehicle[]>([]);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [vehicleName, setVehicleName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [createVehicleDrawerOpen, setCreateVehicleDrawerOpen] = useState(false);
  const [vehicleCreating, setVehicleCreating] = useState(false);
  const [editVehicleDrawerOpen, setEditVehicleDrawerOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<AutoscuolaVehicle | null>(null);
  const [vehicleAvailabilityDays, setVehicleAvailabilityDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [vehicleAvailabilityStart, setVehicleAvailabilityStart] = useState(buildTime(9, 0));
  const [vehicleAvailabilityEnd, setVehicleAvailabilityEnd] = useState(buildTime(18, 0));
  const [vehicleAvailabilityLoading, setVehicleAvailabilityLoading] = useState(false);
  const [vehicleAvailabilitySaving, setVehicleAvailabilitySaving] = useState(false);
  const [vehicleStatusSaving, setVehicleStatusSaving] = useState(false);
  const [vehicleStartTimePickerOpen, setVehicleStartTimePickerOpen] = useState(false);
  const [vehicleEndTimePickerOpen, setVehicleEndTimePickerOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [vehicleResponse, settingsResponse] = await Promise.all([
        regloApi.getVehicles(),
        regloApi.getAutoscuolaSettings(),
      ]);
      setVehicles(vehicleResponse);
      setSettings(settingsResponse);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nel caricamento',
        tone: 'danger',
      });
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetVehicleForm = () => {
    setVehicleName('');
    setVehiclePlate('');
  };

  const openVehicleDrawer = () => {
    resetVehicleForm();
    setCreateVehicleDrawerOpen(true);
  };

  const closeVehicleDrawer = () => {
    if (vehicleCreating) return;
    setCreateVehicleDrawerOpen(false);
  };

  const handleCreateVehicle = async () => {
    setToast(null);
    if (!vehicleName.trim()) {
      setToast({ text: 'Nome veicolo richiesto', tone: 'danger' });
      return;
    }
    setVehicleCreating(true);
    try {
      const created = await regloApi.createVehicle({
        name: vehicleName.trim(),
        plate: vehiclePlate || undefined,
      });
      setToast({ text: 'Veicolo creato', tone: 'success' });
      setVehicles((prev) => [created, ...prev]);
      setCreateVehicleDrawerOpen(false);
      resetVehicleForm();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore salvando veicolo',
        tone: 'danger',
      });
    } finally {
      setVehicleCreating(false);
    }
  };

  const toggleVehicleDay = (day: number) => {
    setVehicleAvailabilityDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort()
    );
  };

  const loadEditingVehicleAvailability = useCallback(async (vehicleId: string) => {
    setVehicleAvailabilityLoading(true);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const dates = Array.from({ length: 7 }, (_, index) => addDays(anchor, index));
      const responses = await Promise.all(
        dates.map((day) =>
          regloApi.getAvailabilitySlots({
            ownerType: 'vehicle',
            ownerId: vehicleId,
            date: toDateString(day),
          })
        )
      );

      const ranges: Array<{ dayIndex: number; startMin: number; endMin: number }> = [];
      responses.forEach((response, index) => {
        if (!response || response.length === 0) return;
        const usableSlots = response
          .filter((slot) => slot.status !== 'cancelled')
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
        if (!usableSlots.length) return;
        const first = new Date(usableSlots[0].startsAt);
        const last = new Date(usableSlots[usableSlots.length - 1].endsAt);
        const startMin = first.getHours() * 60 + first.getMinutes();
        const endMin = last.getHours() * 60 + last.getMinutes();
        ranges.push({ dayIndex: dates[index].getDay(), startMin, endMin });
      });

      if (!ranges.length) {
        setVehicleAvailabilityDays([]);
        setVehicleAvailabilityStart(buildTime(9, 0));
        setVehicleAvailabilityEnd(buildTime(18, 0));
        return;
      }

      const daySet = Array.from(new Set(ranges.map((item) => item.dayIndex))).sort();
      const minStart = Math.min(...ranges.map((item) => item.startMin));
      const maxEnd = Math.max(...ranges.map((item) => item.endMin));
      setVehicleAvailabilityDays(daySet);
      setVehicleAvailabilityStart(buildTime(Math.floor(minStart / 60), minStart % 60));
      setVehicleAvailabilityEnd(buildTime(Math.floor(maxEnd / 60), maxEnd % 60));
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore caricando disponibilita veicolo',
        tone: 'danger',
      });
    } finally {
      setVehicleAvailabilityLoading(false);
    }
  }, []);

  const openEditVehicleDrawer = async (vehicle: AutoscuolaVehicle) => {
    setEditingVehicle(vehicle);
    setEditVehicleDrawerOpen(true);
    await loadEditingVehicleAvailability(vehicle.id);
  };

  const closeEditVehicleDrawer = () => {
    if (vehicleAvailabilitySaving || vehicleStatusSaving) return;
    setEditVehicleDrawerOpen(false);
    setEditingVehicle(null);
  };

  const handleToggleEditingVehicleStatus = async () => {
    if (!editingVehicle) return;
    setToast(null);
    setVehicleStatusSaving(true);
    try {
      if (editingVehicle.status === 'inactive') {
        const updated = await regloApi.updateVehicle(editingVehicle.id, { status: 'active' });
        setVehicles((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setEditingVehicle(updated);
        setToast({ text: 'Veicolo attivato', tone: 'success' });
      } else {
        const updated = await regloApi.deleteVehicle(editingVehicle.id);
        setVehicles((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setEditingVehicle(updated);
        setToast({ text: 'Veicolo disattivato', tone: 'success' });
      }
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore aggiornando veicolo',
        tone: 'danger',
      });
    } finally {
      setVehicleStatusSaving(false);
    }
  };

  const handleSaveEditingVehicleAvailability = async () => {
    if (!editingVehicle) return;
    if (!vehicleAvailabilityDays.length) {
      setToast({ text: 'Seleziona almeno un giorno', tone: 'danger' });
      return;
    }
    if (vehicleAvailabilityEnd <= vehicleAvailabilityStart) {
      setToast({ text: 'Orario non valido', tone: 'danger' });
      return;
    }
    setToast(null);
    setVehicleAvailabilitySaving(true);
    try {
      const anchor = new Date();
      anchor.setHours(0, 0, 0, 0);
      const start = new Date(anchor);
      start.setHours(vehicleAvailabilityStart.getHours(), vehicleAvailabilityStart.getMinutes(), 0, 0);
      const end = new Date(anchor);
      end.setHours(vehicleAvailabilityEnd.getHours(), vehicleAvailabilityEnd.getMinutes(), 0, 0);
      const resetStart = new Date(anchor);
      resetStart.setHours(0, 0, 0, 0);
      const resetEnd = new Date(anchor);
      resetEnd.setHours(23, 59, 0, 0);
      try {
        await regloApi.deleteAvailabilitySlots({
          ownerType: 'vehicle',
          ownerId: editingVehicle.id,
          startsAt: resetStart.toISOString(),
          endsAt: resetEnd.toISOString(),
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          weeks: settings?.availabilityWeeks ?? 4,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/nessuno slot/i.test(message)) {
          throw err;
        }
      }
      await regloApi.createAvailabilitySlots({
        ownerType: 'vehicle',
        ownerId: editingVehicle.id,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        daysOfWeek: vehicleAvailabilityDays,
        weeks: settings?.availabilityWeeks ?? 4,
      });
      setToast({ text: 'Disponibilita veicolo salvata', tone: 'success' });
      setEditVehicleDrawerOpen(false);
      setEditingVehicle(null);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore salvando disponibilita veicolo',
        tone: 'danger',
      });
    } finally {
      setVehicleAvailabilitySaving(false);
    }
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardTitle}>Profilo istruttore mancante</Text>
            <Text style={styles.emptyText}>
              Il tuo account non e ancora collegato a un profilo istruttore.
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice
        message={toast?.text ?? null}
        tone={toast?.tone}
        onHide={() => setToast(null)}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Gestione</Text>
          <Badge label="Istruttore" />
        </View>

        {initialLoading ? (
          <>
            {/* Availability skeleton */}
            <SkeletonCard style={styles.availabilitySkeletonCard}>
              <SkeletonBlock width="60%" height={12} />
              <SkeletonBlock width="50%" height={10} />
              <SkeletonBlock width="100%" height={40} radius={20} style={styles.skeletonButton} />
              <View style={styles.timeCardsRow}>
                <SkeletonBlock width="48%" height={60} radius={radii.sm} />
                <SkeletonBlock width="48%" height={60} radius={radii.sm} />
              </View>
              <SkeletonBlock width="100%" height={50} radius={radii.sm} style={styles.skeletonButton} />
            </SkeletonCard>

            {/* Vehicles skeleton */}
            <View style={styles.vehiclesSection}>
              <Text style={styles.sectionLabel}>I TUOI VEICOLI</Text>
              {Array.from({ length: 2 }).map((_, index) => (
                <SkeletonCard key={`vehicles-skeleton-${index}`} style={styles.vehicleSkeletonCard}>
                  <SkeletonBlock width="54%" height={18} />
                  <SkeletonBlock width="36%" height={14} />
                  <SkeletonBlock width="28%" height={22} radius={999} />
                  <SkeletonBlock width="100%" height={48} radius={radii.sm} style={styles.skeletonButton} />
                </SkeletonCard>
              ))}
            </View>
          </>
        ) : (
          <>
            <AvailabilityEditor
              title={`Disponibilita istruttore · ${settings?.availabilityWeeks ?? 4} sett.`}
              ownerType="instructor"
              ownerId={instructorId}
              weeks={settings?.availabilityWeeks ?? 4}
              onToast={(text, tone = 'success') => setToast({ text, tone })}
            />

            {/* Vehicles Section */}
            <View style={styles.vehiclesSection}>
              <Text style={styles.sectionLabel}>I TUOI VEICOLI</Text>

              <Pressable
                onPress={openVehicleDrawer}
                style={({ pressed }) => [
                  styles.addVehicleButton,
                  pressed && styles.addVehicleButtonPressed,
                ]}
              >
                <Text style={styles.addVehicleText}>+ Aggiungi veicolo</Text>
              </Pressable>

              {vehicles.map((vehicle) => (
                <View key={vehicle.id} style={styles.vehicleCard}>
                  <View style={styles.vehicleCardTopRow}>
                    <Text style={styles.vehicleName}>{vehicle.name}</Text>
                    <Badge
                      label={vehicle.status === 'inactive' ? 'Inattivo' : 'Attivo'}
                      tone={vehicle.status === 'inactive' ? 'warning' : 'success'}
                    />
                  </View>
                  <Text style={styles.vehiclePlate}>Targa: {vehicle.plate ?? '\u2014'}</Text>
                  <Button label="Modifica" onPress={() => openEditVehicleDrawer(vehicle)} fullWidth tone="standard" />
                </View>
              ))}
              {!vehicles.length ? <Text style={styles.emptyText}>Nessun veicolo.</Text> : null}
            </View>
          </>
        )}
      </ScrollView>

      {/* Create Vehicle BottomSheet */}
      <BottomSheet
        visible={createVehicleDrawerOpen}
        title="Nuovo veicolo"
        onClose={closeVehicleDrawer}
        closeDisabled={vehicleCreating}
        showHandle
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <Button
                label={vehicleCreating ? 'Creazione...' : 'Crea'}
                tone="primary"
                onPress={vehicleCreating ? undefined : handleCreateVehicle}
                disabled={vehicleCreating}
                fullWidth
              />
            </View>
          </View>
        }
      >
        <View style={styles.sheetContent}>
          <Input placeholder="Nome veicolo" value={vehicleName} onChangeText={setVehicleName} />
          <Input placeholder="Targa" value={vehiclePlate} onChangeText={setVehiclePlate} />
        </View>
      </BottomSheet>

      {/* Edit Vehicle BottomSheet */}
      <BottomSheet
        visible={editVehicleDrawerOpen}
        title={editingVehicle ? `Modifica ${editingVehicle.name}` : 'Modifica veicolo'}
        onClose={closeEditVehicleDrawer}
        closeDisabled={vehicleAvailabilitySaving || vehicleStatusSaving}
        showHandle
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <Button
                label={vehicleAvailabilitySaving ? 'Salvataggio...' : 'Salva'}
                tone="primary"
                onPress={vehicleAvailabilitySaving ? undefined : handleSaveEditingVehicleAvailability}
                disabled={vehicleAvailabilitySaving || vehicleStatusSaving}
                fullWidth
              />
            </View>
          </View>
        }
      >
        {editingVehicle ? (
          <View style={styles.sheetContent}>
            {/* Vehicle info card */}
            <View style={styles.vehicleInfoBox}>
              <View style={styles.vehicleInfoRow}>
                <View style={styles.vehicleInfoLeft}>
                  <Text style={styles.vehicleEmoji}>{'\uD83D\uDE97'}</Text>
                  <View>
                    <Text style={styles.vehicleInfoTitle}>{editingVehicle.name}</Text>
                    <Text style={styles.vehicleInfoMeta}>Targa: {editingVehicle.plate ?? '\u2014'}</Text>
                  </View>
                </View>
                <View style={[
                  styles.vehicleStatusBadge,
                  editingVehicle.status === 'inactive' ? styles.vehicleStatusInactive : styles.vehicleStatusActive,
                ]}>
                  <View style={[
                    styles.vehicleStatusDot,
                    { backgroundColor: editingVehicle.status === 'inactive' ? '#D97706' : '#16A34A' },
                  ]} />
                  <Text style={[
                    styles.vehicleStatusLabel,
                    { color: editingVehicle.status === 'inactive' ? '#D97706' : '#16A34A' },
                  ]}>
                    {editingVehicle.status === 'inactive' ? 'Inattivo' : 'Attivo'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Status toggle */}
            <Pressable
              onPress={vehicleStatusSaving ? undefined : handleToggleEditingVehicleStatus}
              disabled={vehicleStatusSaving || vehicleAvailabilitySaving}
              style={({ pressed }) => [
                styles.vehicleToggleBtn,
                pressed && { opacity: 0.8 },
                (vehicleStatusSaving || vehicleAvailabilitySaving) && { opacity: 0.5 },
              ]}
            >
              <Text style={[
                styles.vehicleToggleText,
                { color: editingVehicle.status === 'inactive' ? '#16A34A' : '#EF4444' },
              ]}>
                {vehicleStatusSaving
                  ? 'Aggiornamento...'
                  : editingVehicle.status === 'inactive'
                    ? 'Attiva veicolo'
                    : 'Disattiva veicolo'}
              </Text>
            </Pressable>
            <View style={styles.vehicleAvailabilitySection}>
              {vehicleAvailabilityLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Caricamento disponibilita...</Text>
                </View>
              ) : (
                <View style={styles.editorContent}>
                  <View style={styles.dayCircleRow}>
                    {dayLetters.map((letter, index) => (
                      <Pressable
                        key={`vehicle-day-${index}`}
                        onPress={() => toggleVehicleDay(index)}
                        style={[
                          styles.dayCircle,
                          vehicleAvailabilityDays.includes(index) ? styles.dayCircleActive : styles.dayCircleInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayCircleText,
                            vehicleAvailabilityDays.includes(index) ? styles.dayCircleTextActive : styles.dayCircleTextInactive,
                          ]}
                        >
                          {letter}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.timeCardsRow}>
                    <Pressable
                      onPress={() => {
                        setEditVehicleDrawerOpen(false);
                        setTimeout(() => setVehicleStartTimePickerOpen(true), 350);
                      }}
                      style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={styles.timeCardLabel}>Inizio</Text>
                      <View style={styles.timeCardRow}>
                        <Ionicons name="time-outline" size={16} color="#EC4899" />
                        <Text style={styles.timeCardValue}>{toTimeString(vehicleAvailabilityStart)}</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setEditVehicleDrawerOpen(false);
                        setTimeout(() => setVehicleEndTimePickerOpen(true), 350);
                      }}
                      style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={styles.timeCardLabel}>Fine</Text>
                      <View style={styles.timeCardRow}>
                        <Ionicons name="time-outline" size={16} color="#EC4899" />
                        <Text style={styles.timeCardValue}>{toTimeString(vehicleAvailabilityEnd)}</Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : null}
      </BottomSheet>

      <TimePickerDrawer
        visible={vehicleStartTimePickerOpen}
        selectedTime={vehicleAvailabilityStart}
        onSelectTime={setVehicleAvailabilityStart}
        onClose={() => {
          setVehicleStartTimePickerOpen(false);
          setTimeout(() => setEditVehicleDrawerOpen(true), 350);
        }}
      />
      <TimePickerDrawer
        visible={vehicleEndTimePickerOpen}
        selectedTime={vehicleAvailabilityEnd}
        onSelectTime={setVehicleAvailabilityEnd}
        onClose={() => {
          setVehicleEndTimePickerOpen(false);
          setTimeout(() => setEditVehicleDrawerOpen(true), 350);
        }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2 + spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },

  /* ─── Availability Card ───────────────────────────── */
  availabilityCard: {
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 22,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weeksSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  editorContent: {
    gap: spacing.sm,
  },
  editorContentLoading: {
    opacity: 0.5,
  },

  /* ─── Day Circles ─────────────────────────────────── */
  dayCircleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: '#FACC15',
  },
  dayCircleInactive: {
    backgroundColor: '#F1F5F9',
  },
  dayCircleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dayCircleTextActive: {
    color: '#FFFFFF',
  },
  dayCircleTextInactive: {
    color: '#64748B',
  },

  /* ─── Time Picker Cards ───────────────────────────── */
  timeCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.xs,
  },
  timeCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 4,
  },
  timeCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  timeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeCardValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },

  /* ─── Save CTA ────────────────────────────────────── */
  saveCta: {
    width: '100%',
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    shadowColor: '#EC4899',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  saveCtaPressed: {
    transform: [{ scale: 0.98 }],
  },
  saveCtaDisabled: {
    opacity: 0.6,
  },
  addRangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FACC15',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
  },
  addRangeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CA8A04',
  },
  secondRangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeRangeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  saveCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* ─── Vehicles Section ────────────────────────────── */
  vehiclesSection: {
    gap: spacing.sm,
  },
  addVehicleButton: {
    width: '100%',
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addVehicleButtonPressed: {
    opacity: 0.7,
  },
  addVehicleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CA8A04',
  },
  vehicleCard: {
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  vehicleCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  vehiclePlate: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },

  /* ─── Loading ─────────────────────────────────────── */
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  /* ─── Skeletons ───────────────────────────────────── */
  availabilitySkeletonCard: {
    borderRadius: radii.lg,
    backgroundColor: '#F8FAFC',
    padding: 22,
  },
  vehicleSkeletonCard: {
    borderRadius: radii.lg,
    backgroundColor: '#F8FAFC',
  },
  skeletonButton: {
    marginTop: spacing.xs,
  },

  /* ─── Empty State ─────────────────────────────────── */
  emptyState: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  emptyCard: {
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  emptyCardTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },

  /* ─── BottomSheet Content ─────────────────────────── */
  sheetContent: {
    gap: spacing.sm,
  },
  vehicleInfoBox: {
    padding: 16,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  vehicleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicleInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleEmoji: {
    fontSize: 22,
  },
  vehicleInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  vehicleInfoMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  vehicleStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  vehicleStatusActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  vehicleStatusInactive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  vehicleStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vehicleStatusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  vehicleToggleBtn: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleToggleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  vehicleAvailabilitySection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sheetActionsDock: {
    gap: spacing.sm,
    alignItems: 'stretch',
    width: '100%',
  },
  fullWidthButtonWrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
});
