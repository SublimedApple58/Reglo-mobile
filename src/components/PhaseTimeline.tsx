import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { AutoscuolaStudentPhase } from '../types/regloApi';

/**
 * Timeline verticale "a itinerario" (stile Airbnb) del percorso allievo.
 * Sostituisce il vecchio stepper orizzontale. Ogni step ha la sua
 * icona 3D clay (tinta navy), titolo e sottotitolo; lo step corrente è
 * evidenziato con anello navy + pill "In corso", quelli futuri sono smorzati.
 */

type Step = {
  key: AutoscuolaStudentPhase;
  label: string;
  sub: string;
  source: number;
};

const STEPS: Step[] = [
  {
    key: 'AWAITING',
    label: 'In attesa',
    sub: 'Stiamo attivando il tuo accesso',
    source: require('../../assets/icons-3d/clock.png'),
  },
  {
    key: 'TEORIA',
    label: 'Teoria',
    sub: "Quiz e lezioni per l'esame di teoria",
    source: require('../../assets/icons-3d/notebook.png'),
  },
  {
    key: 'PRATICA',
    label: 'Foglio rosa',
    sub: 'Inizi le guide in auto',
    source: require('../../assets/icons-3d/file-text.png'),
  },
  {
    key: 'PATENTATO',
    label: 'Patente',
    sub: 'Pronto a metterti al volante',
    source: require('../../assets/icons-3d/license.png'),
  },
];

type Props = {
  phase: AutoscuolaStudentPhase;
};

export const PhaseTimeline: React.FC<Props> = ({ phase }) => {
  const activeIndex = STEPS.findIndex((s) => s.key === phase);

  return (
    <Animated.View entering={FadeIn.duration(280)}>
      {STEPS.map((step, idx) => {
        const isActive = idx === activeIndex;
        const isDone = idx < activeIndex;
        const isLast = idx === STEPS.length - 1;
        const state = isActive ? 'active' : isDone ? 'done' : 'future';

        return (
          <View key={step.key} style={styles.row}>
            {/* node column + connector */}
            <View style={styles.nodeCol}>
              <View
                style={[
                  styles.node,
                  state === 'active' && styles.nodeActive,
                  state === 'done' && styles.nodeDone,
                ]}
              >
                <Image
                  source={step.source}
                  resizeMode="contain"
                  style={[styles.icon, state === 'future' && styles.iconFuture]}
                  accessibilityLabel={`Step ${step.label}`}
                />
              </View>
              {!isLast && (
                <View
                  style={[styles.connector, isDone && styles.connectorDone]}
                />
              )}
            </View>

            {/* text column */}
            <View style={[styles.textCol, isLast && styles.textColLast]}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.title,
                    state === 'future' && styles.titleFuture,
                  ]}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
                {isActive && (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>In corso</Text>
                  </View>
                )}
              </View>
              <Text
                style={[styles.sub, state === 'future' && styles.subFuture]}
                numberOfLines={2}
              >
                {step.sub}
              </Text>
            </View>
          </View>
        );
      })}
    </Animated.View>
  );
};

const NODE = 56;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  nodeCol: {
    width: NODE,
    alignItems: 'center',
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    backgroundColor: colors.navy[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeActive: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 4,
  },
  nodeDone: {
    backgroundColor: colors.navy[50],
  },
  icon: {
    width: 38,
    height: 38,
  },
  iconFuture: {
    opacity: 0.6,
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 18,
    backgroundColor: colors.border,
    marginVertical: 4,
    borderRadius: 1,
  },
  connectorDone: {
    backgroundColor: colors.primary,
  },
  textCol: {
    flex: 1,
    paddingLeft: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  textColLast: {
    paddingBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  titleFuture: {
    color: colors.textMuted,
  },
  sub: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    color: colors.textSecondary,
  },
  subFuture: {
    color: colors.navy[300],
  },
  pill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: colors.surface,
  },
});

export default PhaseTimeline;
