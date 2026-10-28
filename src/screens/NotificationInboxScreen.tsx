import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSession } from '../context/SessionContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { notificationEvents } from '../services/notificationEvents';
import {
  loadInbox,
  saveInbox,
  markRead as storeMarkRead,
  markAllRead as storeMarkAllRead,
  dismissItem as storeDismissItem,
} from '../services/notificationStore';
import { NotificationItem, PersistedNotification } from '../types/notifications';
import { CLAY } from '../theme/clay';
import { MORALE_ART } from '../theme/moraleArt';
import { CLAY_ROW_PRESSED, ClayEmpty, ClayIconButton, ClayList, ClaySection, clayRowPressShape } from '../components/clay';
import { formatDay, formatTime } from '../utils/date';
import { EXAM_TIME_TBD_SHORT } from '../utils/examTime';

/** Rosso solo per il testo delle azioni distruttive (§0). */
const DESTRUCTIVE = '#C13515';

const getTitle = (item: PersistedNotification): string => {
  switch (item.kind) {
    case 'waitlist':
      return 'Slot liberato';
    case 'group_lesson_invite':
      return 'Guida di gruppo disponibile';
    case 'swap':
      return `${item.data.requestingStudentName} cerca un sostituto`;
    case 'confirmation':
      return `${item.data.acceptedByName} ti sostituisce`;
    case 'available_slots':
      return 'Guide disponibili';
    case 'holiday_declared':
      return 'Giorno festivo';
    case 'weekly_absence':
      return `${item.data.studentName ?? 'Un allievo'} assente`;
    case 'sick_leave_cancelled':
      return 'Guida cancellata';
    // REG-604: lo stesso kind serve guide ed esami — il payload dice quale.
    case 'appointment_rescheduled':
      return item.data.isExam ? 'Esame spostato' : 'Guida spostata';
    case 'appointment_cancelled':
      return item.data.isExam ? 'Esame annullato' : 'Guida annullata';
    case 'availability_published':
      return 'Disponibilità pubblicate';
    case 'appointment_location_changed':
      return item.data.isExam ? "Luogo dell'esame aggiornato" : 'Luogo guida aggiornato';
    case 'theory_exam_countdown':
      return item.data.offsetDays === 1
        ? 'Esame teoria domani'
        : `Esame teoria fra ${item.data.offsetDays} giorni`;
    case 'theory_quiz_inactivity':
      return 'Riprendi lo studio';
    case 'license_path_started':
      return item.data.licenseCategory
        ? `Nuovo percorso: patente ${item.data.licenseCategory}`
        : 'Nuovo percorso avviato';
    case 'student_phase_change':
      switch (item.data.toPhase) {
        case 'TEORIA':
          return 'Il tuo percorso è attivo!';
        case 'PRATICA':
          return 'Hai il foglio rosa!';
        case 'PATENTATO':
          return 'Sei patentato!';
        default:
          return 'Fase aggiornata';
      }
    case 'exam_ready_nudge':
      return item.data.count === 1
        ? "1 allievo pronto per l'esame"
        : `${item.data.count} allievi pronti per l'esame`;
    case 'exam_scheduled':
      return item.data.reason === 'time_set' ? "Orario dell'esame definito" : 'Esame fissato';
  }
};

/**
 * REG-604: «mer 14 ott · 09:00», oppure «mer 14 ott · orario da definire» per
 * l'esame di cui l'autoscuola non ha ancora fissato l'ora.
 *
 * `timeSet` manca sulle notifiche già in posta da prima del rilascio: in quel
 * caso si comporta come sempre e scrive l'ora.
 */
const whenLabel = (data: { startsAt: string; isExam?: boolean; timeSet?: boolean }) => {
  const giorno = formatDay(data.startsAt);
  if (data.isExam && data.timeSet === false) return `${giorno} · ${EXAM_TIME_TBD_SHORT}`;
  return `${giorno} · ${formatTime(data.startsAt)}`;
};

