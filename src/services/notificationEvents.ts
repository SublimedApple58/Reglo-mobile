import { NotificationItem } from '../types/notifications';

type Listener = () => void;
type OpenDrawerListener = (item: NotificationItem) => void;

const dataChangedListeners = new Set<Listener>();
const refreshListeners = new Set<Listener>();
const openDrawerListeners = new Set<OpenDrawerListener>();
const inboxUpdatedListeners = new Set<Listener>();

/**
 * Lightweight event bridge between NotificationOverlay, screens, and inbox.
 *
 * - dataChanged: overlay → screen (e.g., proposal accepted, reload your appointments)
 * - refreshRequested: screen → overlay (e.g., pull-to-refresh, reload drawer data)
 * - openDrawer: inbox → overlay (open the drawer for a specific notification item)
 * - inboxUpdated: overlay → inbox (persistent store changed, reload)
 */
export const notificationEvents = {
  onDataChanged: (fn: Listener) => {
    dataChangedListeners.add(fn);
    return () => { dataChangedListeners.delete(fn); };
  },
  emitDataChanged: () => {
    dataChangedListeners.forEach((fn) => fn());
  },

  onRefreshRequested: (fn: Listener) => {
    refreshListeners.add(fn);
    return () => { refreshListeners.delete(fn); };
  },
  requestRefresh: () => {
    refreshListeners.forEach((fn) => fn());
  },

  onOpenDrawer: (fn: OpenDrawerListener) => {
    openDrawerListeners.add(fn);
    return () => { openDrawerListeners.delete(fn); };
  },
  emitOpenDrawer: (item: NotificationItem) => {
    openDrawerListeners.forEach((fn) => fn(item));
  },

  onInboxUpdated: (fn: Listener) => {
    inboxUpdatedListeners.add(fn);
    return () => { inboxUpdatedListeners.delete(fn); };
  },
  emitInboxUpdated: () => {
    inboxUpdatedListeners.forEach((fn) => fn());
  },
};
