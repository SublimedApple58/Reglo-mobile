import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { BottomSheet } from '../components/BottomSheet';
import { TimePickerDrawer } from '../components/TimePickerDrawer';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { regloApi } from '../services/regloApi';
import { AutoscuolaVehicle, AutoscuolaSettings } from '../types/regloApi';
import { colors, radii, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';

// ─── Helpers ──────────────────────────────────────────────────

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

const formatAvailability = (days: number[], start: Date, end: Date): string => {
  if (!days.length) return '';
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const sorted = [...days].sort();

  // Check for consecutive range
  let isConsecutive = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      isConsecutive = false;
      break;
    }
  }

  const dayStr =
    isConsecutive && sorted.length >= 3
      ? `${dayNames[sorted[0]]}-${dayNames[sorted[sorted.length - 1]]}`
      : sorted.map((d) => dayNames[d]).join(', ');

  return `${dayStr} \u2022 ${toTimeString(start)}-${toTimeString(end)}`;
};

// ─── Component ────────────────────────────────────────────────

export const OwnerVehiclesScreen = () => {
  const router = useRouter();
  const { autoscuolaRole } = useSession();
  const [vehicles, setVehicles] = useState<AutoscuolaVehicle[]>([]);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  // Create vehicle drawer state
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [vehicleName, setVehicleName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleCreating, setVehicleCreating] = useState(false);

  // Edit vehicle drawer state
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<AutoscuolaVehicle | null>(null);
  const [vehicleStatusSaving, setVehicleStatusSaving] = useState(false);
  const [vehicleAvailabilityDays, setVehicleAvailabilityDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [vehicleAvailabilityStart, setVehicleAvailabilityStart] = useState(buildTime(9, 0));
  const [vehicleAvailabilityEnd, setVehicleAvailabilityEnd] = useState(buildTime(18, 0));
  const [vehicleAvailabilityLoading, setVehicleAvailabilityLoading] = useState(false);
  const [vehicleAvailabilitySaving, setVehicleAvailabilitySaving] = useState(false);
  const [vehicleStartTimePickerOpen, setVehicleStartTimePickerOpen] = useState(false);
  const [vehicleEndTimePickerOpen, setVehicleEndTimePickerOpen] = useState(false);

  // Per-vehicle availability cache (for cards display)
  const [vehicleAvailabilityMap, setVehicleAvailabilityMap] = useState<
    Record<string, { days: number[]; start: Date; end: Date } | null>
  >({});

  // ─── Data Loading ───────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [vehicleResponse, settingsResponse] = await Promise.all([
        regloApi.getVehicles(),
        regloApi.getAutoscuolaSettings(),
      ]);
      setVehicles(vehicleResponse);
      setSettings(settingsResponse);

      // Load availability for each vehicle (fire and forget for card display)
      loadAllVehicleAvailabilities(vehicleResponse);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore nel caricamento',
        tone: 'danger',
      });
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const loadVehicleAvailability = useCallback(
    async (vehicleId: string): Promise<{ days: number[]; start: Date; end: Date } | null> => {
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
            }),
          ),
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

        if (!ranges.length) return null;

        const daySet = Array.from(new Set(ranges.map((item) => item.dayIndex))).sort();
        const minStart = Math.min(...ranges.map((item) => item.startMin));
        const maxEnd = Math.max(...ranges.map((item) => item.endMin));
        return {
          days: daySet,
          start: buildTime(Math.floor(minStart / 60), minStart % 60),
          end: buildTime(Math.floor(maxEnd / 60), maxEnd % 60),
        };
      } catch {
        return null;
      }
    },
    [],
  );

  const loadAllVehicleAvailabilities = useCallback(
    async (vehicleList: AutoscuolaVehicle[]) => {
      const results: Record<string, { days: number[]; start: Date; end: Date } | null> = {};
      await Promise.all(
        vehicleList.map(async (vehicle) => {
          results[vehicle.id] = await loadVehicleAvailability(vehicle.id);
        }),
      );
      setVehicleAvailabilityMap(results);
    },
    [loadVehicleAvailability],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ─── Create Vehicle ─────────────────────────────────────────

  const resetCreateForm = () => {
    setVehicleName('');
    setVehiclePlate('');
  };

  const openCreateDrawer = () => {
    resetCreateForm();
    setCreateDrawerOpen(true);
  };

  const closeCreateDrawer = () => {
    if (vehicleCreating) return;
    setCreateDrawerOpen(false);
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
      setCreateDrawerOpen(false);
      resetCreateForm();
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore salvando veicolo',
        tone: 'danger',
      });
    } finally {
      setVehicleCreating(false);
    }
  };

  // ─── Edit Vehicle ───────────────────────────────────────────

  const loadEditingVehicleAvailability = useCallback(async (vehicleId: string) => {
    setVehicleAvailabilityLoading(true);
    try {
      const result = await loadVehicleAvailability(vehicleId);
      if (result) {
        setVehicleAvailabilityDays(result.days);
        setVehicleAvailabilityStart(result.start);
        setVehicleAvailabilityEnd(result.end);
      } else {
        setVehicleAvailabilityDays([]);
        setVehicleAvailabilityStart(buildTime(9, 0));
        setVehicleAvailabilityEnd(buildTime(18, 0));
      }
    } catch {
      setToast({
        text: 'Errore caricando disponibilita veicolo',
        tone: 'danger',
      });
    } finally {
      setVehicleAvailabilityLoading(false);
    }
  }, [loadVehicleAvailability]);

  const openEditDrawer = async (vehicle: AutoscuolaVehicle) => {
    setEditingVehicle(vehicle);
    setEditDrawerOpen(true);
    await loadEditingVehicleAvailability(vehicle.id);
  };

  const closeEditDrawer = () => {
    if (vehicleAvailabilitySaving || vehicleStatusSaving) return;
    setEditDrawerOpen(false);
    setEditingVehicle(null);
  };

  const toggleVehicleDay = (day: number) => {
    setVehicleAvailabilityDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort(),
    );
  };

  const handleToggleVehicleStatus = async () => {
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

  const handleSaveVehicleAvailability = async () => {
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

      // Clear existing slots
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

      // Create new slots
      await regloApi.createAvailabilitySlots({
        ownerType: 'vehicle',
        ownerId: editingVehicle.id,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        daysOfWeek: vehicleAvailabilityDays,
        weeks: settings?.availabilityWeeks ?? 4,
      });

      // Update local availability cache
      setVehicleAvailabilityMap((prev) => ({
        ...prev,
        [editingVehicle.id]: {
          days: vehicleAvailabilityDays,
          start: vehicleAvailabilityStart,
          end: vehicleAvailabilityEnd,
        },
      }));

      setToast({ text: 'Disponibilita veicolo salvata', tone: 'success' });
      setEditDrawerOpen(false);
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

  // ─── Computed ───────────────────────────────────────────────

  const activeCount = vehicles.filter((v) => v.status !== 'inactive').length;

  // ─── Render ─────────────────────────────────────────────────

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
        {/* ── Header ─────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {router.canGoBack() ? (
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <Ionicons name="arrow-back" size={22} color="#1E293B" />
              </Pressable>
            ) : null}
            <Text style={styles.title}>I tuoi veicoli</Text>
          </View>
          <Text style={styles.subtitle}>
            {initialLoading
              ? '...'
              : `${vehicles.length} veicoli \u2022 ${activeCount} attivi`}
          </Text>
        </View>

        {/* ── Loading Skeletons ───────────────────── */}
        {initialLoading ? (
          <View style={styles.cardList}>
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonCard key={`skel-${index}`} style={styles.skeletonCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <SkeletonBlock width={44} height={44} radius={22} />
                    <SkeletonBlock width={120} height={17} />
                  </View>
                  <SkeletonBlock width={70} height={26} radius={999} />
                </View>
                <SkeletonBlock width="50%" height={14} />
                <View style={styles.skeletonDivider} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <SkeletonBlock width={28} height={28} radius={14} />
                  <SkeletonBlock width="60%" height={13} />
                </View>
                <SkeletonBlock width="100%" height={48} radius={radii.sm} style={{ marginTop: 6 }} />
              </SkeletonCard>
            ))}
          </View>
        ) : vehicles.length === 0 ? (
          /* ── Empty State ──────────────────────────── */
          <View style={styles.emptyState}>
            <Image
              source={require('../../assets/duck-zen.png')}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyText}>Nessun veicolo configurato</Text>
          </View>
        ) : (
          /* ── Vehicle Cards ─────────────────────────── */
          <View style={styles.cardList}>
            {vehicles.map((vehicle) => {
              const isActive = vehicle.status !== 'inactive';
              const availability = vehicleAvailabilityMap[vehicle.id];

              return (
                <View key={vehicle.id} style={styles.vehicleCard}>
                  {/* Top row */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardTopLeft}>
                      <View style={styles.emojiCircle}>
                        <Text style={styles.emoji}>{'\uD83D\uDE97'}</Text>
                      </View>
                      <Text style={styles.vehicleName}>{vehicle.name}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        isActive ? styles.statusBadgeActive : styles.statusBadgeInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: isActive ? '#16A34A' : '#D97706' },
                        ]}
                      >
                        {isActive ? 'Attivo' : 'Inattivo'}
                      </Text>
                    </View>
                  </View>

                  {/* Plate */}
                  <View style={styles.plateRow}>
                    <Ionicons name="pricetag-outline" size={14} color="#94A3B8" />
                    <Text style={styles.plateText}>
                      Targa: {vehicle.plate ?? '\u2014'}
                    </Text>
                  </View>

                  {/* Divider */}
                  <View style={styles.cardDivider} />

                  {/* Availability row */}
                  <View style={styles.availabilityRow}>
                    <View style={styles.timeCircle}>
                      <Ionicons name="time-outline" size={14} color="#CA8A04" />
                    </View>
                    {availability ? (
                      <Text style={styles.availabilityText}>
                        {formatAvailability(availability.days, availability.start, availability.end)}
                      </Text>
                    ) : (
                      <Text style={styles.availabilityTextEmpty}>
                        Disponibilit&agrave; non configurata
                      </Text>
                    )}
                  </View>

                  {/* Edit button */}
                  <Pressable
                    onPress={() => openEditDrawer(vehicle)}
                    style={({ pressed }) => [
                      styles.editButton,
                      pressed && styles.editButtonPressed,
                    ]}
                  >
                    <Text style={styles.editButtonText}>Modifica</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Add Vehicle CTA ──────────────────────── */}
        <Pressable
          onPress={openCreateDrawer}
          style={({ pressed }) => [
            styles.addVehicleCta,
            pressed && styles.addVehicleCtaPressed,
          ]}
        >
          <Ionicons name="add-circle-outline" size={20} color="#CA8A04" />
          <Text style={styles.addVehicleCtaText}>+ Aggiungi veicolo</Text>
        </Pressable>
      </ScrollView>

      {/* ── Create Vehicle BottomSheet ─────────────── */}
      <BottomSheet
        visible={createDrawerOpen}
        title="Nuovo veicolo"
        onClose={closeCreateDrawer}
        closeDisabled={vehicleCreating}
        showHandle
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <Button
                label={vehicleCreating ? 'Creazione...' : 'Crea veicolo'}
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

      {/* ── Edit Vehicle BottomSheet ───────────────── */}
      <BottomSheet
        visible={editDrawerOpen}
        title={editingVehicle ? `Modifica ${editingVehicle.name}` : 'Modifica veicolo'}
        onClose={closeEditDrawer}
        closeDisabled={vehicleAvailabilitySaving || vehicleStatusSaving}
        showHandle
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <Button
                label={vehicleAvailabilitySaving ? 'Salvataggio...' : 'Salva modifiche'}
                tone="primary"
                onPress={vehicleAvailabilitySaving ? undefined : handleSaveVehicleAvailability}
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
                  <View style={styles.emojiCircle}>
                    <Text style={styles.emoji}>{'\uD83D\uDE97'}</Text>
                  </View>
                  <View>
                    <Text style={styles.vehicleInfoTitle}>{editingVehicle.name}</Text>
                    <Text style={styles.vehicleInfoMeta}>
                      Targa: {editingVehicle.plate ?? '\u2014'}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.vehicleStatusBadge,
                    editingVehicle.status === 'inactive'
                      ? styles.vehicleStatusInactive
                      : styles.vehicleStatusActive,
                  ]}
                >
                  <View
                    style={[
                      styles.vehicleStatusDot,
                      {
                        backgroundColor:
                          editingVehicle.status === 'inactive' ? '#D97706' : '#16A34A',
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.vehicleStatusLabel,
                      {
                        color:
                          editingVehicle.status === 'inactive' ? '#D97706' : '#16A34A',
                      },
                    ]}
                  >
                    {editingVehicle.status === 'inactive' ? 'Inattivo' : 'Attivo'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Status toggle */}
            <Pressable
              onPress={vehicleStatusSaving ? undefined : handleToggleVehicleStatus}
              disabled={vehicleStatusSaving || vehicleAvailabilitySaving}
              style={({ pressed }) => [
                styles.vehicleToggleBtn,
                pressed && { opacity: 0.8 },
                (vehicleStatusSaving || vehicleAvailabilitySaving) && { opacity: 0.5 },
              ]}
            >
              <Text
                style={[
                  styles.vehicleToggleText,
                  {
                    color:
                      editingVehicle.status === 'inactive' ? '#16A34A' : '#EF4444',
                  },
                ]}
              >
                {vehicleStatusSaving
                  ? 'Aggiornamento...'
                  : editingVehicle.status === 'inactive'
                    ? 'Attiva veicolo'
                    : 'Disattiva veicolo'}
              </Text>
            </Pressable>

            {/* Availability section */}
            <View style={styles.vehicleAvailabilitySection}>
              <Text style={styles.sectionLabel}>DISPONIBILIT&Agrave;</Text>
              {vehicleAvailabilityLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Caricamento disponibilita...</Text>
                </View>
              ) : (
                <View style={styles.editorContent}>
                  {/* Day circles */}
                  <View style={styles.dayCircleRow}>
                    {dayLetters.map((letter, index) => (
                      <Pressable
                        key={`vehicle-day-${index}`}
                        onPress={() => toggleVehicleDay(index)}
                        style={[
                          styles.dayCircle,
                          vehicleAvailabilityDays.includes(index)
                            ? styles.dayCircleActive
                            : styles.dayCircleInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayCircleText,
                            vehicleAvailabilityDays.includes(index)
                              ? styles.dayCircleTextActive
                              : styles.dayCircleTextInactive,
                          ]}
                        >
                          {letter}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Time cards */}
                  <View style={styles.timeCardsRow}>
                    <Pressable
                      onPress={() => {
                        setEditDrawerOpen(false);
                        setTimeout(() => setVehicleStartTimePickerOpen(true), 350);
                      }}
                      style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={styles.timeCardLabel}>Inizio</Text>
                      <View style={styles.timeCardRow}>
                        <Ionicons name="time-outline" size={16} color="#EC4899" />
                        <Text style={styles.timeCardValue}>
                          {toTimeString(vehicleAvailabilityStart)}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setEditDrawerOpen(false);
                        setTimeout(() => setVehicleEndTimePickerOpen(true), 350);
                      }}
                      style={({ pressed }) => [styles.timeCard, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={styles.timeCardLabel}>Fine</Text>
                      <View style={styles.timeCardRow}>
                        <Ionicons name="time-outline" size={16} color="#EC4899" />
                        <Text style={styles.timeCardValue}>
                          {toTimeString(vehicleAvailabilityEnd)}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : null}
      </BottomSheet>

      {/* ── Time Picker Drawers ────────────────────── */}
      <TimePickerDrawer
        visible={vehicleStartTimePickerOpen}
        selectedTime={vehicleAvailabilityStart}
        onSelectTime={setVehicleAvailabilityStart}
        onClose={() => {
          setVehicleStartTimePickerOpen(false);
          setTimeout(() => setEditDrawerOpen(true), 350);
        }}
      />
      <TimePickerDrawer
        visible={vehicleEndTimePickerOpen}
        selectedTime={vehicleAvailabilityEnd}
        onSelectTime={setVehicleAvailabilityEnd}
        onClose={() => {
          setVehicleEndTimePickerOpen(false);
          setTimeout(() => setEditDrawerOpen(true), 350);
        }}
      />
    </Screen>
  );
};

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2 + spacing.md,
  },

  /* ─── Header ───────────────────────────────────── */
  header: {
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },

  /* ─── Card List ────────────────────────────────── */
  cardList: {
    gap: 16,
  },

  /* ─── Vehicle Card ─────────────────────────────── */
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 22,
    gap: 0,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  vehicleName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },

  /* ─── Status Badge ─────────────────────────────── */
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  statusBadgeActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statusBadgeInactive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* ─── Plate ────────────────────────────────────── */
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  plateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },

  /* ─── Card Divider ─────────────────────────────── */
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },

  /* ─── Availability Row ─────────────────────────── */
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    flex: 1,
  },
  availabilityTextEmpty: {
    fontSize: 13,
    fontWeight: '500',
    fontStyle: 'italic',
    color: '#94A3B8',
    flex: 1,
  },

  /* ─── Edit Button ──────────────────────────────── */
  editButton: {
    width: '100%',
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  editButtonPressed: {
    opacity: 0.7,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },

  /* ─── Add Vehicle CTA ──────────────────────────── */
  addVehicleCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FACC15',
  },
  addVehicleCtaPressed: {
    opacity: 0.7,
  },
  addVehicleCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#CA8A04',
  },

  /* ─── Empty State ──────────────────────────────── */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  emptyImage: {
    width: 160,
    height: 160,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },

  /* ─── Skeleton ─────────────────────────────────── */
  skeletonCard: {
    borderRadius: radii.lg,
    backgroundColor: '#F8FAFC',
    padding: 22,
  },
  skeletonDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },

  /* ─── Section Label ────────────────────────────── */
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },

  /* ─── BottomSheet Content ──────────────────────── */
  sheetContent: {
    gap: spacing.sm,
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

  /* ─── Vehicle Info Box (Edit Drawer) ───────────── */
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

  /* ─── Status Toggle Button ─────────────────────── */
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

  /* ─── Availability Section (Edit Drawer) ───────── */
  vehicleAvailabilitySection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editorContent: {
    gap: spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  /* ─── Day Circles ──────────────────────────────── */
  dayCircleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 13,
    fontWeight: '700',
  },
  dayCircleTextActive: {
    color: '#FFFFFF',
  },
  dayCircleTextInactive: {
    color: '#64748B',
  },

  /* ─── Time Cards ───────────────────────────────── */
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
});
