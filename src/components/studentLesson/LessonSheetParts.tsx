/**
 * REG-789 — pezzi dei fogli «guida» dell'allievo (direzione B «protagonista»,
 * scelta da Tiziano il 25/11/2026, anteprime in /tmp/hiro-anteprime/reg-789/B*):
 * ogni foglio ha UNA cosa grande (l'ora, il percorso, il salvadanaio, la
 * stella), al massimo una card, il resto a righe. Niente copertine a tutto
 * sfondo dentro i fogli (regola di Tiziano: quelle solo nelle sezioni).
 */
import React, { memo, useMemo } from 'react';
import { ImageSourcePropType, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Avatar, ClayPressable, ClaySurface, Icon3D } from '../clay';
import { SFSymbol } from '../SFSymbol';
import { FlatRow } from '../../screens/allievoHome/HomeSections';
import { car34Art, markerArt } from '../../road/markerArt';
import { CLAY } from '../../theme/clay';
import { VITA_ART } from '../../theme/vitaArt';
import { scoreWord } from '../../utils/studentLessons';
import type { AutoscuolaAppointmentWithRelations, RoadMarker } from '../../types/regloApi';

export const LESSON_ART = {
  salvadanaio: require('../../../assets/vita/salvadanaio-ambra.png') as ImageSourcePropType,
  stella: require('../../../assets/vita/stella.png') as ImageSourcePropType,
  auto: require('../../../assets/icons3d-ai/auto.png') as ImageSourcePropType,
};

type Location = AutoscuolaAppointmentWithRelations['location'];

