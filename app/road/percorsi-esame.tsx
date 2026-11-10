import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { FormSheet } from '../../src/components/SheetScaffold';
import { ClayList, ClayListRow } from '../../src/components/clay';
import { RouteThumb } from '../../src/components/road/RoadTabParts';
import { CLAY, CLAY_SHADOW } from '../../src/theme/clay';
import { SHEET_NIGHT, useSheetNight } from '../../src/theme/night';
import { formatKm } from '../../src/road/format';
import { examRoutesStore, useExamRouteGroups } from '../../src/road/examRoutesStore';
import { tryExamRoute } from '../../src/road/roadActions';
import type { RoadExamRoute } from '../../src/types/regloApi';

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const EXAM_INK = '#8B5CF6';

const dayOf = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return 'oggi';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
const initials = (name: string) =>
  name
    .replace(/^(ing|dott|dr|sig|arch|geom)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || name.slice(0, 2).toUpperCase();

/**
 * R4c «Prova un percorso d'esame» (anteprima approvata da Tiziano il
 * 10/11/2026): i percorsi d'esame raggruppati per esaminatore (iniziali nelle
 * intestazioni, «Senza esaminatore» in fondo), miniatura sulla mappa vera con
 * la linea viola. Un tocco mette il percorso nel giro di questa guida.
 */
export default function PercorsiEsameSheet() {
  const router = useRouter();
  const night = useSheetNight();
  const groups = useExamRouteGroups();
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    void examRoutesStore.load();
  }, []);

  const pick = async (r: RoadExamRoute) => {
    if (busy) return;
    setBusy(r.id);
    const ok = await tryExamRoute(r.id);
    setBusy(null);
    if (ok) router.back();
  };

  const sub = (r: RoadExamRoute) =>
    [`${formatKm(r.lengthMeters)} km`, r.origin === 'exam' ? `registrato ${dayOf(r.examAt ?? r.createdAt) ?? ''}`.trim() : 'disegnato'].join(' · ');

  return (
    <FormSheet title="Prova un percorso d'esame" subtitle="Il percorso va nel giro di questa guida" testID="road-exam-routes-sheet">
      {groups == null ? (
        <View style={s.loading}>
          <ActivityIndicator color={night ? SHEET_NIGHT.ink3 : CLAY.ink3} />
        </View>
      ) : groups.length === 0 ? (
        <Text style={[s.empty, night && { color: SHEET_NIGHT.ink3 }]}>
          Ancora nessun percorso d'esame. Si registrano con Road Exam dal foglio dell'esame.
        </Text>
      ) : (
        groups.map((g) => (
          <View key={g.key || 'none'}>
            <View style={s.head}>
              <View style={[s.av, night ? { backgroundColor: SHEET_NIGHT.surface } : CLAY_SHADOW.raiseSm]}>
                {g.name ? (
                  <Text style={[s.avTx, night && { color: SHEET_NIGHT.ink }]}>{initials(g.name)}</Text>
                ) : (
                  <Ionicons name="person-outline" size={17} color={night ? SHEET_NIGHT.ink3 : CLAY.ink3} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.gt, night && { color: SHEET_NIGHT.ink }]}>{g.name ?? 'Senza esaminatore'}</Text>
                <Text style={[s.gs, night && { color: SHEET_NIGHT.ink3 }]}>
                  {[
                    g.routes.length === 1 ? '1 percorso' : `${g.routes.length} percorsi`,
                    g.name ? (g.lastExamAt ? `ultimo esame ${dayOf(g.lastExamAt)}` : null) : 'li assegna il titolare',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>
            <ClayList>
              {g.routes.map((r) => (
                <ClayListRow
                  key={`${g.key}:${r.id}`}
                  leading={<RouteThumb thumb={r.path} size={52} ink={EXAM_INK} />}
                  title={r.name}
                  subtitle={sub(r)}
                  trailing={busy === r.id ? <ActivityIndicator color={night ? SHEET_NIGHT.ink3 : CLAY.ink3} /> : undefined}
                  onPress={() => void pick(r)}
                  testID={`road-exam-route-${r.id}`}
                />
              ))}
            </ClayList>
          </View>
        ))
      )}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  loading: { paddingVertical: 32, alignItems: 'center' },
  empty: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, paddingHorizontal: 2, paddingVertical: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 10, marginHorizontal: 4 },
  av: { width: 36, height: 36, borderRadius: 18, backgroundColor: CLAY.surface, alignItems: 'center', justifyContent: 'center' },
  avTx: { fontSize: 13.5, fontWeight: '600', color: CLAY.ink },
  gt: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, color: CLAY.ink },
  gs: { fontSize: 13, color: CLAY.ink3, marginTop: 1 },
});
