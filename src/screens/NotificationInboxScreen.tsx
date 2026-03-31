import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  }
};

const isInteractive = (kind: PersistedNotification['kind']): boolean =>
  kind === 'swap' || kind === 'waitlist' || kind === 'proposal' || kind === 'confirmation';

/* ── Swipeable Card ── */

type CardProps = {
  item: PersistedNotification;
  onTap: () => void;
  onDismiss: () => void;
};

const SWIPE_THRESHOLD = -80;

const NotificationCard = React.memo(({ item, onTap, onDismiss }: CardProps) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const rowHeight = useRef(new Animated.Value(1)).current;
  const isSwiping = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        if (Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy)) {
          isSwiping.current = true;
          return true;
        }
        return false;
      },
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < SWIPE_THRESHOLD) {
          Animated.parallel([
            Animated.timing(translateX, { toValue: -400, duration: 200, useNativeDriver: true }),
            Animated.timing(rowHeight, { toValue: 0, duration: 200, useNativeDriver: false }),
          ]).start(() => onDismiss());
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, stiffness: 200, damping: 20 }).start();
        }
        // Reset after a short delay so the tap doesn't fire
        setTimeout(() => { isSwiping.current = false; }, 50);
      },
    }),
  ).current;

  const handlePress = useCallback(() => {
    if (!isSwiping.current) onTap();
  }, [onTap]);

  return (
    <Animated.View style={{ opacity: rowHeight, transform: [{ scaleY: rowHeight }] }}>
      {/* Delete background */}
      <View style={styles.swipeBackground}>
        <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
      </View>
      <Animated.View
        style={[{ transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={handlePress}
          style={[styles.card, !item.read && styles.cardUnread]}
        >
          <View style={[styles.iconCircle, !item.read && styles.iconCircleUnread]}>
            <Ionicons name={ICON_MAP[item.kind]} size={18} color={!item.read ? '#EC4899' : '#94A3B8'} />
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
      </Animated.View>
    </Animated.View>
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
  swipeBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 20,
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
