import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ClayButton, ClayField, ClayList, ClayListRow, ClayToggle } from './clay';
import { CLAY } from '../theme/clay';
import type { AutoscuolaLocation, CreateLocationInput } from '../types/regloApi';

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

type Props = {
  initialValue?: AutoscuolaLocation | null;
  onSubmit: (values: CreateLocationInput) => Promise<void>;
  onCancel: () => void;
  /**
   * Impaginazione: corpo del form e CTA «Salva luogo» separati, così dentro un
   * `FormSheet` la CTA va nel suo prop `cta` (ultima cosa del foglio).
   * Default: corpo e poi CTA, uno sotto l'altro.
   */
  renderLayout?: (parts: { body: React.ReactNode; cta: React.ReactNode }) => React.ReactElement;
};

type Suggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

const uuid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const InlineLocationForm = ({ initialValue, onSubmit, renderLayout }: Props) => {
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

  const body = (
    <View>
      <ClayField
        label="Nome del luogo"
        value={name}
        onChangeText={setName}
        placeholder="Es. Piazzale del Comune"
        maxLength={80}
        returnKeyType="done"
        testID="location-form-name"
      />

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>Posizione precisa</Text>
          <Text style={styles.toggleSubtitle}>
            Permette agli allievi di aprire Google Maps direttamente.
          </Text>
        </View>
        <ClayToggle
          value={isPrecise}
          onValueChange={setIsPrecise}
          accessibilityLabel="Posizione precisa"
          testID="location-form-precise"
        />
      </View>

      {isPrecise ? (
        <>
          <View>
            <ClayField
              label="Indirizzo"
              hint={
                PLACES_API_KEY
                  ? 'Cerca via, città o luogo. Selezionalo dalla lista per agganciare le coordinate.'
                  : 'Autocomplete non configurato (manca EXPO_PUBLIC_GOOGLE_MAPS_API_KEY).'
              }
              value={address}
              onChangeText={(t) => {
                setAddress(t);
                setPlaceId(null);
                setLatitude(null);
                setLongitude(null);
              }}
              placeholder="Es. Via Roma 14, Milano"
              editable={Boolean(PLACES_API_KEY)}
              returnKeyType="search"
              testID="location-form-address"
            />
            {searching ? (
              <ActivityIndicator style={styles.spinner} color={CLAY.ink3} size="small" />
            ) : null}
          </View>
          {suggestions.length > 0 ? (
            <ClayList style={styles.suggestions}>
              {suggestions.map((s) => (
                <ClayListRow
                  key={s.placeId}
                  title={s.primaryText}
                  subtitle={s.secondaryText || undefined}
                  chevron={false}
                  onPress={() => selectSuggestion(s)}
                />
              ))}
            </ClayList>
          ) : null}
          {latitude != null && longitude != null ? (
            <Text style={styles.coords}>
              Coordinate: {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </Text>
          ) : null}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  const cta = (
    <ClayButton
      title="Salva luogo"
      onPress={handleSubmit}
      disabled={!canSubmit}
      loading={saving}
      testID="location-form-save"
    />
  );

  if (renderLayout) return renderLayout({ body, cta });
  return (
    <View>
      {body}
      <View style={styles.footer}>{cta}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18 },
  toggleTitle: { fontSize: 16, fontWeight: '500', color: CLAY.ink },
  toggleSubtitle: { fontSize: 13.5, lineHeight: 18, color: CLAY.ink3, marginTop: 2 },
  // Allineato al campo (etichetta 15 + gap 8 + metà campo 50).
  spinner: { position: 'absolute', right: 16, top: 41 },
  suggestions: { marginTop: 12 },
  coords: { fontSize: 13, color: CLAY.ink3, marginTop: 10, paddingHorizontal: 4 },
  error: { fontSize: 14, color: '#C13515', marginTop: 14, paddingHorizontal: 4 },
  footer: { marginTop: 22 },
});
