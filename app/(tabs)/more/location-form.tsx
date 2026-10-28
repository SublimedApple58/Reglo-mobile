import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayField, ClayList, ClayListRow, ClayToggle } from '../../../src/components/clay';
import { CLAY_DANGER } from '../../../src/components/ClayAccountParts';
import { locationFormStore } from '../../../src/stores/locationFormStore';
import { CLAY } from '../../../src/theme/clay';

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

type Suggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

const uuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Aggiungi / modifica luogo (tab «Tu» → Luoghi guida) — REG-639 clay: il form
 * sheet unico (FORM_SHEET + FormSheet). Campi clay, interruttore clay, i
 * suggerimenti di Places come lista clay; «Salva luogo» è la CTA in fondo.
 */
export default function LocationFormScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(locationFormStore.subscribe, locationFormStore.get);
  const initialValue = data?.initial ?? null;

  const [name, setName] = useState(initialValue?.name ?? '');
  const [isPrecise, setIsPrecise] = useState(initialValue?.isPrecise ?? false);
  const [address, setAddress] = useState(initialValue?.address ?? '');
  const [latitude, setLatitude] = useState<number | null>(
    typeof initialValue?.latitude === 'number'
      ? initialValue.latitude
      : initialValue?.latitude ? Number(initialValue.latitude) : null,
  );
  const [longitude, setLongitude] = useState<number | null>(
    typeof initialValue?.longitude === 'number'
      ? initialValue.longitude
      : initialValue?.longitude ? Number(initialValue.longitude) : null,
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
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': PLACES_API_KEY },
          body: JSON.stringify({
            input: address,
            includedRegionCodes: ['IT'],
            languageCode: 'it',
            sessionToken: sessionTokenRef.current,
          }),
        });
        if (!res.ok) { setSuggestions([]); return; }
        const json = await res.json();
        if (cancelled) return;
        const items: Suggestion[] = (json.suggestions ?? [])
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
    return () => { cancelled = true; clearTimeout(timer); };
  }, [address, isPrecise]);

  const selectSuggestion = async (sug: Suggestion) => {
    if (!PLACES_API_KEY) return;
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${sug.placeId}?languageCode=it`,
        {
          method: 'GET',
          headers: {
            'X-Goog-Api-Key': PLACES_API_KEY,
            'X-Goog-FieldMask': 'formattedAddress,location,displayName',
          },
        },
      );
      if (!res.ok) { setError('Impossibile leggere il luogo selezionato.'); return; }
      const json = (await res.json()) as {
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      };
      setAddress(json.formattedAddress ?? `${sug.primaryText}, ${sug.secondaryText}`);
      setLatitude(json.location?.latitude ?? null);
      setLongitude(json.location?.longitude ?? null);
      setPlaceId(sug.placeId);
      setSuggestions([]);
    } catch {
      setError('Errore nella selezione del luogo.');
    }
  };

  const canSubmit = useMemo(() => {
    if (!name.trim() || name.trim().length < 2) return false;
    if (isPrecise) return Boolean(address && latitude != null && longitude != null);
    return true;
  }, [name, isPrecise, address, latitude, longitude]);

  const handleSubmit = async () => {
    if (!canSubmit || !data) return;
    setSaving(true);
    setError(null);
    try {
      await data.onSubmit({
        name: name.trim(),
        isPrecise,
        address: isPrecise ? address.trim() : null,
        latitude: isPrecise ? latitude : null,
        longitude: isPrecise ? longitude : null,
        placeId: isPrecise ? placeId : null,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di salvataggio.');
      setSaving(false);
    }
  };

  if (!data) return <View style={s.empty} />;

  return (
    <FormSheet
      title={initialValue ? 'Modifica luogo' : 'Aggiungi luogo'}
      subtitle={initialValue ? initialValue.name : 'Un punto di ritrovo per le guide.'}
      testID="location-form-sheet"
      cta={
        <ClayButton
          title="Salva luogo"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={saving}
          testID="location-form-save"
        />
      }
    >
      <ClayField
        label="Nome del luogo"
        value={name}
        onChangeText={setName}
        placeholder="Es. Piazzale del Comune"
        maxLength={80}
        returnKeyType="done"
        testID="location-form-name"
      />

      <View style={s.toggleRow}>
        <View style={s.toggleText}>
          <Text style={s.toggleTitle}>Posizione precisa</Text>
          <Text style={s.toggleSub}>Permette agli allievi di aprire Google Maps direttamente.</Text>
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
                  ? undefined
                  : 'Autocomplete non configurato (manca EXPO_PUBLIC_GOOGLE_MAPS_API_KEY).'
              }
              value={address}
              onChangeText={(t) => { setAddress(t); setPlaceId(null); setLatitude(null); setLongitude(null); }}
              placeholder="Es. Via Roma 14, Milano"
              editable={Boolean(PLACES_API_KEY)}
              returnKeyType="search"
              testID="location-form-address"
            />
            {searching ? <ActivityIndicator style={s.spinner} color={CLAY.ink3} size="small" /> : null}
          </View>

          {suggestions.length > 0 ? (
            <ClayList style={s.suggestions}>
              {suggestions.map((sug) => (
                <ClayListRow
                  key={sug.placeId}
                  title={sug.primaryText}
                  subtitle={sug.secondaryText || undefined}
                  chevron={false}
                  onPress={() => selectSuggestion(sug)}
                />
              ))}
            </ClayList>
          ) : null}

          {latitude != null && longitude != null ? (
            <Text style={s.coords}>Coordinate agganciate · {latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
          ) : null}
        </>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  empty: { backgroundColor: '#FFFFFF', height: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18 },
  toggleText: { flex: 1, minWidth: 0 },
  toggleTitle: { fontSize: 16, fontWeight: '500', color: CLAY.ink },
  toggleSub: { fontSize: 13.5, lineHeight: 18, color: CLAY.ink3, marginTop: 2 },
  // Allineato al campo (etichetta 15 + gap 8 + metà campo 50).
  spinner: { position: 'absolute', right: 16, top: 41 },
  suggestions: { marginTop: 12 },
  coords: { fontSize: 13, color: CLAY.ink3, marginTop: 10, paddingHorizontal: 4 },
  error: { fontSize: 14, color: CLAY_DANGER, marginTop: 14, paddingHorizontal: 4 },
});
