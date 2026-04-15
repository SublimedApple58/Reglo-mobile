import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Screen } from '../components/Screen';
import { notificationEvents } from '../services/notificationEvents';
import {
  loadInbox,
  saveInbox,
  markRead as storeMarkRead,
  markAllRead as storeMarkAllRead,
  dismissItem as storeDismissItem,
} from '../services/notificationStore';
import { NotificationItem, PersistedNotification } from '../types/notifications';
import { colors, spacing } from '../theme';
import { formatDay, formatTime, formatRelativeTime } from '../utils/date';

const ICON_MAP: Record<NotificationItem['kind'], keyof typeof Ionicons.glyphMap> = {
  waitlist: 'time-outline',
  swap: 'hand-left-outline',
  confirmation: 'checkmark-done-outline',
  proposal: 'document-text-outline',
  available_slots: 'calendar-outline',
  holiday_declared: 'calendar-outline',
  weekly_absence: 'calendar-clear-outline',
  sick_leave_cancelled: 'medkit-outline',
};

const getTitle = (item: PersistedNotification): string => {
  switch (item.kind) {
    case 'waitlist':
      return 'Slot liberato';
    case 'swap':
      return `Sostituzione da ${item.data.requestingStudentName}`;
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
      return '🤒 Guida cancellata';
  }
};

const getSubtitle = (item: PersistedNotification): string => {
  switch (item.kind) {
    case 'waitlist':
      return `${formatDay(item.data.slot.startsAt)} \u00B7 ${formatTime(item.data.slot.startsAt)}`;
    case 'swap':
      return `${formatDay(item.data.appointment.startsAt)} \u00B7 ${formatTime(item.data.appointment.startsAt)}`;
    case 'confirmation':
      return `${item.data.appointmentDate} alle ${item.data.appointmentTime}`;
    case 'proposal':
      return `${formatDay(item.data.startsAt)} \u00B7 ${formatTime(item.data.startsAt)}`;
    case 'available_slots':
      return formatDay(`${item.data.date}T00:00:00Z`);
    case 'holiday_declared':
      return formatDay(`${item.data.date}T00:00:00Z`);
    case 'weekly_absence':
      return `Settimana del ${formatDay(`${item.data.weekStart}T00:00:00Z`)}`;
    case 'sick_leave_cancelled':
      return `Istruttore ${item.data.instructorName ?? ''} in malattia`;
  }
};

const isInteractive = (kind: PersistedNotification['kind']): boolean =>
  kind === 'swap' || kind === 'waitlist' || kind === 'proposal' || kind === 'confirmation' || kind === 'available_slots';

const ICON_COLOR_MAP: Partial<Record<NotificationItem['kind'], string>> = {
  holiday_declared: '#DC2626',
  weekly_absence: '#D97706',
  sick_leave_cancelled: '#DC2626',
};

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
      <Reanimated.View style={[styles.swipeAction, animStyle]}>
        <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
        <Text style={styles.swipeActionText}>Elimina</Text>
      </Reanimated.View>
    </Pressable>
  );
};

const NotificationCard = React.memo(({ item, onTap, onDismiss }: CardProps) => {
  const swipeableRef = useRef<any>(null);

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
      <Pressable
        onPress={onTap}
        style={[styles.card, !item.read && styles.cardUnread]}
      >
        <View style={[styles.iconCircle, !item.read && styles.iconCircleUnread]}>
          <Ionicons name={ICON_MAP[item.kind]} size={18} color={ICON_COLOR_MAP[item.kind] ?? (!item.read ? '#EC4899' : '#94A3B8')} />
        </View>
        <View style={styles.cardCenter}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {getTitle(item)}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {getSubtitle(item)}
          </Text>
          <Text style={styles.cardTimestamp}>
            {formatRelativeTime(item.receivedAt)}
          </Text>
        </View>
        {!item.read ? <View style={styles.unreadDot} /> : null}
      </Pressable>
    </ReanimatedSwipeable>
  );
});

/* ── Screen ── */

export const NotificationInboxScreen = () => {
  const router = useRouter();
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
    // Give the overlay time to fetch + persist, then reload
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

      if (isInteractive(item.kind)) {
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
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </Pressable>
        <Text style={styles.headerTitle}>Notifiche</Text>
        {hasUnread ? (
          <Pressable onPress={handleMarkAllRead} hitSlop={8}>
            <Text style={styles.markAllText}>Segna tutte</Text>
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Nessuna notifica</Text>
          </View>
        }
      />
    </Screen>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    minHeight: 56,
  },
  cardUnread: {
    backgroundColor: '#FDF2F8',
    borderColor: '#FCE7F3',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleUnread: {
    backgroundColor: '#FCE7F3',
  },
  cardCenter: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  cardTimestamp: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EC4899',
  },
  swipeActionPressable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 76,
    marginLeft: 8,
  },
  swipeAction: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 3,
  },
  swipeActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#94A3B8',
  },
});
