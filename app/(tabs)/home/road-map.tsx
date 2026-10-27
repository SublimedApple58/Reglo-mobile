import React, { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCloseButton } from '../../../src/components/GlassCloseButton';
import { RoadRouteMap } from '../../../src/components/road/RoadMiniMap';
import { roadRouteMapStore } from '../../../src/road/routeMapStore';
import { formatKm, formatMinutes } from '../../../src/road/format';

/**
 * REG-638 — percorso di una guida a tutto schermo (dal dettaglio guida
 * dell'allievo): mappa interattiva con le segnalazioni etichettate.
 */
export default function RoadMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const live = useSyncExternalStore(roadRouteMapStore.subscribe, roadRouteMapStore.get);
  const [detail] = useState(() => live);

  if (!detail) return <View style={s.root} />;

  return (
    <View style={s.root}>
      <RoadRouteMap
        track={detail.track}
        markers={detail.markers}
        interactive
        labeled
        style={StyleSheet.absoluteFill}
        edgePadding={56}
      />
      <View style={[s.bar, { top: insets.top + 8 }]}>
        <View style={s.chip}>
          <BlurView intensity={70} tint="systemChromeMaterialLight" style={StyleSheet.absoluteFill} />
          <View style={s.chipTint} />
          <Text style={s.chipTx}>
            {formatKm(detail.distanceMeters)} km · {formatMinutes(detail.durationSec)} min
          </Text>
        </View>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.x}>
            <Ionicons name="close" size={20} color="#111111" />
          </Pressable>
        </GlassCloseButton>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F1EA' },
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  chipTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.6)' },
  chipTx: { fontSize: 14, fontWeight: '600', color: '#111111' },
  x: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
