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
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { ClayButton, ClayList, ClayListRow, ClayPressable, ClaySurface, Icon3D } from '../../components/clay';
import { CLAY, CLAY_SHADOW } from '../../theme/clay';
import { CLAY_RADIUS } from '../../theme/spacing';

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
}: {
  when: string;
  day: string;
  time: string;
  who: string | null;
  initials: string | null;
  onPress: () => void;
}) {
  return (
    <ClaySurface padded={false} onPress={onPress} style={s.big} accessibilityLabel={`${when}, ${day}, ${time}`}>
      <Cover />
      <View style={s.bb}>
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
      </View>
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

// ── Due numeri (guide fatte, esame) ───────────────────────────────────────────

export type HomeTile = {
  key: string;
  icon: ImageSourcePropType;
  value: string;
  label: string;
  onPress?: () => void;
};

export const StatTiles = memo(function StatTiles({ tiles }: { tiles: HomeTile[] }) {
  if (!tiles.length) return null;
  return (
    <View style={s.tiles}>
      {tiles.map((t) => (
        <ClaySurface
          key={t.key}
          padded={false}
          radius={CLAY_RADIUS.tile}
          onPress={t.onPress}
          style={s.tile}
          accessibilityLabel={`${t.value} ${t.label}`}
        >
          <Icon3D source={t.icon} size={46} />
          <View style={s.tileText}>
            <Text style={s.tn} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {t.value}
            </Text>
            <Text style={s.tl} numberOfLines={1}>
              {t.label}
            </Text>
          </View>
        </ClaySurface>
      ))}
    </View>
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
    <ClaySurface padded={false} style={s.casesCard}>
      {cases.map((c, i) => (
        <View key={c.key} style={[s.case, i > 0 && s.caseDivider]}>
          <Icon3D source={c.icon} size={44} />
          <View style={s.caseText}>
            <Text style={s.ct}>{c.title}</Text>
            <Text style={s.cs}>{c.detail}</Text>
          </View>
        </View>
      ))}
    </ClaySurface>
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
    <ClayList>
      {rows.map((r) => (
        <ClayListRow
          key={r.key}
          leading={r.icon ? <Icon3D source={r.icon} size={42} /> : undefined}
          title={r.title}
          subtitle={r.subtitle ?? undefined}
          onPress={r.onPress}
          dimmed={r.dimmed}
        />
      ))}
    </ClayList>
  );
});

// ── Guide (data grande a sinistra) ────────────────────────────────────────────

export type HomeLessonRow = { key: string; dayNum: string; month: string; title: string; subtitle: string; onPress: () => void };

export const LessonsList = memo(function LessonsList({ rows }: { rows: HomeLessonRow[] }) {
  return (
    <ClayList>
      {rows.map((r) => (
        <ClayListRow
          key={r.key}
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
    </ClayList>
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

  tiles: { flexDirection: 'row', gap: 12, marginTop: 14 },
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 14 },
  tileText: { flex: 1, minWidth: 0 },
  tn: { fontSize: 23, lineHeight: 27, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.7 },
  tl: { fontSize: 13, lineHeight: 16, color: CLAY.ink3 },

  sec: { marginTop: 26 },
  sech: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, paddingHorizontal: 2 },
  sect: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.3 },
  secl: { fontSize: 15, fontWeight: '500', color: CLAY.ink3 },
  foot: { fontSize: 13, lineHeight: 18, color: CLAY.ink3, marginTop: 10, paddingHorizontal: 4 },

  casesCard: { paddingVertical: 6, paddingHorizontal: 18 },
  case: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 12 },
  caseDivider: { borderTopWidth: 0.5, borderTopColor: 'rgba(17,17,17,0.12)' },
  caseText: { flex: 1, minWidth: 0 },
  ct: { fontSize: 16, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  cs: { fontSize: 13.5, lineHeight: 18, color: CLAY.ink3, marginTop: 2 },

  feat: { padding: 18 },
  fh: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  fhText: { flex: 1, minWidth: 0 },
  leftRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  leftText: { fontSize: 13.5, color: CLAY.ink3 },
  leftStrong: { color: CLAY.ink, fontWeight: '600' },
  bar: { height: 4, borderRadius: 2, backgroundColor: CLAY.surface, overflow: 'hidden', marginTop: 10, ...CLAY_SHADOW.sink },
  barFill: { height: '100%', backgroundColor: CLAY.ink, borderRadius: 2 },
  featCta: { marginTop: 16 },

  dt: { width: 44, alignItems: 'center' },
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
