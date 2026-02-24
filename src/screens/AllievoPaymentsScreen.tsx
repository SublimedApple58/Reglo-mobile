import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '../components/BottomSheet';
import { GlassBadge } from '../components/GlassBadge';
import { GlassButton } from '../components/GlassButton';
import { GlassCard } from '../components/GlassCard';
import { ScrollHintFab } from '../components/ScrollHintFab';
import { Screen } from '../components/Screen';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import {
  MobileAppointmentPaymentDocument,
  StudentAppointmentPaymentEvent,
  StudentAppointmentPaymentHistoryItem,
} from '../types/regloApi';
import { colors, spacing, typography } from '../theme';
import { formatDay, formatTime } from '../utils/date';
import {
  invoiceStatusLabel,
  paymentEventStatusLabel,
  paymentPhaseLabel,
  paymentStatusLabel,
} from '../utils/payment';

const pageSize = 12;

type TransactionRow = {
  key: string;
  appointment: StudentAppointmentPaymentHistoryItem;
  event: StudentAppointmentPaymentEvent;
};

let sharingModulePromise: Promise<typeof import('expo-sharing') | null> | null = null;
const getSharingModule = async () => {
  if (!sharingModulePromise) {
    sharingModulePromise = import('expo-sharing').catch(() => null);
  }
  return sharingModulePromise;
};

let webBrowserModulePromise: Promise<typeof import('expo-web-browser') | null> | null = null;
const getWebBrowserModule = async () => {
  if (!webBrowserModulePromise) {
    webBrowserModulePromise = import('expo-web-browser').catch(() => null);
  }
  return webBrowserModulePromise;
};

