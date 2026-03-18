import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
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
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../theme';
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
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Header ── */}
        <Text style={styles.title}>Pagamenti</Text>

        {/* ── Hero Card — Yellow gradient totals ── */}
        {initialLoading ? (
          <SkeletonCard style={styles.heroSkeleton}>
            <SkeletonBlock width="45%" height={14} radius={6} />
            <SkeletonBlock width="60%" height={36} radius={8} />
            <SkeletonBlock width="70%" height={13} radius={6} />
          </SkeletonCard>
        ) : (
          <View style={styles.heroShadow}>
            <LinearGradient
              colors={['#FACC15', '#FDE68A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.heroGradient}
            >
              <Text style={styles.heroLabel}>Totale transazioni</Text>
              <Text style={styles.heroAmount}>{'\u20AC'} {stats.totalAmount.toFixed(2)}</Text>
              <Text style={styles.heroMeta}>
                {transactions.length} movimenti {'\u00B7'} {stats.succeeded} riusciti {'\u00B7'} {stats.failed} falliti
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* ── Transaction list section ── */}
        {(initialLoading || transactions.length > 0) ? (
          <Text style={styles.sectionTitle}>Ultime transazioni</Text>
        ) : null}

        {initialLoading ? (
          <View style={styles.list}>
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={`payments-row-skeleton-${index}`} style={styles.txRowSkeleton}>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <SkeletonBlock width={40} height={40} radius={12} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <SkeletonBlock width="60%" height={18} />
                    <SkeletonBlock width="45%" height={13} />
                  </View>
                </View>
              </SkeletonCard>
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {visibleTransactions.map((transaction) => {
              const status = paymentEventStatusLabel(transaction.event.status);
              const isFailed = status.tone === 'danger';
              const phaseLabel = paymentPhaseLabel(transaction.event.phase);
              const iconText = isFailed ? 'ERR' : phaseLabel.slice(0, 3).toUpperCase();

              return (
                <Pressable
                  key={transaction.key}
                  style={styles.txRow}
                  onPress={() => openDetails(transaction)}
                >
                  {/* Icon square */}
                  <View
                    style={[
                      styles.txIcon,
                      isFailed ? styles.txIconDanger : styles.txIconSuccess,
                    ]}
                  >
                    <Text
                      style={[
                        styles.txIconText,
                        isFailed ? styles.txIconTextDanger : styles.txIconTextSuccess,
                      ]}
                    >
                      {iconText}
                    </Text>
                  </View>

                  {/* Center info */}
                  <View style={styles.txCenter}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {phaseLabel}
                    </Text>
                    <Text style={styles.txDate}>
                      {formatDay(transaction.event.paidAt ?? transaction.event.createdAt)} {'\u00B7'}{' '}
                      {formatTime(transaction.event.paidAt ?? transaction.event.createdAt)}
                    </Text>
                    {isFailed ? (
                      <Text style={styles.txFailed}>Pagamento fallito</Text>
                    ) : null}
                  </View>

                  {/* Right amount */}
                  <Text style={styles.txAmount}>
                    {'\u20AC'} {transaction.event.amount.toFixed(2)}
                  </Text>
                </Pressable>
              );
            })}

            {hasMore ? (
              <View style={styles.more}>
                <Button
                  label="Carica altre"
                  onPress={() => setVisibleCount((prev) => Math.min(prev + pageSize, transactions.length))}
                  fullWidth
                />
              </View>
            ) : null}
          </View>
        )}

        {/* Empty state — no transactions */}
        {!initialLoading && !transactions.length ? (
          <View style={styles.emptyWrap}>
            <Image
              source={require('../../assets/duck-coins.png')}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>Nessuna transazione</Text>
            <Text style={styles.emptySubtitle}>I tuoi movimenti appariranno qui</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Detail BottomSheet ── */}
      <BottomSheet
        visible={detailsOpen && !!selectedTransaction}
        onClose={() => setDetailsOpen(false)}
        title="Dettaglio transazione"
        showHandle
        footer={
          selectedTransaction ? (
            <View style={styles.chunkyFooterRow}>
              <Pressable
                onPress={handleSharePaymentDocument}
                disabled={Boolean(documentBusy)}
                style={[styles.chunkyOutlineBtn, { flex: 1 }, documentBusy && { opacity: 0.5 }]}
              >
                <Text style={styles.chunkyOutlineBtnText}>
                  {documentBusy === 'share' ? 'Attendi...' : 'Condividi'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleOpenPaymentDocument}
                disabled={Boolean(documentBusy)}
                style={[styles.chunkyDarkBtn, { flex: 1 }, documentBusy && { opacity: 0.5 }]}
              >
                <Text style={styles.chunkyDarkBtnText}>
                  {documentBusy === 'view' ? 'Attendi...' : 'Visualizza'}
                </Text>
              </Pressable>
            </View>
          ) : undefined
        }
      >
        {selectedTransaction ? (
          <>
            {/* Hero card */}
            <View style={styles.chunkyHeroCard}>
              <Text style={styles.chunkyHeroTitle}>
                {paymentPhaseLabel(selectedTransaction.event.phase)} {'\u00B7'} {'\u20AC'}{' '}
                {selectedTransaction.event.amount.toFixed(2)}
              </Text>
              <View style={[
                styles.chunkyStatusPill,
                {
                  backgroundColor: paymentEventStatusLabel(selectedTransaction.event.status).tone === 'success'
                    ? '#F0FDF4'
                    : paymentEventStatusLabel(selectedTransaction.event.status).tone === 'danger'
                      ? '#FEF2F2'
                      : '#F8FAFC',
                  alignSelf: 'flex-start',
                },
              ]}>
                <Text style={[
                  styles.chunkyStatusPillText,
                  {
                    color: paymentEventStatusLabel(selectedTransaction.event.status).tone === 'success'
                      ? '#16A34A'
                      : paymentEventStatusLabel(selectedTransaction.event.status).tone === 'danger'
                        ? '#DC2626'
                        : '#64748B',
                  },
                ]}>
                  {paymentEventStatusLabel(selectedTransaction.event.status).label}
                </Text>
              </View>
              <Text style={styles.chunkyHeroSub}>
                {formatDay(selectedTransaction.event.paidAt ?? selectedTransaction.event.createdAt)} {'\u00B7'}{' '}
                {formatTime(selectedTransaction.event.paidAt ?? selectedTransaction.event.createdAt)}
              </Text>
              {selectedTransaction.event.failureMessage ? (
                <Text style={styles.chunkyFailureMsg}>{selectedTransaction.event.failureMessage}</Text>
              ) : null}
            </View>

            {/* GUIDA COLLEGATA section */}
            <Text style={styles.chunkyRowLabel}>GUIDA COLLEGATA</Text>
            <View style={{ gap: 16 }}>
              <View style={styles.chunkyIconRow}>
                <View style={[styles.chunkyIconCircle, { backgroundColor: '#FEF9C3' }]}>
                  <Ionicons name="calendar-outline" size={18} color="#CA8A04" />
                </View>
                <View>
                  <Text style={styles.chunkyRowLabel}>DATA</Text>
                  <Text style={styles.chunkyRowValue}>
                    {formatDay(selectedTransaction.appointment.startsAt)} {'\u00B7'}{' '}
                    {formatTime(selectedTransaction.appointment.startsAt)}
                  </Text>
                </View>
              </View>
              <View style={styles.chunkyIconRow}>
                <View style={[styles.chunkyIconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="person-outline" size={18} color="#3B82F6" />
                </View>
                <View>
                  <Text style={styles.chunkyRowLabel}>ISTRUTTORE</Text>
                  <Text style={styles.chunkyRowValue}>
                    {selectedTransaction.appointment.instructorName ?? 'Da assegnare'}
                  </Text>
                </View>
              </View>
              <View style={styles.chunkyIconRow}>
                <View style={[styles.chunkyIconCircle, { backgroundColor: '#FEF9C3' }]}>
                  <Ionicons name="car-outline" size={18} color="#CA8A04" />
                </View>
                <View>
                  <Text style={styles.chunkyRowLabel}>VEICOLO</Text>
                  <Text style={styles.chunkyRowValue}>
                    {selectedTransaction.appointment.vehicleName ?? 'Da assegnare'}
                  </Text>
                </View>
              </View>
              <View style={styles.chunkyIconRow}>
                <View style={[styles.chunkyIconCircle, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
                </View>
                <View>
                  <Text style={styles.chunkyRowLabel}>STATO GUIDA</Text>
                  <Text style={styles.chunkyRowValue}>
                    {selectedTransaction.appointment.lessonStatus}
                  </Text>
                </View>
              </View>
            </View>

            {/* PAGAMENTO section */}
            <Text style={[styles.chunkyRowLabel, { marginTop: 8 }]}>PAGAMENTO</Text>
            <View style={{ gap: 16 }}>
              <View style={styles.chunkyIconRow}>
                <View style={[styles.chunkyIconCircle, { backgroundColor: '#FCE7F3' }]}>
                  <Ionicons name="wallet-outline" size={18} color="#EC4899" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chunkyRowLabel}>STATO</Text>
                  <Text style={styles.chunkyRowValue}>
                    {paymentStatusLabel(selectedTransaction.appointment.paymentStatus).label}
                  </Text>
                </View>
              </View>
              <View style={styles.chunkyIconRow}>
                <View style={[styles.chunkyIconCircle, { backgroundColor: '#FCE7F3' }]}>
                  <Ionicons name="cash-outline" size={18} color="#EC4899" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chunkyRowLabel}>IMPORTI</Text>
                  <Text style={styles.chunkyRowValue}>
                    Dovuto {'\u20AC'} {selectedTransaction.appointment.finalAmount.toFixed(2)} {'\u00B7'}{' '}
                    Pagato {'\u20AC'} {selectedTransaction.appointment.paidAmount.toFixed(2)} {'\u00B7'}{' '}
                    Residuo {'\u20AC'} {selectedTransaction.appointment.dueAmount.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.chunkyIconRow}>
                <View style={[styles.chunkyIconCircle, { backgroundColor: '#FCE7F3' }]}>
                  <Ionicons name="document-text-outline" size={18} color="#EC4899" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chunkyRowLabel}>FATTURA</Text>
                  <Text style={styles.chunkyRowValue}>
                    {invoiceStatusLabel(selectedTransaction.appointment.invoiceStatus)} {'\u00B7'}{' '}
                    Tentativi: {selectedTransaction.event.attemptCount}
                  </Text>
                </View>
              </View>
            </View>
          </>
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

  /* ── Header ── */
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },

  /* ── Hero Card (yellow gradient) ── */
  heroShadow: {
    borderRadius: radii.lg,
    shadowColor: '#B45309',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  heroGradient: {
    borderRadius: radii.lg,
    padding: 24,
    overflow: 'hidden',
    gap: 6,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroMeta: {
    fontSize: 13,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 0.85,
  },
  heroSkeleton: {
    backgroundColor: '#FEF9C3',
    padding: 24,
    gap: 10,
  },

  /* ── Section title ── */
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: spacing.xs,
  },

  /* ── Transaction list ── */
  list: {
    gap: 12,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  txRowSkeleton: {
    borderRadius: radii.lg,
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txIconSuccess: {
    backgroundColor: '#FEF9C3',
  },
  txIconDanger: {
    backgroundColor: '#FCE7F3',
  },
  txIconText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  txIconTextSuccess: {
    color: '#CA8A04',
  },
  txIconTextDanger: {
    color: '#EC4899',
  },
  txCenter: {
    flex: 1,
    marginLeft: 14,
  },
  txTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  txDate: {
    fontSize: 13,
    fontWeight: '400',
    color: '#94A3B8',
    marginTop: 2,
  },
  txFailed: {
    fontSize: 13,
    fontWeight: '500',
    color: '#EF4444',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 10,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.md,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: 8,
  },
  emptyImage: {
    width: 380,
    height: 253,
    marginBottom: -36,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#94A3B8',
    textAlign: 'center',
  },
  more: {
    marginTop: spacing.xs,
  },

  /* ── Detail BottomSheet ── */
  sheetFooter: {
    gap: 10,
  },
  detailInfoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 2,
  },
  detailInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  detailInfoStatus: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  detailInfoDate: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
    marginTop: 2,
  },
  detailFailureMsg: {
    fontSize: 13,
    fontWeight: '500',
    color: '#EF4444',
  },
  detailSection: {
    gap: 2,
    marginTop: spacing.sm,
  },
  detailSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailSectionValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },

  /* ── Scroll hints ── */
  scrollHintBottom: {
    bottom: spacing.sm,
  },
  scrollHintTop: {
    top: spacing.xs,
  },

  /* ── Chunky Google-style BottomSheet styles ── */
  chunkyHeroCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 20,
    gap: 6,
  },
  chunkyHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  chunkyHeroSub: {
    fontSize: 14,
    fontWeight: '400',
    color: '#94A3B8',
  },
  chunkyStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chunkyStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chunkyFailureMsg: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },
  chunkyIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  chunkyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chunkyRowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chunkyRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  chunkyFooterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chunkyOutlineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 50,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chunkyOutlineBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  chunkyDarkBtn: {
    backgroundColor: '#1E293B',
    height: 50,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chunkyDarkBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
