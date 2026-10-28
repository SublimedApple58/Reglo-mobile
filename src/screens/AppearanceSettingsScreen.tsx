import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { ClayEmpty, ClayList, ClayListRow, ClaySection, ClaySegmented, ClayToggle } from '../components/clay';
import { ClayPageHeader } from '../components/ClayPageHeader';
import { CLAY } from '../theme/clay';
import { useSession } from '../context/SessionContext';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { queryKeys } from '../hooks/queries/queryKeys';
import { regloApi } from '../services/regloApi';
import { isInstructor, isOwner } from '../utils/roles';
import type {
  AgendaColorCriterion,
  AgendaColorExceptions,
  AgendaColorOverrides,
} from '../types/regloApi';
import {
  AGENDA_COLOR_CRITERIA,
  AGENDA_SWATCHES,
  AUTOMATIC_MARKER_WIDTH,
  DEFAULT_AUTOMATIC_MARKER_COLOR,
  DURATION_COLOR_ENTRIES,
  previewColor,
  entriesForCriterion,
  resolveColorOverride,
  exceptionsForCriterion,
  overrideNamespaceForCriterion,
  resolveAgendaColorConfig,
  vividHex,
} from '../utils/agendaColors';
import { colorPickerStore } from '../stores/colorPickerStore';

const CRITERIA_LABEL: Record<AgendaColorCriterion, string> = {
  durata: 'Durata',
  patente: 'Patente',
};


/**
 * Aspetto agenda — REG-639 clay: testata grande con l'indietro clay, criterio
 * come segmentato clay, colori ed eccezioni come liste clay (il pallino del
 * colore è un dato di prodotto: resta, a destra), interruttori clay, note
 * sotto le sezioni. Auto-save con rollback, come prima.
 */