export const AllievoPaymentsScreen = () => {
  const { user } = useSession();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const [history, setHistory] = useState<StudentAppointmentPaymentHistoryItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTransactionKey, setSelectedTransactionKey] = useState<string | null>(null);
  const [documentBusy, setDocumentBusy] = useState<'view' | 'share' | null>(null);
  const detailsScrollRef = useRef<ScrollView | null>(null);
  const [detailsLayoutHeight, setDetailsLayoutHeight] = useState(0);
  const [detailsContentHeight, setDetailsContentHeight] = useState(0);
  const [detailsOffsetY, setDetailsOffsetY] = useState(0);

  const detailsMaxHeight = useMemo(
    () => Math.max(320, Math.min(windowHeight * 0.62, windowHeight - insets.top - 180)),
    [insets.top, windowHeight]
  );
  const detailsMaxOffset = Math.max(0, detailsContentHeight - detailsLayoutHeight);
  const canQuickScrollDetails = detailsMaxOffset > 12;
  const showDetailsScrollUp = canQuickScrollDetails && detailsOffsetY > 24;
  const showDetailsScrollDown =
    canQuickScrollDetails && !showDetailsScrollUp && detailsOffsetY < detailsMaxOffset - 24;

  const handleDetailsQuickScroll = useCallback(
    (direction: 'up' | 'down') => {
      if (!detailsScrollRef.current) return;
      const step = Math.max(180, detailsLayoutHeight * 0.85);
      const nextOffset =
        direction === 'down'
          ? Math.min(detailsOffsetY + step, detailsMaxOffset)
          : Math.max(detailsOffsetY - step, 0);
      detailsScrollRef.current.scrollTo({ y: nextOffset, animated: true });
    },
    [detailsLayoutHeight, detailsMaxOffset, detailsOffsetY]
  );

  const load = useCallback(async () => {
    try {
      const response = await regloApi.getPaymentHistory(80);
      setHistory(response);
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore caricando pagamenti',
        tone: 'danger',
      });
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const transactions = useMemo(() => {
    const rows: TransactionRow[] = [];
    history.forEach((appointment) => {
      appointment.payments.forEach((event) => {
        rows.push({
          key: `${appointment.appointmentId}:${event.id}`,
          appointment,
          event,
        });
      });
    });
    rows.sort((a, b) => {
      const aDate = new Date(a.event.paidAt ?? a.event.createdAt).getTime();
      const bDate = new Date(b.event.paidAt ?? b.event.createdAt).getTime();
      return bDate - aDate;
    });
    return rows;
  }, [history]);

  const visibleTransactions = useMemo(
    () => transactions.slice(0, visibleCount),
    [transactions, visibleCount]
  );
  const hasMore = visibleTransactions.length < transactions.length;
  const stats = useMemo(() => {
    const succeeded = transactions.filter(
      (item) => paymentEventStatusLabel(item.event.status).tone === 'success'
    ).length;
    const failed = transactions.filter(
      (item) => paymentEventStatusLabel(item.event.status).tone === 'danger'
    ).length;
    const totalAmount = transactions.reduce((sum, item) => sum + item.event.amount, 0);
    return { succeeded, failed, totalAmount };
  }, [transactions]);

  const selectedTransaction = useMemo(
    () => transactions.find((item) => item.key === selectedTransactionKey) ?? null,
    [selectedTransactionKey, transactions]
  );

  useEffect(() => {
    if (!selectedTransactionKey) return;
    if (!selectedTransaction) {
      setDetailsOpen(false);
      setSelectedTransactionKey(null);
    }
  }, [selectedTransaction, selectedTransactionKey]);

  useEffect(() => {
    if (detailsOpen) return;
    setDetailsOffsetY(0);
    setDetailsLayoutHeight(0);
    setDetailsContentHeight(0);
  }, [detailsOpen]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setToast(null);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const openDetails = (transaction: TransactionRow) => {
    setSelectedTransactionKey(transaction.key);
    setDetailsOpen(true);
  };

  const getPaymentDocument = useCallback(
    async (appointmentId: string): Promise<MobileAppointmentPaymentDocument | null> => {
      const document = await regloApi.getAppointmentPaymentDocument(appointmentId);
      if (document.documentType === 'none' || !document.viewUrl) {
        setToast({
          text: 'Documento non disponibile al momento.',
          tone: 'info',
        });
        return null;
      }
      return document;
    },
    []
  );

  const handleOpenPaymentDocument = useCallback(async () => {
    if (!selectedTransaction || documentBusy) return;
    setDocumentBusy('view');
    try {
      const document = await getPaymentDocument(selectedTransaction.appointment.appointmentId);
      if (!document?.viewUrl) return;
      const webBrowser = await getWebBrowserModule();
      if (webBrowser) {
        await webBrowser.openBrowserAsync(document.viewUrl, {
          presentationStyle: webBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
        return;
      }
      await Linking.openURL(document.viewUrl);
      setToast({
        text: 'Viewer in-app non disponibile su questa build. Aperto nel browser.',
        tone: 'info',
      });
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore aprendo il documento',
        tone: 'danger',
      });
    } finally {
      setDocumentBusy(null);
    }
  }, [documentBusy, getPaymentDocument, selectedTransaction]);

  const handleSharePaymentDocument = useCallback(async () => {
    if (!selectedTransaction || documentBusy) return;
    setDocumentBusy('share');
    let downloadedUri: string | null = null;
    try {
      const document = await regloApi.getAppointmentPaymentDocument(selectedTransaction.appointment.appointmentId);
      if (document.documentType === 'none' || !document.shareUrl || document.shareMode === 'none') {
        setToast({
          text: 'Documento non disponibile al momento.',
          tone: 'info',
        });
        return;
      }

      if (document.shareMode === 'file') {
        const sharing = await getSharingModule();
        if (!sharing || !(await sharing.isAvailableAsync())) {
          await Share.share({
            message: document.shareUrl,
            url: document.shareUrl,
          });
          setToast({
            text: 'Condivisione file non disponibile su questa build. Ti condivido il link.',
            tone: 'info',
          });
          return;
        }

        const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
        if (!cacheDir) {
          throw new Error('Storage locale non disponibile sul dispositivo.');
        }
        const fileUri = `${cacheDir}payment-${selectedTransaction.appointment.appointmentId}-${Date.now()}.pdf`;
        const downloaded = await FileSystem.downloadAsync(document.shareUrl, fileUri);
        downloadedUri = downloaded.uri;
        await sharing.shareAsync(downloaded.uri, {
          mimeType: 'application/pdf',
          dialogTitle: document.label,
          UTI: 'com.adobe.pdf',
        });
        return;
      }

      await Share.share({
        message: document.shareUrl,
        url: document.shareUrl,
      });
    } catch (err) {
      setToast({
        text: err instanceof Error ? err.message : 'Errore condividendo il documento',
        tone: 'danger',
      });
    } finally {
      if (downloadedUri) {
        try {
          await FileSystem.deleteAsync(downloadedUri, { idempotent: true });
        } catch {
          // ignore cleanup error
        }
      }
      setDocumentBusy(null);
    }
  }, [documentBusy, selectedTransaction]);

  return (
    <Screen>
      <StatusBar style="dark" />
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>Allievo</Text>
          </View>
          <Text style={styles.title}>Pagamenti</Text>
          <Text style={styles.subtitle}>
            {user?.name ? `${user.name}, cronologia transazioni` : 'Cronologia transazioni'}
          </Text>
        </View>

        <GlassCard title="Riepilogo rapido" subtitle="Ultimi movimenti registrati">
          {initialLoading ? (
            <View style={styles.summaryGrid}>
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonCard key={`summary-skeleton-${index}`} style={styles.summarySkeletonItem}>
                  <SkeletonBlock width="62%" height={24} />
                  <SkeletonBlock width="48%" height={12} />
                </SkeletonCard>
              ))}
            </View>
          ) : (
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{transactions.length}</Text>
                <Text style={styles.summaryLabel}>Movimenti</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{stats.succeeded}</Text>
                <Text style={styles.summaryLabel}>Riusciti</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{stats.failed}</Text>
                <Text style={styles.summaryLabel}>Falliti</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>€ {stats.totalAmount.toFixed(0)}</Text>
                <Text style={styles.summaryLabel}>Totale</Text>
              </View>
            </View>
          )}
        </GlassCard>

        <GlassCard title="Transazioni" subtitle="Movimenti e tentativi di addebito">
          <View style={styles.list}>
            {initialLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <SkeletonCard key={`payments-row-skeleton-${index}`}>
                  <SkeletonBlock width="58%" height={22} />
                  <SkeletonBlock width="52%" />
                  <SkeletonBlock width="72%" />
                  <SkeletonBlock width="100%" height={42} radius={14} style={styles.skeletonButton} />
                </SkeletonCard>
              ))
            ) : (
              <>
                {visibleTransactions.map((transaction) => {
                  const status = paymentEventStatusLabel(transaction.event.status);
                  return (
                    <View key={transaction.key} style={styles.row}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowTitle}>
                          {paymentPhaseLabel(transaction.event.phase)} · € {transaction.event.amount.toFixed(2)}
                        </Text>
                        <Text style={styles.rowSubtitle}>
                          {formatDay(transaction.event.paidAt ?? transaction.event.createdAt)} ·{' '}
                          {formatTime(transaction.event.paidAt ?? transaction.event.createdAt)}
                        </Text>
                        <Text style={styles.rowMeta}>
                          Guida: {formatDay(transaction.appointment.startsAt)} ·{' '}
                          {formatTime(transaction.appointment.startsAt)}
                        </Text>
                      </View>
                      <View style={styles.rowStatusWrap}>
                        <GlassBadge label={status.label} tone={status.tone} />
                      </View>
                      <View style={styles.rowActions}>
                        <GlassButton
                          label="Dettagli"
                          onPress={() => openDetails(transaction)}
                          fullWidth
                        />
                      </View>
                    </View>
                  );
                })}
                {!transactions.length ? (
                  <Text style={styles.empty}>Nessuna transazione registrata.</Text>
                ) : null}
                {hasMore ? (
                  <View style={styles.more}>
                    <GlassButton
                      label="Carica altre"
                      onPress={() => setVisibleCount((prev) => Math.min(prev + pageSize, transactions.length))}
                    />
                  </View>
                ) : null}
              </>
            )}
          </View>
        </GlassCard>
      </ScrollView>

      <BottomSheet
        visible={detailsOpen && !!selectedTransaction}
        title="Dettaglio transazione"
        onClose={() => setDetailsOpen(false)}
      >
        {selectedTransaction ? (
          <View style={styles.detailsScrollContainer}>
            <ScrollView
              ref={detailsScrollRef}
              style={[styles.detailsScroll, { maxHeight: detailsMaxHeight }]}
              contentContainerStyle={styles.detailsScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentInsetAdjustmentBehavior="never"
              automaticallyAdjustContentInsets={false}
              automaticallyAdjustsScrollIndicatorInsets={false}
              scrollEventThrottle={16}
              onLayout={(event) => setDetailsLayoutHeight(event.nativeEvent.layout.height)}
              onContentSizeChange={(_, height) => setDetailsContentHeight(height)}
              onScroll={(event) => setDetailsOffsetY(event.nativeEvent.contentOffset.y)}
            >
              <Text style={styles.detailsTitle}>
                {paymentPhaseLabel(selectedTransaction.event.phase)} · €{' '}
                {selectedTransaction.event.amount.toFixed(2)}
              </Text>
              <Text style={styles.detailsMeta}>
                Stato: {paymentEventStatusLabel(selectedTransaction.event.status).label}
              </Text>
              <Text style={styles.detailsMeta}>
                Data: {formatDay(selectedTransaction.event.paidAt ?? selectedTransaction.event.createdAt)} ·{' '}
                {formatTime(selectedTransaction.event.paidAt ?? selectedTransaction.event.createdAt)}
              </Text>
              <Text style={styles.detailsMeta}>Tentativi: {selectedTransaction.event.attemptCount}</Text>
              {selectedTransaction.event.failureMessage ? (
                <Text style={styles.detailsMeta}>{selectedTransaction.event.failureMessage}</Text>
              ) : null}

              <Text style={styles.detailsDivider}>Guida collegata</Text>
              <Text style={styles.detailsMeta}>
                {formatDay(selectedTransaction.appointment.startsAt)} ·{' '}
                {formatTime(selectedTransaction.appointment.startsAt)}
              </Text>
              <Text style={styles.detailsMeta}>
                Istruttore: {selectedTransaction.appointment.instructorName ?? 'Da assegnare'}
              </Text>
              <Text style={styles.detailsMeta}>
                Veicolo: {selectedTransaction.appointment.vehicleName ?? 'Da assegnare'}
              </Text>
              <Text style={styles.detailsMeta}>
                Stato guida: {selectedTransaction.appointment.lessonStatus}
              </Text>

              <Text style={styles.detailsDivider}>Pagamento guida</Text>
              <Text style={styles.detailsMeta}>
                Stato pagamento: {paymentStatusLabel(selectedTransaction.appointment.paymentStatus).label}
              </Text>
              <Text style={styles.detailsMeta}>
                Totale dovuto: € {selectedTransaction.appointment.finalAmount.toFixed(2)}
              </Text>
              <Text style={styles.detailsMeta}>
                Pagato: € {selectedTransaction.appointment.paidAmount.toFixed(2)}
              </Text>
              <Text style={styles.detailsMeta}>
                Residuo: € {selectedTransaction.appointment.dueAmount.toFixed(2)}
              </Text>
              <Text style={styles.detailsMeta}>
                Fattura: {invoiceStatusLabel(selectedTransaction.appointment.invoiceStatus)}
              </Text>

              <View style={styles.documentActions}>
                <View style={styles.documentActionWrap}>
                  <GlassButton
                    label={documentBusy === 'view' ? 'Apertura...' : 'Visualizza documento'}
                    onPress={handleOpenPaymentDocument}
                    disabled={Boolean(documentBusy)}
                    fullWidth
                  />
                </View>
                <View style={styles.documentActionWrap}>
                  <GlassButton
                    label={documentBusy === 'share' ? 'Condivisione...' : 'Condividi documento'}
                    onPress={handleSharePaymentDocument}
                    disabled={Boolean(documentBusy)}
                    fullWidth
                  />
                </View>
              </View>
            </ScrollView>
            {showDetailsScrollDown ? (
              <ScrollHintFab
                direction="down"
                style={styles.scrollHintBottom}
                onPress={() => handleDetailsQuickScroll('down')}
              />
            ) : null}
            {showDetailsScrollUp ? (
              <ScrollHintFab
                direction="up"
                style={styles.scrollHintTop}
                onPress={() => handleDetailsQuickScroll('up')}
              />
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl * 2 + spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  rolePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(50, 77, 122, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.18)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginBottom: 2,
  },
  rolePillText: {
    ...typography.caption,
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryItem: {
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.54)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  summarySkeletonItem: {
    minWidth: '47%',
    flexGrow: 1,
  },
  summaryValue: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0.1,
    marginTop: 2,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(50, 77, 122, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  rowHeader: {
    gap: 2,
  },
  rowStatusWrap: {
    paddingTop: 2,
  },
  rowActions: {
    width: '100%',
    paddingTop: 2,
  },
  skeletonButton: {
    marginTop: spacing.xs,
  },
  rowTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  rowSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rowMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  more: {
    marginTop: spacing.xs,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
  },
  detailsScroll: {
    width: '100%',
  },
  detailsScrollContainer: {
    width: '100%',
    position: 'relative',
  },
  detailsScrollContent: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  detailsTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  detailsMeta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  detailsDivider: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  documentActions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    overflow: 'visible',
  },
  documentActionWrap: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    overflow: 'visible',
  },
  scrollHintBottom: {
    bottom: spacing.sm,
  },
  scrollHintTop: {
    top: spacing.xs,
  },
});
