import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { paymentHistoryStore } from '../stores/paymentHistoryStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { GlassCloseButton } from './GlassCloseButton';
import {
  PAYMENT_EVENT_DOT,
  PAYMENT_EVENT_LABEL,
  formatPaymentEventWhen,
} from '../utils/paymentHistory';

/**
 * "Storico pagamento" di una guida (REG-637) — form sheet nativo che si
 * stringe sul contenuto (HUG_SHEET): root `View` semplice, niente ScrollView,
 * così `fitToContents` misura giusto. Lo storico è corto e arriva già pronto
 * dal seed, quindi Android lo misura una volta e basta.
 *
 * Una timeline verticale, dal più recente: l'ultimo evento ha il punto pieno
 * col suo colore, i precedenti un cerchio vuoto. Il colore è solo lì.
 *
 * Padding in fondo: il form sheet non arriva al bordo dello schermo, quindi
 * NON si somma `insets.bottom` (vedi docs/design-system.md §13.2.1).
 */
export function PaymentHistorySheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Catturato al mount: un remount (fast refresh, StrictMode) non svuota il foglio.
  const [data] = useState(() => paymentHistoryStore.get());

  if (!data) return <View style={s.root} />;

  return (
    <View
      testID="payment-history-sheet"
      style={[s.root, { paddingTop: 26, paddingBottom: Math.max(insets.bottom - 16, 22) }]}
    >
      <View style={s.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>Storico pagamento</Text>
          <Text style={s.hint} numberOfLines={1}>{data.lessonLabel}</Text>
        </View>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [s.x, pressed && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Chiudi"
          >
            <Ionicons name="close" size={20} color="#111111" />
          </Pressable>
        </GlassCloseButton>
      </View>

      <View accessibilityRole="list">
        {data.events.map((event, i) => {
          const latest = i === 0;
          const last = i === data.events.length - 1;
          const when = formatPaymentEventWhen(event.at);
          const meta = [`${when.day} · ${when.time}`, event.actorName].filter(Boolean).join(' · ');
          return (
            <Animated.View
              key={event.id}
              entering={FadeInDown.duration(260).delay(60 + i * 45).springify().damping(22).stiffness(260)}
              style={s.item}
              accessible
              accessibilityLabel={`${PAYMENT_EVENT_LABEL[event.kind]}, ${meta}`}
            >
              <View style={s.rail}>
                <View
                  style={[
                    s.dot,
                    latest
                      ? { backgroundColor: PAYMENT_EVENT_DOT[event.kind] }
                      : s.dotPast,
                  ]}
                />
                {!last ? <View style={s.line} /> : null}
              </View>
              <View style={[s.body, !last && s.bodySpaced]}>
                <Text style={[s.label, latest ? s.labelLatest : null]}>
                  {PAYMENT_EVENT_LABEL[event.kind]}
                </Text>
                <Text style={s.meta} numberOfLines={1}>{meta}</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const DOT = 10;

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', paddingBottom: 24, gap: 12 },
  title: { fontSize: 21, fontWeight: '600', color: '#111111', letterSpacing: -0.3 },
  hint: { fontSize: 13.5, fontWeight: '500', color: colors.textMuted, marginTop: 5, lineHeight: 18 },
  x: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },

  item: { flexDirection: 'row', gap: 14 },
  // Il binario: punto allineato alla prima riga di testo, filo fino al successivo.
  rail: { width: 14, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, marginTop: 6 },
  dotPast: { borderWidth: 1.5, borderColor: '#D1D1D1', backgroundColor: colors.background },
  line: { flex: 1, width: StyleSheet.hairlineWidth * 2, backgroundColor: '#E6E6EB', marginTop: 6, marginBottom: -2 },
  body: { flex: 1, minWidth: 0 },
  bodySpaced: { paddingBottom: 20 },
  label: { fontSize: 15.5, fontWeight: '500', color: '#434343', letterSpacing: -0.2 },
  labelLatest: { fontWeight: '600', color: '#111111' },
  meta: { fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 3 },
});
