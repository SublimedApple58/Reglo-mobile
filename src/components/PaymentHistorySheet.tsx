import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { paymentHistoryStore } from '../stores/paymentHistoryStore';
import { FormSheet } from './SheetScaffold';
import { ClayButton, ClayList, ClaySection, clayRowPadding, markClayRow } from './clay';
import type { ClayRowPosition } from './clay';
import { CLAY } from '../theme/clay';
import { PAYMENT_EVENT_LABEL, formatPaymentEventWhen } from '../utils/paymentHistory';

/**
 * Foglio "Guida" di Pagamenti (REG-637, rifatto REG-639 giro pagamenti): qui
 * finisce l'informazione secondaria che prima stava sotto la riga (pallino
 * colorato «Pagata · data · persona» e chip «⏱ 2 ›»). Stato, storico dal più
 * recente, e la CTA per cambiare lo stato. Form sheet adattivo, X in alto.
 */
export function PaymentHistorySheet() {
  const router = useRouter();
  // Catturato al mount: un remount (fast refresh, StrictMode) non svuota il foglio.
  const [data] = useState(() => paymentHistoryStore.get());
  const [saving, setSaving] = useState(false);

  if (!data) return <View style={s.root} />;
  const action = data.action;

  return (
    <FormSheet
      title={data.lessonLabel}
      subtitle={data.lessonSubtitle ?? undefined}
      busy={saving}
      testID="payment-history-sheet"
      cta={
        action ? (
          <ClayButton
            title={action.label}
            loading={saving}
            testID="payment-detail-action"
            onPress={
              saving
                ? undefined
                : async () => {
                    setSaving(true);
                    const ok = await action.run();
                    setSaving(false);
                    if (ok) router.back();
                  }
            }
          />
        ) : undefined
      }
    >
      <ClayList>
        <InfoRow title="Stato" value={data.stateLabel} />
      </ClayList>
      {data.events.length ? (
        <ClaySection title="Storico pagamento">
          <ClayList>
            {data.events.map((event) => {
              const when = formatPaymentEventWhen(event.at);
              return (
                <InfoRow
                  key={event.id}
                  title={PAYMENT_EVENT_LABEL[event.kind]}
                  subtitle={[`${when.day} · ${when.time}`, event.actorName].filter(Boolean).join(' · ')}
                />
              );
            })}
          </ClayList>
        </ClaySection>
      ) : null}
    </FormSheet>
  );
}

const InfoRow = markClayRow(function InfoRow({
  title,
  subtitle,
  value,
  divider,
  ...pos
}: ClayRowPosition & { title: string; subtitle?: string; value?: string }) {
  return (
    <View style={[s.row, clayRowPadding(pos, 14)]} accessible accessibilityLabel={[title, value, subtitle].filter(Boolean).join(', ')}>
      {divider ? <View style={s.divider} /> : null}
      <View style={s.main}>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={s.value}>{value}</Text> : null}
    </View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, minHeight: 56 },
  divider: { position: 'absolute', top: 0, left: 18, right: 18, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)' },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25 },
  sub: { fontSize: 13.5, lineHeight: 18, color: CLAY.ink3, marginTop: 2 },
  value: { fontSize: 16, color: CLAY.ink3, letterSpacing: -0.2 },
});
