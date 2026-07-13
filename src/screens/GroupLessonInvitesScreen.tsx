import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { Button } from '../components/Button';
import { ToastNotice, ToastTone } from '../components/ToastNotice';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { AutoscuolaStudent, GroupLessonInvite } from '../types/regloApi';

const FLUENT_PEOPLE = require('../../assets/icons/fluent-people.png');
const NAVY = '#1A1A2E';
const NAVY_400 = '#6E7596';
const NAVY_50 = '#F4F5F9';
const NAVY_100 = '#E9EBF2';
const NAVY_200 = '#D6D9E6';
const TEAL = '#0F766E';
const MUTED = '#929292';

const normalize = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
const findLinkedStudent = (students: AutoscuolaStudent[], user: { name: string | null; email: string } | null) => {
  if (!user) return null;
  const byEmail = students.find((s) => normalize(s.email) === normalize(user.email));
  if (byEmail) return byEmail;
  const n = normalize(user.name);
  if (!n) return null;
  return students.find((s) => `${normalize(s.firstName)} ${normalize(s.lastName)}` === n) ?? null;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const fmtDate = (startsAt: string) => {
  const d = new Date(startsAt);
  return cap(d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }));
};

const fmtTimeRange = (startsAt: string, endsAt: string | null) => {
  const s = new Date(startsAt);
  const start = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
  if (!endsAt) return start;
  const e = new Date(endsAt);
  const end = `${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
  const hours = (e.getTime() - s.getTime()) / 3600000;
  if (hours <= 0) return `${start} – ${end}`;
  const label = Number.isInteger(hours)
    ? `${hours} ${hours === 1 ? 'ora' : 'ore'}`
    : `${hours.toLocaleString('it-IT', { maximumFractionDigits: 1 })} ore`;
  return `${start} – ${end} · ${label}`;
};

const seatsLabel = (filled: number, capacity: number) => {
  if (filled <= 0) return 'Nessun posto occupato';
  return `${filled} ${filled === 1 ? 'posto occupato' : 'posti occupati'} su ${capacity}`;
};

export const GroupLessonInvitesScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  const [students, setStudents] = useState<AutoscuolaStudent[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [invites, setInvites] = useState<GroupLessonInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  const studentId = useMemo(() => findLinkedStudent(students, user)?.id ?? null, [students, user]);

  useEffect(() => {
    regloApi
      .getStudents()
      .then(setStudents)
      .catch(() => {})
      .finally(() => setStudentsLoaded(true));
  }, []);

  const load = useCallback(async (sid: string) => {
    try {
      // 100 (era 20): con 3-4 guide di gruppo al giorno il cap a 20 nascondeva
      // tutto oltre ~2 settimane (segnalazione Robatto, 2026-07-06).
      const res = await regloApi.getGroupLessonInvites(sid, 100);
      setInvites(res);
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : 'Errore nel caricamento', tone: 'danger' });
    }
  }, []);

  useEffect(() => {
    // Keep the spinner until we know who the student is — otherwise the empty
    // state flashes for a beat while getStudents() is still in flight.
    if (!studentsLoaded) return;
    if (!studentId) { setLoading(false); return; }
    setLoading(true);
    load(studentId).finally(() => setLoading(false));
  }, [studentsLoaded, studentId, load]);

  const respond = async (invite: GroupLessonInvite, response: 'accept' | 'decline') => {
    if (!studentId || pendingId) return;
    setPendingId(invite.inviteId);
    try {
      const res = await regloApi.respondGroupLessonInvite(invite.inviteId, { studentId, response });
      setInvites((prev) => prev.filter((i) => i.inviteId !== invite.inviteId));
      setToast({
        text: response === 'accept' && res.accepted ? 'Iscrizione confermata!' : 'Risposta registrata.',
        tone: 'success',
      });
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : 'Errore.', tone: 'danger' });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.back}>
          <Ionicons name="chevron-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={s.headerTitle}>Guide di gruppo</Text>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
      ) : invites.length === 0 ? (
        <View style={s.center}>
          <Image source={FLUENT_PEOPLE} style={{ width: 56, height: 56, opacity: 0.5 }} />
          <Text style={s.emptyTitle}>Nessun invito</Text>
          <Text style={s.emptySub}>Quando l'autoscuola apre una guida di gruppo per te, la troverai qui.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
          {invites.map((inv) => (
            <View key={inv.inviteId} style={s.card}>
              <Text style={s.when}>{fmtDate(inv.startsAt)}</Text>
              <Text style={s.whenSub}>{fmtTimeRange(inv.startsAt, inv.endsAt)}</Text>

              <View style={s.meta}>
                {inv.instructorName ? <MetaRow icon="person-outline" label={inv.instructorName} /> : null}
                {inv.kind === 'moto' ? (
                  <MetaRow icon="bicycle-outline" label="Ti verrà assegnata una moto" />
                ) : inv.vehicleName ? (
                  <MetaRow icon="car-outline" label={inv.vehicleName} />
                ) : null}
                <View style={s.seats}>
                  <Seats filled={inv.filledSeats} capacity={inv.capacity} />
                  <Text style={s.seatsTxt}>{seatsLabel(inv.filledSeats, inv.capacity)}</Text>
                </View>
              </View>

              <View style={{ marginTop: 18 }}>
                <Button
                  label="Iscrivimi"
                  tone="primary"
                  loading={pendingId === inv.inviteId}
                  onPress={() => respond(inv, 'accept')}
                />
                <Pressable
                  onPress={() => respond(inv, 'decline')}
                  disabled={pendingId === inv.inviteId}
                  style={({ pressed }) => [s.ghost, pressed && { opacity: 0.6 }]}
                >
                  <Text style={s.ghostText}>Non mi interessa</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
    </View>
  );
};

const MetaRow = ({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) => (
  <View style={s.mrow}>
    <View style={s.mi}>
      <Ionicons name={icon} size={15} color={NAVY_400} />
    </View>
    <Text style={s.ml} numberOfLines={1}>{label}</Text>
  </View>
);

const Seats = ({ filled, capacity }: { filled: number; capacity: number }) => (
  <View style={s.dots}>
    {Array.from({ length: Math.max(capacity, 1) }).map((_, i) => (
      <View key={i} style={[s.dot, i < filled && s.dotOn]} />
    ))}
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 10 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: NAVY_50, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: NAVY },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: NAVY, marginTop: 8 },
  emptySub: { fontSize: 14, fontWeight: '400', color: MUTED, textAlign: 'center', lineHeight: 20 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 26, padding: 20, marginBottom: 18, shadowColor: '#1A1A2E', shadowOpacity: 0.07, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 4 },

  when: { fontSize: 23, fontWeight: '600', color: NAVY, letterSpacing: -0.5, lineHeight: 27 },
  whenSub: { fontSize: 14.5, fontWeight: '400', color: NAVY_400, marginTop: 3 },

  meta: { marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: NAVY_100 },
  mrow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: NAVY_100 },
  mi: { width: 26, height: 26, borderRadius: 9, backgroundColor: NAVY_50, alignItems: 'center', justifyContent: 'center' },
  ml: { flex: 1, fontSize: 15, fontWeight: '400', color: NAVY },

  seats: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 13, paddingBottom: 2 },
  // Wraps into a compact grid: capacity is free up to 12 now (was 3-4).
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, maxWidth: 69 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: NAVY_200 },
  dotOn: { backgroundColor: TEAL },
  seatsTxt: { fontSize: 13.5, fontWeight: '400', color: NAVY_400 },

  ghost: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  ghostText: { fontSize: 15, fontWeight: '500', color: NAVY_400 },
});
