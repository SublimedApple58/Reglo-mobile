import React, { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cancelFaultStore, type CancelFault } from '../../../src/stores/cancelFaultStore';
import { colors } from '../../../src/theme/colors';
import { GlassCloseButton } from '../../../src/components/GlassCloseButton';

const NAVY = '#1A1A2E';
const INK = '#222222';

/**
 * REG-587 — "Di chi è l'imprevisto?", chiesto quando lo staff annulla una guida
 * oltre il limite di preavviso. Form sheet content-hugging (HUG_SHEET), niente
 * ScrollView (romperebbe il fitToContents).
 *
 * Nessuna opzione preselezionata: dare per scontato "dell'allievo" è esattamente
 * il bug che questa schermata risolve. Tap su un'opzione → chiude questo foglio
 * + "Gestisci guida" (dismiss(2)) e annulla.
 */
export default function CancelFaultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = useSyncExternalStore(cancelFaultStore.subscribe, cancelFaultStore.get);

  React.useEffect(() => () => cancelFaultStore.clear(), []);

  if (!data) return <View style={s.root} />;

  const pick = (fault: CancelFault) => {
    const cb = data.onPick;
    router.dismiss(2); // chiude il form sheet + "Gestisci guida" → torna all'agenda
    setTimeout(() => cb(fault), 260);
  };

  const schoolSub =
    data.coverage === 'credit'
      ? `Nessuna penale: il credito torna a ${data.studentName}.`
      : data.coverage === 'money'
        ? `Nessuna penale: non addebitiamo nulla a ${data.studentName}.`
        : `Nessuna penale a carico di ${data.studentName}.`;

  const Option = ({
    fault,
    icon,
    title,
    sub,
    tone,
  }: {
    fault: CancelFault;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    sub: string;
    tone: 'warn' | 'ok';
  }) => (
    <Pressable
      onPress={() => pick(fault)}
      style={({ pressed }) => [s.option, pressed && { opacity: 0.6, borderColor: NAVY }]}
    >
      <View style={[s.iconWrap, tone === 'ok' ? s.iconOk : s.iconWarn]}>
        <Ionicons name={icon} size={19} color={tone === 'ok' ? '#067647' : '#B45309'} />
      </View>
      <View style={s.optionText}>
        <Text style={s.optionTitle}>{title}</Text>
        <Text style={s.optionSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#C3C6CC" />
    </Pressable>
  );

  return (
    <View style={[s.root, { paddingTop: 16, paddingBottom: insets.bottom + 20 }]}>
      <View style={s.topbar}>
        <Text style={s.title} numberOfLines={1}>Di chi è l&apos;imprevisto?</Text>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [s.x, pressed && { opacity: 0.5 }]}>
            <Ionicons name="close" size={20} color={NAVY} />
          </Pressable>
        </GlassCloseButton>
      </View>

      <View style={s.context}>
        {/* Nome lungo: si accorcia lui, cosi' giorno e ora restano leggibili. */}
        <Text style={s.contextStrong} numberOfLines={1}>{data.studentName}</Text>
        <Text style={s.contextDot}>·</Text>
        <Text style={s.contextText} numberOfLines={1}>{data.whenLabel}</Text>
      </View>
      <Text style={s.lead}>
        Mancano {data.countdownLabel} alla guida: l&apos;annullamento è tardivo.
      </Text>

      <Option
        fault="student"
        icon="person-outline"
        title={`Dell'allievo`}
        sub="Vale la regola del preavviso. Decide il titolare."
        tone="warn"
      />
      <Option
        fault="school"
        icon="business-outline"
        title="Dell'autoscuola"
        sub={schoolSub}
        tone="ok"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingHorizontal: 20 },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: '600', color: NAVY, letterSpacing: -0.3 },
  x: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#F1F2F4', alignItems: 'center', justifyContent: 'center' },
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F7F7F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  contextStrong: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: INK },
  contextDot: { flexShrink: 0, fontSize: 13, color: colors.textSecondary },
  contextText: { flexShrink: 0, fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  lead: { marginTop: 12, marginBottom: 4, fontSize: 14, color: '#3A3A48', lineHeight: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ECECF1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconWarn: { backgroundColor: '#FFF7ED' },
  iconOk: { backgroundColor: '#F0FDF4' },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: INK },
  optionSub: { marginTop: 2, fontSize: 12.5, fontWeight: '500', color: colors.textSecondary, lineHeight: 17 },
});
