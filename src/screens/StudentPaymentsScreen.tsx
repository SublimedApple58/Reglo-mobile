import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { GlassCloseButton } from '../components/GlassCloseButton';
import { studentPaymentsStore } from '../stores/studentPaymentsStore';
import { regloApi } from '../services/regloApi';
import { colors } from '../theme';
import { formatTime } from '../utils/date';
import { LESSON_TYPE_LABEL_MAP } from '../utils/lessonTypes';
import {
  canToggleLessonPayment,
  isCompanyManualMode,
  isLessonUnpaid,
  isPenaltyCharged,
  isPenaltyPaid,
} from '../utils/lessonPayments';
import type { AutoscuolaAppointmentWithRelations } from '../types/regloApi';

/** Filtri del registro guide — stessi identici del dettaglio allievo web. */
type LessonFilter = 'all' | 'upcoming' | 'unpaid' | 'completed' | 'cancelled';

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

const DONE = ['completed', 'checked_in'];
const MISSED = ['cancelled', 'no_show'];
const FUTURE = ['scheduled', 'confirmed'];

const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
};
const monthLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    ? MONTHS[d.getMonth()]
    : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const formatEuro = (value: number) =>
  Number.isInteger(value) ? `€${value}` : `€${value.toFixed(2)}`;

/**
 * Annullamento oltre la soglia di preavviso. Stessa condizione del dettaglio
 * allievo web: non basta che la guida sia annullata, deve esserlo DOPO il
 * `penaltyCutoffAt`.
 */
const isLate = (l: AutoscuolaAppointmentWithRelations) => {
  if (!l.cancelledAt || !l.penaltyCutoffAt) return false;
  return new Date(l.cancelledAt).getTime() > new Date(l.penaltyCutoffAt).getTime();
};

/** Etichetta di stato della guida, con lo stesso vocabolario del web. */
const statusLabel = (status: string) => {
  switch (normalize(status)) {
    case 'completed':
    case 'checked_in':
      return 'Completata';
    case 'cancelled':
      return 'Annullata';
    case 'no_show':
      return 'Assente';
    case 'proposal':
      return 'Proposta';
    default:
      return 'Programmata';
  }
};

type BadgeTone = 'neutral' | 'amber' | 'green' | 'violet' | 'red';

const Badge = ({ tone, label }: { tone: BadgeTone; label: string }) => (
  <View style={[s.badge, TONE[tone].box]}>
    <Text style={[s.badgeText, TONE[tone].text]}>{label}</Text>
  </View>
);