const getSubtitle = (item: PersistedNotification): string => {
  switch (item.kind) {
    case 'waitlist':
      return `${formatDay(item.data.slot.startsAt)} · ${formatTime(item.data.slot.startsAt)}`;
    case 'group_lesson_invite':
      return `${formatDay(item.data.startsAt)} · ${formatTime(item.data.startsAt)}`;
    case 'swap':
      return `${formatDay(item.data.appointment.startsAt)} · ${formatTime(item.data.appointment.startsAt)}`;
    case 'confirmation':
      return `${item.data.appointmentDate} alle ${item.data.appointmentTime}`;
    case 'available_slots':
      return formatDay(`${item.data.date}T00:00:00Z`);
    case 'holiday_declared':
      return formatDay(`${item.data.date}T00:00:00Z`);
    case 'weekly_absence':
      return `Settimana del ${formatDay(`${item.data.weekStart}T00:00:00Z`)}`;
    case 'sick_leave_cancelled':
      return `Istruttore ${item.data.instructorName ?? ''} in malattia`;
    // REG-604: l'orario si scrive solo se è stato definito. Un esame senza
    // orario porta la mezzanotte segnaposto, e qui diceva «· 00:00».
    case 'appointment_rescheduled': {
      const quando = whenLabel(item.data);
      return item.data.isExam ? `Esame spostato al ${quando}` : `Spostata al ${quando}`;
    }
    case 'appointment_cancelled':
      return whenLabel(item.data);
    case 'availability_published':
      return `Settimana del ${formatDay(`${item.data.weekStart}T00:00:00Z`)}`;
    case 'appointment_location_changed':
      return `${formatDay(item.data.startsAt)} · ${item.data.newLocationName}`;
    case 'exam_scheduled':
      return whenLabel({ ...item.data, isExam: true });
    case 'theory_exam_countdown':
      return item.data.theoryExamAt
        ? `Esame il ${formatDay(item.data.theoryExamAt)}`
        : 'Continua a esercitarti';
    case 'theory_quiz_inactivity':
      return `Sono ${item.data.inactiveDays} giorni che non studi`;
    case 'license_path_started':
      return "L'autoscuola ha avviato il tuo nuovo percorso. Puoi prenotare le guide.";
    case 'student_phase_change':
      switch (item.data.toPhase) {
        case 'TEORIA':
          return "L'autoscuola ti ha attivato. Inizia a studiare!";
        case 'PRATICA':
          return 'Puoi prenotare le tue prime guide.';
        case 'PATENTATO':
          return 'Hai concluso il percorso. Complimenti!';
        default:
          return '';
      }
    case 'exam_ready_nudge':
      return 'Pronti da oltre 2 settimane, esame non ancora in agenda';
  }
};

// Swap-related notifications (a swap offer or a swap-accepted confirmation) open
// the dedicated "Scambi" section. The other interactive kinds still open their
// overlay drawer (being phased out gradually).
const isSwapRelated = (kind: PersistedNotification['kind']): boolean =>
  kind === 'swap' || kind === 'confirmation';

const opensDrawer = (kind: PersistedNotification['kind']): boolean =>
  kind === 'waitlist' || kind === 'available_slots';

// Group-lesson invites open a dedicated join screen (like the "Scambi" section),
// not the overlay drawer.
const opensGroupLessonInvites = (kind: PersistedNotification['kind']): boolean =>
  kind === 'group_lesson_invite';

/* ── Giorni ── */

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** «Oggi», «Ieri», poi «Lunedì 26 ottobre». */
const dayLabel = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return 'Oggi';
  if (dayKey(d) === dayKey(yesterday)) return 'Ieri';
  const label = d.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : null),
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/** Le notifiche (già in ordine, dalla più recente) divise per giorno. */
const groupByDay = (list: PersistedNotification[]) => {
  const groups: { key: string; title: string; items: PersistedNotification[] }[] = [];
  for (const item of list) {
    const key = dayKey(new Date(item.receivedAt));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, title: dayLabel(item.receivedAt), items: [item] });
  }
  return groups;
};

/* ── Swipeable Card ── */

type CardProps = {
  item: PersistedNotification;
  onTap: () => void;
  onDismiss: () => void;
  /** Li imposta `ClayList`. */
  divider?: boolean;
  first?: boolean;
  last?: boolean;
};

