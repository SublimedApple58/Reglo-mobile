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
import { colors, radii, spacing } from '../theme';
import { useSession } from '../context/SessionContext';

const dayLetters = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

const buildTime = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const pad = (value: number) => value.toString().padStart(2, '0');

const toDateString = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const addDays = (date: Date, amount: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
};

const toTimeString = (value: Date) => value.toTimeString().slice(0, 5);

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const InstructorVehiclesScreen = () => {
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
      setToast({ text: err instanceof Error ? err.message : 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetVehicleForm = () => { setVehicleName(''); setVehiclePlate(''); };

  const handleCreateVehicle = async () => {
    setToast(null);
    if (!vehicleName.trim()) { setToast({ text: 'Nome veicolo richiesto', tone: 'danger' }); return; }
    setVehicleCreating(true);
    try {
      const created = await regloApi.createVehicle({ name: vehicleName.trim(), plate: vehiclePlate || undefined });
      setToast({ text: 'Veicolo creato', tone: 'success' });
      setVehicles((prev) => [created, ...prev]);
      setCreateVehicleDrawerOpen(false);
      resetVehicleForm();
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : 'Errore salvando veicolo', tone: 'danger' });
    } finally {
      setVehicleCreating(false);
    }
  };

  const toggleVehicleDay = (day: number) => {
    setVehicleAvailabilityDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort(),
    );
  };

  const loadEditingVehicleAvailability = useCallback(async (vehicleId: string) => {
    setVehicleAvailabilityLoading(true);
    try {
      const anchor = new Date(); anchor.setHours(0, 0, 0, 0);
      const dates = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
      const responses = await Promise.all(
        dates.map((day) => regloApi.getAvailabilitySlots({ ownerType: 'vehicle', ownerId: vehicleId, date: toDateString(day) })),
      );
      const ranges: Array<{ dayIndex: number; startMin: number; endMin: number }> = [];
      responses.forEach((response, index) => {
        if (!response?.length) return;
        const usable = response.filter((s) => s.status !== 'cancelled').sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
        if (!usable.length) return;
        const first = new Date(usable[0].startsAt);
        const last = new Date(usable[usable.length - 1].endsAt);
        ranges.push({ dayIndex: dates[index].getDay(), startMin: first.getHours() * 60 + first.getMinutes(), endMin: last.getHours() * 60 + last.getMinutes() });
      });
      if (!ranges.length) { setVehicleAvailabilityDays([]); setVehicleAvailabilityStart(buildTime(9, 0)); setVehicleAvailabilityEnd(buildTime(18, 0)); return; }
      setVehicleAvailabilityDays(Array.from(new Set(ranges.map((r) => r.dayIndex))).sort());
      const minStart = Math.min(...ranges.map((r) => r.startMin));
      const maxEnd = Math.max(...ranges.map((r) => r.endMin));
      setVehicleAvailabilityStart(buildTime(Math.floor(minStart / 60), minStart % 60));
      setVehicleAvailabilityEnd(buildTime(Math.floor(maxEnd / 60), maxEnd % 60));
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : 'Errore caricando disponibilita veicolo', tone: 'danger' });
    } finally {
      setVehicleAvailabilityLoading(false);
    }
  }, []);

  const openEditVehicleDrawer = async (vehicle: AutoscuolaVehicle) => {
    setEditingVehicle(vehicle);
    setEditVehicleDrawerOpen(true);
    await loadEditingVehicleAvailability(vehicle.id);
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
      setToast({ text: err instanceof Error ? err.message : 'Errore aggiornando veicolo', tone: 'danger' });
    } finally {
      setVehicleStatusSaving(false);
    }
  };

  const handleSaveEditingVehicleAvailability = async () => {
    if (!editingVehicle) return;
    if (!vehicleAvailabilityDays.length) { setToast({ text: 'Seleziona almeno un giorno', tone: 'danger' }); return; }
    if (vehicleAvailabilityEnd <= vehicleAvailabilityStart) { setToast({ text: 'Orario non valido', tone: 'danger' }); return; }
    setVehicleAvailabilitySaving(true);
    try {
      const anchor = new Date(); anchor.setHours(0, 0, 0, 0);
      const start = new Date(anchor); start.setHours(vehicleAvailabilityStart.getHours(), vehicleAvailabilityStart.getMinutes(), 0, 0);
      const end = new Date(anchor); end.setHours(vehicleAvailabilityEnd.getHours(), vehicleAvailabilityEnd.getMinutes(), 0, 0);
      const resetStart = new Date(anchor); resetStart.setHours(0, 0, 0, 0);
      const resetEnd = new Date(anchor); resetEnd.setHours(23, 59, 0, 0);
      try {
        await regloApi.deleteAvailabilitySlots({ ownerType: 'vehicle', ownerId: editingVehicle.id, startsAt: resetStart.toISOString(), endsAt: resetEnd.toISOString(), daysOfWeek: [0, 1, 2, 3, 4, 5, 6], weeks: settings?.availabilityWeeks ?? 4 });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/nessuno slot/i.test(message)) throw err;
      }
      await regloApi.createAvailabilitySlots({ ownerType: 'vehicle', ownerId: editingVehicle.id, startsAt: start.toISOString(), endsAt: end.toISOString(), daysOfWeek: vehicleAvailabilityDays, weeks: settings?.availabilityWeeks ?? 4 });
      setToast({ text: 'Disponibilita veicolo salvata', tone: 'success' });
      setEditVehicleDrawerOpen(false);
      setEditingVehicle(null);
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : 'Errore salvando disponibilita veicolo', tone: 'danger' });
    } finally {
      setVehicleAvailabilitySaving(false);
    }
  };

  const handleRefresh = useCallback(async () => { setRefreshing(true); await loadData(); setRefreshing(false); }, [loadData]);

  if (!instructorId) return <Screen><StatusBar style="dark" /><View style={styles.empty}><Text style={styles.emptyText}>Profilo istruttore mancante</Text></View></Screen>;

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        <View style={styles.header}>
          <Text style={styles.title}>Veicoli</Text>
          <Badge label="Istruttore" />
        </View>

        {initialLoading ? (
          <View style={{ gap: spacing.sm }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <SkeletonCard key={`skel-${i}`} style={styles.vehicleSkeletonCard}>
                <SkeletonBlock width="54%" height={18} />
                <SkeletonBlock width="36%" height={14} />
                <SkeletonBlock width="28%" height={22} radius={999} />
              </SkeletonCard>
            ))}
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Pressable onPress={() => { resetVehicleForm(); setCreateVehicleDrawerOpen(true); }} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}>
              <Ionicons name="add-circle" size={20} color="#92400E" />
              <Text style={styles.addBtnText}>Aggiungi veicolo</Text>
            </Pressable>

            {vehicles.map((vehicle) => (
              <Pressable key={vehicle.id} onPress={() => openEditVehicleDrawer(vehicle)} style={({ pressed }) => [styles.vehicleCard, pressed && { transform: [{ scale: 0.98 }] }]}>
                <Text style={styles.vehicleEmoji}>{'\uD83D\uDE97'}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.vehicleName}>{vehicle.name}</Text>
                    <Badge label={vehicle.status === 'inactive' ? 'Inattivo' : 'Attivo'} tone={vehicle.status === 'inactive' ? 'warning' : 'success'} />
                  </View>
                  <Text style={styles.vehiclePlate}>Targa: {vehicle.plate ?? '\u2014'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
              </Pressable>
            ))}
            {!vehicles.length && <Text style={styles.emptyText}>Nessun veicolo.</Text>}
          </View>
        )}
      </ScrollView>

      {/* Create Vehicle BottomSheet */}
      <BottomSheet visible={createVehicleDrawerOpen} title="Nuovo veicolo" onClose={() => !vehicleCreating && setCreateVehicleDrawerOpen(false)} closeDisabled={vehicleCreating} showHandle footer={<View style={styles.sheetFooter}><Button label={vehicleCreating ? 'Creazione...' : 'Crea'} tone="primary" onPress={vehicleCreating ? undefined : handleCreateVehicle} disabled={vehicleCreating} fullWidth /></View>}>
        <View style={styles.sheetContent}>
          <Input placeholder="Nome veicolo" value={vehicleName} onChangeText={setVehicleName} />
          <Input placeholder="Targa" value={vehiclePlate} onChangeText={setVehiclePlate} />
        </View>
      </BottomSheet>

      {/* Edit Vehicle BottomSheet */}
      <BottomSheet visible={editVehicleDrawerOpen} title={editingVehicle ? `Modifica ${editingVehicle.name}` : 'Modifica veicolo'} onClose={() => !(vehicleAvailabilitySaving || vehicleStatusSaving) && (setEditVehicleDrawerOpen(false), setEditingVehicle(null))} closeDisabled={vehicleAvailabilitySaving || vehicleStatusSaving} showHandle footer={<View style={styles.sheetFooter}><Button label={vehicleAvailabilitySaving ? 'Salvataggio...' : 'Salva'} tone="primary" onPress={vehicleAvailabilitySaving ? undefined : handleSaveEditingVehicleAvailability} disabled={vehicleAvailabilitySaving || vehicleStatusSaving} fullWidth /></View>}>
        {editingVehicle ? (
          <View style={styles.sheetContent}>
            <View style={styles.vehicleInfoBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 28 }}>{'\uD83D\uDE97'}</Text>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{editingVehicle.name}</Text>
                    <Text style={{ fontSize: 13, color: '#94A3B8' }}>Targa: {editingVehicle.plate ?? '\u2014'}</Text>
                  </View>
                </View>
                <Badge label={editingVehicle.status === 'inactive' ? 'Inattivo' : 'Attivo'} tone={editingVehicle.status === 'inactive' ? 'warning' : 'success'} />
              </View>
            </View>

            <Pressable onPress={handleToggleEditingVehicleStatus} disabled={vehicleStatusSaving} style={({ pressed }) => [styles.statusToggle, pressed && { opacity: 0.7 }]}>
              <Text style={styles.statusToggleText}>{vehicleStatusSaving ? 'Attendere...' : editingVehicle.status === 'inactive' ? 'Riattiva veicolo' : 'Disattiva veicolo'}</Text>
            </Pressable>

            {vehicleAvailabilityLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.sectionLabel}>DISPONIBILITÀ</Text>
                <View style={styles.dayRow}>
                  {dayLetters.map((letter, index) => (
                    <Pressable key={`vd-${index}`} onPress={() => toggleVehicleDay(index)} style={[styles.dayCircle, vehicleAvailabilityDays.includes(index) ? styles.dayActive : styles.dayInactive]}>
                      <Text style={[styles.dayText, vehicleAvailabilityDays.includes(index) ? styles.dayTextActive : styles.dayTextInactive]}>{letter}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.timeRow}>
                  <Pressable onPress={() => { setEditVehicleDrawerOpen(false); setTimeout(() => setVehicleStartTimePickerOpen(true), 350); }} style={styles.timeCard}>
                    <Text style={styles.timeLabel}>INIZIO</Text>
                    <View style={styles.timeValRow}><Ionicons name="time-outline" size={16} color="#EC4899" /><Text style={styles.timeVal}>{toTimeString(vehicleAvailabilityStart)}</Text></View>
                  </Pressable>
                  <Pressable onPress={() => { setEditVehicleDrawerOpen(false); setTimeout(() => setVehicleEndTimePickerOpen(true), 350); }} style={styles.timeCard}>
                    <Text style={styles.timeLabel}>FINE</Text>
                    <View style={styles.timeValRow}><Ionicons name="time-outline" size={16} color="#EC4899" /><Text style={styles.timeVal}>{toTimeString(vehicleAvailabilityEnd)}</Text></View>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ) : null}
      </BottomSheet>

      <TimePickerDrawer visible={vehicleStartTimePickerOpen} selectedTime={vehicleAvailabilityStart} onSelectTime={setVehicleAvailabilityStart} onClose={() => { setVehicleStartTimePickerOpen(false); setTimeout(() => setEditVehicleDrawerOpen(true), 350); }} />
      <TimePickerDrawer visible={vehicleEndTimePickerOpen} selectedTime={vehicleAvailabilityEnd} onSelectTime={setVehicleAvailabilityEnd} onClose={() => { setVehicleEndTimePickerOpen(false); setTimeout(() => setEditVehicleDrawerOpen(true), 350); }} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 + spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#1E293B' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 999, backgroundColor: '#FACC15', shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  addBtnText: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: radii.sm, padding: 16, gap: 14, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  vehicleEmoji: { fontSize: 28 },
  vehicleName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  vehiclePlate: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  vehicleSkeletonCard: { borderRadius: radii.lg, backgroundColor: '#FFFFFF', padding: 20, gap: 10 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  sheetContent: { paddingHorizontal: spacing.lg, gap: spacing.md },
  sheetFooter: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  vehicleInfoBox: { backgroundColor: '#F8FAFC', borderRadius: radii.sm, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  statusToggle: { alignItems: 'center', paddingVertical: spacing.xs },
  statusToggleText: { fontSize: 13, fontWeight: '600', color: '#F59E0B' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayRow: { flexDirection: 'row', gap: spacing.xs },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayActive: { backgroundColor: '#FACC15' },
  dayInactive: { backgroundColor: '#F1F5F9' },
  dayText: { fontSize: 13, fontWeight: '700' },
  dayTextActive: { color: '#FFFFFF' },
  dayTextInactive: { color: '#64748B' },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: radii.sm, borderWidth: 1, borderColor: '#F1F5F9', padding: 12, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  timeLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  timeValRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeVal: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
});
