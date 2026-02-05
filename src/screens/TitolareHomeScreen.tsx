import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassBadge } from '../components/GlassBadge';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { regloApi } from '../services/regloApi';
import {
  AutoscuolaDeadlineItem,
  AutoscuolaOverview,
  AutoscuolaVehicle,
} from '../types/regloApi';
import { colors, spacing, typography } from '../theme';

export const TitolareHomeScreen = () => {
  const [overview, setOverview] = useState<AutoscuolaOverview | null>(null);
  const [vehicles, setVehicles] = useState<AutoscuolaVehicle[]>([]);
  const [deadlines, setDeadlines] = useState<AutoscuolaDeadlineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const [overviewResponse, vehiclesResponse, deadlinesResponse] = await Promise.all([
          regloApi.getOverview(),
          regloApi.getVehicles(),
          regloApi.getDeadlines(),
        ]);
        setOverview(overviewResponse);
        setVehicles(vehiclesResponse);
        setDeadlines(deadlinesResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore nel caricamento');
      }
    };
    load();
  }, []);

  return (
    <Screen>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Reglo Autoscuole</Text>
            <Text style={styles.subtitle}>KPI e controllo slot</Text>
          </View>
          <GlassBadge label="Titolare" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <GlassCard title="Dashboard KPI" subtitle="Performance quotidiana">
          <View style={styles.kpiGrid}>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{overview?.studentsCount ?? '—'}</Text>
              <Text style={styles.kpiLabel}>Allievi</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{overview?.activeCasesCount ?? '—'}</Text>
              <Text style={styles.kpiLabel}>Pratiche attive</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiValue}>{overview?.upcomingAppointmentsCount ?? '—'}</Text>
              <Text style={styles.kpiLabel}>Guide in arrivo</Text>
            </View>
          </View>
        </GlassCard>

        <SectionHeader title="Gestione veicoli" action="Flotta" />
        <GlassCard>
          <View style={styles.vehicleList}>
            {vehicles.map((vehicle) => (
              <View key={vehicle.id} style={styles.vehicleRow}>
                <View>
                  <Text style={styles.vehicleName}>{vehicle.name}</Text>
                  <Text style={styles.vehicleMeta}>Targa: {vehicle.plate ?? '—'}</Text>
                  <Text style={styles.vehicleMeta}>Stato: {vehicle.status}</Text>
                </View>
              </View>
            ))}
            {!vehicles.length ? <Text style={styles.empty}>Nessun veicolo.</Text> : null}
          </View>
        </GlassCard>

        <SectionHeader title="Scadenze" action="Attenzione" />
        <GlassCard>
          <View style={styles.deadlineList}>
            {deadlines.map((deadline) => (
              <View key={deadline.id} style={styles.deadlineRow}>
                <View>
                  <Text style={styles.deadlineTitle}>{deadline.studentName}</Text>
                  <Text style={styles.deadlineMeta}>{deadline.deadlineType}</Text>
                </View>
                <GlassBadge
                  label={deadline.status}
                  tone={deadline.status === 'overdue' ? 'danger' : deadline.status === 'soon' ? 'warning' : 'default'}
                />
              </View>
            ))}
            {!deadlines.length ? <Text style={styles.empty}>Nessuna scadenza.</Text> : null}
          </View>
        </GlassCard>

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
  kpiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  kpiItem: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  kpiValue: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  kpiLabel: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  vehicleList: {
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
  deadlineList: {
    gap: spacing.md,
  },
  deadlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deadlineTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  deadlineMeta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
});
