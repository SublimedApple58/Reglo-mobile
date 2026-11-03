import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';

import { useAutoscuolaSettings } from './queries/useAutoscuolaSettings';
import { useLocations } from './queries/useLocations';
import { useStackBase } from './useStackBase';
import { LONG_PICKER_THRESHOLD, optionsPickerStore } from '../stores/optionsPickerStore';
import type { TimeRange } from '../types/regloApi';

const ALL = '__all__';
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/**
 * Luogo delle fasce di disponibilità (REG-705c). `enabled` solo con
 * «Disponibilità per luogo» accesa sull'autoscuola e almeno due luoghi; spento,
 * gli editor restano identici a prima.
 *
 * `pickLocation` apre il form sheet «Luogo della fascia» (OptionsPickerSheet,
 * scelta singola che si applica al tocco) nello stack corrente.
 */
export function useRangeLocations() {
  const router = useRouter();
  const stackBase = useStackBase();
  const { data: settings } = useAutoscuolaSettings();
  const { data: locations } = useLocations();

  const list = useMemo(() => locations ?? [], [locations]);
  const enabled = settings?.availabilityByLocation === true && list.length >= 2;
  const names = useMemo(() => new Map(list.map((l) => [l.id, l.name])), [list]);

  /** Nome del luogo della fascia; `null` = tutti i luoghi (o luogo sparito). */
  const nameFor = useCallback(
    (r: TimeRange) => (r.locationId ? names.get(r.locationId) ?? null : null),
    [names],
  );

  /** «08:00–13:00 Sede · 14:30–18:30 Circuito Lingotto» per le righe di riepilogo. */
  const rangesText = useCallback(
    (ranges: TimeRange[]) =>
      ranges
        .map((r) => {
          const base = `${fmt(r.startMinutes)}–${fmt(r.endMinutes)}`;
          const name = enabled ? nameFor(r) : null;
          return name ? `${base} ${name}` : base;
        })
        .join(' · '),
    [enabled, nameFor],
  );

  const pickLocation = useCallback(
    (args: { range: TimeRange; dayLabel?: string | null; onPick: (locationId: string | null) => void }) => {
      const span = `${fmt(args.range.startMinutes)}–${fmt(args.range.endMinutes)}`;
      optionsPickerStore.set({
        title: 'Luogo della fascia',
        hint: `${args.dayLabel ? `${args.dayLabel} ` : ''}${span} vale per gli allievi di questo luogo.`,
        multi: false,
        tone: 'mono',
        selected: [args.range.locationId ?? ALL],
        options: [
          { value: ALL, label: 'Tutti i luoghi', subtitle: 'Vale per ogni allievo' },
          ...list.map((l) => ({
            value: l.id,
            label: l.name,
            subtitle: l.isPrecise && l.address ? l.address : 'Posizione generica',
          })),
        ],
        onConfirm: (vals) => {
          const v = vals[0];
          args.onPick(!v || v === ALL ? null : v);
        },
      });
      const long = list.length + 1 > LONG_PICKER_THRESHOLD;
      router.push(`/(tabs)/${stackBase}/select-options${long ? '-long' : ''}`);
    },
    [list, router, stackBase],
  );

  return { enabled, nameFor, rangesText, pickLocation };
}
