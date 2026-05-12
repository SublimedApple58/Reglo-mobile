import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { colors, radii, spacing, typography } from '../theme';
import type { AutoscuolaLocation, CreateLocationInput } from '../types/regloApi';

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

type Props = {
  visible: boolean;
  onClose: () => void;
  initialValue?: AutoscuolaLocation | null;
  onSubmit: (values: CreateLocationInput) => Promise<void>;
};

type Suggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

const uuid = () => {
  // Lightweight: timestamp + random; only used for Places session token
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const LocationFormSheet = ({
  visible,
  onClose,
  initialValue,
  onSubmit,
}: Props) => {
  const [name, setName] = useState('');
  const [isPrecise, setIsPrecise] = useState(true);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef<string>('');

  useEffect(() => {
    if (!visible) return;
    sessionTokenRef.current = uuid();
    setName(initialValue?.name ?? '');
    setIsPrecise(initialValue?.isPrecise ?? false);
    setAddress(initialValue?.address ?? '');
    setLatitude(
      typeof initialValue?.latitude === 'number'
        ? initialValue.latitude
        : initialValue?.latitude
          ? Number(initialValue.latitude)
          : null,
    );
    setLongitude(
      typeof initialValue?.longitude === 'number'
        ? initialValue.longitude
        : initialValue?.longitude
          ? Number(initialValue.longitude)
          : null,
    );
    setPlaceId(initialValue?.placeId ?? null);
    setSuggestions([]);
    setError(null);
  }, [visible, initialValue]);

  useEffect(() => {
    if (!PLACES_API_KEY || !isPrecise || !visible) return;
    if (!address || address.length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          'https://places.googleapis.com/v1/places:autocomplete',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': PLACES_API_KEY,
            },
            body: JSON.stringify({
              input: address,
              includedRegionCodes: ['IT'],
              languageCode: 'it',
              sessionToken: sessionTokenRef.current,
            }),
          },
        );
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const items: Suggestion[] = (data.suggestions ?? [])
          .map((s: any) => {
            const pp = s?.placePrediction;
            if (!pp?.placeId) return null;
            return {
              placeId: pp.placeId,
              primaryText: pp.structuredFormat?.mainText?.text ?? '',
              secondaryText: pp.structuredFormat?.secondaryText?.text ?? '',
            };
          })
          .filter(Boolean) as Suggestion[];
        setSuggestions(items.slice(0, 5));
      } catch {
        setSuggestions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address, isPrecise, visible]);

  const selectSuggestion = async (s: Suggestion) => {
    if (!PLACES_API_KEY) return;
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${s.placeId}?languageCode=it`,
        {
          method: 'GET',
          headers: {
            'X-Goog-Api-Key': PLACES_API_KEY,
            'X-Goog-FieldMask': 'formattedAddress,location,displayName',
          },
        },
      );
      if (!res.ok) {
        setError('Impossibile leggere il luogo selezionato.');
        return;
      }
      const data = (await res.json()) as {
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      };
      setAddress(
        data.formattedAddress ?? `${s.primaryText}, ${s.secondaryText}`,
      );
      setLatitude(data.location?.latitude ?? null);
      setLongitude(data.location?.longitude ?? null);
      setPlaceId(s.placeId);
      setSuggestions([]);
    } catch {
      setError('Errore nella selezione del luogo.');
    }
  };

  const canSubmit = useMemo(() => {
    if (!name.trim() || name.trim().length < 2) return false;
    if (isPrecise) {
      return Boolean(address && latitude != null && longitude != null);
    }
    return true;
  }, [name, isPrecise, address, latitude, longitude]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        isPrecise,
        address: isPrecise ? address.trim() : null,
        latitude: isPrecise ? latitude : null,
        longitude: isPrecise ? longitude : null,
        placeId: isPrecise ? placeId : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di salvataggio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={initialValue ? 'Modifica luogo' : 'Aggiungi luogo'}
      footer={
        <Button
          label={saving ? 'Salvataggio…' : 'Salva luogo'}
          onPress={handleSubmit}
          disabled={!canSubmit || saving}
        />
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nome del luogo</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Es. Piazzale del Comune"
          placeholderTextColor={colors.textSecondary}
          maxLength={80}
        />

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Posizione precisa</Text>
            <Text style={styles.toggleSubtitle}>
              Permette agli allievi di aprire Google Maps direttamente.
            </Text>
          </View>
          <Switch
            value={isPrecise}
            onValueChange={setIsPrecise}
            trackColor={{ true: colors.primary, false: '#D1D5DB' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {isPrecise ? (
          <>
            <Text style={styles.label}>Indirizzo</Text>
            <Text style={styles.helper}>
              {PLACES_API_KEY
                ? 'Cerca via, città o luogo. Selezionalo per agganciare le coordinate.'
                : 'Autocomplete non configurato (manca EXPO_PUBLIC_GOOGLE_PLACES_API_KEY).'}
            </Text>
            <View>
              <TextInput
                style={[styles.input, !PLACES_API_KEY && styles.inputDisabled]}
                value={address}
                onChangeText={(t) => {
                  setAddress(t);
                  setPlaceId(null);
                  setLatitude(null);
                  setLongitude(null);
                }}
                placeholder="Es. Via Roma 14, Milano"
                placeholderTextColor={colors.textSecondary}
                editable={Boolean(PLACES_API_KEY)}
              />
              {searching ? (
                <ActivityIndicator
                  style={styles.spinner}
                  color={colors.textSecondary}
                  size="small"
                />
              ) : null}
            </View>
            {suggestions.length > 0 ? (
              <View style={styles.suggestionsBox}>
                {suggestions.map((s) => (
                  <Pressable
                    key={s.placeId}
                    style={styles.suggestionRow}
                    onPress={() => selectSuggestion(s)}
                  >
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionPrimary}>{s.primaryText}</Text>
                      <Text style={styles.suggestionSecondary} numberOfLines={1}>
                        {s.secondaryText}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {latitude != null && longitude != null ? (
              <Text style={styles.coords}>
                Coordinate: {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </Text>
            ) : null}
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  helper: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputDisabled: { backgroundColor: '#F9FAFB', color: colors.textSecondary },
  spinner: { position: 'absolute', right: spacing.md, top: spacing.sm + 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  toggleTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  toggleSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  suggestionsBox: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radii.sm,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionPrimary: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  suggestionSecondary: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  coords: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: '#DC2626',
    marginTop: spacing.md,
  },
});