export const AppearanceSettingsScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeCompanyId, autoscuolaRole } = useSession();
  const queryClient = useQueryClient();
  const settingsQ = useAutoscuolaSettings();

  const [criterion, setCriterion] = useState<AgendaColorCriterion>('durata');
  const [overrides, setOverrides] = useState<AgendaColorOverrides>({});
  const [exceptions, setExceptions] = useState<AgendaColorExceptions>({});
  // REG-622: bordo sulle guide a cambio automatico (color null = nero standard).
  const [marker, setMarker] = useState<{ enabled: boolean; color: string | null }>({
    enabled: true,
    color: null,
  });
  // REG-633: nome del veicolo nei blocchi del calendario.
  const [showVehicle, setShowVehicle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  // Seed una sola volta dai settings company (poi la UI è la source of truth,
  // con auto-save + rollback su errore).
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !settingsQ.data) return;
    const cfg = resolveAgendaColorConfig(settingsQ.data);
    setCriterion(cfg.criterion);
    setOverrides(cfg.overrides);
    setExceptions(cfg.exceptions);
    setMarker(cfg.automaticMarker);
    setShowVehicle(settingsQ.data.agendaShowVehicle === true);
    seededRef.current = true;
  }, [settingsQ.data]);

  const persist = useCallback(
    async (next: { criterion: AgendaColorCriterion; overrides: AgendaColorOverrides; exceptions: AgendaColorExceptions }) => {
      setSaving(true);
      try {
        const updated = await regloApi.updateAgendaColorSettings({
          agendaColorCriterion: next.criterion,
          agendaColorOverrides: next.overrides,
          agendaColorExceptions: next.exceptions,
        });
        queryClient.setQueryData(queryKeys.autoscuolaSettings(activeCompanyId), updated);
      } catch {
        setToast({ text: 'Errore nel salvataggio', tone: 'danger' });
        const cfg = resolveAgendaColorConfig(settingsQ.data);
        setCriterion(cfg.criterion);
        setOverrides(cfg.overrides);
        setExceptions(cfg.exceptions);
      } finally {
        setSaving(false);
      }
    },
    [activeCompanyId, queryClient, settingsQ.data],
  );

  const apply = useCallback(
    (partial: Partial<{ criterion: AgendaColorCriterion; overrides: AgendaColorOverrides; exceptions: AgendaColorExceptions }>) => {
      const next = { criterion, overrides, exceptions, ...partial };
      setCriterion(next.criterion);
      setOverrides(next.overrides);
      setExceptions(next.exceptions);
      persist(next);
    },
    [criterion, overrides, exceptions, persist],
  );

  const applyMarker = useCallback(
    async (next: { enabled: boolean; color: string | null }) => {
      setMarker(next);
      setSaving(true);
      try {
        const updated = await regloApi.updateAgendaColorSettings({
          automaticLessonMarker: next.enabled,
          automaticLessonMarkerColor: next.color,
        });
        queryClient.setQueryData(queryKeys.autoscuolaSettings(activeCompanyId), updated);
      } catch {
        setToast({ text: 'Errore nel salvataggio', tone: 'danger' });
        setMarker(resolveAgendaColorConfig(settingsQ.data).automaticMarker);
      } finally {
        setSaving(false);
      }
    },
    [activeCompanyId, queryClient, settingsQ.data],
  );

  const applyShowVehicle = useCallback(
    async (next: boolean) => {
      setShowVehicle(next);
      setSaving(true);
      try {
        const updated = await regloApi.updateAgendaColorSettings({ agendaShowVehicle: next });
        queryClient.setQueryData(queryKeys.autoscuolaSettings(activeCompanyId), updated);
      } catch {
        setToast({ text: 'Errore nel salvataggio', tone: 'danger' });
        setShowVehicle(settingsQ.data?.agendaShowVehicle === true);
      } finally {
        setSaving(false);
      }
    },
    [activeCompanyId, queryClient, settingsQ.data],
  );

  const openMarkerPicker = () => {
    colorPickerStore.set({
      title: 'Colore del bordo',
      currentHex: marker.color,
      swatches: AGENDA_SWATCHES,
      resetLabel: 'Nero (standard)',
      resetHex: DEFAULT_AUTOMATIC_MARKER_COLOR,
      onSelect: (hex) => applyMarker({ enabled: true, color: hex ? hex.toUpperCase() : null }),
    });
    router.push('/(tabs)/more/color-picker');
  };

  const setEntryOverride = useCallback(
    (key: string, hex: string | null) => {
      const nsp = overrideNamespaceForCriterion(criterion);
      const nsMap = { ...(overrides[nsp] ?? {}) };
      if (hex) nsMap[key] = hex.toUpperCase();
      else delete nsMap[key];
      apply({ overrides: { ...overrides, [nsp]: nsMap } });
    },
    [criterion, overrides, apply],
  );

  const setExceptionOverride = useCallback(
    (key: string, hex: string | null) => {
      const ecc = { ...(overrides.eccezioni ?? {}) };
      if (hex) ecc[key] = hex.toUpperCase();
      else delete ecc[key];
      apply({ overrides: { ...overrides, eccezioni: ecc } });
    },
    [overrides, apply],
  );

  const openEntryPicker = (label: string, key: string) => {
    const nsp = overrideNamespaceForCriterion(criterion);
    colorPickerStore.set({
      title: label,
      currentHex: overrides[nsp]?.[key] ?? null,
      swatches: AGENDA_SWATCHES,
      onSelect: (hex) => setEntryOverride(key, hex),
    });
    router.push('/(tabs)/more/color-picker');
  };

  const openExceptionPicker = (label: string, key: string) => {
    colorPickerStore.set({
      title: label,
      currentHex: overrides.eccezioni?.[key] ?? null,
      swatches: AGENDA_SWATCHES,
      onSelect: (hex) => setExceptionOverride(key, hex),
    });
    router.push('/(tabs)/more/color-picker');
  };

  const entries = useMemo(() => entriesForCriterion(criterion), [criterion]);
  const activeExceptions = useMemo(() => exceptionsForCriterion(criterion), [criterion]);
  const activeExcCount = useMemo(
    () => activeExceptions.filter((e) => exceptions[e.key] ?? e.defaultEnabled).length,
    [activeExceptions, exceptions],
  );
  const ns = overrideNamespaceForCriterion(criterion);

  const canEdit = isOwner(autoscuolaRole) || isInstructor(autoscuolaRole);
  const loading = settingsQ.isLoading && !settingsQ.data;
  const markerName = marker.color
    ? (AGENDA_SWATCHES.find((sw) => sw.hex === marker.color)?.name ?? 'Personalizzato')
    : 'Nero';

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
        <ClayPageHeader
          title="Aspetto agenda"
          onBack={() => router.back()}
          actions={saving ? <ActivityIndicator size="small" color={CLAY.ink3} /> : null}
        />

        {!canEdit ? (
          <ClayEmpty title="Riservato allo staff dell'autoscuola." />
        ) : loading ? (
          <View style={s.center}><ActivityIndicator color={CLAY.ink} /></View>
        ) : (
          <>
            <ClaySection title="Criterio">
              <ClaySegmented
                options={AGENDA_COLOR_CRITERIA.map((c) => ({ value: c, label: CRITERIA_LABEL[c] }))}
                value={criterion}
                onChange={(c) => { if (c !== criterion) apply({ criterion: c }); }}
                testID="appearance-criterion"
              />
            </ClaySection>

            <ClaySection title="Colori">
              <ClayList>
                {entries.map((e) => (
                  <ClayListRow
                    key={e.key}
                    title={e.label}
                    trailing={<Swatch color={vividHex(e, resolveColorOverride(e, overrides[ns]))} />}
                    onPress={() => openEntryPicker(e.label, e.key)}
                  />
                ))}
              </ClayList>
            </ClaySection>

            {activeExceptions.length > 0 ? (
              <ClaySection
                title="Eccezioni"
                action={activeExcCount > 0 ? <Text style={s.count}>{activeExcCount === 1 ? '1 attiva' : `${activeExcCount} attive`}</Text> : null}
              >
                <ClayList>
                  {activeExceptions.map((exc) => {
                    const on = exceptions[exc.key] ?? exc.defaultEnabled;
                    return (
                      <ToggleRow
                        key={exc.key}
                        title={exc.label}
                        value={on}
                        onValueChange={(v) => apply({ exceptions: { ...exceptions, [exc.key]: v } })}
                        accessory={
                          on ? (
                            <Pressable
                              onPress={() => openExceptionPicker(exc.label, exc.key)}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`Colore di ${exc.label}`}
                            >
                              <Swatch color={vividHex(exc.entry, overrides.eccezioni?.[exc.key])} />
                            </Pressable>
                          ) : null
                        }
                      />
                    );
                  })}
                </ClayList>
              </ClaySection>
            ) : null}

            {/* ── Guide automatiche (REG-622): bordo, non colore ── */}
            <ClaySection
              title="Guide automatiche"
              footnote="Le guide con veicolo o percorso a cambio automatico tengono il loro colore e hanno in più un bordo."
            >
              <ClayList>
                <ToggleRow
                  title="Contrassegna le guide con mezzi automatici"
                  value={marker.enabled}
                  onValueChange={(v) => applyMarker({ ...marker, enabled: v })}
                />
                {marker.enabled ? (
                  <ClayListRow
                    title="Colore del bordo"
                    subtitle={markerName}
                    trailing={
                      <View
                        style={[
                          s.markerPreview,
                          {
                            backgroundColor: previewColor(DURATION_COLOR_ENTRIES[2], overrides.durata?.[DURATION_COLOR_ENTRIES[2].key]),
                            borderColor: marker.color ?? DEFAULT_AUTOMATIC_MARKER_COLOR,
                          },
                        ]}
                      />
                    }
                    onPress={openMarkerPicker}
                  />
                ) : null}
              </ClayList>
            </ClaySection>

            {/* ── Veicolo nei blocchi (REG-633), solo col modulo veicoli ── */}
            {settingsQ.data?.vehiclesEnabled !== false ? (
              <ClaySection
                title="Veicolo"
                footnote="Sotto il nome dell'allievo compare il mezzo della guida, nel calendario e sul web. Per le guide moto anche l'auto al seguito."
              >
                <ClayList>
                  <ToggleRow
                    title="Mostra il veicolo nei blocchi delle guide"
                    value={showVehicle}
                    onValueChange={applyShowVehicle}
                  />
                </ClayList>
              </ClaySection>
            ) : null}
          </>
        )}
      </ScrollView>
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
    </View>
  );
};

