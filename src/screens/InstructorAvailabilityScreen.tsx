import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Screen } from '../components/Screen';
import { Badge } from '../components/Badge';
import { SelectableChip } from '../components/SelectableChip';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { AvailabilityEditor } from './InstructorManageScreen';
import { regloApi } from '../services/regloApi';
import { AutoscuolaSettings } from '../types/regloApi';
import { colors, radii, spacing } from '../theme';
import { useSession } from '../context/SessionContext';

const DURATION_OPTIONS = [30, 60, 90, 120] as const;

export const InstructorAvailabilityScreen = () => {
  const { instructorId } = useSession();
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  // Autonomous mode booking settings
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [bookingSlotDurations, setBookingSlotDurations] = useState<number[]>([]);
  const [roundedHoursOnly, setRoundedHoursOnly] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [settingsRes, instrSettings] = await Promise.all([
        regloApi.getAutoscuolaSettings(),
        regloApi.getInstructorSettings().catch(() => null),
      ]);
      setSettings(settingsRes);
      if (instrSettings) {
        setAutonomousMode(instrSettings.autonomousMode);
        if (instrSettings.autonomousMode) {
          setBookingSlotDurations(
            instrSettings.settings.bookingSlotDurations ?? instrSettings.companyDefaults.bookingSlotDurations,
          );
          setRoundedHoursOnly(
            instrSettings.settings.roundedHoursOnly ?? instrSettings.companyDefaults.roundedHoursOnly,
          );
        }
      }
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

  const toggleDuration = (dur: number) => {
    setBookingSlotDurations((prev) =>
      prev.includes(dur) ? prev.filter((d) => d !== dur) : [...prev, dur].sort((a, b) => a - b),
    );
  };

  const handleSaveBookingSettings = async () => {
    if (!bookingSlotDurations.length) {
      setToast({ text: 'Seleziona almeno una durata', tone: 'danger' });
      return;
    }
    setSettingsSaving(true);
    try {
      await regloApi.updateInstructorSettings({ bookingSlotDurations, roundedHoursOnly });
      setToast({ text: 'Impostazioni salvate', tone: 'success' });
    } catch {
      setToast({ text: 'Errore nel salvataggio', tone: 'danger' });
    } finally {
      setSettingsSaving(false);
    }
  };

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
          <>
            <AvailabilityEditor
              title="Disponibilità istruttore"
              ownerType="instructor"
              ownerId={instructorId}
              weeks={settings?.availabilityWeeks ?? 4}
              onToast={(text, tone = 'success') => setToast({ text, tone })}
            />

            {autonomousMode ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.bookingCard}>
                <Text style={styles.bookingTitle}>Impostazioni prenotazione</Text>
                <Text style={styles.bookingDesc}>
                  Configura come i tuoi allievi possono prenotare le guide.
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Durata guide</Text>
                  <View style={styles.chipsRow}>
                    {DURATION_OPTIONS.map((dur) => (
                      <SelectableChip
                        key={dur}
                        label={`${dur} min`}
                        active={bookingSlotDurations.includes(dur)}
                        onPress={() => toggleDuration(dur)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>Solo orari tondi</Text>
                    <Text style={styles.toggleDesc}>
                      Prenotazioni solo a inizio ora (es. 9:00, 10:00)
                    </Text>
                  </View>
                  <Switch
                    value={roundedHoursOnly}
                    onValueChange={setRoundedHoursOnly}
                    trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <Pressable
                  onPress={settingsSaving ? undefined : handleSaveBookingSettings}
                  disabled={settingsSaving}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    pressed && { opacity: 0.85 },
                    settingsSaving && { opacity: 0.6 },
                  ]}
                >
                  {settingsSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Salva impostazioni</Text>
                  )}
                </Pressable>
              </Animated.View>
            ) : null}
          </>
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

  /* Booking settings */
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  bookingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  bookingDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: -8,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  toggleDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 2,
  },
  saveBtn: {
    height: 48,
    borderRadius: 999,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