const RightAction = ({ drag, onPress }: { drag: SharedValue<number>; onPress: () => void }) => {
  const animStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, -drag.value / 80),
  }));
  return (
    <Pressable onPress={onPress} style={styles.swipeActionPressable} accessibilityRole="button" accessibilityLabel="Elimina notifica">
      <Animated.View style={[styles.swipeAction, animStyle]}>
        <Ionicons name="trash-outline" size={18} color={DESTRUCTIVE} />
        <Text style={styles.swipeActionText}>Elimina</Text>
      </Animated.View>
    </Pressable>
  );
};

/**
 * Riga di notifica (REG-639 clay): niente icona né puntino. Da leggere =
 * titolo nero 600; letta = titolo 500 grigio. Ora a destra (il giorno è
 * nel titolo della sezione). Scorri verso sinistra per eliminarla.
 */
const NotificationCard = React.memo(({ item, onTap, onDismiss, divider, first, last }: CardProps) => {
  const swipeableRef = useRef<any>(null);

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    onDismiss();
  }, [onDismiss]);

  const title = getTitle(item);
  const subtitle = getSubtitle(item);

  return (
    <View>
      {divider ? <View style={styles.divider} /> : null}
      <ReanimatedSwipeable
        ref={swipeableRef}
        friction={2}
        rightThreshold={80}
        renderRightActions={(_, drag) => <RightAction drag={drag} onPress={handleDelete} />}
        onSwipeableOpen={(direction) => {
          if (direction === 'right') onDismiss();
        }}
        overshootRight={false}
      >
        <Pressable
          onPress={onTap}
          style={({ pressed }) => [styles.row, pressed && [CLAY_ROW_PRESSED, clayRowPressShape({ first, last })]]}
          accessibilityRole="button"
          accessibilityLabel={`${item.read ? '' : 'Da leggere. '}${title}${subtitle ? `, ${subtitle}` : ''}`}
        >
          <View style={styles.rowMain}>
            <Text style={[styles.rowTitle, item.read && styles.rowTitleRead]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.rowSub} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Text style={styles.rowTime}>{formatTime(item.receivedAt)}</Text>
        </Pressable>
      </ReanimatedSwipeable>
    </View>
  );
});

/* ── Screen ── */

