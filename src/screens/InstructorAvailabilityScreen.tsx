import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { Badge } from '../components/Badge';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { AvailabilityEditor } from './InstructorManageScreen';
import { regloApi } from '../services/regloApi';
import { AutoscuolaSettings } from '../types/regloApi';
import { colors, radii, spacing } from '../theme';
import { useSession } from '../context/SessionContext';

export const InstructorAvailabilityScreen = () => {
  const { instructorId } = useSession();
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const settingsRes = await regloApi.getAutoscuolaSettings();
      setSettings(settingsRes);
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
        <View style={styles.header}>
          <Text style={styles.title}>Disponibilità</Text>
          <Badge label="Istruttore" />
        </View>

        {initialLoading ? (
          <SkeletonCard style={styles.skeletonCard}>
            <SkeletonBlock width="60%" height={12} />
            <SkeletonBlock width="50%" height={10} />
            <SkeletonBlock width="100%" height={40} radius={20} style={{ marginTop: 8 }} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <SkeletonBlock width="48%" height={60} radius={radii.sm} />
              <SkeletonBlock width="48%" height={60} radius={radii.sm} />
            </View>
            <SkeletonBlock width="100%" height={50} radius={radii.sm} style={{ marginTop: 8 }} />
          </SkeletonCard>
        ) : (
          <AvailabilityEditor
            title="Disponibilità istruttore"
            ownerType="instructor"
            ownerId={instructorId}
            weeks={settings?.availabilityWeeks ?? 4}
            onToast={(text, tone = 'success') => setToast({ text, tone })}
          />
        )}
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
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },
  skeletonCard: {
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    padding: 22,
    gap: spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