/** Pallino del colore di una voce (dato di prodotto, non decorazione). */
const Swatch = ({ color }: { color: string }) => <View style={[s.dot, { backgroundColor: color }]} />;

/**
 * Riga con interruttore dentro una `ClayList`: il titolo va a capo (non
 * tronca), `accessory` sta prima dell'interruttore. Il separatore lo passa
 * la lista (`divider`).
 */
function ToggleRow({
  title,
  value,
  onValueChange,
  accessory,
  divider,
}: {
  title: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  accessory?: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <View style={s.toggleRow}>
      {divider ? <View style={s.divider} /> : null}
      <Text style={s.toggleTitle}>{title}</Text>
      {accessory}
      <ClayToggle value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 140 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  count: { fontSize: 14, color: CLAY.ink3 },

  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(17,17,17,0.12)' },
  // Mini blocco guida col bordo: anteprima a colpo d'occhio di come appare in agenda.
  markerPreview: { width: 34, height: 24, borderRadius: 7, borderWidth: AUTOMATIC_MARKER_WIDTH },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 18, minHeight: 56 },
  divider: { position: 'absolute', top: 0, left: 18, right: 18, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(17,17,17,0.12)' },
  toggleTitle: { flex: 1, minWidth: 0, fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.25, lineHeight: 21 },
});
