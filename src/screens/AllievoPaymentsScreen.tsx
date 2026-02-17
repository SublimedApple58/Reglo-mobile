import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Screen } from '../components/Screen';
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTransactionKey, setSelectedTransactionKey] = useState<string | null>(null);
  const [documentBusy, setDocumentBusy] = useState<'view' | 'share' | null>(null);

  const detailsMaxHeight = useMemo(
    () => Math.max(320, Math.min(windowHeight * 0.62, windowHeight - insets.top - 180)),
    [insets.top, windowHeight]
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
          <Text style={styles.title}>Pagamenti</Text>
          <Text style={styles.subtitle}>
            {user?.name ? `${user.name}, cronologia transazioni` : 'Cronologia transazioni'}
          </Text>
        </View>

        <GlassCard title="Transazioni" subtitle="Movimenti e tentativi di addebito">
          <View style={styles.list}>
            {visibleTransactions.map((transaction) => {
              const status = paymentEventStatusLabel(transaction.event.status);
              return (
                <View key={transaction.key} style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>
                      {paymentPhaseLabel(transaction.event.phase)} · € {transaction.event.amount.toFixed(2)}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {formatDay(transaction.event.paidAt ?? transaction.event.createdAt)} ·{' '}
                      {formatTime(transaction.event.paidAt ?? transaction.event.createdAt)}
                    </Text>
                    <Text style={styles.rowMeta}>
                      Guida: {formatDay(transaction.appointment.startsAt)} ·{' '}
                      {formatTime(transaction.appointment.startsAt)}
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    <GlassBadge label={status.label} tone={status.tone} />
                    <GlassButton label="Dettagli" onPress={() => openDetails(transaction)} />
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
          </View>
        </GlassCard>
      </ScrollView>

      <BottomSheet
        visible={detailsOpen && !!selectedTransaction}
        title="Dettaglio transazione"
        onClose={() => setDetailsOpen(false)}
      >
        {selectedTransaction ? (
          <ScrollView
            style={[styles.detailsScroll, { maxHeight: detailsMaxHeight }]}
            contentContainerStyle={styles.detailsScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            automaticallyAdjustsScrollIndicatorInsets={false}
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
        ) : null}
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  rowTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  rowMeta: {
    ...typography.body,
    color: colors.textSecondary,
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
});
