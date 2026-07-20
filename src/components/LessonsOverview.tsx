import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SheetScaffold } from './SheetScaffold';
import { useAppointments } from '../hooks/queries/useAppointments';
import { formatDay, formatTime } from '../utils/date';
import { lessonArtSource } from '../utils/lessonArt';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

/**
 * Vista "Le tue guide" dell'allievo: due segmenti Programmate / Annullate.
 * Riusata da due punti d'accesso:
 *  - home sheet `all-lessons` → riceve `seededUpcoming` + `onOpenDetail` (card tappabili).
 *  - Profilo route `more/le-tue-guide` → autonoma: risolve i dati da sé (card non tappabili).
 * Il segmento Annullate si carica sempre da sé (lazy, solo quando selezionato).
 */
type Props = {
  studentId: string | null;
  /** Programmate seedate dalla home. Se assente → la vista le carica da sola. */
  seededUpcoming?: AutoscuolaAppointmentWithRelations[];
  /** Se presente, le card programmate sono tappabili e aprono il dettaglio. */
  onOpenDetail?: (lesson: AutoscuolaAppointmentWithRelations) => void;
};

type Tab = 'upcoming' | 'cancelled';

const UPCOMING_STATUSES = ['scheduled', 'confirmed', 'checked_in', 'pending_review'];

const CARD_COLORS = [
  { bg: '#F4F5F9', accent: '#1A1A2E' },
  { bg: '#EFF6FF', accent: '#3B82F6' },
  { bg: '#F0FDF4', accent: '#22C55E' },
  { bg: '#FFFBEB', accent: '#F59E0B' },
  { bg: '#F5F3FF', accent: '#8B5CF6' },
] as const;