const coordOf = (v: number | string | null | undefined) => {
  const n = typeof v === 'number' ? v : v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Coordinate del luogo solo se precise (altrimenti la mappa mentirebbe). */
export const placeCoords = (loc: Location) => {
  if (!loc?.isPrecise) return null;
  const latitude = coordOf(loc.latitude);
  const longitude = coordOf(loc.longitude);
  return latitude != null && longitude != null ? { latitude, longitude } : null;
};

export const openInMaps = (loc: Location) => {
  const c = placeCoords(loc);
  if (!c) return;
  const place = loc?.placeId ? `&query_place_id=${loc.placeId}` : '';
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}${place}`).catch(() => null);
};

// ── Protagonista: l'oggetto 3D grande con la frase sotto ──────────────────────

export const LessonHero = memo(function LessonHero({
  art,
  size,
  title,
  subtitle,
}: {
  art: ImageSourcePropType;
  size: number;
  title: string;
  subtitle?: string | null;
}) {
  return (
    <View style={s.hero}>
      <Icon3D source={art} size={size} />
      <Text style={s.heroTitle}>{title}</Text>
      {subtitle ? <Text style={s.heroSub}>{subtitle}</Text> : null}
    </View>
  );
});

// ── Luogo: la mappa del ritrovo in UNA card, con «Mappe» ─────────────────────

/**
 * Una sola MapView, ferma (niente gesti): il punto di ritrovo con la sede 3D
 * (o un pallino nero se non è la sede). Senza coordinate precise la card resta
 * solo testo.
 */
export const LessonPlaceCard = memo(function LessonPlaceCard({ location }: { location: Location }) {
  const coords = placeCoords(location);
  const region = useMemo(
    () => (coords ? { ...coords, latitudeDelta: 0.006, longitudeDelta: 0.006 } : null),
    // Il luogo di una guida non cambia mentre il foglio è aperto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coords?.latitude, coords?.longitude],
  );
  const name = location?.name ?? "Sede dell'autoscuola";
  const address = location?.isPrecise ? location.address : null;
  return (
    <ClaySurface padded={false} style={s.placeCard}>
      <View style={s.placeClip}>
        {region ? (
          <Pressable onPress={() => openInMaps(location)} accessibilityRole="button" accessibilityLabel={`Apri ${name} in Mappe`}>
            <MapView
              style={s.placeMap}
              initialRegion={region}
              mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
              showsPointsOfInterest={false}
              showsBuildings={false}
              showsCompass={false}
              showsScale={false}
              toolbarEnabled={false}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              liteMode={Platform.OS === 'android'}
              pointerEvents="none"
            >
              <Marker coordinate={region} anchor={{ x: 0.5, y: 0.62 }} tracksViewChanges={false}>
                {location?.isDefault ? <Icon3D source={VITA_ART.edificio} size={52} /> : <View style={s.dot} />}
              </Marker>
            </MapView>
          </Pressable>
        ) : null}
        <View style={s.placeRow}>
          <View style={s.flex}>
            <Text style={s.rt} numberOfLines={1}>
              {name}
            </Text>
            {address ? (
              <Text style={s.rs} numberOfLines={1}>
                {address}
              </Text>
            ) : null}
          </View>
          {coords ? (
            <ClayPressable kind="small" onPress={() => openInMaps(location)} hitSlop={10} accessibilityRole="button">
              <Text style={s.link}>Mappe</Text>
            </ClayPressable>
          ) : null}
        </View>
      </View>
    </ClaySurface>
  );
});

/** Il luogo come riga semplice (fogli delle guide passate). */
export const LessonPlaceRow = memo(function LessonPlaceRow({ location, first }: { location: Location; first?: boolean }) {
  const coords = placeCoords(location);
  return (
    <FlatRow
      first={first}
      leading={<Icon3D source={VITA_ART.edificio} size={36} />}
      title={location?.name ?? "Sede dell'autoscuola"}
      subtitle={location?.isPrecise ? location.address : null}
      onPress={coords ? () => openInMaps(location) : undefined}
      trailing={coords ? <Text style={s.link}>Mappe</Text> : undefined}
    />
  );
});

// ── Persone e auto ───────────────────────────────────────────────────────────

export const InstructorRow = memo(function InstructorRow({
  instructor,
  subtitle,
  first,
}: {
  instructor: AutoscuolaAppointmentWithRelations['instructor'];
  subtitle: string;
  first?: boolean;
}) {
  const name = instructor?.name ?? 'Da assegnare';
  const phone = instructor?.phone;
  return (
    <FlatRow
      first={first}
      leading={<Avatar userId={instructor?.userId ?? instructor?.id} name={name} size={40} />}
      title={name}
      subtitle={subtitle}
      trailing={
        phone ? (
          <ClayPressable
            kind="small"
            onPress={() => Linking.openURL(`tel:${phone}`).catch(() => null)}
            accessibilityRole="button"
            accessibilityLabel={`Chiama ${name}`}
            style={s.call}
          >
            <SFSymbol name="phone.fill" size={16} color={CLAY.ink} fallback="phone" />
          </ClayPressable>
        ) : undefined
      }
    />
  );
});

export const VehicleRow = memo(function VehicleRow({
  vehicle,
  first,
}: {
  vehicle: AutoscuolaAppointmentWithRelations['vehicle'];
  first?: boolean;
}) {
  return (
    <FlatRow
      first={first}
      leading={<Icon3D source={car34Art(vehicle?.color)} size={34} width={42} />}
      title={vehicle?.name ?? 'Da assegnare'}
      subtitle="L'auto della guida"
    />
  );
});

// ── Road: le segnalazioni a righe, con l'icona 3D vera ───────────────────────

export const MarkerRows = memo(function MarkerRows({
  markers,
  withTime,
  onPress,
}: {
  markers: RoadMarker[];
  withTime?: boolean;
  onPress?: (m: RoadMarker) => void;
}) {
  return (
    <>
      {markers.map((m, i) => (
        <FlatRow
          key={m.id}
          first={i === 0}
          leading={<Icon3D source={markerArt(m.kind)} size={38} />}
          title={m.label}
          subtitle={[m.street, withTime && m.recordedAt ? `alle ${hm(m.recordedAt)}` : null].filter(Boolean).join(' · ') || null}
          onPress={onPress ? () => onPress(m) : undefined}
        />
      ))}
    </>
  );
});

// ── Pagellino a parole ───────────────────────────────────────────────────────

export type EvaluationLine = { key: string; label: string; score: number; scaleMax: number };

export const EvaluationRows = memo(function EvaluationRows({ items }: { items: EvaluationLine[] }) {
  return (
    <>
      {items.map((e, i) => {
        const word = scoreWord(e.score, e.scaleMax);
        return (
          <FlatRow
            key={e.key}
            first={i === 0}
            title={e.label}
            value={word}
            valueStyle={word === 'Bene' ? s.valueSoft : s.valueStrong}
          />
        );
      })}
    </>
  );
});

/** «Bene in 3 voci su 4», «Tutto bene in 4 voci», «4 voci da rifinire». */
export const evaluationHeadline = (items: EvaluationLine[]) => {
  const good = items.filter((e) => scoreWord(e.score, e.scaleMax) === 'Bene').length;
  const n = items.length;
  const voci = (k: number) => (k === 1 ? '1 voce' : `${k} voci`);
  if (good === n) return n === 1 ? 'Bene' : `Bene in tutte le ${n} voci`;
  if (good === 0) return `${voci(n)} da rifinire`;
  return `Bene in ${good} ${good === 1 ? 'voce' : 'voci'} su ${n}`;
};

/** «8:10» (senza zero davanti, come gli orari delle guide). */
const hm = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || null;

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  hero: { alignItems: 'center', paddingTop: 6, paddingBottom: 4 },
  heroTitle: { fontSize: 28, lineHeight: 33, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.7, marginTop: 10, textAlign: 'center' },
  heroSub: { fontSize: 16, lineHeight: 21, color: CLAY.ink3, marginTop: 4, textAlign: 'center' },
  placeCard: { marginTop: 20 },
  placeClip: { borderRadius: 28, overflow: 'hidden' },
  placeMap: { height: 168 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 15 },
  rt: { fontSize: 16, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  rs: { fontSize: 14, lineHeight: 19, color: CLAY.ink3, marginTop: 1 },
  link: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: CLAY.ink, borderWidth: 3, borderColor: '#FFFFFF' },
  call: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CLAY.surface,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 0 1px rgba(17,17,17,0.055), 0 6px 14px -6px rgba(0,0,0,0.18)',
  },
  valueSoft: { fontSize: 15, color: CLAY.ink3 },
  valueStrong: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
});
