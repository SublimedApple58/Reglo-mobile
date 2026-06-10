import { useCallback, useEffect, useState } from 'react';
import { loadInbox } from '../services/notificationStore';
import { notificationEvents } from '../services/notificationEvents';

/**
 * Live count of unread, non-dismissed inbox notifications. Recomputes on inbox
 * mutations (markRead / server sync / dismiss) and on push-driven data changes.
 * Used by the bottom tab bar to show the red count pill on the "Notifiche" tab.
 */
export const useUnreadNotifications = (): number => {
  const [count, setCount] = useState(0);

  const recompute = useCallback(async () => {
    try {
      const items = await loadInbox();
      setCount(items.filter((n) => !n.read && !n.dismissed).length);
    } catch {
      // ignore — keep last known count
    }
  }, []);

  useEffect(() => {
    recompute();
    const unsubInbox = notificationEvents.onInboxUpdated(recompute);
    const unsubData = notificationEvents.onDataChanged(recompute);
    return () => {
      unsubInbox();
      unsubData();
    };
  }, [recompute]);

  return count;
};
