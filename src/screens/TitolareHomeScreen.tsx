import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { GlassBadge } from '../components/GlassBadge';
import { GlassCard } from '../components/GlassCard';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
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
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <Screen>
      <StatusBar style="dark" />
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
            <Text style={styles.title}>Reglo Autoscuole</Text>
            <Text style={styles.subtitle}>KPI e controllo slot</Text>
          </View>
          <GlassBadge label="Titolare" />
        </View>

        {!initialLoading && error ? <Text style={styles.error}>{error}</Text> : null}

        <GlassCard title="Dashboard KPI" subtitle="Performance quotidiana">
          {initialLoading ? (
            <View style={styles.kpiGrid}>
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonCard key={`owner-kpi-skeleton-${index}`} style={styles.kpiSkeletonItem}>
                  <SkeletonBlock width="48%" height={24} />
                  <SkeletonBlock width="72%" height={12} />
                </SkeletonCard>
              ))}
            </View>
          ) : (
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
          )}
        </GlassCard>

        <SectionHeader
          title="Gestione veicoli"
          subtitle="Stato e disponibilita mezzi"
          action="Flotta"
        />
        <GlassCard>
          <View style={styles.vehicleList}>
            {initialLoading ? (
              Array.from({ length: 2 }).map((_, index) => (
                <SkeletonCard key={`owner-vehicle-skeleton-${index}`}>
                  <SkeletonBlock width="52%" height={20} />
                  <SkeletonBlock width="34%" />
                  <SkeletonBlock width="26%" height={22} radius={999} />
                </SkeletonCard>
              ))
            ) : (
              <>
                {vehicles.map((vehicle) => (
                  <View key={vehicle.id} style={styles.vehicleRow}>
                    <View style={styles.vehicleMain}>
                      <Text style={styles.vehicleName}>{vehicle.name}</Text>
                      <Text style={styles.vehicleMeta}>Targa: {vehicle.plate ?? '—'}</Text>
                    </View>
                    <GlassBadge
                      label={vehicle.status === 'inactive' ? 'Inattivo' : 'Attivo'}
                      tone={vehicle.status === 'inactive' ? 'warning' : 'success'}
                    />
                  </View>
                ))}
                {!vehicles.length ? <Text style={styles.empty}>Nessun veicolo.</Text> : null}
              </>
            )}
          </View>
        </GlassCard>

        <SectionHeader
          title="Scadenze"
          subtitle="Documenti e pratiche imminenti"
          action="Attenzione"
        />
        <GlassCard>
          <View style={styles.deadlineList}>
            {initialLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <SkeletonCard key={`owner-deadline-skeleton-${index}`}>
                  <SkeletonBlock width="58%" height={20} />
                  <SkeletonBlock width="44%" />
                </SkeletonCard>
              ))
            ) : (
              <>
                {deadlines.map((deadline) => (
                  <View key={deadline.id} style={styles.deadlineRow}>
                    <View style={styles.deadlineMain}>
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
              </>
            )}
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
    paddingBottom: spacing.xxl * 2 + spacing.md,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.12)',
  },
  kpiSkeletonItem: {
    flex: 1,
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
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  vehicleMain: {
    flex: 1,
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
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deadlineMain: {
    flex: 1,
    minWidth: 0,
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
