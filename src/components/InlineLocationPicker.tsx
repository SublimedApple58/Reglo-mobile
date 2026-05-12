import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing, typography } from '../theme';
import { regloApi } from '../services/regloApi';
import type { AutoscuolaLocation } from '../types/regloApi';

type Props = {
  selectedLocationId: string | null;
  onSelect: (location: AutoscuolaLocation) => void;
  onRequestCreate: () => void;
};

export const InlineLocationPicker = ({
  selectedLocationId,
  onSelect,
  onRequestCreate,
}: Props) => {
  const [locations, setLocations] = useState<AutoscuolaLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
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
  }, []);

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
    <View style={{ paddingTop: 4 }}>
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

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>Nessun luogo trovato.</Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((item, index) => {
            const selected = item.id === selectedLocationId;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item)}
                style={({ pressed }) => [
                  styles.row,
                  index !== 0 && styles.rowBorderTop,
                  selected && styles.rowSelected,
                  pressed && { opacity: 0.7 },
                ]}
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
                    color={item.isPrecise ? '#16A34A' : '#6B7280'}
                  />
                </View>
                <View style={styles.textWrap}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.isDefault ? (
                      <View style={styles.sedeBadge}>
                        <Text style={styles.sedeBadgeText}>Sede</Text>
                      </View>
                    ) : null}
                  </View>
                  {item.address ? (
                    <Text style={styles.address} numberOfLines={1}>
                      {item.address}
                    </Text>
                  ) : (
                    <Text style={styles.addressMuted}>
                      {item.isPrecise ? '' : 'Luogo generico'}
                    </Text>
                  )}
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        onPress={onRequestCreate}
        style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.addIcon}>
          <Ionicons name="add" size={20} color={colors.primary} />
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
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
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
  list: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    minHeight: 64,
  },
  rowBorderTop: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  rowSelected: { backgroundColor: '#FDF2F8' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapPrecise: { backgroundColor: '#DCFCE7' },
  iconWrapGeneric: { backgroundColor: '#F3F4F6' },
  textWrap: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...typography.body, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  address: { ...typography.caption, color: colors.textSecondary },
  addressMuted: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  sedeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FCE7F3',
  },
  sedeBadgeText: { fontSize: 10, fontWeight: '700', color: '#BE185D' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FBCFE8',
    borderStyle: 'dashed',
    backgroundColor: '#FDF2F8',
    minHeight: 56,
  },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  addText: { ...typography.body, color: colors.primary, fontWeight: '700' },
});
