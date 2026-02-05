import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassBadge } from '../components/GlassBadge';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { GlassInput } from '../components/GlassInput';
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

const toTimeString = (value: Date) => value.toTimeString().slice(0, 5);

type PickerFieldProps = {
  label: string;
  value: Date;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
};

const PickerField = ({ label, value, mode, onChange }: PickerFieldProps) => {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable onPress={() => setOpen(true)}>
        <GlassInput
          editable={false}
          placeholder={label}
          value={mode === 'date' ? value.toLocaleDateString('it-IT') : toTimeString(value)}
        />
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display="default"
          onChange={(_, selected) => {
            setOpen(false);
            if (selected) onChange(selected);
          }}
        />
      ) : null}
    </View>
  );
};

type AvailabilityEditorProps = {
  title: string;
  ownerType: 'student' | 'instructor' | 'vehicle';
  ownerId: string | null;
  weeks: number;
};

const AvailabilityEditor = ({ title, ownerType, ownerId, weeks }: AvailabilityEditorProps) => {
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState(buildTime(9, 0));
  const [endTime, setEndTime] = useState(buildTime(18, 0));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const toggleDay = (day: number) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort()));
  };

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
      setError('Seleziona almeno un giorno');
      return;
    }
    if (endTime <= startTime) {
      setError('Orario non valido');
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const { start, end } = buildAnchorRange();
      await regloApi.createAvailabilitySlots({
        ownerType,
        ownerId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        daysOfWeek: days,
        weeks,
      });
      setMessage('Disponibilita salvata');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvando disponibilita');
    }
  };

  const handleDelete = async () => {
    if (!ownerId) return;
    setError(null);
    setMessage(null);
    try {
      const { start, end } = buildAnchorRange();
      await regloApi.deleteAvailabilitySlots({
        ownerType,
        ownerId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        daysOfWeek: days,
        weeks,
      });
      setMessage('Disponibilita rimossa');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore rimuovendo disponibilita');
    }
  };

  return (
    <GlassCard title={title}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.dayRow}>
        {dayLabels.map((label, index) => (
          <Pressable
            key={label}
            onPress={() => toggleDay(index)}
            style={[styles.dayChip, days.includes(index) && styles.dayChipActive]}
          >
            <Text style={days.includes(index) ? styles.dayTextActive : styles.dayText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.pickerRow}>
        <PickerField label="Inizio" value={startTime} mode="time" onChange={setStartTime} />
        <PickerField label="Fine" value={endTime} mode="time" onChange={setEndTime} />
      </View>
      <View style={styles.actionRow}>
        <GlassButton label="Salva" onPress={handleCreate} />
        <GlassButton label="Rimuovi" onPress={handleDelete} />
      </View>
    </GlassCard>
  );
};

export const InstructorManageScreen = () => {
  const { instructorId } = useSession();
  const [vehicles, setVehicles] = useState<AutoscuolaVehicle[]>([]);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehicleName, setVehicleName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedVehicle = useMemo(
    () => vehicles.find((item) => item.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId]
  );

  const loadData = useCallback(async () => {
    try {
      const [vehicleResponse, settingsResponse] = await Promise.all([
        regloApi.getVehicles(),
        regloApi.getAutoscuolaSettings(),
      ]);
      setVehicles(vehicleResponse);
      setSettings(settingsResponse);
      if (!selectedVehicleId && vehicleResponse.length) {
        setSelectedVehicleId(vehicleResponse[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento');
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (vehicle) {
      setEditingVehicleId(vehicleId);
      setVehicleName(vehicle.name);
      setVehiclePlate(vehicle.plate ?? '');
    }
  };

  const resetForm = () => {
    setEditingVehicleId(null);
    setVehicleName('');
    setVehiclePlate('');
  };

  const handleSaveVehicle = async () => {
    setError(null);
    setMessage(null);
    if (!vehicleName.trim()) {
      setError('Nome veicolo richiesto');
      return;
    }
    try {
      if (editingVehicleId) {
        const updated = await regloApi.updateVehicle(editingVehicleId, {
          name: vehicleName.trim(),
          plate: vehiclePlate || null,
        });
        setMessage('Veicolo aggiornato');
        setVehicles((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await regloApi.createVehicle({
          name: vehicleName.trim(),
          plate: vehiclePlate || undefined,
        });
        setMessage('Veicolo creato');
        setVehicles((prev) => [created, ...prev]);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvando veicolo');
    }
  };

  const handleDeactivateVehicle = async (vehicleId: string) => {
    setError(null);
    setMessage(null);
    try {
      const updated = await regloApi.deleteVehicle(vehicleId);
      setVehicles((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setMessage('Veicolo disattivato');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore disattivando veicolo');
    }
  };

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Gestione istruttore</Text>
            <Text style={styles.subtitle}>Disponibilita e veicoli</Text>
          </View>
          <GlassBadge label="Gestione" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <AvailabilityEditor
          title={`Disponibilita istruttore · ${settings?.availabilityWeeks ?? 4} sett.`}
          ownerType="instructor"
          ownerId={instructorId}
          weeks={settings?.availabilityWeeks ?? 4}
        />

        <GlassCard title="Veicoli">
          <View style={styles.formRow}>
            <GlassInput placeholder="Nome veicolo" value={vehicleName} onChangeText={setVehicleName} />
            <GlassInput placeholder="Targa" value={vehiclePlate} onChangeText={setVehiclePlate} />
          </View>
          <View style={styles.actionRow}>
            <GlassButton label={editingVehicleId ? 'Aggiorna' : 'Aggiungi'} onPress={handleSaveVehicle} />
            {editingVehicleId ? <GlassButton label="Nuovo" onPress={resetForm} /> : null}
          </View>
          <View style={styles.vehicleList}>
            {vehicles.map((vehicle) => (
              <View key={vehicle.id} style={styles.vehicleRow}>
                <Pressable onPress={() => handleSelectVehicle(vehicle.id)}>
                  <Text style={styles.vehicleName}>{vehicle.name}</Text>
                  <Text style={styles.vehicleMeta}>Targa: {vehicle.plate ?? '—'}</Text>
                  <Text style={styles.vehicleMeta}>Stato: {vehicle.status}</Text>
                </Pressable>
                <GlassButton label="Disattiva" onPress={() => handleDeactivateVehicle(vehicle.id)} />
              </View>
            ))}
            {!vehicles.length ? <Text style={styles.emptyText}>Nessun veicolo.</Text> : null}
          </View>
        </GlassCard>

        <AvailabilityEditor
          title="Disponibilita veicolo"
          ownerType="vehicle"
          ownerId={selectedVehicle?.id ?? null}
          weeks={settings?.availabilityWeeks ?? 4}
        />
      </ScrollView>
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  dayChipActive: {
    backgroundColor: colors.glassStrong,
  },
  dayText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  dayTextActive: {
    ...typography.body,
    color: colors.textPrimary,
  },
  formRow: {
    gap: spacing.sm,
  },
  vehicleList: {
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
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
  message: {
    ...typography.body,
    color: colors.success,
  },
});
