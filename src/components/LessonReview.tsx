/**
 * REG-790 — pezzi del foglio di RIEPILOGO prima di prendere una guida (flusso
 * Airbnb voluto da Tiziano il 25/11/2026): prenotazione (`booking-review`) e
 * guida lasciata da un compagno (`swap-detail`). Gerarchia a tre livelli:
 * l'orario grande, poi righe istruttore · auto · sede, poi le regole utili in
 * piccolo. La CTA nera prende la guida; al successo il quadratino
 * (`BookingSuccessOverlay`), all'errore il messaggio qui sopra la CTA.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { Avatar, Icon3D } from './clay';
import { FlatRow } from '../screens/allievoHome/HomeSections';
import { car34Art } from '../road/markerArt';
import { CLAY } from '../theme/clay';
import { VITA_ART } from '../theme/vitaArt';
import { CLAY_DANGER } from './ClayAccountParts';

const PEOPLE_ART = require('../../assets/icons3d-ai/persone.png');

export const hm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

const dayDiff = (d: Date) => {
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
};

/** «oggi alle 14:30», «domani alle 9:00», «mercoledì alle 14:30», «mercoledì 3 dicembre alle 9:00». */
export const atWords = (d: Date) => {
  const diff = dayDiff(d);
  const day =
    diff <= 0
      ? 'oggi'
      : diff === 1
        ? 'domani'
        : diff < 7
          ? d.toLocaleDateString('it-IT', { weekday: 'long' })
          : d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${day} alle ${hm(d)}`;
};

/** «Oggi», «Domani», «Tra 3 giorni» (sottotitolo del foglio). */
export const whenWords = (iso: string) => {
  const diff = dayDiff(new Date(iso));
  if (diff <= 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  return `Tra ${diff} giorni`;
};

/** L'orario grande con tipo · durata sotto. */
export function ReviewTime({ startsAt, endsAt, meta }: { startsAt: string; endsAt?: string | null; meta?: string | null }) {
  return (
    <View>
      <Text style={s.time} accessibilityRole="header">
        {hm(new Date(startsAt))}
        {endsAt ? ` – ${hm(new Date(endsAt))}` : ''}
      </Text>
      {meta ? <Text style={s.meta}>{meta}</Text> : null}
    </View>
  );
}

export function ReviewRows({
  instructorName,
  instructorKnown,
  vehicleName,
  vehicleColor,
  locationName,
  locationAddress,
}: {
  instructorName: string | null;
  /** `false` = lo sceglie il server alla conferma (primo istruttore libero). */
  instructorKnown: boolean;
  vehicleName?: string | null;
  vehicleColor?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
}) {
  return (
    <View style={s.rows}>
      {instructorKnown && instructorName ? (
        <FlatRow first leading={<Avatar userId={null} name={instructorName} size={40} />} title={instructorName} subtitle="Il tuo istruttore" />
      ) : (
        <FlatRow
          first
          leading={<Icon3D source={PEOPLE_ART} size={36} />}
          title="Il primo istruttore libero"
          subtitle="Lo vedi appena confermi"
        />
      )}
      {vehicleName ? (
        <FlatRow
          leading={<Icon3D source={car34Art(vehicleColor)} size={34} width={42} />}
          title={vehicleName}
          subtitle="L'auto della guida"
        />
      ) : null}
      {locationName ? (
        <FlatRow leading={<Icon3D source={VITA_ART.edificio} size={36} />} title={locationName} subtitle={locationAddress ?? 'Il punto di ritrovo'} />
      ) : null}
    </View>
  );
}

/** Regole utili in piccolo (annullo, scadenza): righe di testo, niente pillole. */
export function ReviewNote({ lines }: { lines: Array<string | null | undefined> }) {
  const text = lines.filter(Boolean).join(' ');
  return text ? <Text style={s.note}>{text}</Text> : null;
}

/** Errore del server: nel foglio, sopra la CTA, in dissolvenza. */
export function ReviewError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <Animated.Text
      entering={FadeIn.duration(180).reduceMotion(ReduceMotion.Never)}
      style={s.error}
      accessibilityRole="alert"
      testID="review-error"
    >
      {message}
    </Animated.Text>
  );
}

const s = StyleSheet.create({
  time: { fontSize: 46, lineHeight: 52, fontWeight: '600', color: CLAY.ink, letterSpacing: -1.5, marginTop: 4, fontVariant: ['tabular-nums'] },
  meta: { fontSize: 16, lineHeight: 21, color: CLAY.ink2, marginTop: 4 },
  rows: { marginTop: 14 },
  note: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 12 },
  error: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: CLAY_DANGER, marginTop: 14 },
});
