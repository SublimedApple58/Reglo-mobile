import React, { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { SkeletonBlock } from '../components/Skeleton';
import { ClayEmpty, ClayIconButton, ClayList, ClayListRow, ClaySection, ClaySurface } from '../components/clay';
import { SEDE_COVER_FALLBACK } from '../theme/vitaArt';
import { ClayPageHeader } from '../components/ClayPageHeader';
import { CLAY } from '../theme/clay';
import { MORALE_ART } from '../theme/moraleArt';
import { regloApi } from '../services/regloApi';
import { useSession } from '../context/SessionContext';
import { useLocations } from '../hooks/queries/useLocations';
import { queryKeys } from '../hooks/queries/queryKeys';
import { locationFormStore } from '../stores/locationFormStore';
import type { AutoscuolaLocation, CreateLocationInput } from '../types/regloApi';

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Luoghi guida — REG-639 clay: testata grande (indietro + «+» clay), la sede
 * in una lista clay a sé con la nota sotto, poi gli altri luoghi in una lista
 * clay senza icone. Tocca → modifica, ••• → menu nativo (Maps, elimina).
 * Nessun luogo aggiuntivo = stato vuoto con la piantina.
 */
export const LocationsScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeCompanyId } = useSession();
  const queryClient = useQueryClient();
  const { data: locations = [], isLoading } = useLocations();

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.locations(activeCompanyId) }),
    [queryClient, activeCompanyId],
  );

  const openForm = useCallback(
    (initial: AutoscuolaLocation | null) => {
      locationFormStore.set({
        initial,
        onSubmit: async (values: CreateLocationInput) => {
          if (initial) await regloApi.updateLocation(initial.id, values);
          else await regloApi.createLocation(values);
          await invalidate();
        },
      });
      router.push('/(tabs)/more/location-form');
    },
    [router, invalidate],
  );

  const handleDelete = (loc: AutoscuolaLocation) => {
    Alert.alert('Eliminare luogo?', `"${loc.name}" sarà rimosso dalla lista.`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          try {
            await regloApi.deleteLocation(loc.id);
            await invalidate();
          } catch (err) {
            Alert.alert('Errore', err instanceof Error ? err.message : 'Eliminazione fallita.');
          }
        },
      },
    ]);
  };

  const openMaps = (loc: AutoscuolaLocation) => {
    const lat = toNumber(loc.latitude);
    const lng = toNumber(loc.longitude);
    if (lat == null || lng == null) return;
    const placeIdParam = loc.placeId ? `&query_place_id=${loc.placeId}` : '';
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}${placeIdParam}`;
    Linking.openURL(url).catch(() => null);
  };

  // Tapping a location opens a native action menu (Airbnb-style) instead of
  // inline buttons cluttering each row.
  const openActions = (loc: AutoscuolaLocation) => {
    const lat = toNumber(loc.latitude);
    const lng = toNumber(loc.longitude);
    const canMaps = loc.isPrecise && lat != null && lng != null;

    if (Platform.OS === 'ios') {
      const options = [
        ...(canMaps ? ['Apri in Maps'] : []),
        'Elimina',
        'Annulla',
      ];
      const cancelButtonIndex = options.length - 1;
      const destructiveButtonIndex = options.length - 2;
      ActionSheetIOS.showActionSheetWithOptions(
        { title: loc.name, options, cancelButtonIndex, destructiveButtonIndex },
        (i) => {
          const label = options[i];
          if (label === 'Apri in Maps') openMaps(loc);
          else if (label === 'Elimina') handleDelete(loc);
        },
      );
    } else {
      Alert.alert(loc.name, undefined, [
        ...(canMaps ? [{ text: 'Apri in Maps', onPress: () => openMaps(loc) }] : []),
        { text: 'Elimina', style: 'destructive' as const, onPress: () => handleDelete(loc) },
        { text: 'Annulla', style: 'cancel' as const },
      ]);
    }
  };

  const [coverFailed, setCoverFailed] = useState(false);
  const sede = locations.find((l) => l.isDefault) ?? null;
  const customs = locations.filter((l) => !l.isDefault);
  const sedeTappable = sede?.isPrecise && toNumber(sede.latitude) != null && toNumber(sede.longitude) != null;

  const ellipsis = (loc: AutoscuolaLocation) => (
    <Pressable
      onPress={() => openActions(loc)}
      hitSlop={12}
      style={styles.trailingBtn}
      accessibilityRole="button"
      accessibilityLabel={`Azioni per ${loc.name}`}
    >
      <Ionicons name="ellipsis-horizontal" size={20} color={CLAY.ink3} />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
        <ClayPageHeader
          title="Luoghi guida"
          subtitle="Da dove partono le tue guide"
          onBack={() => router.back()}
          actions={
            <ClayIconButton icon="add" onPress={() => openForm(null)} accessibilityLabel="Aggiungi luogo" testID="locations-add" />
          }
        />

        {/* REG-639 «vita»: la sede con la sua foto (caricata dal titolare dalla
            web app; senza foto, o se non si carica, la foto d'esempio). */}
        <ClaySection
          title="Sede principale"
          footnote="La sede e la sua foto le cambia il titolare dalla web app. È il luogo di default di ogni guida."
        >
          {isLoading ? (
            <ClayList>
              <ClayListRow title=" " subtitle={<SkeletonBlock width={180} height={12} radius={6} />} />
            </ClayList>
          ) : (
            <ClaySurface padded={false} radius={26} testID="locations-sede">
              <View style={styles.coverClip}>
                <Image
                  source={sede?.coverPhotoUrl && !coverFailed ? { uri: sede.coverPhotoUrl } : SEDE_COVER_FALLBACK}
                  onError={() => setCoverFailed(true)}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.sedeRow}>
                <View style={styles.sedeMain}>
                  <Text style={styles.sedeName} numberOfLines={1}>{sede?.name ?? "Sede dell'autoscuola"}</Text>
                  <Text style={styles.sedeSub} numberOfLines={2}>
                    {sede?.address || (sede?.isPrecise ? 'Posizione sulla mappa' : 'Posizione generica')}
                  </Text>
                </View>
                {sedeTappable ? (
                  <Pressable
                    onPress={() => openMaps(sede!)}
                    hitSlop={8}
                    style={styles.trailingBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Apri in Maps"
                  >
                    <Text style={styles.mapsTx}>Maps</Text>
                  </Pressable>
                ) : null}
              </View>
            </ClaySurface>
          )}
        </ClaySection>

        <ClaySection title="Altri luoghi">
          {isLoading ? (
            <ClayList>
              {[0, 1].map((i) => (
                <ClayListRow key={`skel-${i}`} title=" " subtitle={<SkeletonBlock width={160} height={12} radius={6} />} />
              ))}
            </ClayList>
          ) : customs.length === 0 ? (
            <ClayEmpty
              icon={MORALE_ART.piantina}
              title="Nessun luogo aggiuntivo"
              text="Aggiungi parcheggi, punti di ritrovo o aree di esercitazione."
            />
          ) : (
            <ClayList>
              {customs.map((loc) => (
                <ClayListRow
                  key={loc.id}
                  title={loc.name}
                  subtitle={loc.address || (loc.isPrecise ? undefined : 'Senza posizione precisa')}
                  onPress={() => openForm(loc)}
                  chevron={false}
                  trailing={ellipsis(loc)}
                  testID={`location-row-${loc.id}`}
                />
              ))}
            </ClayList>
          )}
        </ClaySection>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  coverClip: { height: 150, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden', backgroundColor: '#F2F0EC' },
  sedeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 18 },
  sedeMain: { flex: 1, minWidth: 0 },
  sedeName: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  sedeSub: { fontSize: 14, color: CLAY.ink3, marginTop: 2 },
  root: { flex: 1, backgroundColor: CLAY.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 140 },
  trailingBtn: { minWidth: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  mapsTx: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
});
