/**
 * Prenotazione «solo eccezioni» (mobile): pezzi condivisi dai fogli «Si è
 * liberato un posto» (`SlotOfferSheet`) e «Posti liberi a breve»
 * (`LastMinuteSheet`). Anteprime approvate: mob-6a…6f e mob-7
 * (`docs/features/student-booking-exceptions.md`).
 *
 * - date a parole («Oggi», «Domani», «Giovedì», «Giovedì 13 novembre»);
 * - righe chiave/valore in card clay (Istruttore · Veicolo · Luogo);
 * - stato centrato con icona 3D (scaduto, già preso);
 * - successo «È tua, Luca!» con la cartina e il mezzo: sostituisce
 *   `BookingCelebration` in questi due flussi (una sola celebrazione).
 */
import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { CLAY, CLAY_SHADOW } from '../theme';
import { VITA_ART } from '../theme/vitaArt';
import { car34Art } from '../road/markerArt';
import { isMotoLicenseCategory } from '../utils/license';
import { ClayList, clayRowPadding, markClayRow, type ClayRowPosition } from '../components/clay';
import { Icon3D } from '../components/clay/Icon3D';
import { SkeletonBlock } from '../components/Skeleton';
import { notificationEvents } from '../services/notificationEvents';
import type { AutoscuolaStudent } from '../types/regloApi';

// ── Asset (tutti già nel repo, mappati dalle anteprime) ─────────────────────
/** Campanella oro della web app (`public/images/menu/bell-gold.png`). */
export const OFFER_BELL_ART = require('../../assets/web/menu/bell-gold.png');
export const PEOPLE_ART = require('../../assets/icons3d-ai/persone.png');
const MOTO_ART = require('../../assets/icons3d-ai/moto.png');

// ── Date a parole ───────────────────────────────────────────────────────────
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiff = (iso: string) =>
  Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);

/** «8:00», «15:30» (ora senza zero davanti, come nelle anteprime). */
export const hm = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** «Oggi» · «Domani» · «Giovedì» (entro la settimana) · «Giovedì 20». */
export const dayWord = (iso: string) => {
  const diff = dayDiff(iso);
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  const d = new Date(iso);
  const weekday = cap(d.toLocaleDateString('it-IT', { weekday: 'long' }));
  return diff > 1 && diff < 7 ? weekday : `${weekday} ${d.getDate()}`;
};

/** «Giovedì 13» (titoli di riga, «Sabato 15 · 9:00»). */
export const dayWithNumber = (iso: string) => {
  const diff = dayDiff(iso);
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  const d = new Date(iso);
  return `${cap(d.toLocaleDateString('it-IT', { weekday: 'long' }))} ${d.getDate()}`;
};

/** «Giovedì 13 novembre». */
export const longDate = (iso: string) =>
  cap(new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }));

/** «Gio 13 nov · 15:00 – 16:00». */
export const shortWhen = (startsAt: string, endsAt: string | null | undefined) => {
  const d = new Date(startsAt);
  const day = cap(d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''));
  return `${day} · ${hm(startsAt)}${endsAt ? ` – ${hm(endsAt)}` : ''}`;
};

/** YYYY-MM-DD nel fuso del telefono (parametro `date` di available-slots). */
export const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const firstNameOf = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] ?? '';

// ── Allievo collegato all'utente (come GroupLessonInvitesScreen) ───────────
const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
export const findLinkedStudent = (
  students: AutoscuolaStudent[],
  user: { name: string | null; email: string } | null,
) => {
  if (!user) return null;
  const byEmail = students.find((s) => norm(s.email) === norm(user.email));
  if (byEmail) return byEmail;
  const n = norm(user.name);
  if (!n) return null;
  return students.find((s) => `${norm(s.firstName)} ${norm(s.lastName)}` === n) ?? null;
};

