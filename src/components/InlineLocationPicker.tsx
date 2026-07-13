import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { colors, spacing, typography } from '../theme';
import { regloApi } from '../services/regloApi';
import type { AutoscuolaLocation } from '../types/regloApi';

type Props = {
  selectedLocationId: string | null;
  onSelect: (location: AutoscuolaLocation) => void;
  onRequestCreate: () => void;
  /** Hide the search field (e.g. inside a compact bottom formsheet). */
  showSearch?: boolean;
};

export const InlineLocationPicker = ({
  selectedLocationId,
  onSelect,
  onRequestCreate,
  showSearch = true,
}: Props) => {
  const [locations, setLocations] = useState<AutoscuolaLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Refetch whenever the picker regains focus, so a location created in the
  // (separately routed) form sheet shows up on return without a manual reload.
  useFocusEffect(
    useCallback(() => {
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
    }, []),
  );

  const filtered = useMemo(() => {
    const sorted = [...locations].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    if (!showSearch || !search.trim()) return sorted;
    const q = search.trim().toLowerCase();
    return sorted.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.address ?? '').toLowerCase().includes(q),
    );
  }, [locations, search, showSearch]);

  return (
    <View style={{ paddingTop: 4 }}>
      {showSearch ? (
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Cerca per nome o indirizzo"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#1A1A2E" />
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>Nessun luogo trovato.</Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((item, index) => {
            const selected = item.id === selectedLocationId;
            const iconName: keyof typeof Ionicons.glyphMap = item.isDefault
              ? 'business'
              : item.isPrecise
                ? 'location'
                : 'location-outline';
            return (
              <View key={item.id}>
                {index !== 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.55 }]}
                >
                  <View style={styles.iconCol}>
                    <Ionicons name={iconName} size={22} color="#1A1A2E" />
                  </View>
                  <View style={styles.textWrap}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.address ? (
                      <Text style={styles.address} numberOfLines={1}>
                        {item.address}
                      </Text>
                    ) : (
                      <Text style={styles.addressMuted}>Luogo generico</Text>
                    )}
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color="#1A1A2E" />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <Pressable
        onPress={onRequestCreate}
        style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.5 }]}
      >
        <View style={styles.iconCol}>
          <Ionicons name="add" size={22} color="#1A1A2E" />
        </View>
        <Text style={styles.addText}>Aggiungi nuovo luogo</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F2F2F2',
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },
  loadingRow: { paddingVertical: spacing.xl, alignItems: 'center' },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },
  list: { marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 60,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EBEDF0',
    marginLeft: 40,
  },
  iconCol: { width: 28, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', flexShrink: 1 },
  address: { fontSize: 13, color: '#929292' },
  addressMuted: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EBEDF0',
  },
  addText: { fontSize: 15, color: '#1A1A2E', fontWeight: '600' },
});
