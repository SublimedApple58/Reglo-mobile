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

  const { lesson, payment, canSwap, canCancel, vehiclesEnabled, activeSwapOfferId, onSwap, onCancel, onRevokeSwap } = data;
  const isFuture = new Date(lesson.startsAt).getTime() > Date.now();
  const hasActiveSwap = !!activeSwapOfferId;

  return (
    <View style={s.root}>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: 14, paddingTop: 4 }}>
        {/* Header (flat) */}
        <View style={s.header}>
          <View style={s.headerTopRow}>
            <Text style={s.heroDate}>{formatDay(lesson.startsAt)}</Text>
            <View style={s.statusBadge}>
              <Text style={s.statusText}>{statusLabel(lesson.status)}</Text>
            </View>
          </View>
          <Text style={s.heroTime}>
            {formatTime(lesson.startsAt)}{lesson.endsAt ? ` \u2013 ${formatTime(lesson.endsAt)}` : ''}
          </Text>
          <Text style={s.heroDuration}>
            {lessonDurationMinutes(lesson.startsAt, lesson.endsAt)} min
          </Text>
          {hasActiveSwap && (
            <View style={s.swapBanner}>
              <Ionicons name="swap-horizontal" size={14} color="#14141F" />
              <Text style={s.swapBannerText}>Sostituzione richiesta · in attesa di un compagno</Text>
            </View>
          )}
        </View>

        {/* Details (flat rows) */}
        <View style={s.groupCard}>
          {/* Instructor */}
          <View style={s.row}>
            <View style={[s.iconChip, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="person" size={18} color="#4F46E5" />
            </View>
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
                <View style={[s.iconChip, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="car" size={18} color="#7C3AED" />
                </View>
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
                <View style={[s.iconChip, { backgroundColor: '#CCFBF1' }]}>
                  <Ionicons name="location" size={18} color="#0D9488" />
                </View>
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
            <View style={[s.iconChip, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="wallet" size={18} color="#D97706" />
            </View>
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
                <View style={[s.iconChip, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="flag" size={18} color="#2563EB" />
                </View>
                <Text style={s.rowValue}>{lesson.types.map(formatLessonType).join(', ')}</Text>
              </View>
            </>
          )}
        </View>

        {/* Action buttons */}
        {isFuture && (canSwap || canCancel || hasActiveSwap) && (
          <View style={{ gap: 8, marginTop: 32 }}>
            {hasActiveSwap ? (
              <Pressable
                style={({ pressed }) => [s.revokeBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                onPress={() => { router.back(); setTimeout(() => onRevokeSwap?.(activeSwapOfferId!), 350); }}
              >
                <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                <Text style={s.revokeText}>Revoca richiesta sostituzione</Text>
              </Pressable>
            ) : canSwap ? (
              <Pressable
                style={({ pressed }) => [s.swapBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                onPress={() => { router.back(); setTimeout(() => onSwap(lesson.id), 350); }}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color={colors.surface} />
                <Text style={s.swapText}>Cerca sostituto</Text>
              </Pressable>
            ) : null}
            {canCancel && (
              <Pressable
                style={({ pressed }) => [s.cancelBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
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
  header: { gap: 4, paddingTop: 10 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroDate: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  heroTime: { fontSize: 36, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.8, marginTop: 6 },
  statusBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  statusText: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.2 },
  heroDuration: { fontSize: 14, fontWeight: '500', color: colors.textMuted, marginTop: 4 },
  groupCard: { marginTop: 30 },
  iconChip: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  rowValue: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 1 },
  rowLink: { fontSize: 14, fontWeight: '600', color: '#3B82F6', marginTop: 2 },
  swapBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 27,
    backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32, shadowRadius: 14, elevation: 6,
  },
  swapText: { fontSize: 16, fontWeight: '700', color: colors.surface, letterSpacing: -0.2 },
  swapBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    marginTop: 12, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, backgroundColor: '#E9EBF2',
  },
  swapBannerText: { fontSize: 12, fontWeight: '700', color: '#14141F', letterSpacing: -0.1 },
  revokeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 27,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  revokeText: { fontSize: 16, fontWeight: '700', color: '#DC2626', letterSpacing: -0.2 },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 26,
    backgroundColor: 'transparent',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
});
