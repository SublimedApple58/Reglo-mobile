import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { formatDay, formatTime, formatRelativeTime } from '../utils/date';

const COMPACT_H = 44;
const SCROLL_RANGE = 70;

const ICON_MAP: Record<NotificationItem['kind'], keyof typeof Ionicons.glyphMap> = {
  waitlist: 'time-outline',
  swap: 'swap-horizontal',
  confirmation: 'checkmark-done-outline',
  proposal: 'document-text-outline',
  available_slots: 'calendar-outline',
  holiday_declared: 'calendar-outline',
  weekly_absence: 'calendar-clear-outline',
  sick_leave_cancelled: 'medkit-outline',
  appointment_rescheduled: 'swap-horizontal-outline',
  appointment_cancelled: 'close-circle-outline',
  availability_published: 'megaphone-outline',
  appointment_location_changed: 'location-outline',
  theory_exam_countdown: 'time-outline',
  theory_quiz_inactivity: 'school-outline',
  student_phase_change: 'sparkles-outline',
};

const THEME: Record<NotificationItem['kind'], { bg: string; fg: string }> = {
  swap: { bg: '#FCE7F3', fg: '#DB2777' },
  waitlist: { bg: '#DBEAFE', fg: '#2563EB' },
  confirmation: { bg: '#DCFCE7', fg: '#16A34A' },
  proposal: { bg: '#E0E7FF', fg: '#4F46E5' },
  available_slots: { bg: '#CCFBF1', fg: '#0D9488' },
  holiday_declared: { bg: '#FEE2E2', fg: '#DC2626' },
  weekly_absence: { bg: '#FFEDD5', fg: '#EA580C' },
  sick_leave_cancelled: { bg: '#FEE2E2', fg: '#DC2626' },
  appointment_rescheduled: { bg: '#EDE9FE', fg: '#7C3AED' },
  appointment_cancelled: { bg: '#FEE2E2', fg: '#DC2626' },
  availability_published: { bg: '#DCFCE7', fg: '#16A34A' },
  appointment_location_changed: { bg: '#CCFBF1', fg: '#0D9488' },
  theory_exam_countdown: { bg: '#E0E7FF', fg: '#4F46E5' },
  theory_quiz_inactivity: { bg: '#EDE9FE', fg: '#7C3AED' },
  student_phase_change: { bg: '#FCE7F3', fg: '#DB2777' },
};

const getTitle = (item: PersistedNotification): string => {
  switch (item.kind) {
    case 'waitlist':
      return 'Slot liberato';
    case 'swap':
      return `${item.data.requestingStudentName} cerca un sostituto`;
    case 'confirmation':
      return `${item.data.acceptedByName} ti sostituisce`;
    case 'proposal':
      return 'Nuova proposta di guida';
    case 'available_slots':
      return 'Guide disponibili';
    case 'holiday_declared':
      return 'Giorno festivo';
    case 'weekly_absence':
      return `${item.data.studentName ?? 'Un allievo'} assente`;
    case 'sick_leave_cancelled':
      return 'Guida cancellata';
    case 'appointment_rescheduled':
      return 'Guida spostata';
    case 'appointment_cancelled':
      return 'Guida annullata';
    case 'availability_published':
      return 'Disponibilità pubblicate';
    case 'appointment_location_changed':
      return 'Luogo guida aggiornato';
    case 'theory_exam_countdown':
      return item.data.offsetDays === 1
        ? 'Esame teoria domani'
        : `Esame teoria fra ${item.data.offsetDays} giorni`;
    case 'theory_quiz_inactivity':
      return 'Riprendi lo studio';
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
  }
};

const getSubtitle = (item: PersistedNotification): string => {
  switch (item.kind) {
    case 'waitlist':
      return `${formatDay(item.data.slot.startsAt)} · ${formatTime(item.data.slot.startsAt)}`;
    case 'swap':
      return `${formatDay(item.data.appointment.startsAt)} · ${formatTime(item.data.appointment.startsAt)}`;
    case 'confirmation':
      return `${item.data.appointmentDate} alle ${item.data.appointmentTime}`;
    case 'proposal':
      return `${formatDay(item.data.startsAt)} · ${formatTime(item.data.startsAt)}`;
    case 'available_slots':
      return formatDay(`${item.data.date}T00:00:00Z`);
    case 'holiday_declared':
      return formatDay(`${item.data.date}T00:00:00Z`);
    case 'weekly_absence':
      return `Settimana del ${formatDay(`${item.data.weekStart}T00:00:00Z`)}`;
    case 'sick_leave_cancelled':
      return `Istruttore ${item.data.instructorName ?? ''} in malattia`;
    case 'appointment_rescheduled':
      return `Spostata al ${formatDay(item.data.startsAt)} · ${formatTime(item.data.startsAt)}`;
    case 'appointment_cancelled':
      return `${formatDay(item.data.startsAt)} · ${formatTime(item.data.startsAt)}`;
    case 'availability_published':
      return `Settimana del ${formatDay(`${item.data.weekStart}T00:00:00Z`)}`;
    case 'appointment_location_changed':
      return `${formatDay(item.data.startsAt)} · ${item.data.newLocationName}`;
    case 'theory_exam_countdown':
      return item.data.theoryExamAt
        ? `Esame il ${formatDay(item.data.theoryExamAt)}`
        : 'Continua a esercitarti';
    case 'theory_quiz_inactivity':
      return `Sono ${item.data.inactiveDays} giorni che non studi`;
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
  }
};

// Swap-related notifications (a swap offer or a swap-accepted confirmation) open
// the dedicated "Scambi" section. The other interactive kinds still open their
// overlay drawer (being phased out gradually).
const isSwapRelated = (kind: PersistedNotification['kind']): boolean =>
  kind === 'swap' || kind === 'confirmation';