const monthLabel = (iso: string) => {
  const s = new Date(iso).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatEuro = (value: number) => {
  const n = Number(value);
  return Number.isInteger(n) ? `€${n}` : `€${n.toFixed(2)}`;
};

export function LessonsOverview({ studentId, seededUpcoming, onOpenDetail }: Props) {
  const [tab, setTab] = useState<Tab>('upcoming');
  const standalone = seededUpcoming === undefined;

  // Programmate: in standalone le carico io (finestra 12 settimane avanti).
  const upcomingParams = useMemo(() => {
    if (!standalone || !studentId) return null;
    const to = new Date();
    to.setDate(to.getDate() + 84);
    to.setHours(23, 59, 59, 999);
    return {
      studentId,
      from: new Date().toISOString(),
      to: to.toISOString(),
      limit: 200,
      light: true,
    };
  }, [standalone, studentId]);
  const upcomingQuery = useAppointments(upcomingParams);

  const upcoming = useMemo(() => {
    if (!standalone) return seededUpcoming ?? [];
    const now = Date.now();
    return (upcomingQuery.data ?? [])
      .filter(
        (l) =>
          UPCOMING_STATUSES.includes((l.status ?? '').toLowerCase()) &&
          new Date(l.startsAt).getTime() >= now,
      )
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [standalone, seededUpcoming, upcomingQuery.data]);

  // Annullate: fetch lazy solo quando il segmento è attivo (ultimi 12 mesi in
  // avanti, nessun `to` → include anche eventuali future annullate).
  const cancelledParams = useMemo(() => {
    if (tab !== 'cancelled' || !studentId) return null;
    const from = new Date();
    from.setMonth(from.getMonth() - 12);
    from.setHours(0, 0, 0, 0);
    return { studentId, from: from.toISOString(), status: 'cancelled', limit: 200, light: true };
  }, [tab, studentId]);
  const cancelledQuery = useAppointments(cancelledParams);

  // Solo gli annullamenti dell'allievo (manual_cancel): esclude le rimozioni
  // amministrative (record_cleanup) e le cancellazioni organizzative della scuola.
  const cancelledSections = useMemo(() => {
    const list = (cancelledQuery.data ?? [])
      .filter((l) => l.cancellationKind === 'manual_cancel')
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
    const out: { month: string; items: AutoscuolaAppointmentWithRelations[] }[] = [];
    for (const l of list) {
      const m = monthLabel(l.startsAt);
      let sec = out[out.length - 1];
      if (!sec || sec.month !== m) {
        sec = { month: m, items: [] };
        out.push(sec);
      }
      sec.items.push(l);
    }
    return out;
  }, [cancelledQuery.data]);

  const cancelledCount = cancelledSections.reduce((acc, sec) => acc + sec.items.length, 0);

  return (
    <>
      <View style={s.header}>
        <Text style={s.title}>Le tue guide</Text>
        <Text style={s.subtitle}>
          {tab === 'upcoming'
            ? `${upcoming.length} ${upcoming.length === 1 ? 'guida' : 'guide'} in programma`
            : 'Le guide che hai annullato'}
        </Text>
      </View>

      <View style={s.seg}>
        {(['upcoming', 'cancelled'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[s.segBtn, tab === t && s.segBtnActive]}>
            <Text style={[s.segText, tab === t && s.segTextActive]}>
              {t === 'upcoming' ? 'Programmate' : 'Annullate'}
            </Text>
          </Pressable>
        ))}
      </View>

      <SheetScaffold>
        {tab === 'upcoming' ? (
          standalone && upcomingQuery.isLoading ? (
            <View style={s.centerState}>
              <ActivityIndicator color="#1A1A2E" />
            </View>
          ) : upcoming.length === 0 ? (
            <View style={s.centerState}>
              <View style={s.emptyIcon}>
                <Ionicons name="calendar-outline" size={24} color="#B4B4BD" />
              </View>
              <Text style={s.emptyTitle}>Nessuna guida in programma</Text>
            </View>
          ) : (
            <View style={s.list}>
              {upcoming.map((lesson, idx) => {
                const bg = CARD_COLORS[idx % CARD_COLORS.length];
                const inner = (
                  <>
                    <Image source={lessonArtSource(lesson.vehicle?.licenseCategory)} style={s.cardIcon} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.cardTime} numberOfLines={1}>
                        {formatTime(lesson.startsAt)}{lesson.endsAt ? ` – ${formatTime(lesson.endsAt)}` : ''}
                      </Text>
                      <Text style={s.cardDate} numberOfLines={1}>{formatDay(lesson.startsAt)}</Text>
                      <Text style={s.cardInstructor} numberOfLines={1}>
                        {lesson.instructor?.name ?? 'Da assegnare'}
                      </Text>
                    </View>
                    {onOpenDetail ? (
                      <View style={[s.cardArrow, { backgroundColor: bg.accent }]}>
                        <Ionicons name="chevron-forward" size={14} color="#FFF" />
                      </View>
                    ) : null}
                  </>
                );
                return onOpenDetail ? (
                  <Pressable
                    key={lesson.id}
                    onPress={() => onOpenDetail(lesson)}
                    style={({ pressed }) => [s.card, { backgroundColor: bg.bg }, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
                  >
                    {inner}
                  </Pressable>
                ) : (
                  <View key={lesson.id} style={[s.card, { backgroundColor: bg.bg }]}>
                    {inner}
                  </View>
                );
              })}
            </View>
          )
        ) : cancelledQuery.isLoading ? (
          <View style={s.centerState}>
            <ActivityIndicator color="#1A1A2E" />
          </View>
        ) : cancelledCount === 0 ? (
          <View style={s.centerState}>
            <View style={s.emptyIcon}>
              <Ionicons name="close-circle-outline" size={26} color="#B4B4BD" />
            </View>
            <Text style={s.emptyTitle}>Nessuna guida annullata</Text>
            <Text style={s.emptyText}>Le guide che annulli compariranno qui.</Text>
          </View>
        ) : (
          <View style={s.list}>
            {cancelledSections.map((section) => (
              <View key={section.month} style={{ gap: 11 }}>
                <Text style={s.month}>{section.month}</Text>
                {section.items.map((lesson) => {
                  const cancelledAt = lesson.cancelledAt ? new Date(lesson.cancelledAt) : null;
                  const cutoff = lesson.penaltyCutoffAt ? new Date(lesson.penaltyCutoffAt) : null;
                  const isLate = !!cancelledAt && !!cutoff && cancelledAt.getTime() > cutoff.getTime();
                  const charged = lesson.lateCancellationAction === 'charged';
                  const dismissed = lesson.lateCancellationAction === 'dismissed';
                  return (
                    <View key={lesson.id} style={s.cancelledCard}>
                      <Image
                        source={lessonArtSource(lesson.vehicle?.licenseCategory)}
                        style={[s.cardIcon, s.cardIconDim]}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.cxTime} numberOfLines={1}>
                          {formatTime(lesson.startsAt)}{lesson.endsAt ? ` – ${formatTime(lesson.endsAt)}` : ''}
                        </Text>
                        <Text style={s.cardDate} numberOfLines={1}>{formatDay(lesson.startsAt)}</Text>
                        <Text style={s.cardInstructor} numberOfLines={1}>
                          {lesson.instructor?.name ?? 'Da assegnare'}
                        </Text>
                        <View style={s.badges}>
                          {isLate ? (
                            <>
                              <View style={[s.badge, s.badgeLate]}>
                                <Text style={[s.badgeText, s.badgeLateText]}>Annullamento tardivo</Text>
                              </View>
                              {charged ? (
                                <View style={[s.badge, s.badgeCharged]}>
                                  <Text style={[s.badgeText, s.badgeChargedText]}>
                                    Addebitata{lesson.penaltyAmount != null ? ` ${formatEuro(lesson.penaltyAmount)}` : ''}
                                  </Text>
                                </View>
                              ) : dismissed ? (
                                <View style={[s.badge, s.badgeRefunded]}>
                                  <Text style={[s.badgeText, s.badgeRefundedText]}>Non addebitata</Text>
                                </View>
                              ) : null}
                            </>
                          ) : (
                            <View style={[s.badge, s.badgeCancelled]}>
                              <Text style={[s.badgeText, s.badgeCancelledText]}>Annullata</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </SheetScaffold>
    </>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: spacing.md, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginTop: 4 },

  seg: { marginHorizontal: spacing.md, marginBottom: 16, backgroundColor: '#ECECF1', borderRadius: 13, padding: 3, flexDirection: 'row' },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1,
  },
  segText: { fontSize: 13, fontWeight: '600', color: '#8A8A94' },
  segTextActive: { color: '#1A1A2E' },

  list: { paddingHorizontal: spacing.md, paddingBottom: 40, gap: 11 },
  month: { fontSize: 12, fontWeight: '600', color: '#A2A2AC', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6, marginLeft: 4 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 22, padding: 14, paddingRight: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
  },
  cardIcon: { width: 38, height: 38 },
  cardIconDim: { opacity: 0.55 },
  cardTime: { fontSize: 17, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
  cardDate: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: 1 },
  cardInstructor: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
  cardArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  cancelledCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 22, padding: 14, paddingRight: 13,
    shadowColor: '#141428', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  cxTime: { fontSize: 16, fontWeight: '700', color: '#3A3A48', letterSpacing: -0.3 },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  badge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeCancelled: { backgroundColor: '#F1F1F5' },
  badgeCancelledText: { color: '#88888F' },
  badgeLate: { backgroundColor: '#FFF4E5' },
  badgeLateText: { color: '#B45309' },
  badgeCharged: { backgroundColor: '#1A1A2E' },
  badgeChargedText: { color: '#FFFFFF' },
  badgeRefunded: { backgroundColor: '#ECFDF3' },
  badgeRefundedText: { color: '#067647' },

  centerState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: spacing.md, gap: 6 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F1F1F5', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  emptyText: { fontSize: 13, fontWeight: '500', color: colors.textMuted, textAlign: 'center' },
});
