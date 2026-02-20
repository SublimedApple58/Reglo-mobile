import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { BottomSheet } from '../components/BottomSheet';
import { GlassBadge } from '../components/GlassBadge';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { GlassInput } from '../components/GlassInput';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SelectableChip } from '../components/SelectableChip';
import { regloApi } from '../services/regloApi';
import { AutoscuolaVehicle, AutoscuolaSettings } from '../types/regloApi';
import { colors, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

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

type PickerFieldProps = {
  label: string;
  value: Date;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
};

const PickerField = ({ label, value, mode, onChange }: PickerFieldProps) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const isTimeField = mode === 'time';

  return (
    <View style={isTimeField ? styles.timePickerFieldWrap : undefined}>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          isTimeField && styles.timePickerField,
          pressed && isTimeField && styles.timePickerFieldPressed,
        ]}
      >
        <View pointerEvents="none">
          <GlassInput
            editable={false}
            placeholder={label}
            value={mode === 'date' ? value.toLocaleDateString('it-IT') : toTimeString(value)}
          />
        </View>
      </Pressable>
      {open ? (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="fade" onRequestClose={close}>
            <View style={styles.pickerBackdrop}>
              <View style={styles.pickerCard}>
                <Text style={styles.pickerTitle}>{label}</Text>
                <DateTimePicker
                  value={value}
                  mode={mode}
                  display="spinner"
                  onChange={(_, selected) => {
                    if (selected) onChange(selected);
                  }}
                />
                <GlassButton label="Fatto" onPress={close} />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={value}
            mode={mode}
            display="default"
            onChange={(_, selected) => {
              setOpen(false);
              if (selected) onChange(selected);
            }}
          />
        )
      ) : null}
    </View>
  );
};

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
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

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
        setDays([]);
        setStartTime(buildTime(9, 0));
        setEndTime(buildTime(18, 0));
        return;
      }
      const daySet = Array.from(new Set(ranges.map((item) => item.dayIndex))).sort();
      const minStart = Math.min(...ranges.map((item) => item.startMin));
      const maxEnd = Math.max(...ranges.map((item) => item.endMin));
      setDays(daySet);
      setStartTime(buildTime(Math.floor(minStart / 60), minStart % 60));
      setEndTime(buildTime(Math.floor(maxEnd / 60), maxEnd % 60));
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
      await regloApi.createAvailabilitySlots({
        ownerType,
        ownerId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
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
    <GlassCard title={title}>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.navy} />
          <Text style={styles.loadingText}>Caricamento disponibilita...</Text>
        </View>
      ) : null}
      <View style={[styles.editorContent, loading && styles.editorContentLoading]} pointerEvents={loading ? 'none' : 'auto'}>
        <View style={styles.dayRow}>
          {dayLabels.map((label, index) => (
            <SelectableChip
              key={label}
              label={label}
              active={days.includes(index)}
              onPress={() => toggleDay(index)}
            />
          ))}
        </View>
        <View style={styles.pickerRow}>
          <PickerField label="Inizio" value={startTime} mode="time" onChange={setStartTime} />
          <PickerField label="Fine" value={endTime} mode="time" onChange={setEndTime} />
        </View>
        <View style={styles.actionRow}>
          <GlassButton
            label={saving ? 'Salvataggio...' : 'Salva'}
            tone="primary"
            onPress={handleCreate}
            disabled={saving}
            fullWidth
          />
        </View>
      </View>
    </GlassCard>
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
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Gestione istruttore</Text>
            <Text style={styles.subtitle}>Disponibilita e veicoli</Text>
          </View>
          <GlassBadge label="Gestione" />
        </View>

        {initialLoading ? (
          <>
            <GlassCard title="Disponibilita istruttore">
              <SkeletonCard>
                <SkeletonBlock width="74%" />
                <SkeletonBlock width="100%" height={42} radius={14} style={styles.skeletonButton} />
                <SkeletonBlock width="100%" height={42} radius={14} style={styles.skeletonButton} />
              </SkeletonCard>
            </GlassCard>
            <GlassCard title="Veicoli">
              <SkeletonCard>
                <SkeletonBlock width="100%" height={42} radius={14} style={styles.skeletonButton} />
              </SkeletonCard>
              <View style={styles.vehicleList}>
                {Array.from({ length: 2 }).map((_, index) => (
                  <SkeletonCard key={`vehicles-skeleton-${index}`}>
                    <SkeletonBlock width="54%" height={22} />
                    <SkeletonBlock width="36%" />
                    <SkeletonBlock width="28%" height={22} radius={999} />
                    <SkeletonBlock width="34%" height={38} radius={12} style={styles.skeletonButton} />
                  </SkeletonCard>
                ))}
              </View>
            </GlassCard>
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

            <GlassCard title="Veicoli">
              <View style={styles.actionRow}>
                <GlassButton
                  label="Aggiungi veicolo"
                  onPress={openVehicleDrawer}
                  fullWidth
                />
              </View>
              <View style={styles.vehicleList}>
                {vehicles.map((vehicle) => (
                  <View key={vehicle.id} style={styles.vehicleRow}>
                    <View style={styles.vehicleMain}>
                      <Text style={styles.vehicleName}>{vehicle.name}</Text>
                      <Text style={styles.vehicleMeta}>Targa: {vehicle.plate ?? '—'}</Text>
                      <View style={styles.vehicleStatusRow}>
                        <GlassBadge
                          label={vehicle.status === 'inactive' ? 'Inattivo' : 'Attivo'}
                          tone={vehicle.status === 'inactive' ? 'warning' : 'success'}
                        />
                      </View>
                    </View>
                    <View style={styles.vehicleActions}>
                      <GlassButton label="Modifica" onPress={() => openEditVehicleDrawer(vehicle)} />
                    </View>
                  </View>
                ))}
                {!vehicles.length ? <Text style={styles.emptyText}>Nessun veicolo.</Text> : null}
              </View>
            </GlassCard>
          </>
        )}
      </ScrollView>
      <BottomSheet
        visible={createVehicleDrawerOpen}
        title="Nuovo veicolo"
        onClose={closeVehicleDrawer}
        closeDisabled={vehicleCreating}
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
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
          <GlassInput placeholder="Nome veicolo" value={vehicleName} onChangeText={setVehicleName} />
          <GlassInput placeholder="Targa" value={vehiclePlate} onChangeText={setVehiclePlate} />
        </View>
      </BottomSheet>
      <BottomSheet
        visible={editVehicleDrawerOpen}
        title={editingVehicle ? `Modifica ${editingVehicle.name}` : 'Modifica veicolo'}
        onClose={closeEditVehicleDrawer}
        closeDisabled={vehicleAvailabilitySaving || vehicleStatusSaving}
        footer={
          <View style={styles.sheetActionsDock}>
            <View style={styles.fullWidthButtonWrap}>
              <GlassButton
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
            <View style={styles.vehicleInfoBox}>
              <Text style={styles.vehicleInfoTitle}>{editingVehicle.name}</Text>
              <Text style={styles.vehicleInfoMeta}>Targa: {editingVehicle.plate ?? '—'}</Text>
              <Text style={styles.vehicleInfoMeta}>Stato: {editingVehicle.status}</Text>
            </View>
            <GlassButton
              label={
                vehicleStatusSaving
                  ? 'Aggiornamento...'
                  : editingVehicle.status === 'inactive'
                    ? 'Attiva'
                    : 'Disattiva'
              }
              onPress={vehicleStatusSaving ? undefined : handleToggleEditingVehicleStatus}
              disabled={vehicleStatusSaving || vehicleAvailabilitySaving}
            />
            <View style={styles.vehicleAvailabilitySection}>
              {vehicleAvailabilityLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.navy} />
                  <Text style={styles.loadingText}>Caricamento disponibilita...</Text>
                </View>
              ) : (
                <View style={styles.editorContent}>
                  <View style={styles.dayRow}>
                    {dayLabels.map((label, index) => (
                      <SelectableChip
                        key={`vehicle-day-${label}`}
                        label={label}
                        active={vehicleAvailabilityDays.includes(index)}
                        onPress={() => toggleVehicleDay(index)}
                      />
                    ))}
                  </View>
                  <View style={styles.pickerRow}>
                    <PickerField
                      label="Inizio"
                      value={vehicleAvailabilityStart}
                      mode="time"
                      onChange={setVehicleAvailabilityStart}
                    />
                    <PickerField
                      label="Fine"
                      value={vehicleAvailabilityEnd}
                      mode="time"
                      onChange={setVehicleAvailabilityEnd}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
};

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
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editorContent: {
    gap: spacing.sm,
  },
  editorContentLoading: {
    opacity: 0.5,
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  skeletonButton: {
    marginTop: spacing.xs,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  vehicleList: {
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  vehicleMain: {
    flex: 1,
    minWidth: 0,
  },
  vehicleActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  vehicleName: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  vehicleMeta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  vehicleStatusRow: {
    marginTop: spacing.xs,
  },
  vehicleInfoBox: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
  },
  vehicleInfoTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  vehicleInfoMeta: {
    ...typography.body,
    color: colors.textSecondary,
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
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10, 15, 30, 0.78)',
    padding: spacing.lg,
  },
  pickerCard: {
    backgroundColor: '#F7FAFF',
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pickerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  timePickerFieldWrap: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.34)',
    backgroundColor: 'rgba(238, 244, 252, 0.92)',
    padding: 3,
    shadowColor: 'rgba(50, 77, 122, 0.4)',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  timePickerField: {
    borderRadius: 16,
  },
  timePickerFieldPressed: {
    opacity: 0.9,
  },
  sheetContent: {
    gap: spacing.sm,
  },
  vehicleAvailabilitySection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
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
