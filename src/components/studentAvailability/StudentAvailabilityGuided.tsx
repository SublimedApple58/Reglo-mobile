import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Href } from "expo-router";
import Animated from "react-native-reanimated";
import { ClayList, ClayListRow } from "../clay";
import { CLAY } from "../../theme/clay";
import { StudentDayChoice } from "./StudentDayChoice";
import { StudentAvailabilityEditor } from "./StudentAvailabilityEditor";
import { StudentWeekStrip } from "./StudentWeekStrip";
import { fadeIn } from "../../screens/firstAccess/FirstAccessStepScreen";
import type {
  StudentAvailabilityBand,
  StudentRangeRules,
  StudentRangesByDay,
} from "../../types/regloApi";
import {
  DEFAULT_RULES,
  WEEK,
  hasAnyRange,
  sameForAll,
  type DayKey,
} from "../../utils/studentAvailability";

/** «il lunedì», «la domenica». */
const withArticle = (day: (typeof WEEK)[number]) =>
  `${day.key === "0" ? "la" : "il"} ${day.full.toLowerCase()}`;
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * REG-802 giro 3 — la scelta GUIDATA delle disponibilità, uguale
 * nell'onboarding e nel Primo accesso (il Profilo tiene l'editor completo).
 * Si parte dai GIORNI, perché ogni giorno è diverso (Tiziano, 27/11):
 *
 * - una domanda per giorno, da lunedì a domenica: «Di solito il lunedì sei
 *   libero…» con mattina, pomeriggio e sera da spuntare, più «Un orario
 *   preciso» con le rotelle (REG-813, `StudentDayChoice`);
 * - la CTA dello step fa sempre avanzare: «Avanti» con una scelta, «Il lunedì
 *   non posso» senza (il salto rapido);
 * - in alto la settimana compatta si riempie man mano, cerchia il giorno della
 *   domanda e si tocca per tornare su un giorno;
 * - dopo la prima scelta, «Uguale per tutti i giorni» copia e va alla fine;
 * - dopo la domenica: «La tua settimana», l'editor completo, per ritoccare.
 *
 * Chi arriva con delle fasce già scelte (ritorno dal riepilogo, disponibilità
 * già salvate) parte dalla fine.
 *
 * Hook e non componente perché la CTA sta nello scheletro dello step: chi lo
 * usa mette `body` nella schermata e collega `ctaTitle` / `advance`.
 */
export function useGuidedAvailability({
  days,
  bands,
  rules = DEFAULT_RULES,
  onChange,
  dayHref,
  ready = true,
}: {
  days: StudentRangesByDay;
  bands: StudentAvailabilityBand[];
  /** REG-813 — regole di «Un orario preciso». */
  rules?: StudentRangeRules;
  onChange: (days: StudentRangesByDay) => void;
  /** Rotta del foglio del giorno (per i ritocchi alla fine). */
  dayHref: Href;
  /** Falso finché le disponibilità salvate non sono arrivate. */
  ready?: boolean;
}) {
  // 0–6 = domanda del giorno, WEEK.length = «La tua settimana».
  const [index, setIndex] = useState(() =>
    ready && hasAnyRange(days) ? WEEK.length : 0,
  );
  const started = useRef(ready);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    if (hasAnyRange(days)) setIndex(WEEK.length);
  }, [ready, days]);

  const overview = index >= WEEK.length;
  const day = overview ? null : WEEK[index];
  const selected = day ? (days[day.key] ?? []) : [];

  // «Uguale per tutti i giorni» ha senso solo con una scelta e dei giorni davanti.
  const shortcut = !overview && selected.length > 0 && index < WEEK.length - 1;

  const jumpTo = (key: DayKey) =>
    setIndex(WEEK.findIndex((d) => d.key === key));

  const body = overview ? (
    <Animated.View entering={fadeIn}>
      <StudentAvailabilityEditor
        days={days}
        bands={bands}
        rules={rules}
        onChange={onChange}
        dayHref={dayHref}
      />
    </Animated.View>
  ) : (
    <View>
      <StudentWeekStrip
        days={days}
        bands={bands}
        compact
        current={day!.key}
        onPressDay={jumpTo}
        pressLabel={(name) => `${name}, vai a questo giorno`}
      />
      {/* Solo la domanda si rimonta (dissolvenza): le righe restano le stesse. */}
      <Animated.Text
        key={day!.key}
        entering={fadeIn}
        style={s.question}
        testID="guided-question"
      >
        Di solito {withArticle(day!)} sei libero…
      </Animated.Text>
      {/* Una `key` per giorno: la via scelta (fasce o orario preciso) nasce dagli orari di QUEL giorno. */}
      <StudentDayChoice
        key={day!.key}
        ranges={selected}
        bands={bands}
        rules={rules}
        onChange={(next) => onChange({ ...days, [day!.key]: next })}
        testPrefix="guided"
      />
      {shortcut ? (
        <Animated.View entering={fadeIn}>
          <ClayList style={s.gap}>
            <ClayListRow
              title="Uguale per tutti i giorni"
              subtitle="Copia su tutta la settimana"
              onPress={() => {
                onChange(sameForAll(selected));
                setIndex(WEEK.length);
              }}
              testID="guided-same-all"
            />
          </ClayList>
        </Animated.View>
      ) : null}
    </View>
  );

  return {
    body,
    /** Per `revealKey` dello scheletro: porta in vista la scorciatoia, torna in cima alla fine. */
    revealKey: overview ? "top" : shortcut ? `same-${index}` : undefined,
    /** Vero su «La tua settimana»: la CTA è quella dello step («Continua»). */
    overview,
    /** Titolo della CTA durante le domande. */
    ctaTitle: overview
      ? null
      : selected.length
        ? "Avanti"
        : `${capital(withArticle(day!))} non posso`,
    /** Passa al giorno dopo (o a «La tua settimana»). */
    advance: () => setIndex((i) => Math.min(i + 1, WEEK.length)),
  };
}

const s = StyleSheet.create({
  question: {
    fontSize: 19,
    fontWeight: "600",
    color: CLAY.ink,
    letterSpacing: -0.4,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  gap: { marginTop: 14 },
});
