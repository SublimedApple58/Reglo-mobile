import React, { useCallback } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '../components/Screen';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { colors, spacing } from '../theme';
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

export const LocationsScreen = () => {
  const router = useRouter();
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

  const sede = locations.find((l) => l.isDefault) ?? null;
  const customs = locations.filter((l) => !l.isDefault);
  const sedeTappable = sede?.isPrecise && toNumber(sede.latitude) != null && toNumber(sede.longitude) != null;

  return (
    <Screen>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </Pressable>
        <Text style={[styles.headerTitle, { flex: 1 }]}>Luoghi guida</Text>
        <Pressable onPress={() => openForm(null)} hitSlop={10} style={styles.headerAdd}>
          <Ionicons name="add" size={28} color="#1A1A2E" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Sede ── */}
        <Text style={styles.sectionLabel}>SEDE PRINCIPALE</Text>
        {isLoading ? (
          <SkeletonCard style={styles.skelCard}>
            <SkeletonBlock width="55%" height={16} radius={6} />
            <SkeletonBlock width="80%" height={12} radius={6} style={{ marginTop: 8 }} />
          </SkeletonCard>
        ) : (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name="business-outline" size={23} color="#1A1A2E" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardName} numberOfLines={1}>{sede?.name ?? "Sede dell'autoscuola"}</Text>
                {sede?.address ? (
                  <Text style={styles.cardAddress} numberOfLines={1}>{sede.address}</Text>
                ) : (
                  <Text style={styles.cardAddressMuted}>Non ancora configurata</Text>
                )}
              </View>
              {sedeTappable ? (
                <Pressable onPress={() => openMaps(sede!)} hitSlop={8} style={styles.mapsBtn}>
                  <Ionicons name="open-outline" size={19} color="#6E7596" />
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
        <Text style={styles.note}>
          Modificabile solo dal titolare dalle impostazioni web. Usata come luogo di default per ogni guida.
        </Text>

        {/* ── Altri luoghi ── */}
        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>ALTRI LUOGHI</Text>

        {isLoading ? (
          <>
            <SkeletonCard style={styles.skelCard}>
              <SkeletonBlock width="50%" height={15} radius={6} />
              <SkeletonBlock width="70%" height={12} radius={6} style={{ marginTop: 8 }} />
            </SkeletonCard>
            <SkeletonCard style={styles.skelCard}>
              <SkeletonBlock width="45%" height={15} radius={6} />
              <SkeletonBlock width="65%" height={12} radius={6} style={{ marginTop: 8 }} />
            </SkeletonCard>
          </>
        ) : customs.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
              <Image source={require('../../assets/icons/fluent-pin.png')} style={styles.emptyIcon} />
            </View>
            <Text style={styles.emptyTitle}>Nessun luogo aggiuntivo</Text>
            <Text style={styles.emptySub}>Aggiungi parcheggi, punti di ritrovo o aree di esercitazione.</Text>
          </View>
        ) : (
          customs.map((loc, i) => (
            <React.Fragment key={loc.id}>
              {i > 0 ? <View style={styles.locDivider} /> : null}
              <Pressable
                onPress={() => openForm(loc)}
                style={({ pressed }) => [styles.locRow, pressed && styles.locRowPressed]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={loc.isPrecise ? 'location-outline' : 'pricetag-outline'}
                    size={23}
                    color="#1A1A2E"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardName} numberOfLines={1}>{loc.name}</Text>
                  {loc.address ? (
                    <Text style={styles.cardAddress} numberOfLines={1}>{loc.address}</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => openActions(loc)} hitSlop={12} style={styles.ellipsisBtn}>
                  <Ionicons name="ellipsis-horizontal" size={20} color="#C7C7CC" />
                </Pressable>
              </Pressable>
            </React.Fragment>
          ))
        )}
      </ScrollView>
    </Screen>
  );
};

const CARD_SHADOW = {
  shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
} as const;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm,
  },
  backBtn: { padding: 2 },
  headerAdd: { padding: 2 },
  headerTitle: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3, color: '#1A1A2E' },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 120, paddingTop: 8 },

  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: '#9CA3AF',
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12,
  },
  note: { fontSize: 13, fontWeight: '400', color: '#9CA3AF', lineHeight: 18, marginTop: 12 },

  card: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginBottom: 12,
    ...CARD_SHADOW,
  },
  skelCard: { borderRadius: 20, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 32, alignItems: 'center', justifyContent: 'center' },

  cardName: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', flexShrink: 1 },
  cardAddress: { fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 2 },
  cardAddressMuted: { fontSize: 13, fontWeight: '400', fontStyle: 'italic', color: '#9CA3AF', marginTop: 2 },

  mapsBtn: { padding: 4 },

  // "Altri luoghi" = FLAT list (NOT wrapped in a card): rows flush-left on the
  // page background (icon at the screen margin), hairline dividers, tap → edit,
  // ••• → native action menu.
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 0 },
  locRowPressed: { backgroundColor: '#F4F5F9' },
  locDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 46 },
  ellipsisBtn: { padding: 4 },

  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  emptyIconCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    ...CARD_SHADOW,
  },
  emptyIcon: { width: 48, height: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  emptySub: { fontSize: 13, fontWeight: '400', color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18 },
});
