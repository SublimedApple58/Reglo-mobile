/**
 * Home allievo — sezioni Clay (prenotazione «solo eccezioni», anteprime
 * approvate da Tiziano il 10/11/2026: /tmp/hiro-anteprime/prenotazione-eccezioni
 * mob-1…mob-5). Ogni sezione è memo e riceve solo dati già pronti: la logica
 * (query, azioni, navigazione) resta in `AllievoHomeScreen`.
 *
 * Regole: bianco e nero, colore solo dalle icone 3D e dall'immagine della
 * guida; niente pillole, badge o pallini; pesi 500–600; entrate in dissolvenza
 * (nessuna molla).
 */
import React, { memo } from 'react';
import { Image, ImageSourcePropType, Pressable, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { CLAY_ROW_PRESSED, ClayButton, ClayPressable, ClaySurface, Icon3D } from '../../components/clay';
import { PiggyCoin } from '../../components/credits/CreditsHero';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { CLAY_RADIUS } from '../../theme/spacing';
import { contentEnter, contentExit } from './homeMotion';

export const HOME_ART = {
  hero: require('../../../assets/vita/home-hero.png') as ImageSourcePropType,
  volante: require('../../../assets/vita/volante.png') as ImageSourcePropType,
  esame: require('../../../assets/vita/esame.png') as ImageSourcePropType,
  orologio: require('../../../assets/vita/orologio.png') as ImageSourcePropType,
  salvadanaio: require('../../../assets/vita/salvadanaio.png') as ImageSourcePropType,
  campanella: require('../../../assets/web/menu/bell-gold.png') as ImageSourcePropType,
  telefono: require('../../../assets/web/nav/segretaria-3d.png') as ImageSourcePropType,
  agenda: require('../../../assets/web/nav/agenda-3d.png') as ImageSourcePropType,
  persone: require('../../../assets/icons3d-ai/persone.png') as ImageSourcePropType,
  scambio: require('../../../assets/icons3d-ai/scambio.png') as ImageSourcePropType,
};

// ── Intestazione calda ────────────────────────────────────────────────────────

export const HomeGreeting = memo(function HomeGreeting({
  greeting,
  name,
  mood,
}: {
  greeting: string;
  name: string;
  mood: string | null;
}) {
  return (
    <View style={s.greetWrap}>
      <Text style={s.greet}>{greeting}</Text>
      <Text style={s.name} accessibilityRole="header" numberOfLines={1}>
        {name}
      </Text>
      {mood ? <Text style={s.mood}>{mood}</Text> : null}
    </View>
  );
});

// ── Card della prossima guida (con l'immagine in alto) ────────────────────────

const Cover = memo(function Cover() {
  return (
    <View style={s.cover}>
      <Image source={HOME_ART.hero} style={s.coverImg} resizeMode="cover" accessibilityIgnoresInvertColors />
    </View>
  );
});

export const NextLessonCard = memo(function NextLessonCard({
  when,
  day,
  time,
  who,
  initials,
  onPress,
  contentKey,
  animate,
}: {
  when: string;
  day: string;
  time: string;
  who: string | null;
  initials: string | null;
  onPress: () => void;
  /** REG-792: id della guida mostrata; quando cambia il testo si dissolve nel nuovo. */
  contentKey?: string;
  /** REG-792: solo durante il riordino animato della home. */
  animate?: boolean;
}) {
  return (
    <ClaySurface padded={false} onPress={onPress} style={s.big} accessibilityLabel={`${when}, ${day}, ${time}`}>
      <Cover />
      <Animated.View
        key={contentKey}
        style={s.bb}
        entering={animate ? contentEnter : undefined}
        exiting={animate ? contentExit : undefined}
      >
        <Text style={s.when}>{when}</Text>
        <Text style={s.day}>{day}</Text>
        <Text style={s.time}>{time}</Text>
        {who ? (
          <View style={s.who}>
            {initials ? (
              <View style={s.avSm}>
                <Text style={s.avSmText}>{initials}</Text>
              </View>
            ) : null}
            <Text style={s.whoText} numberOfLines={1}>
              {who}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </ClaySurface>
  );
});

/** Nessuna guida in programma: stessa card con l'immagine, testo e azione. */
export const EmptyLessonCard = memo(function EmptyLessonCard({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <ClaySurface padded={false} style={s.big}>
      <Cover />
      <View style={[s.bb, s.center]}>
        <Text style={[s.day, s.dayEmpty]}>{title}</Text>
        <Text style={[s.time, s.timeEmpty]}>{text}</Text>
        {action ? <View style={s.emptyAction}>{action}</View> : null}
      </View>
    </ClaySurface>
  );
});

// ── Livello 2: card piccola (v6, Tiziano 24/11) ──────────────────────────────
// Gerarchia a tre livelli: card grande = la cosa n.1; card piccola = la cosa
// subito dopo (al massimo UNA); tutto il resto righe piatte. La card piccola
// può avere sotto un filo una riga d'azione («Prenota un'altra guida»,
// «Crediti finiti»), così due cose di livello 2 non diventano due card.

export type SmallCardFooter = { title: string; value?: string | null; onPress?: () => void; testID?: string };

export const HomeSmallCard = memo(function HomeSmallCard({
  thumb,
  kicker,
  title,
  titleFirst,
  onPress,
  footer,
  testID,
  contentKey,
  animate,
}: {
  /** REG-792: id della guida mostrata; quando cambia il testo si dissolve nel nuovo. */
  contentKey?: string;
  /** REG-792: solo durante il riordino animato della home. */
  animate?: boolean;
  /** `car` = ritaglio dell'immagine della guida; altrimenti un nodo (salvadanaio…). */
  thumb: 'car' | React.ReactNode;
  kicker: string;
  title: string;
  /** Titolo forte sopra e riga grigia sotto (crediti, pausa). */
  titleFirst?: boolean;
  onPress?: () => void;
  footer?: SmallCardFooter | null;
  testID?: string;
}) {
  const top = (
    <Text style={[s.smallKicker, titleFirst && s.smallKickerBelow]} numberOfLines={1}>
      {kicker}
    </Text>
  );
  return (
    <ClaySurface padded={false} style={s.small} testID={testID}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [s.smallMain, pressed && s.pressedSoft]}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${title}, ${kicker}`}
      >
        {thumb === 'car' ? (
          <View style={s.thumb}>
            <Image source={HOME_ART.hero} style={s.thumbImg} resizeMode="cover" accessibilityIgnoresInvertColors />
          </View>
        ) : (
          <View style={[s.thumb, s.thumbPlain]}>{thumb}</View>
        )}
        <Animated.View
          key={contentKey}
          style={s.smallText}
          entering={animate ? contentEnter : undefined}
          exiting={animate ? contentExit : undefined}
        >
          {titleFirst ? null : top}
          <Text style={[s.smallTitle, titleFirst && s.smallTitleFirst]} numberOfLines={1}>
            {title}
          </Text>
          {titleFirst ? top : null}
        </Animated.View>
        {onPress ? <Ionicons name="chevron-forward" size={17} color={CLAY.chevron} /> : null}
      </Pressable>
      {footer ? (
        <Pressable
          onPress={footer.onPress}
          disabled={!footer.onPress}
          style={({ pressed }) => [s.smallFoot, pressed && s.pressedSoft]}
          accessibilityRole={footer.onPress ? 'button' : undefined}
          testID={footer.testID}
        >
          <View style={s.smallFootInner}>
            <Text style={s.footTitle} numberOfLines={1}>
              {footer.title}
            </Text>
            {footer.value ? (
              <Text style={s.footValue} numberOfLines={1}>
                {footer.value}
              </Text>
            ) : null}
            {footer.onPress ? <Ionicons name="chevron-forward" size={15} color={CLAY.chevron} /> : null}
          </View>
        </Pressable>
      ) : null}
    </ClaySurface>
  );
});

// ── CTA primaria «Prenota» (REG-786, Tiziano 25/11) ──────────────────────────
// Blocco a sé sotto la card principale (o sotto la card piccola della prossima
// guida quando la principale è l'esame): il bottone nero più evidente della
// home, il credito in una riga discreta sotto. Mai dentro la card della guida.

export const BookCta = memo(function BookCta({
  title,
  note,
  onPress,
}: {
  title: string;
  note?: string | null;
  onPress: () => void;
}) {
  return (
    <View style={s.bookCta}>
      <ClayButton title={title} onPress={onPress} testID="home-book" />
      {note ? <Text style={s.bookNote}>{note}</Text> : null}
    </View>
  );
});

// ── Livello 1: crediti finiti senza guide (salvadanaio su bianco) ─────────────

export const CreditsPrimaryCard = memo(function CreditsPrimaryCard({ title, line }: { title: string; line: string }) {
  return (
    <ClaySurface padded={false} style={s.big} testID="home-credits-card">
      <View style={[s.cover, s.coverPlain]}>
        <PiggyCoin size={86} top={28} />
      </View>
      <View style={s.bb}>
        <Text style={s.when}>Nessuna guida in programma</Text>
        <Text style={s.day} accessibilityRole="header">
          {title}
        </Text>
        <Text style={s.time}>{line}</Text>
      </View>
    </ClaySurface>
  );
});

// ── Livello 1: nessuna guida, si può prenotare (bottone dentro la card) ───────

export const BookPrimaryCard = memo(function BookPrimaryCard({ line, onBook }: { line: string; onBook: () => void }) {
  return (
    <ClaySurface padded={false} style={s.big}>
      <Cover />
      <View style={s.bb}>
        <Text style={s.when}>Nessuna guida in programma</Text>
        <Text style={s.day}>Prenota la prossima</Text>
        <Text style={s.time}>{line}</Text>
        <ClayButton title="Prenota guida" onPress={onBook} style={s.cardCta} testID="home-book" />
      </View>
    </ClaySurface>
  );
});

// ── Livello 3: righe piatte (niente card) ─────────────────────────────────────

/** Una riga piatta: icona/data a sinistra, testo, valore, chevron; filo sottile sopra se non è la prima. */
export const FlatRow = memo(function FlatRow({
  leading,
  title,
  subtitle,
  value,
  valueStyle,
  trailing,
  onPress,
  first,
  strong,
  dimmed,
  testID,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string | null;
  value?: string | null;
  /** REG-786: «Da pagare» in nero 600, «Pagata» in grigio. */
  valueStyle?: StyleProp<TextStyle>;
  /** REG-786: azione a destra al posto del chevron (es. «Prendi» negli Scambi). */
  trailing?: React.ReactNode;
  onPress?: () => void;
  first?: boolean;
  strong?: boolean;
  dimmed?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.row, pressed && CLAY_ROW_PRESSED]}
      accessibilityRole={onPress ? 'button' : undefined}
      testID={testID}
    >
      {leading ? <View style={s.lead}>{leading}</View> : null}
      <View style={[s.rowBody, !first && s.rowDivider, dimmed && s.dimmed]}>
        <View style={s.rowText}>
          <Text style={[s.rt, strong && s.rtStrong]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={s.rs} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {value ? <Text style={[s.rv, valueStyle]}>{value}</Text> : null}
        {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={17} color={CLAY.ink3} /> : null)}
      </View>
    </Pressable>
  );
});

/** «Il tuo percorso»: guide fatte e ultima guida, solo testo. */
export const PathRows = memo(function PathRows({
  done,
  last,
  onLastPress,
}: {
  done: number;
  last: string | null;
  onLastPress?: () => void;
}) {
  if (!done) return null;
  return (
    <HomeSection title="Il tuo percorso">
      <FlatRow first title="Guide fatte" value={String(done)} />
      {last ? <FlatRow title="Ultima guida" value={last} onPress={onLastPress} /> : null}
    </HomeSection>
  );
});

// ── Sezione con titolo ────────────────────────────────────────────────────────

export function HomeSection({
  title,
  right,
  onRightPress,
  footer,
  children,
}: {
  title: string;
  right?: string | null;
  onRightPress?: () => void;
  footer?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={s.sec}>
      <View style={s.sech}>
        <Text style={s.sect}>{title}</Text>
        {right ? (
          onRightPress ? (
            <ClayPressable kind="small" onPress={onRightPress} hitSlop={10} accessibilityRole="button">
              <Text style={s.secl}>{right}</Text>
            </ClayPressable>
          ) : (
            <Text style={s.secl}>{right}</Text>
          )
        ) : null}
      </View>
      {children}
      {footer ? <Text style={s.foot}>{footer}</Text> : null}
    </View>
  );
}

// ── «Quando puoi prenotare tu» ────────────────────────────────────────────────

export type BookingCaseItem = { key: string; icon: ImageSourcePropType; title: string; detail: string };

export const BookingCasesCard = memo(function BookingCasesCard({ cases }: { cases: BookingCaseItem[] }) {
  return (
    <View>
      {cases.map((c, i) => (
        <FlatRow key={c.key} first={i === 0} leading={<Icon3D source={c.icon} size={34} />} title={c.title} subtitle={c.detail} />
      ))}
    </View>
  );
});

// ── Posto liberato in evidenza ────────────────────────────────────────────────

export const FeaturedOfferCard = memo(function FeaturedOfferCard({
  day,
  detail,
  minutesLeft,
  progress,
  onTake,
}: {
  day: string;
  detail: string;
  minutesLeft: number;
  /** 0–1: tempo che resta sull'offerta. */
  progress: number;
  onTake: () => void;
}) {
  return (
    <ClaySurface padded={false} style={[s.big, s.feat]} onPress={onTake} accessibilityLabel={`Si è liberato un posto, ${day}`}>
      <View style={s.fh}>
        <Icon3D source={HOME_ART.campanella} size={70} />
        <View style={s.fhText}>
          <Text style={s.when}>Si è liberato un posto</Text>
          <Text style={[s.day, s.dayOffer]}>{day}</Text>
          <Text style={[s.time, s.timeOffer]} numberOfLines={1}>
            {detail}
          </Text>
        </View>
      </View>
      <View style={s.leftRow}>
        <Text style={s.leftText}>
          Ancora <Text style={s.leftStrong}>{minutesLeft <= 1 ? '1 minuto' : `${minutesLeft} minuti`}</Text>
        </Text>
        <Text style={s.leftText}>poi passa al prossimo</Text>
      </View>
      <View style={s.bar}>
        <View style={[s.barFill, { width: `${Math.max(4, Math.min(100, progress * 100))}%` }]} />
      </View>
      <ClayButton title="Prendilo" compact onPress={onTake} style={s.featCta} />
    </ClaySurface>
  );
});

// ── Elenco posti liberi / altre voci ──────────────────────────────────────────

export type HomeRow = {
  key: string;
  icon?: ImageSourcePropType;
  title: string;
  subtitle?: string | null;
  onPress?: () => void;
  dimmed?: boolean;
};

export const HomeRowsList = memo(function HomeRowsList({ rows }: { rows: HomeRow[] }) {
  return (
    <View>
      {rows.map((r, i) => (
        <FlatRow
          key={r.key}
          first={i === 0}
          leading={r.icon ? <Icon3D source={r.icon} size={34} /> : undefined}
          title={r.title}
          subtitle={r.subtitle}
          onPress={r.onPress}
          dimmed={r.dimmed}
        />
      ))}
    </View>
  );
});

// ── Guide (data grande a sinistra) ────────────────────────────────────────────

export type HomeLessonRow = { key: string; dayNum: string; month: string; title: string; subtitle: string; onPress: () => void };

export const LessonsList = memo(function LessonsList({ rows }: { rows: HomeLessonRow[] }) {
  return (
    <View>
      {rows.map((r, i) => (
        <FlatRow
          key={r.key}
          first={i === 0}
          leading={
            <View style={s.dt}>
              <Text style={s.dtNum}>{r.dayNum}</Text>
              <Text style={s.dtMonth}>{r.month}</Text>
            </View>
          }
          title={r.title}
          subtitle={r.subtitle}
          onPress={r.onPress}
        />
      ))}
    </View>
  );
});

// ── Prenotazioni in pausa ─────────────────────────────────────────────────────

export const PausedCard = memo(function PausedCard({
  count,
  countLabel,
  title,
  text,
}: {
  /** Numero grande (guide da pagare); null = solo il titolo. */
  count: number | null;
  countLabel: string;
  title: string;
  text: string;
}) {
  return (
    <ClaySurface style={s.big}>
      <View style={s.pauseTop}>
        <View style={s.pauseText}>
          <Text style={s.when}>{title}</Text>
          {count != null ? (
            <View style={s.pauseCountRow}>
              <Text style={s.pauseCount}>{count}</Text>
              <Text style={s.pauseCountLabel}>{countLabel}</Text>
            </View>
          ) : (
            <Text style={[s.day, s.pauseOnly]}>{countLabel}</Text>
          )}
        </View>
        <Icon3D source={HOME_ART.salvadanaio} size={84} />
      </View>
      <Text style={[s.time, s.pauseBody]}>{text}</Text>
    </ClaySurface>
  );
});

// ── Bottone «Chiama il tuo istruttore» ────────────────────────────────────────

export function CallInstructorButton({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <ClayButton variant="secondary" onPress={onPress} leading={<Icon3D source={HOME_ART.telefono} size={30} />}>
      <Text style={s.callText} numberOfLines={1}>
        Chiama {name}, il tuo istruttore
      </Text>
    </ClayButton>
  );
}

const s = StyleSheet.create({
  greetWrap: { paddingTop: 2 },
  greet: { fontSize: 15, color: CLAY.ink3, marginBottom: 1 },
  name: { fontSize: 32, lineHeight: 38, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.9 },
  mood: { fontSize: 15.5, lineHeight: 21, color: CLAY.ink2, marginTop: 4 },

  big: { marginTop: 18 },
  cover: {
    height: 118,
    borderTopLeftRadius: CLAY_RADIUS.card,
    borderTopRightRadius: CLAY_RADIUS.card,
    overflow: 'hidden',
  },
  coverImg: { width: '100%', height: '100%' },
  bb: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 20 },
  center: { alignItems: 'center', paddingHorizontal: 22, paddingBottom: 22 },
  when: { fontSize: 13.5, color: CLAY.ink3 },
  day: { fontSize: 23, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.6, marginTop: 2 },
  dayEmpty: { fontSize: 21, textAlign: 'center' },
  dayOffer: { fontSize: 22 },
  time: { fontSize: 16, color: CLAY.ink2, marginTop: 3 },
  timeEmpty: { fontSize: 15, lineHeight: 21, marginTop: 6, textAlign: 'center' },
  timeOffer: { fontSize: 15 },
  emptyAction: { marginTop: 18, alignSelf: 'stretch' },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(17,17,17,0.12)',
  },
  avSm: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CLAY.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...CLAY_SHADOW.avatar,
  },
  avSmText: { fontSize: 12, fontWeight: '600', color: CLAY.ink },
  whoText: { flex: 1, fontSize: 15, color: CLAY.ink2 },

  coverPlain: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  cardCta: { marginTop: 16 },
  bookCta: { marginTop: 18 },
  bookNote: { fontSize: 13.5, color: CLAY.ink3, textAlign: 'center', marginTop: 10 },

  small: { marginTop: 14 },
  smallMain: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 18 },
  thumb: { width: 80, height: 58, borderRadius: 16, overflow: 'hidden', backgroundColor: CLAY.surface },
  thumbPlain: { alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' },
  // Ritaglio dell'immagine della home centrato sull'auto (come la card compatta sotto l'esame).
  thumbImg: { position: 'absolute', width: 330, height: 110, left: -125, top: -29 },
  smallText: { flex: 1, minWidth: 0 },
  smallKicker: { fontSize: 13.5, lineHeight: 18, color: CLAY.ink3 },
  smallKickerBelow: { marginTop: 2 },
  smallTitle: { fontSize: 16.5, lineHeight: 21, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3, marginTop: 2 },
  smallTitleFirst: { marginTop: 0 },
  smallFoot: { paddingHorizontal: 18 },
  smallFootInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 13,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(17,17,17,0.12)',
  },
  footTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2 },
  footValue: { fontSize: 14, color: CLAY.ink3, flexShrink: 1 },

  row: { flexDirection: 'row', alignItems: 'center', minHeight: 54 },
  lead: { width: 44, marginRight: 12, alignItems: 'center' },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', paddingVertical: 12, paddingLeft: 2 },
  rowDivider: { borderTopWidth: 0.5, borderTopColor: 'rgba(17,17,17,0.12)' },
  dimmed: { opacity: 0.5 },
  pressedSoft: { opacity: 0.6 },
  rowText: { flex: 1, minWidth: 0 },
  rt: { fontSize: 16, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  rtStrong: { fontWeight: '600' },
  rs: { fontSize: 14, lineHeight: 19, color: CLAY.ink3, marginTop: 1 },
  rv: { fontSize: 16, color: CLAY.ink2 },

  sec: { marginTop: 28 },
  sech: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, paddingHorizontal: 2 },
  sect: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  secl: { fontSize: 15, fontWeight: '500', color: CLAY.ink3 },
  foot: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 10, paddingHorizontal: 4 },


  feat: { padding: 18 },
  fh: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  fhText: { flex: 1, minWidth: 0 },
  leftRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  leftText: { fontSize: 13.5, color: CLAY.ink3 },
  leftStrong: { color: CLAY.ink, fontWeight: '600' },
  bar: { height: 4, borderRadius: 2, backgroundColor: CLAY.surface, overflow: 'hidden', marginTop: 10, ...CLAY_SHADOW.sink },
  barFill: { height: '100%', backgroundColor: CLAY.ink, borderRadius: 2 },
  featCta: { marginTop: 16 },

  dt: { alignItems: 'center' },
  dtNum: { fontSize: 22, lineHeight: 24, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.5 },
  dtMonth: { fontSize: 12.5, color: CLAY.ink3 },

  pauseTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pauseText: { flex: 1, minWidth: 0 },
  pauseCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  pauseCount: { fontSize: 44, lineHeight: 48, fontWeight: '600', color: CLAY.ink, letterSpacing: -1.5 },
  pauseCountLabel: { fontSize: 18, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4 },
  pauseOnly: { fontSize: 21 },
  pauseBody: { fontSize: 15, lineHeight: 21, marginTop: 10 },

  callText: { fontSize: 16.5, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
});
