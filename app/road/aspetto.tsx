import React from 'react';
import { Ionicons } from '@expo/vector-icons';

import { FormSheet } from '../../src/components/SheetScaffold';
import { ClayList, ClayListRow } from '../../src/components/clay';
import { roadNightMode, useRoadNightMode, type RoadNightMode } from '../../src/road/nightMode';
import { useSheetNight, SHEET_NIGHT } from '../../src/theme/night';
import { CLAY } from '../../src/theme';
import * as Haptics from '../../src/utils/haptics';

const OPTIONS: Array<{ value: RoadNightMode; title: string; subtitle: string }> = [
  { value: 'auto', title: 'Automatico', subtitle: 'Scuro dal tramonto all’alba' },
  { value: 'day', title: 'Giorno', subtitle: 'Sempre chiaro' },
  { value: 'night', title: 'Notte', subtitle: 'Sempre scuro' },
];

/**
 * Ricca 7 — «Aspetto» di Road: Automatico / Giorno / Notte. La scelta vale
 * subito (mappa, pannello e fogli) e resta salvata sul telefono. Il foglio
 * resta aperto: si vede il cambio e si chiude con la X.
 */
export default function RoadAspettoSheet() {
  const mode = useRoadNightMode();
  const night = useSheetNight();
  const check = <Ionicons name="checkmark" size={22} color={night ? SHEET_NIGHT.ink : CLAY.ink} accessibilityLabel="Selezionato" />;
  return (
    <FormSheet title="Aspetto" subtitle="Mappa e fogli di Road" testID="road-aspetto-sheet">
      <ClayList>
        {OPTIONS.map((o) => (
          <ClayListRow
            key={o.value}
            title={o.title}
            subtitle={o.subtitle}
            chevron={false}
            trailing={mode === o.value ? check : null}
            onPress={() => {
              if (o.value === mode) return;
              Haptics.selectionAsync().catch(() => undefined);
              roadNightMode.set(o.value);
            }}
            testID={`road-aspetto-${o.value}`}
          />
        ))}
      </ClayList>
    </FormSheet>
  );
}
