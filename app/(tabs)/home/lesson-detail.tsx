import React, { useEffect, useSyncExternalStore } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { lessonDetailStore } from '../../../src/stores/lessonDetailStore';
import { formatDay, formatTime } from '../../../src/utils/date';
import { paymentStatusLabel } from '../../../src/utils/payment';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import type { StudentAppointmentPaymentHistoryItem } from '../../../src/types/regloApi';

const statusLabel = (status: string | null | undefined) => {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'scheduled' || s === 'confirmed') return 'Programmata';
  if (s === 'checked_in') return 'Check-in';
  if (s === 'completed') return 'Completata';
  if (s === 'cancelled') return 'Annullata';
  if (s === 'pending_review') return 'Da confermare';
  return 'Programmata';
};

const lessonDurationMinutes = (startsAt: string, endsAt?: string | null) => {
  const s = new Date(startsAt).getTime();
  const e = endsAt ? new Date(endsAt).getTime() : s + 30 * 60 * 1000;
  return Math.max(30, Math.round((e - s) / 60000));
};

const formatLessonType = (value: string | null | undefined) => {
  const map: Record<string, string> = {
    manovre: 'Manovre', urbano: 'Urbano', extraurbano: 'Extraurbano',
    notturna: 'Notturna', autostrada: 'Autostrada', guida: 'Guida',
  };
  return map[(value ?? '').trim().toLowerCase()] ?? value ?? 'Guida';
};

export default function LessonDetailScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(lessonDetailStore.subscribe, lessonDetailStore.get);

  useEffect(() => {
    return () => { lessonDetailStore.clear(); };
  }, []);

  if (!data) {
    return <View style={s.root} />;
  }

  const { lesson, payment, canSwap, canCancel, vehiclesEnabled, onSwap, onCancel } = data;
  const isFuture = new Date(lesson.startsAt).getTime() > Date.now();

  return (
    <View style={s.root}>
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: 40, gap: 14 }}>
        {/* Dark hero card */}
        <View style={s.hero}>
          <View style={s.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroDate}>{formatDay(lesson.startsAt)}</Text>
              <Text style={s.heroTime}>
                {formatTime(lesson.startsAt)}{lesson.endsAt ? ` \u2013 ${formatTime(lesson.endsAt)}` : ''}
              </Text>
            </View>
            <View style={s.statusBadge}>
              <Text style={s.statusText}>{statusLabel(lesson.status)}</Text>
            </View>
          </View>
          <Text style={s.heroDuration}>
            {lessonDurationMinutes(lesson.startsAt, lesson.endsAt)} min
          </Text>
        </View>

        {/* Details grouped card */}
        <View style={s.groupCard}>
          {/* Instructor */}
          <View style={s.row}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowValue}>{lesson.instructor?.name ?? 'Da assegnare'}</Text>
              {lesson.instructor?.phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${lesson.instructor!.phone}`)}>
                  <Text style={s.rowLink}>{lesson.instructor.phone}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Vehicle */}
          {vehiclesEnabled && (
            <>
              <View style={s.divider} />
              <View style={s.row}>
                <Ionicons name="car-outline" size={18} color={colors.textMuted} />
                <Text style={s.rowValue}>{lesson.vehicle?.name ?? 'Da assegnare'}</Text>
              </View>
            </>
          )}

          {/* Location */}
          <View style={s.divider} />
          {(() => {
            const loc = lesson.location;
            const lat = typeof loc?.latitude === 'number' ? loc.latitude : loc?.latitude ? Number(loc.latitude) : null;
            const lng = typeof loc?.longitude === 'number' ? loc.longitude : loc?.longitude ? Number(loc.longitude) : null;
            const isTappable = loc?.isPrecise && lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
            const display = loc?.name ?? "Sede dell'autoscuola";
            const handleOpenMaps = () => {
              if (!isTappable) return;
              const placeIdParam = loc!.placeId ? `&query_place_id=${loc!.placeId}` : '';
              Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}${placeIdParam}`).catch(() => null);
            };
            return (
              <Pressable onPress={isTappable ? handleOpenMaps : undefined} disabled={!isTappable} style={s.row}>
                <Ionicons name={loc?.isPrecise ? 'location' : 'location-outline'} size={18} color={isTappable ? '#16A34A' : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowValue} numberOfLines={1}>{display}</Text>
                  {loc?.isPrecise && loc.address ? <Text style={s.rowSub} numberOfLines={1}>{loc.address}</Text> : null}
                </View>
                {isTappable ? <Ionicons name="open-outline" size={16} color="#16A34A" /> : null}
              </Pressable>
            );
          })()}

          {/* Payment */}
          <View style={s.divider} />
          <View style={s.row}>
            <Ionicons name="wallet-outline" size={18} color={colors.textMuted} />
            <Text style={[s.rowValue, { color: colors.textSecondary }]}>
              {payment
                ? `${paymentStatusLabel(payment.paymentStatus).label}${payment.dueAmount > 0 ? ` \u2022 Residuo \u20AC${payment.dueAmount.toFixed(2)}` : ''}`
                : 'Nessun dettaglio disponibile'}
            </Text>
          </View>

          {/* Lesson type */}
          {lesson.types && lesson.types.length > 0 && (
            <>
              <View style={s.divider} />
              <View style={s.row}>
                <Ionicons name="flag-outline" size={18} color={colors.textMuted} />
                <Text style={s.rowValue}>{lesson.types.map(formatLessonType).join(', ')}</Text>
              </View>
            </>
          )}
        </View>

        {/* Action buttons */}
        {isFuture && (canSwap || canCancel) && (
          <View style={{ gap: 10, marginTop: 4 }}>
            {canSwap && (
              <Pressable
                style={({ pressed }) => [s.swapBtn, pressed && { opacity: 0.8 }]}
                onPress={() => { router.back(); setTimeout(() => onSwap(lesson.id), 350); }}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color="#92400E" />
                <Text style={s.swapText}>Cerca sostituto</Text>
              </Pressable>
            )}
            {canCancel && (
              <Pressable
                style={({ pressed }) => [s.cancelBtn, pressed && { opacity: 0.8 }]}
                onPress={() => { router.back(); setTimeout(() => onCancel(lesson.id), 350); }}
              >
                <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                <Text style={s.cancelText}>Annulla guida</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20 },
  hero: {
    backgroundColor: '#1A1A2E', borderRadius: 26, padding: 20, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14, shadowRadius: 6, elevation: 5,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroDate: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  heroTime: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginTop: 2 },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  heroDuration: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.45)' },
  groupCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14, shadowRadius: 6, elevation: 5,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
  rowValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 1 },
  rowLink: { fontSize: 14, fontWeight: '600', color: '#3B82F6', marginTop: 2 },
  swapBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginTop: 8, paddingVertical: 12, borderRadius: 14,
    borderWidth: 2, borderColor: 'rgba(146, 64, 14, 0.25)', backgroundColor: 'rgba(146, 64, 14, 0.06)',
  },
  swapText: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: 14,
    borderWidth: 2, borderColor: 'rgba(220, 38, 38, 0.2)', backgroundColor: 'rgba(220, 38, 38, 0.04)',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
});
