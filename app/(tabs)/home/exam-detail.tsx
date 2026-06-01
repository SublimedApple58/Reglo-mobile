import React, { useEffect, useSyncExternalStore } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { examDetailStore } from '../../../src/stores/examDetailStore';
import { formatDay, formatTime } from '../../../src/utils/date';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function ExamDetailScreen() {
  const data = useSyncExternalStore(examDetailStore.subscribe, examDetailStore.get);

  useEffect(() => {
    return () => { examDetailStore.clear(); };
  }, []);

  if (!data) return <View style={s.root} />;

  const { exam, countdown } = data;
  const loc = exam.location;
  const lat = typeof loc?.latitude === 'number' ? loc.latitude : loc?.latitude ? Number(loc.latitude) : null;
  const lng = typeof loc?.longitude === 'number' ? loc.longitude : loc?.longitude ? Number(loc.longitude) : null;
  const canOpenMap = loc?.isPrecise && lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <View style={s.root}>
      {/* Purple hero */}
      <View style={s.hero}>
        <Image source={require('../../../assets/icons/fluent-graduate.png')} style={s.heroIcon} />
        <View style={{ flex: 1 }}>
          <Text style={s.heroLabel}>Esame di guida</Text>
          <Text style={s.heroTime}>
            {formatTime(exam.startsAt)}
          </Text>
          <Text style={s.heroDate}>{formatDay(exam.startsAt)}</Text>
        </View>
        {countdown && (
          <View style={s.countdownBadge}>
            <Text style={s.countdownNum}>
              {countdown.days === 0 ? 'Oggi!' : countdown.days}
            </Text>
            {countdown.days > 0 && (
              <Text style={s.countdownUnit}>{countdown.days === 1 ? 'giorno' : 'giorni'}</Text>
            )}
          </View>
        )}
      </View>

      {/* Info card */}
      <View style={s.infoCard}>
        {/* Instructor */}
        <View style={s.row}>
          <Ionicons name="person-outline" size={18} color={colors.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={s.rowValue}>{exam.instructor?.name ?? 'Da assegnare'}</Text>
            {exam.instructor?.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${exam.instructor!.phone}`)}>
                <Text style={s.rowLink}>{exam.instructor.phone}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Vehicle */}
        {exam.vehicle?.name && (
          <>
            <View style={s.divider} />
            <View style={s.row}>
              <Ionicons name="car-outline" size={18} color={colors.textMuted} />
              <Text style={s.rowValue}>{exam.vehicle.name}</Text>
            </View>
          </>
        )}

        {/* Location */}
        <View style={s.divider} />
        <Pressable
          onPress={canOpenMap ? () => {
            const placeId = loc!.placeId ? `&query_place_id=${loc!.placeId}` : '';
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}${placeId}`).catch(() => null);
          } : undefined}
          disabled={!canOpenMap}
          style={s.row}
        >
          <Ionicons
            name={loc?.isPrecise ? 'location' : 'location-outline'}
            size={18}
            color={canOpenMap ? '#7C3AED' : colors.textMuted}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.rowValue} numberOfLines={1}>
              {loc?.name ?? "Sede dell'autoscuola"}
            </Text>
            {loc?.isPrecise && loc.address ? (
              <Text style={s.rowSub} numberOfLines={1}>{loc.address}</Text>
            ) : null}
          </View>
          {canOpenMap ? <Ionicons name="open-outline" size={16} color="#7C3AED" /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.md, paddingBottom: 40, gap: 14 },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#F5F0FF', borderRadius: 26, padding: 20,
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20, shadowRadius: 10, elevation: 6,
  },
  heroIcon: { width: 52, height: 52 },
  heroLabel: { fontSize: 12, fontWeight: '700', color: '#7C3AED', letterSpacing: 0.3 },
  heroTime: { fontSize: 28, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.5, marginTop: 2 },
  heroDate: { fontSize: 14, fontWeight: '500', color: colors.textMuted, marginTop: 2 },
  countdownBadge: {
    backgroundColor: '#8B5CF6', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 64,
  },
  countdownNum: { color: '#FFF', fontSize: 24, fontWeight: '800', lineHeight: 26 },
  countdownUnit: { color: '#FFF', fontSize: 10, fontWeight: '600', opacity: 0.9 },
  infoCard: {
    backgroundColor: '#EEEDEB', borderRadius: 20, padding: spacing.md,
    boxShadow: [
      { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: 0, color: 'rgba(0,0,0,0.12)', inset: true },
      { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: 'rgba(0,0,0,0.06)', inset: true },
    ],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
  rowValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 1 },
  rowLink: { fontSize: 14, fontWeight: '600', color: '#7C3AED', marginTop: 2 },
});
