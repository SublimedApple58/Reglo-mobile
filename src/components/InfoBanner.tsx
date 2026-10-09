import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { selectionAsync } from '../utils/haptics';
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
 *
 * ## Movimento
 *
 * Questa riga non si limita a mostrare uno stato: **lo cambia**. Quindi deve
 * comportarsi come un controllo nativo — rispondere al dito, e trasformarsi
 * invece di sostituirsi:
 *
 * - **al tocco**: scala + velo, con un haptic di selezione. Il design system
 *   (§8.4) lo pretende: niente è tappabile con la sola `opacity`.
 * - **al cambio di valore**: i testi sfumano al proprio posto e la riga scivola
 *   alla nuova larghezza, invece di scattare.
 * - **la freccia ruota** quando l'azione si inverte: avanti = allarga,
 *   indietro = restringi. È la stessa freccia, non due icone diverse, perché
 *   l'utente sta percorrendo lo stesso asse nei due versi.
 *
 * Con «Riduci movimento» attivo restano **solo le dissolvenze**: niente scala,
 * niente rotazione, niente scivolamento (§4 della richiesta e default
 * `ReduceMotion.System` di Reanimated per le transizioni di layout).
 */

type Variant = 'filled' | 'quiet';

/** Gentle (design-system §8.2) — fluido, nessun rimbalzo. Sono gli stessi
 *  numeri che la scheda allievo usa già per le proprie transizioni di layout:
 *  due componenti vicini che si muovono con la stessa inerzia sembrano
 *  un'app sola. */
const GLIDE = LinearTransition.springify().damping(22).stiffness(240).mass(0.6);

/** Il valore cambia **nello stesso posto**: va dissolto, non spostato — uno
 *  slittamento direbbe «è arrivato altro contenuto», che è falso. Essendo una
 *  pura dissolvenza resta onesta anche con «Riduci movimento», dove i fade
 *  sono ammessi e gli spostamenti no: da qui `ReduceMotion.Never`. */
const DISSOLVE = FadeIn.duration(200).reduceMotion(ReduceMotion.Never);
/** L'occhiello è più piccolo e conta meno: arriva prima, così il valore resta
 *  l'ultimo a posarsi e l'occhio va dove deve. */
const DISSOLVE_EYEBROW = FadeIn.duration(150).reduceMotion(ReduceMotion.Never);

/** Snappy (§8.2). La scala però è 1.5% e non il 3% del design system: su una
 *  riga a tutta larghezza il 3% fa gommare i bordi: a quella larghezza sono
 *  dieci pixel di corsa. Il velo a 0.62 è quello che questa schermata usa già
 *  su ogni riga tappabile. */
const PRESS_SPRING = { damping: 20, stiffness: 300 } as const;
const PRESSED_SCALE = 0.985;
const PRESSED_OPACITY = 0.62;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  /** L'azione torna indietro invece di andare avanti: la freccia si gira. */
  actionFlipped?: boolean;
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
  actionFlipped = false,
  onPress,
  style,
  titleLines = 1,
}: Props) {
  const quiet = variant === 'quiet';
  const reduced = useReducedMotion();

  const pressed = useSharedValue(0);
  const flip = useSharedValue(actionFlipped ? 1 : 0);

  useEffect(() => {
    const to = actionFlipped ? 1 : 0;
    // Gentle: la freccia si gira, non scatta né rimbalza.
    flip.value = reduced ? to : withSpring(to, { damping: 18, stiffness: 220 });
  }, [actionFlipped, reduced, flip]);

  const pressStyle = useAnimatedStyle(() => ({
    // Con «Riduci movimento» la scala resta ferma: il velo basta a dire
    // «ti ho sentito», e non è movimento.
    transform: [{ scale: reduced ? 1 : 1 - pressed.value * (1 - PRESSED_SCALE) }],
    opacity: 1 - pressed.value * (1 - PRESSED_OPACITY),
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${flip.value * 180}deg` }],
  }));

  const handlePress = () => {
    if (!onPress) return;
    // Lo stesso haptic che l'app usa quando si scorre una scelta: qui si sta
    // cambiando che cosa si guarda, non si sta confermando niente.
    selectionAsync().catch(() => {});
    onPress();
  };

  const body = (
    <>
      {/* Nella forma quiet l'icona è rumore: la freccia basta a dire che si tocca. */}
      {!quiet && icon ? (
        <View style={s.iconCircle}>
          <Ionicons name={icon} size={18} color={iconColor ?? colors.primary} />
        </View>
      ) : null}

      <View style={s.textBlock}>
        {/* La chiave è il valore: cambiandolo il testo si rimonta e sfuma al
            proprio posto, invece di sostituirsi di colpo. È l'idioma che
            «Le tue guide» usa già per il suo sottotitolo. */}
        {quiet && eyebrow ? (
          <Animated.Text key={eyebrow} entering={DISSOLVE_EYEBROW} style={s.eyebrow}>
            {eyebrow}
          </Animated.Text>
        ) : null}
        <Animated.Text
          key={title}
          entering={DISSOLVE}
          style={quiet ? s.quietTitle : s.title}
          numberOfLines={titleLines}
        >
          {title}
        </Animated.Text>
        {subtitle ? (
          <Animated.Text key={subtitle} entering={DISSOLVE} style={s.subtitle} numberOfLines={1}>
            {subtitle}
          </Animated.Text>
        ) : null}
      </View>

      {trailing ??
        (actionLabel ? (
          <View style={s.actionRow}>
            <Animated.Text key={actionLabel} entering={DISSOLVE} style={s.action}>
              {actionLabel}
            </Animated.Text>
            {/* La disclosure di iOS: niente sottolineatura, che è roba da web. */}
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Animated.View>
          </View>
        ) : null)}
    </>
  );

  if (!onPress) {
    return (
      <Animated.View layout={GLIDE} style={[quiet ? s.quiet : s.filled, style] as ViewStyle[]}>
        {body}
      </Animated.View>
    );
  }

  return (
    <AnimatedPressable
      layout={GLIDE}
      style={[quiet ? s.quiet : s.filled, style, pressStyle] as ViewStyle[]}
      onPress={handlePress}
      // 90ms: dentro la fascia Micro (§8.3). Il dito deve trovare la riga già
      // abbassata, non vederla abbassarsi.
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, PRESS_SPRING);
      }}
      hitSlop={8}
      accessibilityRole="button"
    >
      {body}
    </AnimatedPressable>
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
