import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { LocationFormSheet } from '../components/LocationFormSheet';
import { colors, radii, spacing, typography } from '../theme';
import { regloApi } from '../services/regloApi';
import type {
  AutoscuolaLocation,
  CreateLocationInput,
} from '../types/regloApi';

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

export const LocationsScreen = () => {
  const router = useRouter();
  const [locations, setLocations] = useState<AutoscuolaLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [formSheet, setFormSheet] = useState<{
    initial: AutoscuolaLocation | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await regloApi.getLocations();
      setLocations(data ?? []);
    } catch {
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (values: CreateLocationInput) => {
    await regloApi.createLocation(values);
    await load();
  };

  const handleUpdate = async (id: string, values: CreateLocationInput) => {
    await regloApi.updateLocation(id, values);
    await load();
  };

  const handleDelete = (loc: AutoscuolaLocation) => {
    Alert.alert(
      'Eliminare luogo?',
      `"${loc.name}" sarà rimosso dalla lista.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await regloApi.deleteLocation(loc.id);
              await load();
            } catch (err) {
              Alert.alert(
                'Errore',
                err instanceof Error ? err.message : 'Eliminazione fallita.',
              );
            }
          },
        },
      ],
    );
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

  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Luoghi guida</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Sede */}
        <Text style={styles.sectionTitle}>Sede dell&apos;autoscuola</Text>
        <Text style={styles.sectionSubtitle}>
          Modificabile solo dal titolare nelle impostazioni web. Usata come luogo di default per ogni guida.
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, styles.iconSede]}>
                <Ionicons name="business-outline" size={20} color="#EC4899" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{sede?.name ?? "Sede dell'autoscuola"}</Text>
                {sede?.address ? (
                  <Text style={styles.cardAddress}>{sede.address}</Text>
                ) : (
                  <Text style={styles.cardAddressMuted}>Non ancora configurata</Text>
                )}
              </View>
              {sede?.isPrecise && sede.latitude != null && sede.longitude != null ? (
                <Pressable onPress={() => openMaps(sede)} style={styles.linkBtn}>
                  <Ionicons name="open-outline" size={18} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        {/* Altri luoghi */}
        <View style={styles.customsHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Altri luoghi</Text>
            <Text style={styles.sectionSubtitle}>
              Aggiungi parcheggi, punti di ritrovo o aree di esercitazione.
            </Text>
          </View>
          <Button label="+ Aggiungi" onPress={() => setFormSheet({ initial: null })} />
        </View>

        {customs.length === 0 && !loading ? (
          <Text style={styles.emptyText}>Nessun luogo aggiuntivo.</Text>
        ) : null}

        {customs.map((loc) => {
          const lat = toNumber(loc.latitude);
          const lng = toNumber(loc.longitude);
          const tappable = loc.isPrecise && lat != null && lng != null;
          return (
            <View key={loc.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.iconWrap,
                    loc.isPrecise ? styles.iconPrecise : styles.iconGeneric,
                  ]}
                >
                  <Ionicons
                    name={loc.isPrecise ? 'location' : 'pricetag-outline'}
                    size={20}
                    color={loc.isPrecise ? '#16A34A' : '#6B7280'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {loc.name}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        loc.isPrecise ? styles.badgePrecise : styles.badgeGeneric,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          loc.isPrecise ? styles.badgeTextPrecise : styles.badgeTextGeneric,
                        ]}
                      >
                        {loc.isPrecise ? 'Precisa' : 'Generica'}
                      </Text>
                    </View>
                  </View>
                  {loc.address ? (
                    <Text style={styles.cardAddress} numberOfLines={1}>
                      {loc.address}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.actionRow}>
                {tappable ? (
                  <Pressable onPress={() => openMaps(loc)} style={styles.actionBtn}>
                    <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.actionText}>Maps</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setFormSheet({ initial: loc })}
                  style={styles.actionBtn}
                >
                  <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.actionText}>Modifica</Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(loc)} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                  <Text style={[styles.actionText, { color: colors.destructive }]}>
                    Elimina
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <LocationFormSheet
        visible={formSheet !== null}
        initialValue={formSheet?.initial ?? null}
        onClose={() => setFormSheet(null)}
        onSubmit={async (values) => {
          if (formSheet?.initial) {
            await handleUpdate(formSheet.initial.id, values);
          } else {
            await handleCreate(values);
          }
        }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  customsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSede: { backgroundColor: '#FCE7F3' },
  iconPrecise: { backgroundColor: '#DCFCE7' },
  iconGeneric: { backgroundColor: '#F3F4F6' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  cardAddress: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardAddressMuted: {
    ...typography.caption,
    fontStyle: 'italic',
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgePrecise: { backgroundColor: '#DCFCE7' },
  badgeGeneric: { backgroundColor: '#F3F4F6' },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  badgeTextPrecise: { color: '#15803D' },
  badgeTextGeneric: { color: '#4B5563' },
  linkBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCE7F3',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
