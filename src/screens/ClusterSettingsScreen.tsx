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
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { SelectableChip } from '../components/SelectableChip';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { regloApi } from '../services/regloApi';
import { colors, spacing } from '../theme';

const DURATION_OPTIONS = [30, 60, 90, 120] as const;

export const ClusterSettingsScreen = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [bookingSlotDurations, setBookingSlotDurations] = useState<number[]>([30, 60]);
  const [roundedHoursOnly, setRoundedHoursOnly] = useState(false);
  const [companyDefaults, setCompanyDefaults] = useState<{ bookingSlotDurations: number[]; roundedHoursOnly: boolean }>({
    bookingSlotDurations: [30, 60],
    roundedHoursOnly: false,
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await regloApi.getInstructorSettings();
      setCompanyDefaults(res.companyDefaults);
      setBookingSlotDurations(
        res.settings.bookingSlotDurations ?? res.companyDefaults.bookingSlotDurations,
      );
      setRoundedHoursOnly(
        res.settings.roundedHoursOnly ?? res.companyDefaults.roundedHoursOnly,
      );
    } catch {
      setToast({ text: 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleDuration = (dur: number) => {
    setBookingSlotDurations((prev) =>
      prev.includes(dur) ? prev.filter((d) => d !== dur) : [...prev, dur].sort((a, b) => a - b),
    );
  };

  const handleSave = async () => {
    if (!bookingSlotDurations.length) {
      setToast({ text: 'Seleziona almeno una durata', tone: 'danger' });
      return;
    }
    setSaving(true);
    try {
      await regloApi.updateInstructorSettings({ bookingSlotDurations, roundedHoursOnly });
      setToast({ text: 'Impostazioni salvate', tone: 'success' });
    } catch {
      setToast({ text: 'Errore nel salvataggio', tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={loadData} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Header */}
        <Pressable style={styles.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
          <Text style={styles.backTitle}>Il mio gruppo</Text>
        </Pressable>

        <Text style={styles.pageDesc}>
          Configura come i tuoi allievi possono prenotare le guide con te.
        </Text>

        {loading ? (
          <SkeletonCard style={{ padding: 16, borderRadius: 20 }}>
            <SkeletonBlock width="60%" height={16} radius={6} />
            <SkeletonBlock width="80%" height={40} radius={12} />
            <SkeletonBlock width="50%" height={16} radius={6} />
          </SkeletonCard>
        ) : (
          <>
            {/* Durata guide */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Durata guide</Text>
              <Text style={styles.sectionDesc}>
                Seleziona le durate che i tuoi allievi possono prenotare.
                {'\n'}Predefinito autoscuola: {companyDefaults.bookingSlotDurations.map((d) => `${d} min`).join(', ')}
              </Text>
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

            {/* Solo orari tondi */}
            <View style={styles.toggleCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Solo orari tondi</Text>
                <Text style={styles.toggleDesc}>
                  Gli allievi vedranno solo slot che iniziano a ore piene (es. 9:00, 10:00).
                </Text>
              </View>
              <Switch
                value={roundedHoursOnly}
                onValueChange={setRoundedHoursOnly}
                trackColor={{ false: '#E2E8F0', true: '#FACC15' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Save */}
            <Pressable
              onPress={saving ? undefined : handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && { opacity: 0.85 },
                saving && { opacity: 0.6 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Salva impostazioni</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: 20,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  pageDesc: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginTop: -4,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  toggleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  toggleDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginTop: 2,
  },
  saveBtn: {
    height: 52,
    borderRadius: 999,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