const opensDrawer = (kind: PersistedNotification['kind']): boolean =>
  kind === 'waitlist' || kind === 'proposal' || kind === 'available_slots';

/* ── Swipeable Card ── */

type CardProps = {
  item: PersistedNotification;
  onTap: () => void;
  onDismiss: () => void;
};

const RightAction = ({ drag, onPress }: { drag: SharedValue<number>; onPress: () => void }) => {
  const animStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, -drag.value / 80),
    transform: [{ scale: Math.min(1, Math.max(0.8, -drag.value / 100)) }],
  }));
  return (
    <Pressable onPress={onPress} style={styles.swipeActionPressable}>
      <Animated.View style={[styles.swipeAction, animStyle]}>
        <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
        <Text style={styles.swipeActionText}>Elimina</Text>
      </Animated.View>
    </Pressable>
  );
};

const NotificationCard = React.memo(({ item, onTap, onDismiss }: CardProps) => {
  const swipeableRef = useRef<any>(null);
  const theme = THEME[item.kind];

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    onDismiss();
  }, [onDismiss]);

  return (
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
      <Pressable onPress={onTap} style={({ pressed }) => [styles.card, !item.read && styles.cardUnread, pressed && styles.cardPressed]}>
        <View style={[styles.iconChip, { backgroundColor: theme.bg }]}>
          <Ionicons name={ICON_MAP[item.kind]} size={18} color={theme.fg} />
        </View>
        <View style={styles.cardCenter}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {getTitle(item)}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {getSubtitle(item)}
          </Text>
          <Text style={styles.cardTimestamp}>{formatRelativeTime(item.receivedAt)}</Text>
        </View>
        {!item.read ? <View style={styles.unreadDot} /> : null}
      </Pressable>
    </ReanimatedSwipeable>
  );
});

/* ── Screen ── */

export const NotificationInboxScreen = () => {
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
      // section (no drawer).
      if (isSwapRelated(item.kind)) {
        router.replace('/(tabs)/home/swaps');
        return;
      }

      if (opensDrawer(item.kind)) {
        const notifItem: NotificationItem = {
          kind: item.kind,
          id: item.id,
          data: item.data,
        } as NotificationItem;
        router.back();
        setTimeout(() => {
          notificationEvents.emitOpenDrawer(notifItem);
        }, 350);
      }
    },
    [router, updateItems],
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

  /* ── Scroll animation ── */
  const scrollY = useSharedValue(0);
  const headerH = insets.top + COMPACT_H;
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, SCROLL_RANGE * 0.6], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, SCROLL_RANGE], [0, -10], Extrapolation.CLAMP) }],
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [SCROLL_RANGE * 0.5, SCROLL_RANGE], [0, 1], Extrapolation.CLAMP),
  }));
  const borderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 20], [0, 1], Extrapolation.CLAMP),
  }));

  const renderItem = useCallback(
    ({ item }: { item: PersistedNotification }) => (
      <NotificationCard
        item={item}
        onTap={() => handleTap(item)}
        onDismiss={() => handleDismiss(item.id)}
      />
    ),
    [handleTap, handleDismiss],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* ── Sticky blur header ── */}
      <View style={[styles.headerWrap, { height: headerH, paddingTop: insets.top }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(247,247,247,0.95)' }]} />
        )}
        <Animated.View style={[StyleSheet.absoluteFill, styles.headerBorder, borderStyle]} />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={14} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Animated.Text style={[styles.compactTitle, compactStyle]} numberOfLines={1}>
            Notifiche
          </Animated.Text>
          {hasUnread ? (
            <Pressable onPress={handleMarkAllRead} hitSlop={8} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Segna tutte</Text>
            </Pressable>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>
      </View>

      <Animated.FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingTop: headerH }]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <Animated.View style={largeTitleStyle}>
            <Text style={styles.largeTitle}>Notifiche</Text>
            <Text style={styles.largeSub}>
              {hasUnread ? 'Hai aggiornamenti da leggere' : 'Sei in pari'}
            </Text>
          </Animated.View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            progressViewOffset={headerH}
          />
        }
        ListEmptyComponent={
          <Animated.View entering={FadeIn.duration(250)} style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Image source={require('../../assets/icons/fluent-bell.png')} style={styles.emptyIcon} />
            </View>
            <Text style={styles.emptyTitle}>Nessuna notifica</Text>
            <Text style={styles.emptySub}>
              Avvisi su guide, scambi e disponibilità{'\n'}compariranno qui.
            </Text>
          </Animated.View>
        }
      />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  /* Header */
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  compactTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  markAllBtn: { paddingHorizontal: 8, minWidth: 80, alignItems: 'flex-end' },
  markAllText: { fontSize: 14, fontWeight: '600', color: colors.primary },

  /* Large title */
  largeTitle: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.3 },
  largeSub: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginTop: 4, marginBottom: 18 },

  /* List */
  list: { paddingHorizontal: spacing.md, paddingBottom: 60 },

  /* Card */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 14,
    gap: 13,
    minHeight: 58,
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  cardUnread: { backgroundColor: '#FFF7FB' },
  cardPressed: { opacity: 0.95, transform: [{ scale: 0.99 }] },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCenter: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  cardSubtitle: { fontSize: 13, fontWeight: '400', color: colors.textSecondary },
  cardTimestamp: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },

  /* Swipe */
  swipeActionPressable: { flex: 1, justifyContent: 'center', alignItems: 'center', width: 76, marginLeft: 10 },
  swipeAction: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 3,
  },
  swipeActionText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },

  /* Empty */
  emptyState: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 24 },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  emptyIcon: { width: 46, height: 46 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.2 },
  emptySub: { fontSize: 14, fontWeight: '400', color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: 8 },
});