export const StudentPaymentsScreen = () => {
  const router = useRouter();
  const data = useSyncExternalStore(studentPaymentsStore.subscribe, studentPaymentsStore.get);

  const [filter, setFilter] = useState<LessonFilter>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  /**
   * Scritture già confermate dal BE, applicate qui senza rileggere tutto lo
   * storico (niente optimistic update: si scrive solo ciò che il server ha
   * risposto). La scheda sotto si riallinea da sé via `onChanged`.
   */
  const [patched, setPatched] = useState<Record<string, string | null>>({});

  const manualMode = isCompanyManualMode(data?.settings);

  const lessons = useMemo(() => {
    const list = (data?.lessons ?? []).map((l) =>
      l.id in patched ? { ...l, manualPaymentStatus: patched[l.id] } : l,
    );
    return list.sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    );
  }, [data?.lessons, patched]);

  /**
   * Predicati dei filtri: copia esatta del dettaglio allievo web. "Da pagare"
   * sono SOLO le guide effettuate non saldate (o le penali tardive addebitate),
   * mai le future programmate e mai quelle coperte da credito.
   */
  const predicates: Record<LessonFilter, (l: AutoscuolaAppointmentWithRelations) => boolean> =
    useMemo(() => {
      const now = Date.now();
      return {
        all: () => true,
        upcoming: (l) =>
          FUTURE.includes(normalize(l.status)) && new Date(l.startsAt).getTime() > now,
        unpaid: (l) => isLessonUnpaid(l, manualMode),
        completed: (l) => DONE.includes(normalize(l.status)),
        cancelled: (l) => MISSED.includes(normalize(l.status)),
      };
    }, [manualMode]);

  // Il segmento "Da pagare" ha senso solo in modalità manuale, come sul web.
  const filterDefs = useMemo(
    () =>
      [
        { value: 'all' as const, label: 'Tutte' },
        { value: 'upcoming' as const, label: 'Future' },
        ...(manualMode ? [{ value: 'unpaid' as const, label: 'Da pagare' }] : []),
        { value: 'completed' as const, label: 'Completate' },
        { value: 'cancelled' as const, label: 'Annullate' },
      ].map((f) => ({ ...f, count: lessons.filter(predicates[f.value]).length })),
    [manualMode, lessons, predicates],
  );

  const activeFilter = filterDefs.some((f) => f.value === filter) ? filter : 'all';
  const unpaidCount = lessons.filter(predicates.unpaid).length;

  /** Righe raggruppate per mese: l'ordine di lettura naturale su mobile. */
  const sections = useMemo(() => {
    const out: { key: string; label: string; items: AutoscuolaAppointmentWithRelations[] }[] = [];
    for (const l of lessons.filter(predicates[activeFilter])) {
      const key = monthKey(l.startsAt);
      let sec = out[out.length - 1];
      if (!sec || sec.key !== key) {
        sec = { key, label: monthLabel(l.startsAt), items: [] };
        out.push(sec);
      }
      sec.items.push(l);
    }
    return out;
  }, [lessons, predicates, activeFilter]);

  const applyStatus = useCallback(
    async (lesson: AutoscuolaAppointmentWithRelations, status: 'paid' | 'unpaid') => {
      if (savingId) return;
      setSavingId(lesson.id);
      try {
        const res = await regloApi.setManualPaymentStatus(lesson.id, status);
        setPatched((prev) => ({ ...prev, [lesson.id]: res.manualPaymentStatus }));
        setToast({
          text: status === 'paid' ? 'Guida segnata come pagata.' : 'Guida segnata come da pagare.',
          tone: 'success',
        });
        await data?.onChanged?.();
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : 'Errore nel salvataggio.',
          tone: 'danger',
        });
      } finally {
        setSavingId(null);
      }
    },
    [savingId, data],
  );

  /**
   * Menu nativo per riga (convenzione dell'app: mai bottoni inline dentro la
   * riga di lista). Il tap sulla riga è l'azione primaria: qui è il pagamento.
   */
  const openActions = useCallback(
    (lesson: AutoscuolaAppointmentWithRelations) => {
      const paid = lesson.manualPaymentStatus === 'paid';
      const action = paid ? 'Segna da pagare' : 'Segna pagata';
      const next: 'paid' | 'unpaid' = paid ? 'unpaid' : 'paid';
      const title = `${new Date(lesson.startsAt).getDate()} ${
        MONTHS_SHORT[new Date(lesson.startsAt).getMonth()]
      } · ${formatTime(lesson.startsAt)}`;

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { title, options: [action, 'Annulla'], cancelButtonIndex: 1 },
          (i) => {
            if (i === 0) void applyStatus(lesson, next);
          },
        );
      } else {
        Alert.alert(title, undefined, [
          { text: action, onPress: () => void applyStatus(lesson, next) },
          { text: 'Annulla', style: 'cancel' },
        ]);
      }
    },
    [applyStatus],
  );

  if (!data) return <View style={s.sheet} />;

  return (
    <View style={s.sheet}>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      <View style={[s.topBar, Platform.OS === 'android' && { justifyContent: 'flex-start' }]}>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
            <Ionicons
              name={Platform.OS === 'android' ? 'arrow-back' : 'close'}
              size={20}
              color="#1A1A2E"
            />
          </Pressable>
        </GlassCloseButton>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Pagamenti</Text>
        {data.studentName ? <Text style={s.subtitle}>{data.studentName}</Text> : null}

        {/* Riepilogo: il numero che conta, leggibile senza scorrere nulla. */}
        {manualMode ? (
          <Animated.View entering={FadeIn.duration(320)} style={s.hero}>
            {unpaidCount > 0 ? (
              <>
                <Text style={s.heroNum}>{unpaidCount}</Text>
                <Text style={s.heroLabel}>
                  {unpaidCount === 1 ? 'guida da pagare' : 'guide da pagare'}
                </Text>
              </>
            ) : (
              <>
                <View style={s.heroOk}>
                  <Ionicons name="checkmark" size={17} color="#15803D" />
                </View>
                <Text style={s.heroLabelOk}>Tutto saldato</Text>
              </>
            )}
          </Animated.View>
        ) : (
          <Text style={s.note}>
            L&apos;autoscuola incassa dalla sezione Pagamenti: qui le guide sono in sola lettura.
          </Text>
        )}

        {/* Filtri */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
          style={s.filterScroll}
        >
          {filterDefs.map((f) => {
            const active = f.value === activeFilter;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={({ pressed }) => [s.pill, active && s.pillActive, pressed && { opacity: 0.7 }]}
              >
                <Text style={[s.pillText, active && s.pillTextActive]}>{f.label}</Text>
                {f.count > 0 ? (
                  <Text style={[s.pillCount, active && s.pillCountActive]}>{f.count}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {sections.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="receipt-outline" size={24} color="#B4B4BD" />
            </View>
            <Text style={s.emptyTitle}>Nessuna guida</Text>
            <Text style={s.emptyText}>Non ci sono guide per questo filtro.</Text>
          </View>
        ) : (
          <Animated.View layout={LinearTransition.duration(220)}>
            {sections.map((section) => (
              <View key={section.key}>
                <Text style={s.month}>{section.label}</Text>
                {section.items.map((lesson, i) => {
                  const status = normalize(lesson.status);
                  const done = DONE.includes(status);
                  const missed = MISSED.includes(status);
                  const isExam = normalize(lesson.type) === 'esame';
                  const isGroup = normalize(lesson.type) === 'group_lesson' || !!lesson.groupLessonId;
                  const penaltyCharged = isPenaltyCharged(lesson);
                  const penaltyPaid = isPenaltyPaid(lesson);
                  const unpaid = isLessonUnpaid(lesson, manualMode);
                  const covered = !!lesson.creditApplied;
                  const paid =
                    !covered && lesson.manualPaymentStatus === 'paid' && (manualMode || penaltyPaid);

                  const actionable =
                    data.canManagePayments &&
                    canToggleLessonPayment(lesson, data.settings);
                  const busy = savingId === lesson.id;

                  const start = new Date(lesson.startsAt);
                  const types = (lesson.types?.length ? lesson.types : [lesson.type])
                    .filter((t) => t && t !== 'guida' && t !== 'group_lesson')
                    .map((t) => LESSON_TYPE_LABEL_MAP[t] ?? t);
                  const meta = [
                    isGroup ? 'Guida di gruppo' : types.join(' · ') || null,
                    lesson.instructor?.name ?? null,
                    lesson.vehicle?.name ?? null,
                  ].filter(Boolean).join(' · ');

                  const row = (
                    <View style={[s.row, i > 0 && s.rowDivider]}>
                      <View style={s.dateCol}>
                        <Text style={s.dateDay}>{start.getDate()}</Text>
                        <Text style={s.dateMon}>{MONTHS_SHORT[start.getMonth()]}</Text>
                      </View>

                      <View style={s.rowBody}>
                        <Text style={s.rowTime}>
                          {formatTime(lesson.startsAt)}
                          {lesson.endsAt ? ` – ${formatTime(lesson.endsAt)}` : ''}
                        </Text>
                        {meta ? (
                          <Text style={s.rowMeta} numberOfLines={1}>{meta}</Text>
                        ) : null}

                        <View style={s.badges}>
                          <Badge
                            tone={done ? 'green' : missed ? 'red' : 'neutral'}
                            label={statusLabel(lesson.status)}
                          />
                          {isExam ? <Badge tone="violet" label="Esame" /> : null}
                          {/* "Tardiva" = annullata oltre la soglia di preavviso:
                              stessa condizione del dettaglio allievo web. */}
                          {isLate(lesson) ? <Badge tone="amber" label="Tardiva" /> : null}
                          {covered ? <Badge tone="violet" label="Coperta da credito" /> : null}
                          {paid ? <Badge tone="green" label="Pagata" /> : null}
                          {unpaid ? (
                            <Badge
                              tone="amber"
                              label={
                                // L'importo si mostra solo dove il BE lo conosce
                                // davvero: la penale tardiva addebitata.
                                penaltyCharged && lesson.penaltyAmount != null
                                  ? `Da pagare · ${formatEuro(lesson.penaltyAmount)}`
                                  : 'Da pagare'
                              }
                            />
                          ) : null}
                        </View>
                      </View>

                      {busy ? (
                        <ActivityIndicator size="small" color="#1A1A2E" style={s.rowTrail} />
                      ) : actionable ? (
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={18}
                          color="#C7C7CC"
                          style={s.rowTrail}
                        />
                      ) : (
                        <View style={s.rowTrail} />
                      )}
                    </View>
                  );

                  return actionable ? (
                    <Pressable
                      key={lesson.id}
                      onPress={() => openActions(lesson)}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`Guida del ${start.getDate()} ${
                        MONTHS_SHORT[start.getMonth()]
                      }, ${unpaid ? 'da pagare' : 'saldata'}`}
                      style={({ pressed }) => (pressed ? s.rowPressed : undefined)}
                    >
                      {row}
                    </Pressable>
                  ) : (
                    <View key={lesson.id}>{row}</View>
                  );
                })}
              </View>
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
};

const TONE: Record<BadgeTone, { box: object; text: object }> = {
  neutral: { box: { backgroundColor: '#F1F1F5' }, text: { color: '#88888F' } },
  amber: { box: { backgroundColor: '#FFF4E5' }, text: { color: '#B45309' } },
  green: { box: { backgroundColor: '#ECFDF3' }, text: { color: '#067647' } },
  violet: { box: { backgroundColor: '#F5F3FF' }, text: { color: '#6D28D9' } },
  red: { box: { backgroundColor: '#FEF2F2' }, text: { color: '#DC2626' } },
};

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingLeft: 30, paddingRight: 16, paddingTop: 20, paddingBottom: 4,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#DDDDDD',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 60 },

  title: { fontSize: 28, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: '400', color: colors.textMuted, marginTop: 4 },
  note: { fontSize: 13, fontWeight: '400', color: colors.textMuted, lineHeight: 19, marginTop: 18 },

  // Riepilogo: informativo → nessuna ombra esterna (regola raised/recessed).
  hero: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 22 },
  heroNum: { fontSize: 40, fontWeight: '600', color: '#1A1A2E', letterSpacing: -1.4 },
  heroLabel: { fontSize: 15, fontWeight: '400', color: colors.textSecondary },
  heroOk: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#ECFDF3',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  heroLabelOk: { fontSize: 17, fontWeight: '500', color: '#15803D', alignSelf: 'center' },

  filterScroll: { marginTop: 22, marginHorizontal: -24 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingBottom: 2 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999, backgroundColor: '#EEF0F3',
  },
  pillActive: { backgroundColor: '#1A1A2E' },
  pillText: { fontSize: 14, fontWeight: '400', color: '#595959' },
  pillTextActive: { color: '#FFFFFF', fontWeight: '500' },
  pillCount: { fontSize: 12, fontWeight: '500', color: '#9A9AA2' },
  pillCountActive: { color: 'rgba(255,255,255,0.65)' },

  month: {
    fontSize: 12, fontWeight: '600', color: '#A2A2AC', textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 26, marginBottom: 4,
  },

  // Lista = righe flat sullo sfondo + divider hairline (mai una card attorno).
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E8EE' },
  rowPressed: { opacity: 0.55 },
  dateCol: { width: 34, alignItems: 'center', paddingTop: 1 },
  dateDay: { fontSize: 17, fontWeight: '500', color: '#1A1A2E', letterSpacing: -0.3 },
  dateMon: { fontSize: 11, fontWeight: '400', color: colors.textMuted, marginTop: -1 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTime: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  rowMeta: { fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 2 },
  rowTrail: { width: 20, alignItems: 'center', paddingTop: 3 },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '500' },

  empty: { alignItems: 'center', paddingTop: 70, gap: 6 },
  emptyIcon: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#F1F1F5',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  emptyText: { fontSize: 13, fontWeight: '400', color: colors.textMuted, textAlign: 'center' },
});
