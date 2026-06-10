import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock } from '../components/Skeleton';
import { regloApi } from '../services/regloApi';
import { vehicleFormStore } from '../stores/vehicleFormStore';
import { AutoscuolaVehicle, AutoscuolaSettings } from '../types/regloApi';
import { transmissionLabel } from '../utils/license';
import { useSession } from '../context/SessionContext';
import { colors } from '../theme';

const H_PAD = 22;
const COMPACT_H = 54;
const LARGE_TITLE_H = 56;

export const VehiclesScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { instructorId } = useSession();
  const [vehicles, setVehicles] = useState<AutoscuolaVehicle[]>([]);
  const [settings, setSettings] = useState<AutoscuolaSettings | null>(null);
  const [loading, setLoading] = useState(true);
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
    } catch {
      setToast({ text: 'Errore nel caricamento', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const openForm = useCallback(
    (initial: AutoscuolaVehicle | null) => {
      vehicleFormStore.set({
        initial,
        availabilityWeeks: settings?.availabilityWeeks ?? 4,
        onChanged: loadData,
      });
      router.push('/(tabs)/more/vehicle-form');
    },
    [router, settings, loadData],
  );

  // Toggle active/inactive. Activation = PATCH; deactivation = DELETE
  // (soft-delete = inactive), preserving the backend semantics.
  const toggleStatus = useCallback(async (vehicle: AutoscuolaVehicle) => {
    try {
      if (vehicle.status === 'inactive') {
        await regloApi.updateVehicle(vehicle.id, { status: 'active' });
        setToast({ text: 'Veicolo attivato', tone: 'success' });
      } else {
        await regloApi.deleteVehicle(vehicle.id);
        setToast({ text: 'Veicolo disattivato', tone: 'success' });
      }
      await loadData();
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : 'Errore aggiornando il veicolo', tone: 'danger' });
    }
  }, [loadData]);

  // Tapping ••• opens a native action menu (Airbnb-style); the row tap itself
  // opens the edit form.
  const openActions = useCallback((vehicle: AutoscuolaVehicle) => {
    const isActive = vehicle.status !== 'inactive';
    const statusLabel = isActive ? 'Disattiva veicolo' : 'Riattiva veicolo';
    const subtitle = vehicle.plate ? `${vehicle.name} · ${vehicle.plate}` : vehicle.name;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: subtitle,
          options: [statusLabel, 'Annulla'],
          cancelButtonIndex: 1,
          destructiveButtonIndex: isActive ? 0 : undefined,
        },
        (i) => { if (i === 0) toggleStatus(vehicle); },
      );
    } else {
      Alert.alert(subtitle, undefined, [
        { text: statusLabel, style: isActive ? 'destructive' : 'default', onPress: () => toggleStatus(vehicle) },
        { text: 'Annulla', style: 'cancel' },
      ]);
    }
  }, [toggleStatus]);

  /* ── Collapsible header ── */
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const largeTitleStyle = useAnimatedStyle(() => {
    const ty = scrollY.value < 0
      ? scrollY.value
      : interpolate(scrollY.value, [0, LARGE_TITLE_H], [0, -12], Extrapolation.CLAMP);
    return {
      opacity: interpolate(scrollY.value, [0, LARGE_TITLE_H * 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: ty }],
    };
  });
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [LARGE_TITLE_H * 0.5, LARGE_TITLE_H * 0.95], [0, 1], Extrapolation.CLAMP),
  }));
  const headerBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      {/* Sticky collapsible header */}
      <View style={[styles.headerWrap, { height: insets.top + COMPACT_H, paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, headerBgStyle]} pointerEvents="none">
          {Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(253,253,253,0.96)' }]} />
          )}
          <View style={styles.headerBorder} />
        </Animated.View>

        <View style={styles.compactRow}>
          <Pressable onPress={() => router.back()} hitSlop={6} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
          </Pressable>
          <Animated.Text style={[styles.compactTitle, compactStyle]} numberOfLines={1}>Veicoli</Animated.Text>
          <Pressable onPress={() => openForm(null)} hitSlop={6} style={styles.addBtn}>
            <Ionicons name="add" size={27} color="#1A1A2E" />
          </Pressable>
        </View>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressViewOffset={insets.top + COMPACT_H}
          />
        }
        contentContainerStyle={[styles.content, { paddingTop: insets.top + COMPACT_H }]}
      >
        <View style={{ height: LARGE_TITLE_H, justifyContent: 'flex-end' }}>
          <Animated.Text style={[styles.largeTitle, largeTitleStyle]}>Veicoli</Animated.Text>
        </View>
        <Text style={styles.pageDesc}>I mezzi dell'autoscuola disponibili per le guide.</Text>

        {loading ? (
          <View>
            {[0, 1, 2].map((i) => (
              <React.Fragment key={`skel-${i}`}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.row}>
                  <View style={styles.vIcon}>
                    <Ionicons name="car-outline" size={24} color="#D6D9E6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <SkeletonBlock width="45%" height={15} radius={6} />
                    <SkeletonBlock width="30%" height={12} radius={6} style={{ marginTop: 8 }} />
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        ) : vehicles.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <Ionicons name="car-outline" size={42} color="#6E7596" />
            </View>
            <Text style={styles.emptyTitle}>Nessun veicolo</Text>
            <Text style={styles.emptySub}>Aggiungi i mezzi dell'autoscuola con il + in alto a destra.</Text>
          </View>
        ) : (
          vehicles.map((vehicle, i) => {
            const isActive = vehicle.status !== 'inactive';
            const isMine = !!instructorId && vehicle.assignedInstructorId === instructorId;
            const licenseLabel = `${vehicle.licenseCategory} · ${transmissionLabel(vehicle.transmission)}`;
            const sub = isActive
              ? [vehicle.plate, licenseLabel].filter(Boolean).join(' · ')
              : [vehicle.plate, licenseLabel, 'Inattivo'].filter(Boolean).join(' · ');
            return (
              <React.Fragment key={vehicle.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  onPress={() => openForm(vehicle)}
                  style={({ pressed }) => [styles.row, !isActive && styles.rowInactive, pressed && styles.rowPressed]}
                >
                  <View style={styles.vIcon}>
                    <Ionicons name={isMine ? 'car-sport' : 'car-outline'} size={24} color="#1A1A2E" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.vNameRow}>
                      <Text style={styles.vName} numberOfLines={1}>{vehicle.name}</Text>
                      {isMine ? (
                        <View style={styles.minePill}>
                          <Ionicons name="person" size={10} color="#FFFFFF" />
                          <Text style={styles.minePillText}>Il tuo</Text>
                        </View>
                      ) : null}
                    </View>
                    {sub ? <Text style={styles.vSub} numberOfLines={1}>{sub}</Text> : null}
                  </View>
                  <Pressable onPress={() => openActions(vehicle)} hitSlop={12} style={styles.ellipsisBtn}>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#C7C7CC" />
                  </Pressable>
                </Pressable>
              </React.Fragment>
            );
          })
        )}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: H_PAD, paddingBottom: 120 },

  /* Header */
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerBorder: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  compactRow: { height: COMPACT_H, justifyContent: 'center', alignItems: 'center' },
  backBtn: { position: 'absolute', left: H_PAD - 4, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addBtn: { position: 'absolute', right: H_PAD - 4, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  compactTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },

  largeTitle: { fontSize: 32, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.5 },
  pageDesc: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: 6, marginBottom: 14 },

  /* Flat rows */
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, minHeight: 64 },
  rowInactive: { opacity: 0.5 },
  rowPressed: { opacity: 0.55 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 40 },
  vIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  vNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vName: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.1, flexShrink: 1 },
  minePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#1A1A2E' },
  minePillText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.1 },
  vSub: { fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 2 },
  ellipsisBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  /* Empty */
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  emptySub: { fontSize: 13, fontWeight: '400', color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18, maxWidth: 250 },
});
