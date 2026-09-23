import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { selectionAsync } from 'expo-haptics';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

/**
 * Il linguaggio visivo del **registro**: barra filtri con pastiglia scorrevole e
 * contatori, e riga con glifo tondo a sinistra + stato a testo colorato a destra.
 *
 * Nato in `StudentPaymentsScreen` (Pagamenti) ed estratto qui perché "Le tue
 * guide" doveva avere la stessa identità invece di una sua. Non è
 * generalizzazione preventiva: sono due schermate che mostrano la stessa cosa —
 * un elenco di guide raggruppate per mese, con uno stato per riga — e finché il
 * codice era in due posti erano destinate a divergere al primo ritocco.
 *
 * Chi aggiunge una terza lista di questo tipo parte da qui.
 */

export const LEDGER_PAD = 20;
/** Rientro del separatore: parte dopo il glifo, non da bordo a bordo. */
export const LEDGER_SEP_INSET = LEDGER_PAD + 36 + 13;

const SPRING = { damping: 20, stiffness: 340, mass: 0.5 } as const;

/* ────────────────────────────── stato della riga ────────────────────────── */

export type RowTone = 'amber' | 'green' | 'violet' | 'grey' | 'blue' | 'red';
export type RowIcon = 'euro' | 'check' | 'wallet' | 'close' | 'clock' | 'exam' | 'car';

export const TONE: Record<RowTone, { chip: string; ink: string }> = {
  amber: { chip: '#FFF3E3', ink: '#B45309' },
  green: { chip: '#EAF7F0', ink: '#067647' },
  violet: { chip: '#F3F0FF', ink: '#6D28D9' },
  grey: { chip: '#F1F1F5', ink: '#A8A8B0' },
  blue: { chip: '#EFF4FF', ink: '#1D4ED8' },
  red: { chip: '#FFF1F0', ink: '#B42318' },
};

const ICON_NAME: Record<Exclude<RowIcon, 'euro'>, React.ComponentProps<typeof Ionicons>['name']> = {
  check: 'checkmark',
  wallet: 'wallet',
  close: 'close',
  clock: 'time-outline',
  exam: 'school',
  car: 'car-sport',
};

/**
 * Pastiglia tonda di sinistra: è lei a dire lo stato a colpo d'occhio, al posto
 * di una fila di badge. La lista si legge scorrendo la colonna.
 */
export function StateGlyph({ tone, icon }: { tone: RowTone; icon: RowIcon }) {
  const { chip, ink } = TONE[tone];
  return (
    <View style={[ledger.glyph, { backgroundColor: chip }]}>
      {icon === 'euro' ? (
        <Text style={[ledger.glyphEuro, { color: ink }]}>€</Text>
      ) : (
        <Ionicons name={ICON_NAME[icon]} size={icon === 'check' ? 18 : 15} color={ink} />
      )}
    </View>
  );
}

/* ────────────────────────────────── filtri ──────────────────────────────── */

export type FilterDef<T extends string> = { value: T; label: string; count: number };

/**
 * Barra filtri con la pastiglia che **scivola** da un filtro all'altro invece
 * di riapparire altrove, e i contatori in cross-fade invece di saltare al
 * numero nuovo.
 *
 * Scorre in orizzontale di proposito: con il contatore accanto all'etichetta le
 * voci non stanno in una riga fissa senza troncare le parole — e "Program…" è
 * peggio di una voce da raggiungere scorrendo.
 */
export function LedgerFilterBar<T extends string>({
  defs,
  active,
  onChange,
  style,
}: {
  defs: FilterDef<T>[];
  active: T;
  onChange: (value: T) => void;
  style?: React.ComponentProps<typeof ScrollView>['style'];
}) {
  const [layouts, setLayouts] = useState<Record<string, { x: number; w: number }>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const ready = useSharedValue(0);

  const onLayoutFor = (value: T) => (e: LayoutChangeEvent) => {
    const { x: lx, width } = e.nativeEvent.layout;
    setLayouts((prev) =>
      prev[value]?.x === lx && prev[value]?.w === width ? prev : { ...prev, [value]: { x: lx, w: width } },
    );
  };

  useEffect(() => {
    const l = layouts[active];
    if (!l) return;
    if (ready.value === 0) {
      // Primo posizionamento: la pastiglia si trova già dov'è, non scivola dal nulla.
      x.value = l.x;
      w.value = l.w;
      ready.value = 1;
      return;
    }
    x.value = withSpring(l.x, SPRING);
    w.value = withSpring(l.w, SPRING);
  }, [active, layouts, ready, w, x]);

  const pill = useAnimatedStyle(() => ({
    opacity: ready.value,
    transform: [{ translateX: x.value }],
    width: w.value,
  }));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={ledger.filterRow}
      style={style ?? ledger.filterScroll}
    >
      <Animated.View style={[ledger.filterPill, pill]} pointerEvents="none" />
      {defs.map((f) => {
        const on = f.value === active;
        return (
          <Pressable
            key={f.value}
            onLayout={onLayoutFor(f.value)}
            onPress={() => {
              if (f.value === active) return;
              void selectionAsync().catch(() => {});
              onChange(f.value);
            }}
            style={ledger.filterItem}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[ledger.filterText, on && ledger.filterTextOn]}>{f.label}</Text>
            {f.count > 0 ? (
              <Animated.Text
                key={`${f.value}-${f.count}`}
                entering={FadeIn.duration(200)}
                style={[ledger.filterCount, on && ledger.filterCountOn]}
              >
                {f.count}
              </Animated.Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export const ledger = StyleSheet.create({
  filterScroll: { marginTop: 20 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: LEDGER_PAD, paddingBottom: 2 },
  filterPill: {
    position: 'absolute', top: 0, bottom: 2, left: 0,
    borderRadius: 999, backgroundColor: '#1A1A2E',
  },
  filterItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999,
  },
  filterText: { fontSize: 14, fontWeight: '400', color: '#595959' },
  filterTextOn: { color: '#FFFFFF', fontWeight: '500' },
  filterCount: { fontSize: 12, fontWeight: '500', color: '#9A9AA2' },
  filterCountOn: { color: 'rgba(255,255,255,0.65)' },

  month: {
    fontSize: 12, fontWeight: '600', color: '#AEAEB6', textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 26, marginBottom: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: LEDGER_PAD, paddingVertical: 11 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#ECECF0', marginLeft: LEDGER_SEP_INSET },
  glyph: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  glyphEuro: { fontSize: 15, fontWeight: '600' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '400', color: '#1A1A2E', letterSpacing: -0.1 },
  rowSub: { fontSize: 13, fontWeight: '400', color: '#9A9AA2', marginTop: 1 },
  rowValue: { fontSize: 13, fontWeight: '400', textAlign: 'right' },
});

/**
 * Importo in euro, tollerante al tipo — e non è pignoleria: `penaltyAmount` e
 * `priceAmount` sono `Decimal` di Prisma e arrivano via JSON come **stringa**.
 * Una copia di questo helper che prendeva solo `number` ha fatto crashare
 * Pagamenti (REG-511). Sta qui perché ne esista **una sola**.
 */
export function formatEuro(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? `€${n}` : `€${n.toFixed(2)}`;
}
