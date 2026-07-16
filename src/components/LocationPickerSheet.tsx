import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from './BottomSheet';
import { colors, radii, spacing, typography } from '../theme';
import { regloApi } from '../services/regloApi';
import type { AutoscuolaLocation } from '../types/regloApi';

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedLocationId: string | null;
  onSelect: (location: AutoscuolaLocation) => void;
  onRequestCreate: () => void;
};

export const LocationPickerSheet = ({
  visible,
  onClose,
  selectedLocationId,
  onSelect,
  onRequestCreate,
}: Props) => {
  const [locations, setLocations] = useState<AutoscuolaLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    regloApi
      .getLocations()
      .then((data) => {
        if (!cancelled) setLocations(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setLocations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const sorted = [...locations].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    if (!search.trim()) return sorted;
    const q = search.trim().toLowerCase();
    return sorted.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.address ?? '').toLowerCase().includes(q),
    );
  }, [locations, search]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Scegli il luogo">
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Cerca per nome o indirizzo"
          returnKeyType="search"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const selected = item.id === selectedLocationId;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={[styles.row, selected && styles.rowSelected]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    item.isPrecise ? styles.iconWrapPrecise : styles.iconWrapGeneric,
                  ]}
                >
                  <Ionicons
                    name={item.isPrecise ? 'location' : 'pricetag-outline'}
                    size={18}
                    color={item.isPrecise ? '#16A34A' : '#6A6A6A'}
                  />
                </View>
                <View style={styles.textWrap}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                    {item.isDefault ? ' · Sede' : ''}
                  </Text>
                  {item.address ? (
                    <Text style={styles.address} numberOfLines={1}>
                      {item.address}
                    </Text>
                  ) : (
                    <Text style={styles.address}>
                      {item.isPrecise ? '' : 'Luogo generico'}
                    </Text>
                  )}
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>Nessun luogo trovato.</Text>
          }
          ListFooterComponent={
            <Pressable
              style={styles.addRow}
              onPress={() => {
                onClose();
                onRequestCreate();
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.addText}>Aggiungi nuovo luogo</Text>
            </Pressable>
          }
        />
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: '#F2F2F2',
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },
  loadingRow: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  rowSelected: {
    backgroundColor: '#F4F5F9',
    borderRadius: radii.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapPrecise: { backgroundColor: '#DCFCE7' },
  iconWrapGeneric: { backgroundColor: '#F2F2F2' },
  textWrap: { flex: 1 },
  name: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  address: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  separator: { height: 1, backgroundColor: '#F2F2F2' },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F2',
  },
  addText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});
