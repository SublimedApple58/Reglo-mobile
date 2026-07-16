import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { ToggleSwitch } from '../../../src/components/ToggleSwitch';
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
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <SheetScaffold
        keyboardAware
        footer={
          <Pressable
            onPress={canSubmit && !saving ? handleSubmit : undefined}
            disabled={!canSubmit || saving}
            style={({ pressed }) => [s.cta, (!canSubmit || saving) && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}
          >
            <GradientCTABackground radius={28} />
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.ctaText}>Salva luogo</Text>}
          </Pressable>
        }
      >
        <Text style={s.title}>{initialValue ? 'Modifica luogo' : 'Aggiungi luogo'}</Text>

        <Text style={s.label}>Nome del luogo</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="Es. Piazzale del Comune"
          placeholderTextColor="#9CA3AF"
          maxLength={80}
          returnKeyType="done"
        />

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleTitle}>Posizione precisa</Text>
            <Text style={s.toggleSub}>Permette agli allievi di aprire Google Maps direttamente.</Text>
          </View>
          <ToggleSwitch value={isPrecise} onValueChange={setIsPrecise} />
        </View>

        {isPrecise ? (
          <>
            <Text style={s.label}>Indirizzo</Text>
            {!PLACES_API_KEY ? (
              <Text style={s.helper}>Autocomplete non configurato (manca EXPO_PUBLIC_GOOGLE_MAPS_API_KEY).</Text>
            ) : null}
            <View>
              <TextInput
                style={[s.input, !PLACES_API_KEY && s.inputDisabled]}
                value={address}
                onChangeText={(t) => { setAddress(t); setPlaceId(null); setLatitude(null); setLongitude(null); }}
                placeholder="Es. Via Roma 14, Milano"
                placeholderTextColor="#9CA3AF"
                editable={Boolean(PLACES_API_KEY)}
                returnKeyType="search"
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
                <Ionicons name="checkmark-circle" size={15} color="#6E7596" />
                <Text style={s.coords}>Coordinate agganciate · {latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
              </View>
            ) : null}
          </>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg, paddingBottom: 32 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4, marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginTop: 22, marginBottom: 10 },
  helper: { fontSize: 13, fontWeight: '400', color: '#9CA3AF', marginBottom: 10, lineHeight: 18 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 15, fontSize: 16, fontWeight: '400', color: '#1A1A2E',
    backgroundColor: '#FFFFFF',
  },
  inputDisabled: { backgroundColor: '#F8FAFC', color: '#9CA3AF' },
  spinner: { position: 'absolute', right: 16, top: 16 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 4, marginTop: 26,
  },
  toggleTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  toggleSub: { fontSize: 13, fontWeight: '400', color: '#9CA3AF', marginTop: 3, lineHeight: 18 },
  suggestionsBox: {
    marginTop: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
    backgroundColor: '#FFFFFF', overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9',
  },
  suggestionPrimary: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  suggestionSecondary: { fontSize: 13, fontWeight: '400', color: '#9CA3AF' },
  coordsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  coords: { fontSize: 13, fontWeight: '500', color: '#6E7596' },
  error: { fontSize: 13, fontWeight: '400', color: '#DC2626', marginTop: 16 },
  cta: {
    height: 56, borderRadius: 28, marginTop: 30,
    alignItems: 'center', justifyContent: 'center',
    ...primaryCtaShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
});
