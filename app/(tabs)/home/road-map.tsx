import React, { useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClayIconButton } from '../../../src/components/clay';
import { CLAY, CLAY_SHADOW } from '../../../src/theme';
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
        stops={detail.stops}
        interactive
        labeled
        style={StyleSheet.absoluteFill}
        edgePadding={56}
      />
      <View style={[s.bar, { top: insets.top + 8 }]}>
        <View style={[s.chip, CLAY_SHADOW.raiseSm]}>
          <Text style={s.chipTx}>
            {formatKm(detail.distanceMeters)} km · {formatMinutes(detail.durationSec)} min
          </Text>
        </View>
        <ClayIconButton icon="close" onPress={() => router.back()} accessibilityLabel="Chiudi" testID="sheet-close" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Numeri della guida in una capsula bianca in rilievo sopra la mappa.
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: 'center',
    backgroundColor: CLAY.surface,
  },
  chipTx: { fontSize: 14.5, fontWeight: '600', color: CLAY.ink, fontVariant: ['tabular-nums'] },
});
