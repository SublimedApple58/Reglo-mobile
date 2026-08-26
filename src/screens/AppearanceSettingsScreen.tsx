import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '../components/Screen';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { useSession } from '../context/SessionContext';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { queryKeys } from '../hooks/queries/queryKeys';
import { regloApi } from '../services/regloApi';
import { isInstructor, isOwner } from '../utils/roles';
import { colors, spacing } from '../theme';
import type {
  AgendaColorCriterion,
  AgendaColorExceptions,
  AgendaColorOverrides,
} from '../types/regloApi';
import {
  AGENDA_COLOR_CRITERIA,
  AGENDA_SWATCHES,
  entriesForCriterion,
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

export const AppearanceSettingsScreen = () => {
  const router = useRouter();
  const { activeCompanyId, autoscuolaRole } = useSession();
  const queryClient = useQueryClient();
  const settingsQ = useAutoscuolaSettings();

  const [criterion, setCriterion] = useState<AgendaColorCriterion>('durata');
  const [overrides, setOverrides] = useState<AgendaColorOverrides>({});
  const [exceptions, setExceptions] = useState<AgendaColorExceptions>({});
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
  if (!canEdit) {
    return (
      <Screen>
        <Header onBack={() => router.back()} saving={false} />
        <View style={s.center}>
          <Text style={s.muted}>Riservato allo staff dell&apos;autoscuola.</Text>
        </View>
      </Screen>
    );
  }

  const loading = settingsQ.isLoading && !settingsQ.data;

  return (
    <Screen>
      <Header onBack={() => router.back()} saving={saving} />
      {loading ? (
        <View style={s.center}><ActivityIndicator color="#1A1A2E" /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Criterio: segmented ─────────────── */}
          <Text style={s.sectionLabel}>CRITERIO</Text>
          <View style={s.segment}>
            {AGENDA_COLOR_CRITERIA.map((c) => {
              const active = criterion === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => { if (!active) apply({ criterion: c }); }}
                  style={[s.segmentItem, active && s.segmentItemActive]}
                >
                  <Text style={[s.segmentText, active && s.segmentTextActive]}>{CRITERIA_LABEL[c]}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Colori (lista piatta) ───────────── */}
          <Text style={s.sectionLabel}>COLORI</Text>
          <View style={s.list}>
            {entries.map((e, i) => (
              <View key={e.key}>
                {i > 0 ? <View style={s.divider} /> : null}
                <Pressable onPress={() => openEntryPicker(e.label, e.key)} style={({ pressed }) => [s.row, pressed && s.rowPressed]}>
                  <View style={[s.dot, { backgroundColor: vividHex(e, overrides[ns]?.[e.key]) }]} />
                  <Text style={s.rowLabel} numberOfLines={1}>{e.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
                </Pressable>
              </View>
            ))}
          </View>

          {/* ── Eccezioni (lista piatta) ────────── */}
          {activeExceptions.length > 0 ? (
            <>
              <View style={s.sectionHeaderRow}>
                <Text style={s.sectionLabel}>ECCEZIONI</Text>
                {activeExcCount > 0 ? (
                  <View style={s.countBadge}><Text style={s.countBadgeText}>{activeExcCount}</Text></View>
                ) : null}
              </View>
              <View style={s.list}>
                {activeExceptions.map((exc, i) => {
                  const on = exceptions[exc.key] ?? exc.defaultEnabled;
                  return (
                    <View key={exc.key}>
                      {i > 0 ? <View style={s.divider} /> : null}
                      <View style={s.row}>
                        {on ? (
                          <Pressable onPress={() => openExceptionPicker(exc.label, exc.key)} hitSlop={8}>
                            <View style={[s.dot, { backgroundColor: vividHex(exc.entry, overrides.eccezioni?.[exc.key]) }]} />
                          </Pressable>
                        ) : (
                          <View style={[s.dot, s.dotOff]} />
                        )}
                        <Text style={s.rowLabel} numberOfLines={1}>{exc.label}</Text>
                        <ToggleSwitch value={on} onValueChange={(v) => apply({ exceptions: { ...exceptions, [exc.key]: v } })} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
    </Screen>
  );
};

const Header = ({ onBack, saving }: { onBack: () => void; saving: boolean }) => (
  <View style={s.header}>
    <Pressable onPress={onBack} hitSlop={8} style={s.backBtn}>
      <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
    </Pressable>
    <Text style={s.headerTitle}>Aspetto agenda</Text>
    <View style={s.headerRight}>{saving ? <ActivityIndicator size="small" color="#94A3B8" /> : null}</View>
  </View>
);

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: 8, paddingBottom: 8, gap: 8 },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.4 },
  headerRight: { width: 34, alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 48 },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.6, marginTop: 26, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginTop: 16 },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },

  // Segmented control: capsula (pillola) — stesso riferimento delle tab
  // "Una volta/Ricorrente" (availability-exception): track grigio, pillola bianca.
  segment: { flexDirection: 'row', backgroundColor: '#EBEBEB', borderRadius: 999, padding: 4, gap: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  segmentItemActive: { backgroundColor: '#FFFFFF', shadowColor: '#1A1A2E', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  segmentTextActive: { color: '#1A1A2E', fontWeight: '700' },

  // Liste piatte su sfondo pagina (no card-in-card), divisori inset.
  list: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, minHeight: 56 },
  rowPressed: { opacity: 0.55 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBEDF0', marginLeft: 38 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#00000012' },
  dotOff: { backgroundColor: '#E5E7EB' },
  rowLabel: { flex: 1, fontSize: 15.5, fontWeight: '600', color: '#1A1A2E' },
});
