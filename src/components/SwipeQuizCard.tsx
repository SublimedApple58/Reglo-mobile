import React, { useCallback, useImperativeHandle, forwardRef } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_H = Math.min(SCREEN_H * 0.48, 420);
const SWIPE_THRESHOLD = SCREEN_W * 0.22;
const FLY_OUT_X = SCREEN_W * 1.4;
const MAX_ROTATION = 10;

type Question = {
  id: string;
  questionText: string;
  imageUrl: string | null;
  correctAnswer: boolean;
};

export type SwipeQuizCardRef = {
  flyOut: (right: boolean) => void;
};

type Props = {
  question: Question;
  nextQuestion: Question | null;
  onAnswer: (answer: boolean) => void;
  disabled?: boolean;
};

export const SwipeQuizCard = forwardRef<SwipeQuizCardRef, Props>(
  ({ question, nextQuestion, onAnswer, disabled }, ref) => {
    const translateX = useSharedValue(0);
    const isGone = useSharedValue(false);

    const triggerAnswer = useCallback((answer: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onAnswer(answer);
    }, [onAnswer]);

    const animateOut = useCallback((right: boolean) => {
      if (isGone.value) return;
      isGone.value = true;
      translateX.value = withTiming(
        right ? FLY_OUT_X : -FLY_OUT_X,
        { duration: 220 },
        () => runOnJS(triggerAnswer)(right),
      );
    }, [triggerAnswer]);

    // Expose flyOut to parent (for button taps)
    useImperativeHandle(ref, () => ({ flyOut: animateOut }), [animateOut]);

    const pan = Gesture.Pan()
      .enabled(!disabled && !isGone.value)
      .activeOffsetX([-15, 15])
      .onUpdate((e) => { translateX.value = e.translationX; })
      .onEnd((e) => {
        const fast = Math.abs(e.velocityX) > 600;
        const far = Math.abs(e.translationX) > SWIPE_THRESHOLD;
        if (fast || far) {
          const right = e.translationX > 0;
          isGone.value = true;
          translateX.value = withTiming(
            right ? FLY_OUT_X : -FLY_OUT_X,
            { duration: 220 },
            () => runOnJS(triggerAnswer)(right),
          );
        } else {
          // Tight snap-back — fast, minimal bounce
          translateX.value = withSpring(0, { damping: 26, stiffness: 400 });
        }
      });

    const cardStyle = useAnimatedStyle(() => {
      const rotate = interpolate(translateX.value, [-SCREEN_W * 0.4, 0, SCREEN_W * 0.4], [-MAX_ROTATION, 0, MAX_ROTATION], Extrapolation.CLAMP);
      return { transform: [{ translateX: translateX.value }, { rotate: `${rotate}deg` }] };
    });

    const borderColorStyle = useAnimatedStyle(() => {
      const c = interpolateColor(
        translateX.value,
        [-SWIPE_THRESHOLD, -10, 0, 10, SWIPE_THRESHOLD],
        ['#FCA5A5', '#E5E7EB', '#E5E7EB', '#E5E7EB', '#86EFAC'],
      );
      const w = interpolate(Math.abs(translateX.value), [0, SWIPE_THRESHOLD], [1, 3], Extrapolation.CLAMP);
      return { borderColor: c, borderWidth: w };
    });

    const veroOpacity = useAnimatedStyle(() => ({
      opacity: interpolate(translateX.value, [20, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    }));
    const falsoOpacity = useAnimatedStyle(() => ({
      opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, -20], [1, 0], Extrapolation.CLAMP),
    }));

    const backStyle = useAnimatedStyle(() => {
      const s = interpolate(Math.abs(translateX.value), [0, SWIPE_THRESHOLD], [0.94, 1], Extrapolation.CLAMP);
      const o = interpolate(Math.abs(translateX.value), [0, SWIPE_THRESHOLD * 0.6], [0.4, 1], Extrapolation.CLAMP);
      return { transform: [{ scale: s }], opacity: o };
    });

    return (
      <GestureHandlerRootView style={st.container}>
        {nextQuestion && (
          <Animated.View style={[st.card, st.backCard, backStyle]}>
            <View style={st.backCardInner}>
              <Text style={st.backCardText} numberOfLines={3}>{nextQuestion.questionText}</Text>
            </View>
          </Animated.View>
        )}

        <GestureDetector gesture={pan}>
          <Animated.View style={[st.card, cardStyle, borderColorStyle]}>
            <Animated.View style={[st.stamp, st.stampLeft, veroOpacity]} pointerEvents="none">
              <Text style={[st.stampText, { color: '#16A34A' }]}>VERO</Text>
            </Animated.View>
            <Animated.View style={[st.stamp, st.stampRight, falsoOpacity]} pointerEvents="none">
              <Text style={[st.stampText, { color: '#EF4444' }]}>FALSO</Text>
            </Animated.View>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={st.cardContent}>
              {question.imageUrl && (
                <View style={st.imageWrap}>
                  <Image source={{ uri: question.imageUrl }} style={st.image} resizeMode="contain" />
                </View>
              )}
              <Text style={st.questionText}>{question.questionText}</Text>
            </ScrollView>

            <View style={st.hintRow}>
              <Text style={st.hintText}>{'← FALSO'}</Text>
              <Text style={st.hintDot}>{'·'}</Text>
              <Text style={st.hintText}>{'VERO →'}</Text>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    );
  },
);

const CARD_W = SCREEN_W - spacing.md * 2;

const st = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: CARD_W, maxHeight: CARD_H,
    backgroundColor: '#FFFFFF', borderRadius: 24,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
  },
  backCard: { position: 'absolute' },
  backCardInner: { padding: 24, justifyContent: 'center', minHeight: 120 },
  backCardText: { fontSize: 16, fontWeight: '600', color: colors.textMuted, lineHeight: 24 },
  stamp: {
    position: 'absolute', top: 16, zIndex: 20,
    paddingVertical: 4, paddingHorizontal: 14,
    borderWidth: 3, borderRadius: 8,
  },
  stampLeft: { left: 16, borderColor: '#16A34A', transform: [{ rotate: '-12deg' }] },
  stampRight: { right: 16, borderColor: '#EF4444', transform: [{ rotate: '12deg' }] },
  stampText: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  cardContent: { padding: 20, paddingTop: 48, gap: 0 },
  imageWrap: {
    backgroundColor: '#1A1A2E', borderRadius: 16, marginBottom: 16,
    paddingVertical: 20, alignItems: 'center', overflow: 'hidden',
  },
  image: { width: '75%', height: 140 },
  questionText: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', lineHeight: 26, letterSpacing: -0.2 },
  hintRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0F0F5',
  },
  hintText: { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.5 },
  hintDot: { fontSize: 12, color: colors.textMuted },
});
