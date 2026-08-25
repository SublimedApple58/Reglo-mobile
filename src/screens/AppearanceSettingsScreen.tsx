import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Screen } from '../components/Screen';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { useSession } from '../context/SessionContext';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { queryKeys } from '../hooks/queries/queryKeys';
import { regloApi } from '../services/regloApi';
import { isOwner } from '../utils/roles';
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
  previewColor,
  resolveAgendaColorConfig,
} from '../utils/agendaColors';
import { colorPickerStore } from '../stores/colorPickerStore';

const CRITERIA_META: Record<AgendaColorCriterion, { label: string; desc: string }> = {
  durata: { label: 'Durata', desc: 'Colore per durata della guida' },
  patente: { label: 'Patente', desc: "Colore per patente dell'allievo" },
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
        const updated = await regloApi.updateAutoscuolaSettings({
          agendaColorCriterion: next.criterion,
          agendaColorOverrides: next.overrides,
          agendaColorExceptions: next.exceptions,
        });
        // Allinea la cache così le agende (griglia/timeline/day-detail) rileggono.
        queryClient.setQueryData(queryKeys.autoscuolaSettings(activeCompanyId), updated);
      } catch {
        setToast({ text: 'Errore nel salvataggio', tone: 'danger' });
        // Rollback allo stato server corrente.
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
      const ns = overrideNamespaceForCriterion(criterion);
      const nsMap = { ...(overrides[ns] ?? {}) };
      if (hex) nsMap[key] = hex.toUpperCase();
      else delete nsMap[key];
      apply({ overrides: { ...overrides, [ns]: nsMap } });
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
    const ns = overrideNamespaceForCriterion(criterion);
    colorPickerStore.set({
      title: label,
      subtitle: 'Colore del blocco per questa voce.',
      currentHex: overrides[ns]?.[key] ?? null,
      swatches: AGENDA_SWATCHES,
      onSelect: (hex) => setEntryOverride(key, hex),
    });
    router.push('/(tabs)/more/color-picker');
  };

  const openExceptionPicker = (label: string, key: string) => {
    colorPickerStore.set({
      title: label,
      subtitle: 'Colore quando l’eccezione è attiva.',
      currentHex: overrides.eccezioni?.[key] ?? null,
      swatches: AGENDA_SWATCHES,
      onSelect: (hex) => setExceptionOverride(key, hex),
    });
    router.push('/(tabs)/more/color-picker');
  };

  const entries = useMemo(() => entriesForCriterion(criterion), [criterion]);
  const activeExceptions = useMemo(() => exceptionsForCriterion(criterion), [criterion]);
  const ns = overrideNamespaceForCriterion(criterion);

  if (!isOwner(autoscuolaRole)) {
    return (
      <Screen>
        <Header onBack={() => router.back()} saving={false} />
        <View style={s.center}>
          <Text style={s.muted}>Solo il titolare può modificare l&apos;aspetto dell&apos;agenda.</Text>
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
          <Text style={s.intro}>Personalizza i colori dei blocchi guida in agenda. Le modifiche valgono per tutta l&apos;autoscuola.</Text>

          {/* ── Criterio ─────────────────────────── */}
          <Text style={s.sectionLabel}>CRITERIO COLORE</Text>
          <View style={s.criteriaRow}>
            {AGENDA_COLOR_CRITERIA.map((c) => {
              const meta = CRITERIA_META[c];
              const selected = criterion === c;
              const chips = entriesForCriterion(c);
              return (
                <Pressable
                  key={c}
                  onPress={() => { if (!selected) apply({ criterion: c }); }}
                  style={[s.critCard, selected && s.critCardSelected]}
                >
                  <View style={s.critHeader}>
                    <Text style={s.critTitle}>{meta.label}</Text>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? '#1A1A2E' : '#C7CBD1'}
                    />
                  </View>
                  <Text style={s.critDesc}>{meta.desc}</Text>
                  <View style={s.previewChips}>
                    {chips.slice(0, 6).map((e) => (
                      <View
                        key={e.key}
                        style={[s.previewChip, { backgroundColor: previewColor(e, (c === 'patente' ? overrides.patente : overrides.durata)?.[e.key]) }]}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* ── Personalizza i colori ────────────── */}
          <Text style={s.sectionLabel}>PERSONALIZZA I COLORI</Text>
          <View style={s.card}>
            {entries.map((e, i) => {
              const overrideHex = overrides[ns]?.[e.key] ?? null;
              return (
                <View key={e.key}>
                  {i > 0 ? <View style={s.rowDivider} /> : null}
                  <Pressable onPress={() => openEntryPicker(e.label, e.key)} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
                    <View style={[s.dot, { backgroundColor: previewColor(e, overrideHex) }]} />
                    <Text style={s.rowLabel} numberOfLines={1}>{e.label}</Text>
                    {overrideHex ? <Text style={s.rowHint}>Personalizzato</Text> : <Text style={s.rowHintMuted}>Standard</Text>}
                    <Ionicons name="chevron-forward" size={18} color="#C7CBD1" />
                  </Pressable>
                </View>
              );
            })}
          </View>

          {/* ── Eccezioni ────────────────────────── */}
          {activeExceptions.length > 0 ? (
            <>
              <Text style={s.sectionLabel}>ECCEZIONI</Text>
              <Text style={s.sectionCaption}>Regole che vincono sul criterio quando attive.</Text>
              <View style={s.card}>
                {activeExceptions.map((exc, i) => {
                  const on = exceptions[exc.key] ?? exc.defaultEnabled;
                  const overrideHex = overrides.eccezioni?.[exc.key] ?? null;
                  return (
                    <View key={exc.key}>
                      {i > 0 ? <View style={s.rowDivider} /> : null}
                      <View style={s.excRow}>
                        {on ? (
                          <Pressable onPress={() => openExceptionPicker(exc.label, exc.key)} hitSlop={6}>
                            <View style={[s.dot, { backgroundColor: previewColor(exc.entry, overrideHex) }]} />
                          </Pressable>
                        ) : (
                          <View style={[s.dot, s.dotOff]} />
                        )}
                        <View style={s.excBody}>
                          <Text style={s.rowLabel}>{exc.label}</Text>
                          <Text style={s.excDesc}>{exc.description}</Text>
                        </View>
                        <Switch
                          value={on}
                          onValueChange={(v) => apply({ exceptions: { ...exceptions, [exc.key]: v } })}
                          trackColor={{ true: '#1A1A2E', false: '#E5E7EB' }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#E5E7EB"
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={s.footnote}>Il criterio e i colori sono condivisi col pannello “Aspetto” del web.</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: 8, paddingBottom: 12, gap: 8 },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1A1A2E', letterSpacing: -0.4 },
  headerRight: { width: 34, alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 48, gap: 8 },
  intro: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.6, marginTop: 18, marginBottom: 8 },
  sectionCaption: { fontSize: 13, color: colors.textMuted, marginTop: -4, marginBottom: 8 },
  criteriaRow: { flexDirection: 'row', gap: 12 },
  critCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', padding: 14, gap: 6 },
  critCardSelected: { borderColor: '#1A1A2E' },
  critHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  critTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  critDesc: { fontSize: 12.5, color: colors.textMuted, lineHeight: 17 },
  previewChips: { flexDirection: 'row', gap: 5, marginTop: 6 },
  previewChip: { width: 22, height: 14, borderRadius: 5 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#EEF0F3', paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 56 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEF0F3' },
  dot: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: '#00000010' },
  dotOff: { backgroundColor: '#F1F3F7' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  rowHint: { fontSize: 12.5, fontWeight: '600', color: '#1A1A2E' },
  rowHintMuted: { fontSize: 12.5, color: '#AEB4CC' },
  excRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 60 },
  excBody: { flex: 1, gap: 2 },
  excDesc: { fontSize: 12.5, color: colors.textMuted, lineHeight: 17 },
  footnote: { fontSize: 12.5, color: '#AEB4CC', marginTop: 18, textAlign: 'center' },
});
