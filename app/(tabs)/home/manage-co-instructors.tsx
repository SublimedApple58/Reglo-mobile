import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { coInstructorPickerStore } from '../../../src/stores/coInstructorPickerStore';
import { regloApi } from '../../../src/services/regloApi';
import type { AutoscuolaInstructor } from '../../../src/types/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { GlassCloseButton } from '../../../src/components/GlassCloseButton';

/**
 * REG-585 — "Altri istruttori": chi porta la guida INSIEME al principale.
 *
 * Multi-selezione che salva a ogni tocco (niente CTA da tagliare su Android,
 * e nessun optimistic update: spinner sulla riga → risposta del BE → lista
 * aggiornata). Il principale non compare: è già lui che tiene la guida.
 */
export default function ManageCoInstructorsScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(coInstructorPickerStore.subscribe, coInstructorPickerStore.get);

  const [list, setList] = useState<AutoscuolaInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string[]>(data?.selectedIds ?? []);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Chi sta guardando: serve solo per il "(tu)". Se la chiamata fallisce,
  // semplicemente non si vede l'etichetta — niente di rotto.
  const [myInstructorId, setMyInstructorId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    regloApi
      .getInstructors()
      .then((items) => { if (!cancelled) setList(items ?? []); })
      .catch(() => { if (!cancelled) { setList([]); setFailed(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    regloApi
      .getInstructorSettings()
      .then((st) => { if (!cancelled) setMyInstructorId(st?.instructorId ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const active = list.filter((it) => it.status !== 'inactive');
  // Il principale si VEDE (se no non si capisce chi tiene l'esame) ma non si
  // tocca: è già lui che lo porta, non può essere anche collega di se stesso.
  const main = active.find((it) => it.id === data?.mainInstructorId) ?? null;
  const selectable = active.filter((it) => it.id !== data?.mainInstructorId);

  const toggle = async (it: AutoscuolaInstructor) => {
    if (!data || savingId) return;
    const next = selected.includes(it.id)
      ? selected.filter((id) => id !== it.id)
      : [...selected, it.id];
    const previous = selected;
    setSavingId(it.id);
    setError(null);
    // Niente optimistic update: la riga si muove solo quando il BE conferma.
    try {
      await data.onToggle(next);
      setSelected(next);
    } catch (e) {
      setSelected(previous);
      setError(e instanceof Error ? e.message : 'Non è stato possibile salvare.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <GlassCloseButton onPress={() => router.back()}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
            <Ionicons name="close" size={20} color="#1A1A2E" />
          </Pressable>
        </GlassCloseButton>
      </View>
      <View style={s.headerBlock}>
        <Text style={s.title}>Altri istruttori</Text>
        <Text style={s.subtitle}>{data?.subtitle ?? 'Chi la porta insieme a te.'}</Text>
      </View>

      <SheetScaffold>
        {loading && list.length === 0 ? (
          <View style={s.center}>
            <ActivityIndicator size="small" color="#1A1A2E" />
            <Text style={s.muted}>Carico gli istruttori…</Text>
          </View>
        ) : failed ? (
          <View style={s.center}>
            <Ionicons name="cloud-offline-outline" size={26} color="#AEB4CC" />
            <Text style={s.muted}>Non sono riuscito a caricare gli istruttori.</Text>
          </View>
        ) : selectable.length === 0 && !main ? (
          <View style={s.center}>
            <Ionicons name="people-outline" size={26} color="#AEB4CC" />
            <Text style={s.muted}>Non ci sono altri istruttori da aggiungere.</Text>
          </View>
        ) : (
          <View>
            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#B42318" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}
            {/* Il principale, in cima e bloccato. */}
            {main ? (
              <View style={s.mainRow}>
                <View style={s.iconCol}>
                  <Ionicons name="person" size={22} color="#1A1A2E" />
                </View>
                <View style={s.body}>
                  <Text style={s.name} numberOfLines={1}>
                    {main.name}{main.id === myInstructorId ? ' (tu)' : ''}
                  </Text>
                  <Text style={s.mainSub}>Principale · tiene lui questa guida</Text>
                </View>
                <Ionicons name="lock-closed" size={16} color="#C7CBD1" />
              </View>
            ) : null}
            {selectable.map((it, idx) => {
              const isOn = selected.includes(it.id);
              const isSaving = savingId === it.id;
              const blocked = savingId !== null && !isSaving;
              return (
                <View key={it.id}>
                  {idx > 0 || main ? <View style={s.divider} /> : null}
                  <Pressable
                    onPress={() => void toggle(it)}
                    disabled={savingId !== null}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isOn, disabled: savingId !== null }}
                    style={({ pressed }) => [s.row, pressed && { opacity: 0.55 }, blocked && { opacity: 0.4 }]}
                  >
                    <View style={s.iconCol}>
                      <Ionicons name="person" size={22} color="#1A1A2E" />
                    </View>
                    <View style={s.body}>
                      <Text style={[s.name, isOn && { fontWeight: '700' }]} numberOfLines={1}>
                        {it.name}{it.id === myInstructorId ? ' (tu)' : ''}
                      </Text>
                      {isOn ? <Text style={s.sub}>Porta questa guida con te</Text> : null}
                    </View>
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#1A1A2E" />
                    ) : isOn ? (
                      <Ionicons name="checkmark-circle" size={22} color="#047857" />
                    ) : (
                      <Ionicons name="ellipse-outline" size={22} color="#C7CBD1" />
                    )}
                  </Pressable>
                </View>
              );
            })}
            <Text style={s.footnote}>
              La guida comparirà in agenda anche a chi aggiungi, e le ore contano per tutti.
            </Text>
          </View>
        )}
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 16, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerBlock: { gap: 4 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted },
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  muted: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 60 },
  mainRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 60, opacity: 0.75 },
  mainSub: { fontSize: 13, color: colors.textSecondary },
  iconCol: { width: 28, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  sub: { fontSize: 13, color: '#047857' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EBEDF0', marginLeft: 40 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#B42318' },
  footnote: { marginTop: 14, fontSize: 12.5, fontWeight: '500', color: colors.textSecondary, lineHeight: 17 },
});
