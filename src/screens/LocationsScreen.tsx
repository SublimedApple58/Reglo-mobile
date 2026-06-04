import React, { useCallback } from 'react';
import {
  Alert,
  Image,
  Linking,
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
        <Text style={styles.headerTitle}>Luoghi guida</Text>
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
              <View style={[styles.iconWrap, styles.iconSede]}>
                <Ionicons name="business" size={20} color="#1A1A2E" />
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
                <Pressable onPress={() => openMaps(sede!)} hitSlop={8} style={styles.mapsCircle}>
                  <Ionicons name="open-outline" size={17} color="#1A1A2E" />
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
        <Text style={styles.note}>
          Modificabile solo dal titolare dalle impostazioni web. Usata come luogo di default per ogni guida.
        </Text>

        {/* ── Altri luoghi ── */}
        <View style={styles.customsHeader}>
          <Text style={styles.sectionLabel}>ALTRI LUOGHI</Text>
          <Pressable onPress={() => openForm(null)} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}>
            <Ionicons name="add" size={17} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Aggiungi</Text>
          </Pressable>
        </View>

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
          customs.map((loc) => {
            const lat = toNumber(loc.latitude);
            const lng = toNumber(loc.longitude);
            const tappable = loc.isPrecise && lat != null && lng != null;
            return (
              <View key={loc.id} style={styles.card}>
                <View style={styles.row}>
                  <View style={[styles.iconWrap, loc.isPrecise ? styles.iconPrecise : styles.iconGeneric]}>
                    <Ionicons
                      name={loc.isPrecise ? 'location' : 'pricetag-outline'}
                      size={20}
                      color={loc.isPrecise ? '#16A34A' : '#6B7280'}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.cardName} numberOfLines={1}>{loc.name}</Text>
                      <View style={[styles.badge, loc.isPrecise ? styles.badgePrecise : styles.badgeGeneric]}>
                        <Text style={[styles.badgeText, loc.isPrecise ? styles.badgeTextPrecise : styles.badgeTextGeneric]}>
                          {loc.isPrecise ? 'Precisa' : 'Generica'}
                        </Text>
                      </View>
                    </View>
                    {loc.address ? (
                      <Text style={styles.cardAddress} numberOfLines={1}>{loc.address}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.actionRow}>
                  {tappable ? (
                    <Pressable onPress={() => openMaps(loc)} style={styles.actionBtn} hitSlop={6}>
                      <Ionicons name="open-outline" size={17} color="#475569" />
                      <Text style={styles.actionText}>Maps</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => openForm(loc)} style={styles.actionBtn} hitSlop={6}>
                    <Ionicons name="pencil-outline" size={17} color="#475569" />
                    <Text style={styles.actionText}>Modifica</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(loc)} style={styles.actionBtn} hitSlop={6}>
                    <Ionicons name="trash-outline" size={17} color={colors.destructive} />
                    <Text style={[styles.actionText, { color: colors.destructive }]}>Elimina</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
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
  headerTitle: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3, color: '#1A1A2E' },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 120, paddingTop: 8 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
  },
  note: { fontSize: 12, color: '#9CA3AF', lineHeight: 17, marginTop: 10 },

  customsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 28, marginBottom: 0,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, paddingLeft: 10, paddingRight: 14, paddingVertical: 8,
    borderRadius: 999, marginBottom: 10,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 8, elevation: 4,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  card: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginBottom: 12,
    ...CARD_SHADOW,
  },
  skelCard: { borderRadius: 20, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconSede: { backgroundColor: '#F1F5F9' },
  iconPrecise: { backgroundColor: '#DCFCE7' },
  iconGeneric: { backgroundColor: '#F1F5F9' },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', flexShrink: 1 },
  cardAddress: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardAddressMuted: { fontSize: 13, fontStyle: 'italic', color: '#9CA3AF', marginTop: 2 },

  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  badgePrecise: { backgroundColor: '#DCFCE7' },
  badgeGeneric: { backgroundColor: '#F1F5F9' },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  badgeTextPrecise: { color: '#15803D' },
  badgeTextGeneric: { color: '#64748B' },

  mapsCircle: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },

  actionRow: {
    flexDirection: 'row', gap: 22, marginTop: 14, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 13, fontWeight: '600', color: '#475569' },

  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  emptyIconCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    ...CARD_SHADOW,
  },
  emptyIcon: { width: 48, height: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18 },
});
