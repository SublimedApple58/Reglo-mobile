import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ToggleSwitch } from './ToggleSwitch';
import { GradientCTABackground, primaryCtaShadow } from './GradientCTA';
import { colors, spacing, typography } from '../theme';
import type { AutoscuolaLocation, CreateLocationInput } from '../types/regloApi';

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

type Props = {
  initialValue?: AutoscuolaLocation | null;
  onSubmit: (values: CreateLocationInput) => Promise<void>;
  onCancel: () => void;
};

type Suggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

const uuid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const InlineLocationForm = ({ initialValue, onSubmit, onCancel }: Props) => {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [isPrecise, setIsPrecise] = useState(initialValue?.isPrecise ?? false);
  const [address, setAddress] = useState(initialValue?.address ?? '');
  const [latitude, setLatitude] = useState<number | null>(
    typeof initialValue?.latitude === 'number'
      ? initialValue.latitude
      : initialValue?.latitude
        ? Number(initialValue.latitude)
        : null,
  );
  const [longitude, setLongitude] = useState<number | null>(
    typeof initialValue?.longitude === 'number'
      ? initialValue.longitude
      : initialValue?.longitude
        ? Number(initialValue.longitude)
        : null,
  );
  const [placeId, setPlaceId] = useState<string | null>(initialValue?.placeId ?? null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef<string>(uuid());

  useEffect(() => {
    if (!PLACES_API_KEY || !isPrecise) return;
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
  }, [address, isPrecise]);

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
      setAddress(data.formattedAddress ?? `${s.primaryText}, ${s.secondaryText}`);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di salvataggio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ paddingTop: 4 }}>
      <Text style={styles.label}>Nome del luogo</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Es. Piazzale del Comune"
        placeholderTextColor={colors.textSecondary}
        maxLength={80}
        returnKeyType="done"
      />

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>Posizione precisa</Text>
          <Text style={styles.toggleSubtitle}>
            Permette agli allievi di aprire Google Maps direttamente.
          </Text>
        </View>
        <ToggleSwitch value={isPrecise} onValueChange={setIsPrecise} />
      </View>

      {isPrecise ? (
        <>
          <Text style={styles.label}>Indirizzo</Text>
          <Text style={styles.helper}>
            {PLACES_API_KEY
              ? 'Cerca via, città o luogo. Selezionalo dalla lista per agganciare le coordinate.'
              : 'Autocomplete non configurato (manca EXPO_PUBLIC_GOOGLE_MAPS_API_KEY).'}
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
              returnKeyType="search"
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
              {suggestions.map((s, idx) => (
                <Pressable
                  key={s.placeId}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    idx !== 0 && styles.suggestionBorder,
                    pressed && { opacity: 0.7 },
                  ]}
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

      <View style={styles.footer}>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || saving}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }, (!canSubmit || saving) && { opacity: 0.4 }]}
        >
          <GradientCTABackground radius={27} />
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>Salva luogo</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
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
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  inputDisabled: { backgroundColor: '#FAFAFA', color: colors.textSecondary },
  spinner: { position: 'absolute', right: spacing.md, top: 14 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  toggleTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  toggleSubtitle: { ...typography.caption, color: colors.textSecondary },
  suggestionsBox: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 56,
  },
  suggestionBorder: { borderTopWidth: 1, borderTopColor: '#F2F2F2' },
  suggestionPrimary: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  suggestionSecondary: { ...typography.caption, color: colors.textSecondary },
  coords: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  error: { ...typography.caption, color: colors.destructive, marginTop: spacing.md },
  footer: {
    marginTop: spacing.lg,
  },
  saveBtn: {
    minHeight: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    ...primaryCtaShadow,
  },
  saveText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
