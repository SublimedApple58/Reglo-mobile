import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/**
 * Due forme per due mestieri diversi, sotto lo stesso tetto.
 *
 * - `filled` — **contenitore di un controllo**: sfondo pieno, icona nel
 *   cerchio, un toggle a destra. È il banner "Prenotazione multipla" del form
 *   di prenotazione, da cui questo componente nasce. Misure identiche
 *   all'originale: il refactor non doveva spostare un pixel.
 *
 * - `quiet` — **indicatore di contesto**: dice che cosa stai guardando, non ti
 *   chiede niente. Niente riempimento, un filetto sotto, occhiello maiuscolo e
 *   valore in evidenza, azione con la freccia di iOS.
 *
 * Perché non la stessa forma per entrambi: riempire di grigio una riga che
 * *informa* la fa pesare quanto una che *si usa*, e su una scheda già densa
 * diventa una macchia. Il grigio pieno resta dov'è un'opzione da attivare.
 */

type Variant = 'filled' | 'quiet';

type Props = {
  variant?: Variant;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  /** `quiet`: etichetta maiuscola sopra il valore. */
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  /** `filled`: il controllo a destra (un toggle…). */
  trailing?: React.ReactNode;
  /** Azione testuale a destra. Ignorata se c'è `trailing`. */
  actionLabel?: string | null;
  onPress?: () => void;
  style?: ViewStyle;
  titleLines?: number;
};

export function InfoBanner({
  variant = 'filled',
  icon,
  iconColor,
  eyebrow,
  title,
  subtitle,
  trailing,
  actionLabel,
  onPress,
  style,
  titleLines = 1,
}: Props) {
  const quiet = variant === 'quiet';
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      style={[quiet ? s.quiet : s.filled, style] as ViewStyle[]}
      {...(onPress ? { onPress, hitSlop: 8 } : {})}
    >
      {/* Nella forma quiet l'icona è rumore: la freccia basta a dire che si tocca. */}
      {!quiet && icon ? (
        <View style={s.iconCircle}>
          <Ionicons name={icon} size={18} color={iconColor ?? colors.primary} />
        </View>
      ) : null}

      <View style={s.textBlock}>
        {quiet && eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
        <Text style={quiet ? s.quietTitle : s.title} numberOfLines={titleLines}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={s.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ??
        (actionLabel ? (
          <View style={s.actionRow}>
            <Text style={s.action}>{actionLabel}</Text>
            {/* La disclosure di iOS: niente sottolineatura, che è roba da web. */}
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        ) : null)}
    </Wrapper>
  );
}

const s = StyleSheet.create({
  // ── filled: misure del banner originale, invariate ──
  filled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F4F5F9',
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '600', color: colors.primary },
  // 12.5 e #929292 sono quelli dell'originale: il refactor non cambia un pixel.
  subtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },

  // ── quiet: il vocabolario tipografico della scheda allievo ──
  // occhiello = `sectionLabel` (11/700/1.2 maiuscolo), valore = `tlTime` (15/700).
  quiet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  quietTitle: { fontSize: 15, fontWeight: '700', color: colors.primary, letterSpacing: -0.2 },

  textBlock: { flex: 1, minWidth: 0 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  action: { fontSize: 13.5, fontWeight: '600', color: colors.primary, letterSpacing: -0.1 },
});
