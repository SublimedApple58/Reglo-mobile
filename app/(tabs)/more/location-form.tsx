import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { locationFormStore } from '../../../src/stores/locationFormStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

type Suggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

const uuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

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

  if (!data) return <View style={s.root} />;

  return (
    <View style={s.root}>
      <Text style={s.title}>{initialValue ? 'Modifica luogo' : 'Aggiungi luogo'}</Text>

        <Text style={s.label}>Nome del luogo</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="Es. Piazzale del Comune"
          placeholderTextColor="#9CA3AF"
          maxLength={80}
        />

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleTitle}>Posizione precisa</Text>
            <Text style={s.toggleSub}>Permette agli allievi di aprire Google Maps direttamente.</Text>
          </View>
          <Switch
            value={isPrecise}
            onValueChange={setIsPrecise}
            trackColor={{ true: colors.primary, false: '#E2E8F0' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {isPrecise ? (
          <>
            <Text style={s.label}>Indirizzo</Text>
            <Text style={s.helper}>
              {PLACES_API_KEY
                ? 'Cerca via, città o luogo. Selezionalo per agganciare le coordinate.'
                : 'Autocomplete non configurato (manca EXPO_PUBLIC_GOOGLE_MAPS_API_KEY).'}
            </Text>
            <View>
              <TextInput
                style={[s.input, !PLACES_API_KEY && s.inputDisabled]}
                value={address}
                onChangeText={(t) => { setAddress(t); setPlaceId(null); setLatitude(null); setLongitude(null); }}
                placeholder="Es. Via Roma 14, Milano"
                placeholderTextColor="#9CA3AF"
                editable={Boolean(PLACES_API_KEY)}
              />
              {searching ? <ActivityIndicator style={s.spinner} color="#9CA3AF" size="small" /> : null}
            </View>

            {suggestions.length > 0 ? (
              <View style={s.suggestionsBox}>
                {suggestions.map((sug) => (
                  <Pressable key={sug.placeId} style={s.suggestionRow} onPress={() => selectSuggestion(sug)}>
                    <Ionicons name="location-outline" size={16} color="#9CA3AF" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.suggestionPrimary}>{sug.primaryText}</Text>
                      <Text style={s.suggestionSecondary} numberOfLines={1}>{sug.secondaryText}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {latitude != null && longitude != null ? (
              <View style={s.coordsRow}>
                <Ionicons name="checkmark-circle" size={15} color="#16A34A" />
                <Text style={s.coords}>Coordinate agganciate · {latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
              </View>
            ) : null}
          </>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable
          onPress={canSubmit && !saving ? handleSubmit : undefined}
          disabled={!canSubmit || saving}
          style={({ pressed }) => [s.cta, (!canSubmit || saving) && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.ctaText}>Salva luogo</Text>}
        </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 16, marginBottom: 8 },
  helper: { fontSize: 12, color: '#9CA3AF', marginBottom: 8, lineHeight: 16 },
  input: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#1A1A2E',
    backgroundColor: '#F8FAFC',
  },
  inputDisabled: { backgroundColor: '#F1F5F9', color: '#9CA3AF' },
  spinner: { position: 'absolute', right: 14, top: 14 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 16, marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  toggleSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2, lineHeight: 16 },
  suggestionsBox: {
    marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14,
    backgroundColor: '#FFFFFF', overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9',
  },
  suggestionPrimary: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  suggestionSecondary: { fontSize: 12, color: '#9CA3AF' },
  coordsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  coords: { fontSize: 12, fontWeight: '500', color: '#15803D' },
  error: { fontSize: 13, color: '#DC2626', marginTop: 16 },
  cta: {
    backgroundColor: colors.primary, height: 54, borderRadius: 27, marginTop: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 14, elevation: 6,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
});