export const NotificationInboxScreen = ({ asTab = false }: { asTab?: boolean } = {}) => {
  const { autoscuolaRole } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<PersistedNotification[]>([]);
  const itemsRef = useRef<PersistedNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const updateItems = useCallback((newItems: PersistedNotification[]) => {
    const sorted = newItems.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    itemsRef.current = sorted;
    setItems(sorted);
  }, []);

  const reload = useCallback(async () => {
    const inbox = await loadInbox();
    updateItems(inbox);
  }, [updateItems]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    return notificationEvents.onInboxUpdated(() => {
      reload();
    });
  }, [reload]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    notificationEvents.requestRefresh();
    setTimeout(async () => {
      await reload();
      setRefreshing(false);
    }, 1500);
  }, [reload]);

  const handleTap = useCallback(
    async (item: PersistedNotification) => {
      const updated = storeMarkRead(itemsRef.current, item.id);
      updateItems(updated);
      await saveInbox(updated);
      notificationEvents.emitInboxUpdated();

      // Swap-related (offer or accepted confirmation) → open the "Scambi"
      // section (no drawer). From the tab we push (keep the tab in the stack);
      // from the pushed route we replace (don't stack the inbox underneath).
      if (isSwapRelated(item.kind)) {
        if (asTab) router.push('/(tabs)/home/swaps');
        else router.replace('/(tabs)/home/swaps');
        return;
      }

      if (opensGroupLessonInvites(item.kind)) {
        if (asTab) router.push('/(tabs)/home/group-lesson-invites');
        else router.replace('/(tabs)/home/group-lesson-invites');
        return;
      }

      if (opensDrawer(item.kind)) {
        const notifItem: NotificationItem = {
          kind: item.kind,
          id: item.id,
          data: item.data,
        } as NotificationItem;
        // On the tab the overlay shows globally — no route to pop.
        if (!asTab) router.back();
        setTimeout(() => {
          notificationEvents.emitOpenDrawer(notifItem);
        }, 350);
      }
    },
    [router, updateItems, asTab],
  );

  const handleDismiss = useCallback(
    async (id: string) => {
      const updated = storeDismissItem(itemsRef.current, id);
      updateItems(updated);
      await saveInbox(updated);
      notificationEvents.emitInboxUpdated();
    },
    [updateItems],
  );

  const handleMarkAllRead = useCallback(async () => {
    const updated = storeMarkAllRead(itemsRef.current);
    updateItems(updated);
    await saveInbox(updated);
    notificationEvents.emitInboxUpdated();
  }, [updateItems]);

  const visibleItems = items.filter((i) => !i.dismissed);
  const hasUnread = visibleItems.some((i) => !i.read);
  const isInstructorApp = autoscuolaRole === 'INSTRUCTOR' || autoscuolaRole === 'INSTRUCTOR_OWNER';

  const groups = useMemo(() => groupByDay(items.filter((i) => !i.dismissed)), [items]);

  return (
    <GestureHandlerRootView style={[styles.root, { paddingTop: insets.top }]}>
      {/* Testata clay (come l'Agenda): titolo grande, riga grigia, azioni a destra. */}
      <View style={styles.hd}>
        {/* Indietro: sempre se spinta; nella app istruttore anche come tab,
            perché lì «Notifiche» non è nella barra (si apre dalla campanella). */}
        {!asTab || isInstructorApp ? (
          <ClayIconButton
            icon="back"
            onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(tabs)/home'))}
            accessibilityLabel="Indietro"
            style={styles.back}
            testID="inbox-back"
          />
        ) : null}
        <View style={styles.hdTop}>
          <View style={styles.hdTitles}>
            <Text style={styles.title} accessibilityRole="header">
              Notifiche
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {hasUnread ? 'Hai aggiornamenti da leggere' : 'Sei in pari'}
            </Text>
          </View>
          {hasUnread ? (
            <ClayIconButton
              icon={<Ionicons name="checkmark-done" size={20} color={CLAY.ink} />}
              onPress={handleMarkAllRead}
              accessibilityLabel="Segna tutte come lette"
              testID="inbox-mark-all"
            />
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={CLAY.ink} />}
      >
        {groups.length === 0 ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.empty}>
            <ClayEmpty
              icon={MORALE_ART.aeroplanino}
              title="Nessuna notifica"
              text="Avvisi su guide, scambi e disponibilità compariranno qui."
            />
          </Animated.View>
        ) : (
          groups.map((g, i) => (
            <ClaySection key={g.key} title={g.title} style={i === 0 ? styles.firstSection : undefined}>
              <ClayList>
                {g.items.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    onTap={() => handleTap(item)}
                    onDismiss={() => handleDismiss(item.id)}
                  />
                ))}
              </ClayList>
            </ClaySection>
          ))
        )}
      </ScrollView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },

  /* Testata */
  hd: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  back: { marginBottom: 12 },
  hdTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hdTitles: { flex: 1, minWidth: 0 },
  title: { fontSize: 32, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.9 },
  sub: { fontSize: 15, color: CLAY.ink3, marginTop: 1 },

  /* Lista */
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  firstSection: { marginTop: 18 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)', marginHorizontal: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 18 },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.25 },
  rowTitleRead: { fontWeight: '500', color: CLAY.ink3 },
  rowSub: { fontSize: 13.5, lineHeight: 18, color: CLAY.ink3, marginTop: 3 },
  rowTime: { fontSize: 13.5, color: CLAY.ink3, alignSelf: 'flex-start', marginTop: 2 },

  /* Scorri per eliminare: testo rosso su bianco, niente bottone pieno. */
  swipeActionPressable: { width: 84 },
  swipeAction: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  swipeActionText: { fontSize: 12, fontWeight: '600', color: DESTRUCTIVE },

  /* Vuoto */
  empty: { paddingTop: 40 },
});
