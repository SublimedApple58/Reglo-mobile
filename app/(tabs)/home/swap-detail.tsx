import React, { useEffect, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { swapDetailStore } from '../../../src/stores/swapDetailStore';
import { formatDay, formatTime } from '../../../src/utils/date';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const lessonTypeLabelMap: Record<string, string> = {
  manovre: 'Manovre', urbano: 'Urbano', extraurbano: 'Extraurbano',
  notturna: 'Notturna', autostrada: 'Autostrada', parcheggio: 'Parcheggio',
  altro: 'Altro', guida: 'Guida', esame: 'Esame',
};
const lessonTypeLabel = (type: string) => lessonTypeLabelMap[type] ?? type;

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';

export default function SwapDetailScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(swapDetailStore.subscribe, swapDetailStore.get);

  useEffect(() => {
    return () => { swapDetailStore.clear(); };
  }, []);

  if (!data) {
    return <View style={s.root} />;
  }

  const { offer, mine, onAccept, onRevoke } = data;
  const { appointment } = offer;

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: 14, paddingTop: 4 }}>
        {/* Hero */}
        <View style={s.heroRow}>
          {mine ? (
            <View style={[s.avatar, { backgroundColor: '#E9EBF2' }]}>
              <Ionicons name="swap-horizontal" size={24} color="#14141F" />
            </View>
          ) : (
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initialsOf(offer.requestingStudentName)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{mine ? 'La tua richiesta' : offer.requestingStudentName}</Text>
            <Text style={s.hint}>
              {mine
                ? 'In attesa che un compagno la prenda'
                : 'cerca un sostituto per questa guida'}
            </Text>
          </View>
        </View>

        {/* When (prominent) */}
        <Text style={s.whenDate}>{formatDay(appointment.startsAt)}</Text>
        <Text style={s.whenTime}>
          {formatTime(appointment.startsAt)}{appointment.endsAt ? ` – ${formatTime(appointment.endsAt)}` : ''}
        </Text>

        {/* Detail rows */}
        <View style={s.rows}>
          <View style={s.row}>
            <View style={[s.chip, { backgroundColor: '#CCFBF1' }]}>
              <Ionicons name="flag" size={18} color="#0D9488" />
            </View>
            <Text style={s.rowText}>{lessonTypeLabel(appointment.type)}</Text>
          </View>

          {appointment.instructorName ? (
            <>
              <View style={s.divider} />
              <View style={s.row}>
                <View style={[s.chip, { backgroundColor: '#E0E7FF' }]}>
                  <Ionicons name="person" size={18} color="#4F46E5" />
                </View>
                <Text style={s.rowText}>{appointment.instructorName}</Text>
              </View>
            </>
          ) : null}

          {appointment.vehicleName ? (
            <>
              <View style={s.divider} />
              <View style={s.row}>
                <View style={[s.chip, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="car" size={18} color="#7C3AED" />
                </View>
                <Text style={s.rowText}>{appointment.vehicleName}</Text>
              </View>
            </>
          ) : null}

          <View style={s.divider} />
          <View style={s.row}>
            <View style={[s.chip, { backgroundColor: '#F3F4F6' }]}>
              <Ionicons name="time" size={18} color="#6B7280" />
            </View>
            <Text style={[s.rowText, { color: colors.textSecondary }]}>
              Rispondi entro le {formatTime(offer.expiresAt)}
            </Text>
          </View>
        </View>

        {/* CTA */}
        {mine ? (
          <Pressable
            style={({ pressed }) => [s.revokeBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            onPress={() => { router.back(); setTimeout(() => onRevoke?.(offer.id), 350); }}
          >
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
            <Text style={s.revokeText}>Revoca richiesta</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [s.acceptBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            onPress={() => { router.back(); setTimeout(() => onAccept?.(offer.id), 350); }}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.surface} />
            <Text style={s.acceptText}>Accetta sostituzione</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.xl, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },

  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 10, marginBottom: 24 },
  avatar: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: '#F4F3F7',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 19, fontWeight: '700', color: '#7C7A8C' },
  name: { fontSize: 18, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  hint: { fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 2 },

  whenDate: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  whenTime: { fontSize: 34, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.6, marginTop: 4 },

  rows: { marginTop: 26 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  chip: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.textPrimary },

  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 27, backgroundColor: colors.primary, marginTop: 32,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32, shadowRadius: 14, elevation: 6,
  },
  acceptText: { fontSize: 16, fontWeight: '700', color: colors.surface, letterSpacing: -0.2 },

  revokeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 27, marginTop: 32,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  revokeText: { fontSize: 16, fontWeight: '700', color: '#DC2626', letterSpacing: -0.2 },
});