// ── Dopo una prenotazione riuscita: dati freschi ovunque ───────────────────
/** Stesse chiavi di `invalidateAllData` della home allievo + overlay notifiche. */
export function useInvalidateAfterBooking() {
  const queryClient = useQueryClient();
  return React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['appointments'] }),
      queryClient.invalidateQueries({ queryKey: ['autoscuola-settings'] }),
      queryClient.invalidateQueries({ queryKey: ['booking-options'] }),
    ]);
    notificationEvents.emitDataChanged();
    notificationEvents.requestRefresh();
  }, [queryClient]);
}

/** Offerte già accettate (stessa chiave che l'overlay legge per «Già fatto»). */
export const ACCEPTED_OFFERS_KEY = 'reglo_accepted_notification_ids';
export async function readAcceptedOfferIds(): Promise<Set<string>> {
  try {
    const raw = await SecureStore.getItemAsync(ACCEPTED_OFFERS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
export async function markOfferAccepted(id: string) {
  const ids = await readAcceptedOfferIds();
  ids.add(id);
  await SecureStore.setItemAsync(ACCEPTED_OFFERS_KEY, JSON.stringify([...ids])).catch(() => undefined);
}

// ── Righe chiave / valore ───────────────────────────────────────────────────
export type KvItem = { key: string; label: string; value: React.ReactNode };

export const KvRow = markClayRow(function KvRow({
  label,
  value,
  divider,
  first,
  last,
}: { label: string; value: React.ReactNode } & ClayRowPosition) {
  return (
    <View style={[s.kvRow, clayRowPadding({ first, last }, 13)]}>
      {divider ? <View style={s.divider} /> : null}
      <Text style={s.kvKey}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={s.kvValue} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <View style={s.kvValueBox}>{value}</View>
      )}
    </View>
  );
});

export function KvList({ items, style }: { items: KvItem[]; style?: object }) {
  if (!items.length) return null;
  return (
    <ClayList style={style}>
      {items.map((it) => (
        <KvRow key={it.key} label={it.label} value={it.value} />
      ))}
    </ClayList>
  );
}

/** Volto piccolo a iniziali (riga Istruttore). */
export function InitialsFace({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
  return (
    <View style={s.face}>
      <Text style={s.faceTx}>{initials}</Text>
    </View>
  );
}

export function KvSkeletonList({ labels, widths, style }: { labels: string[]; widths: number[]; style?: object }) {
  return (
    <ClayList style={style}>
      {labels.map((label, i) => (
        <KvRow key={label} label={label} value={<SkeletonBlock width={widths[i] ?? 120} height={14} radius={7} />} />
      ))}
    </ClayList>
  );
}

// ── Stato centrato (già preso, scaduto) ─────────────────────────────────────
export function CenteredState({
  art,
  artSize = 104,
  title,
  text,
  testID,
}: {
  art: ImageSourcePropType;
  artSize?: number;
  title: string;
  text: string;
  testID?: string;
}) {
  return (
    <View style={s.center} testID={testID}>
      <Icon3D source={art} size={artSize} />
      <Text style={s.centerTitle}>{title}</Text>
      <Text style={s.centerText}>{text}</Text>
    </View>
  );
}

// ── Successo «È tua, Luca!» ─────────────────────────────────────────────────
/** Altezza della cartina in testa al foglio (anteprima mob-6c). */
export const SUCCESS_COVER_H = 150;
/** Testata di `FormSheet` (26 sopra + 40 riga + 14 sotto) + 4 del centro. */
const SHEET_HEAD_AND_PAD = 84;

/**
 * Cartina + mezzo che stanno DIETRO la testata del foglio: si passa come
 * `leading` di `FormSheet` (posizione assoluta, la X resta sopra). Il centro
 * del foglio è trasparente, quindi la parte bassa della cartina si vede sotto
 * il titolo e sfuma nel bianco.
 */
export function SuccessCover({
  licenseCategory,
  vehicleColor,
}: {
  licenseCategory?: string | null;
  vehicleColor?: string | null;
}) {
  const moto = isMotoLicenseCategory(licenseCategory);
  return (
    <View pointerEvents="none" style={s.cover}>
      <Image source={VITA_ART.cartinaRoad} style={s.coverMap} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)']}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.halo} />
      {moto ? (
        <Image source={MOTO_ART} style={s.moto} resizeMode="contain" />
      ) : (
        <Image source={car34Art(vehicleColor ?? 'rosso')} style={s.car} resizeMode="contain" />
      )}
    </View>
  );
}

export type SuccessInfo = {
  firstName: string;
  startsAt: string;
  endsAt: string | null;
  instructorName: string | null;
  vehicleName: string | null;
  vehicleColor: string | null;
  locationName: string | null;
  licenseCategory: string | null;
};

export function SuccessBody({ info }: { info: SuccessInfo }) {
  const who = firstNameOf(info.instructorName);
  const when = `${dayWord(info.startsAt)} alle ${hm(info.startsAt)}`;
  const line = who ? `${when} guidi con ${who}.` : `${when} hai la tua guida.`;
  // Il promemoria del giorno prima ha senso solo se la guida non è già oggi o domani.
  const startDay = new Date(info.startsAt);
  startDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysAway = Math.round((startDay.getTime() - today.getTime()) / 86400000);
  const closing = daysAway <= 0 ? 'Ci vediamo tra poco!' : daysAway === 1 ? 'A domani!' : 'Ti ricordiamo noi il giorno prima.';
  const rows: KvItem[] = [{ key: 'when', label: 'Quando', value: shortWhen(info.startsAt, info.endsAt) }];
  if (info.vehicleName) rows.push({ key: 'veh', label: 'Veicolo', value: info.vehicleName });
  if (info.locationName) rows.push({ key: 'loc', label: 'Luogo', value: info.locationName });
  return (
    <View testID="booking-success">
      <View style={{ height: SUCCESS_COVER_H - SHEET_HEAD_AND_PAD }} />
      <View style={s.center}>
        <Text style={[s.centerTitle, s.joyTitle]}>{info.firstName ? `È tua, ${info.firstName}!` : 'È tua!'}</Text>
        <Text style={s.centerText}>
          {line}
          {'\n'}{closing}
        </Text>
      </View>
      <KvList items={rows} style={{ marginTop: 18 }} />
    </View>
  );
}

const s = StyleSheet.create({
  kvRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, minHeight: 54 },
  divider: { position: 'absolute', top: 0, left: 18, right: 18, height: 0.5, backgroundColor: 'rgba(17,17,17,0.12)' },
  kvKey: { width: 92, fontSize: 16, color: CLAY.ink3 },
  kvValue: { flex: 1, textAlign: 'right', fontSize: 16, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  kvValueBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  face: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...CLAY_SHADOW.raiseSm,
  },
  faceTx: { fontSize: 12, fontWeight: '600', color: CLAY.ink },
  center: { alignItems: 'center', paddingHorizontal: 4 },
  centerTitle: { fontSize: 24, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5, marginTop: 10, textAlign: 'center' },
  joyTitle: { fontSize: 28, letterSpacing: -0.7, marginTop: 0 },
  centerText: { fontSize: 15.5, lineHeight: 22, color: CLAY.ink2, marginTop: 8, textAlign: 'center' },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, height: SUCCESS_COVER_H, overflow: 'hidden' },
  coverMap: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined, opacity: 0.9 },
  halo: {
    position: 'absolute',
    left: '50%',
    top: SUCCESS_COVER_H * 0.58 - 35,
    marginLeft: -85,
    width: 170,
    height: 70,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.75)',
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 28, spreadDistance: 18, color: 'rgba(255,255,255,0.75)' }],
  },
  moto: { position: 'absolute', left: '50%', marginLeft: -64, top: SUCCESS_COVER_H * 0.54 - 64, width: 128, height: 128 },
  car: { position: 'absolute', left: '50%', marginLeft: -75, top: SUCCESS_COVER_H * 0.54 - 58, width: 150, height: 116 },
});
