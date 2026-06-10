import React, { useSyncExternalStore } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { settingsStore } from '../../../src/stores/settingsStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function PaymentScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(settingsStore.subscribe, settingsStore.get);

  if (!data) return <View style={s.root} />;

  const { paymentProfile, paymentLoading, onConfigurePayment, onRemovePayment } = data;
  const hasMethod = !!paymentProfile?.hasPaymentMethod;
  const method = paymentProfile?.paymentMethod;

  return (
    <View style={s.root}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>
      <Text style={s.title}>Metodo di pagamento</Text>

      {paymentProfile?.blockedByInsoluti ? (
        <Text style={s.warning}>Hai pagamenti insoluti. Salda dalla Home.</Text>
      ) : null}

      {hasMethod && method ? (
        <View style={s.card}>
          <View style={s.cardIcon}>
            <Ionicons name="card" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardBrand}>{method.brand.toUpperCase()}</Text>
            <Text style={s.cardNumber}>{'••••'} {method.last4}</Text>
          </View>
          <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
        </View>
      ) : (
        <Text style={s.hint}>Aggiungi una carta per prenotare e pagare le guide senza attriti.</Text>
      )}

      <Pressable
        onPress={onConfigurePayment}
        disabled={paymentLoading}
        style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }, paymentLoading && { opacity: 0.6 }]}
      >
        <Text style={s.ctaText}>
          {paymentLoading ? 'Attendi...' : hasMethod ? 'Aggiorna metodo' : 'Aggiungi metodo'}
        </Text>
      </Pressable>

      {hasMethod ? (
        <Pressable
          onPress={onRemovePayment}
          disabled={paymentLoading}
          style={({ pressed }) => [s.danger, pressed && { opacity: 0.85 }, paymentLoading && { opacity: 0.6 }]}
        >
          <Text style={s.dangerText}>Rimuovi metodo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 14 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3, marginBottom: 4 },
  hint: { fontSize: 14, fontWeight: '400', color: colors.textMuted, lineHeight: 20 },
  warning: { fontSize: 13, fontWeight: '500', color: '#F59E0B' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surface, borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#E9EBF2',
    alignItems: 'center', justifyContent: 'center',
  },
  cardBrand: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  cardNumber: { fontSize: 14, fontWeight: '500', color: colors.textMuted, marginTop: 2 },
  cta: {
    backgroundColor: colors.primary, minHeight: 50, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.20, shadowRadius: 8, elevation: 4,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  danger: {
    backgroundColor: '#FEE2E2', minHeight: 50, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  dangerText: { fontSize: 16, fontWeight: '600', color: '#DC2626' },
});
