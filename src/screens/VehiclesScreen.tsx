import React, { useCallback, useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { SkeletonBlock } from '../components/Skeleton';
import { ClayEmpty, ClayIconButton, ClayList, ClayListRow } from '../components/clay';
import { ClayLargeTitleScroll } from '../components/ClayLargeTitle';
import { CLAY } from '../theme/clay';
import { MORALE_ART } from '../theme/moraleArt';
import { regloApi } from '../services/regloApi';
import { vehicleFormStore } from '../stores/vehicleFormStore';
import { AutoscuolaVehicle, AutoscuolaSettings } from '../types/regloApi';
import { isMotoLicenseCategory, transmissionLabel } from '../utils/license';
import { car34Art } from '../road/markerArt';

const MOTO_ART = require('../../assets/icons3d-ai/moto.png');
import { useSession } from '../context/SessionContext';

/**
 * Veicoli — REG-639 clay: testata grande (indietro + «+» clay), i mezzi in
 * una lista clay senza icone. «Il tuo» e lo stato (Inattivo, Manutenzione)
 * stanno nel sottotitolo come testo; i veicoli inattivi sono più tenui.
 * Tocca → modifica, ••• → menu nativo attiva/disattiva.
 */
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

  // Una riga umana sotto il titolo: quanti mezzi e qual è il tuo.
  const mineVehicle = instructorId ? vehicles.find((v) => v.assignedInstructorId === instructorId) : null;
  const headerLine = loading
    ? "I mezzi dell'autoscuola disponibili per le guide."
    : [
        vehicles.length === 1 ? '1 mezzo' : `${vehicles.length} mezzi`,
        mineVehicle ? `la ${mineVehicle.name} è la tua` : null,
      ].filter(Boolean).join(' · ');

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      <ClayLargeTitleScroll
        title="Veicoli"
        subtitle={headerLine}
        onBack={() => router.back()}
        actions={
          <ClayIconButton icon="add" onPress={() => openForm(null)} accessibilityLabel="Aggiungi veicolo" testID="vehicles-add" />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={CLAY.ink3} colors={[CLAY.ink]} />
        }
        contentContainerStyle={styles.content}
      >

        {loading ? (
          <ClayList style={styles.list}>
            {[0, 1, 2].map((i) => (
              <ClayListRow
                key={`skel-${i}`}
                title=" "
                subtitle={<SkeletonBlock width={160} height={12} radius={6} />}
              />
            ))}
          </ClayList>
        ) : vehicles.length === 0 ? (
          <ClayEmpty
            icon={MORALE_ART.piantina}
            title="Nessun veicolo"
            text="Aggiungi i mezzi dell'autoscuola con il + in alto a destra."
            style={styles.empty}
          />
        ) : (
          <ClayList style={styles.list}>
            {vehicles.map((vehicle) => {
              // "Mine" = reserved to me OR in my shared pool.
              const isMine =
                !!instructorId &&
                (vehicle.assignedInstructorId === instructorId ||
                  (vehicle.poolInstructorIds ?? []).includes(instructorId));
              const licenseLabel = `${vehicle.licenseCategory} · ${transmissionLabel(vehicle.transmission)}`;
              const usageLabel = vehicle.assignedInstructorId
                ? 'Esclusivo'
                : (vehicle.poolInstructorIds?.length ?? 0) > 0
                  ? `Pool · ${vehicle.poolInstructorIds.length}`
                  : 'Aperto';
              const statusTag =
                vehicle.status === 'inactive'
                  ? 'Inattivo'
                  : vehicle.status === 'maintenance'
                    ? 'Manutenzione'
                    : null;
              // Lo stato va per primo: un veicolo inattivo si riconosce subito.
              const sub = [statusTag, isMine ? 'Il tuo' : null, vehicle.plate, licenseLabel, usageLabel]
                .filter(Boolean)
                .join(' · ');
              return (
                <ClayListRow
                  key={vehicle.id}
                  // REG-639 «vita»: il mezzo col suo oggetto 3D — l'auto nel colore
                  // vero del veicolo (Aspetto agenda), la moto per le moto.
                  leading={
                    isMotoLicenseCategory(vehicle.licenseCategory) ? (
                      <Image source={MOTO_ART} style={styles.motoArt} />
                    ) : (
                      <Image source={car34Art(vehicle.color)} style={styles.carArt} resizeMode="contain" />
                    )
                  }
                  dimmed={vehicle.status === 'inactive'}
                  title={vehicle.name}
                  subtitle={sub || undefined}
                  onPress={() => openForm(vehicle)}
                  chevron={false}
                  trailing={
                    <Pressable
                      onPress={() => openActions(vehicle)}
                      hitSlop={12}
                      style={styles.ellipsisBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Azioni per ${vehicle.name}`}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color={CLAY.ink3} />
                    </Pressable>
                  }
                  testID={`vehicle-row-${vehicle.id}`}
                />
              );
            })}
          </ClayList>
        )}
      </ClayLargeTitleScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  carArt: { width: 58, height: 47, marginVertical: -4 },
  motoArt: { width: 50, height: 50, marginHorizontal: 4, marginVertical: -4 },
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: 20, paddingBottom: 140 },
  list: { marginTop: 22 },
  empty: { marginTop: 20 },
  ellipsisBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
