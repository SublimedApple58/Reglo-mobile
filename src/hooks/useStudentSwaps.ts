import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { notificationEvents } from '../services/notificationEvents';
import { subscribePushIntent } from '../services/pushNotifications';
import type { AutoscuolaSwapOfferWithDetails } from '../types/regloApi';

/**
 * REG-786 — scambi dell'allievo in cache (TanStack Query): la tab Scambi e la
 * tab Guide leggono gli stessi dati, così aprire una tab non ricarica da zero.
 * Si aggiornano con le push di scambio e quando un'altra schermata cambia uno
 * scambio (`notificationEvents.emitDataChanged`). Per un allievo lo studentId
 * è l'utente stesso (il server lo forza comunque).
 */
export const swapKeys = {
  peers: (companyId: string | null, studentId: string | null) => ['swap-offers', companyId, studentId] as const,
  mine: (companyId: string | null, studentId: string | null) => ['swap-my-offers', companyId, studentId] as const,
};

export function useStudentSwaps({ enabled, poll }: { enabled: boolean; poll?: boolean }) {
  const { activeCompanyId, user } = useSession();
  const studentId = user?.id ?? null;
  const queryClient = useQueryClient();
  const on = enabled && !!activeCompanyId && !!studentId;

  const peers = useQuery<AutoscuolaSwapOfferWithDetails[]>({
    queryKey: swapKeys.peers(activeCompanyId, studentId),
    queryFn: () => regloApi.getSwapOffers(studentId!, 20),
    enabled: on,
    staleTime: 30 * 1000,
    refetchInterval: poll ? 30 * 1000 : false,
  });
  const mine = useQuery<AutoscuolaSwapOfferWithDetails[]>({
    queryKey: swapKeys.mine(activeCompanyId, studentId),
    queryFn: () => regloApi.getMySwapOffers(studentId!),
    enabled: on,
    staleTime: 30 * 1000,
    refetchInterval: poll ? 30 * 1000 : false,
  });

  useEffect(() => {
    if (!on) return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['swap-offers'] });
      queryClient.invalidateQueries({ queryKey: ['swap-my-offers'] });
    };
    const offPush = subscribePushIntent((intent) => {
      if (intent === 'swap_offer' || intent === 'swap_accepted') refresh();
    });
    const offData = notificationEvents.onDataChanged(refresh);
    return () => {
      offPush();
      offData();
    };
  }, [on, queryClient]);

  return {
    studentId,
    offers: peers.data ?? [],
    myOffers: mine.data ?? [],
    loading: on && (peers.isLoading || mine.isLoading) && !peers.data,
    refetch: async () => {
      await Promise.all([peers.refetch(), mine.refetch()]);
    },
  };
}
