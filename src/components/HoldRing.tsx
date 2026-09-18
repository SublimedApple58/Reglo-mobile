import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/**
 * Anello di avanzamento pilotato da uno shared value 0→1 (REG-450).
 *
 * Stessa tecnica di `ProgressRing`: due semidischi che ruotano dentro due
 * maschere, **niente SVG** — così viaggia via OTA senza toccare il binario.
 * A differenza di `ProgressRing`, che anima da sé un valore fisso al mount,
 * questo segue il dito: il riempimento è il tempo di pressione.
 *
 * A riposo (`progress` 0) resta un cerchietto vuoto: è anche il segno statico
 * che su quella riga c'è qualcosa da tenere premuto — ha preso il posto dei
 * tre puntini, che invece non facevano niente.
 */
export function HoldRing({
  progress,
  size = 26,
  stroke = 2.5,
  color = '#067647',
  trackColor = '#E4E4EA',
  innerColor = '#FDFDFD',
}: {
  progress: SharedValue<number>;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  innerColor?: string;
}) {
  const half = size / 2;

  // Primo mezzo giro: ruota il semidisco destro. Secondo mezzo giro: il sinistro.
  const rightAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${Math.min(progress.value, 0.5) * 360}deg` }],
  }));
  const leftAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${Math.max(progress.value - 0.5, 0) * 360}deg` }],
  }));

  const fill = (side: 'left' | 'right') => ({
    width: half,
    height: size,
    backgroundColor: color,
    ...(side === 'right'
      ? { borderTopLeftRadius: half, borderBottomLeftRadius: half }
      : { borderTopRightRadius: half, borderBottomRightRadius: half }),
  });

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: half,
          backgroundColor: trackColor,
        }}
      />

      <View
        style={{ position: 'absolute', left: half, top: 0, width: half, height: size, overflow: 'hidden' }}
      >
        <Animated.View
          style={[
            { position: 'absolute', left: -half, top: 0, width: half, height: size, transformOrigin: 'right center' },
            rightAnim,
          ]}
        >
          <View style={fill('right')} />
        </Animated.View>
      </View>

      <View
        style={{ position: 'absolute', left: 0, top: 0, width: half, height: size, overflow: 'hidden' }}
      >
        <Animated.View
          style={[
            { position: 'absolute', left: half, top: 0, width: half, height: size, transformOrigin: 'left center' },
            leftAnim,
          ]}
        >
          <View style={fill('left')} />
        </Animated.View>
      </View>

      {/* Buco centrale: è questo che trasforma il disco in anello. */}
      <View
        style={{
          position: 'absolute',
          left: stroke,
          top: stroke,
          width: size - stroke * 2,
          height: size - stroke * 2,
          borderRadius: (size - stroke * 2) / 2,
          backgroundColor: innerColor,
        }}
      />
    </View>
  );
}
