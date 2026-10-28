import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { CLAY } from '../theme/clay';
import { ClayButton, ClayList, ClayListRow, ClaySearchField } from './clay';
import { regloApi } from '../services/regloApi';
import type { AutoscuolaLocation } from '../types/regloApi';

type Props = {
  selectedLocationId: string | null;
  onSelect: (location: AutoscuolaLocation) => void;
  /**
   * «Aggiungi nuovo luogo». Se il picker sta in un FormSheet, meglio passarlo
   * come `cta` del foglio e non qui (la CTA è l'ultima cosa del foglio).
   */
  onRequestCreate?: () => void;
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
    <View>
      {showSearch ? (
        <ClaySearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Cerca per nome o indirizzo"
          style={styles.search}
        />
      ) : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={CLAY.ink} />
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>Nessun luogo trovato.</Text>
      ) : (
        <ClayList>
          {filtered.map((item) => {
            const selected = item.id === selectedLocationId;
            return (
              <ClayListRow
                key={item.id}
                title={item.name}
                subtitle={item.address || 'Luogo generico'}
                trailing={selected ? <Ionicons name="checkmark" size={20} color={CLAY.ink} /> : null}
                chevron={false}
                onPress={() => onSelect(item)}
                testID={`location-option-${item.id}`}
              />
            );
          })}
        </ClayList>
      )}

      {onRequestCreate ? (
        <ClayButton
          title="Aggiungi nuovo luogo"
          variant="secondary"
          onPress={onRequestCreate}
          style={styles.add}
          testID="location-add"
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  search: { marginBottom: 16 },
  loadingRow: { paddingVertical: 32, alignItems: 'center' },
  empty: { textAlign: 'center', color: CLAY.ink3, fontSize: 14, paddingVertical: 24 },
  add: { marginTop: 22 },
});
