import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { ClayLargeTitleScroll } from '../components/ClayLargeTitle';
import { Avatar, ClayList, ClayListRow, ClaySurface } from '../components/clay';
import { InboxBellButton } from '../components/InboxBellButton';
import { AgendaTodayCard } from '../components/agenda/AgendaTodayCard';
import { SkeletonBlock } from '../components/Skeleton';
import { useSession } from '../context/SessionContext';
import { useAgendaBootstrap } from '../hooks/queries/useAgendaBootstrap';
import { useAutoscuolaSettings } from '../hooks/queries/useAutoscuolaSettings';
import { useSchoolAvailability } from '../hooks/queries/useSchoolAvailability';
import { mondayOf, orderInstructors, toDateKey, type AvailWindow } from '../components/schoolDay';
import { buildInstructorsToday, buildSchoolNow, firstNameOf, hhmm, type InstructorToday } from '../components/ownerToday/todayModel';
import { regloApi } from '../services/regloApi';
import { ownerAgendaRequestStore, type OwnerAgendaRequest } from '../stores/ownerAgendaRequestStore';
import { ownerTodayInstructorStore } from '../stores/ownerTodayInstructorStore';
import { outOfAvailStore } from '../stores/outOfAvailStore';
import { groupOutOfAvailability } from '../utils/outOfAvailability';
import { nextAbsenceText, type AbsencePeriod } from '../utils/absencePeriods';
import { useInstructorAbsences } from '../hooks/queries/useInstructorAbsences';
import { CLAY } from '../theme/clay';
import { VITA_ART, greetingFor } from '../theme/vitaArt';
import { MORALE_ART } from '../theme/moraleArt';

const SOFT_IN = FadeIn.duration(200).reduceMotion(ReduceMotion.Never);
/** Chiusura di un form sheet nativo. */
const SHEET_CLOSE_MS = 320;

const fmtLongDay = (d: Date) => {
  const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * «Oggi» del titolare e del titolare-istruttore (REG-794, rilascio 2,
 * anteprime O1/O1b approvate). Una protagonista: «In guida adesso» con i numeri
 * della giornata e le prossime che partono. Sotto, solo se servono, «Le tue
 * guide» (titolare-istruttore) e le guide fuori disponibilità. Poi la sezione
 * Istruttori a righe, con lo stato a parole; il tocco apre il foglio
 * dell'istruttore (`today/instructor`).
 *
 * Dati: il bootstrap di oggi di tutta la scuola, i blocchi e la disponibilità
 * (`useSchoolAvailability`), tutti in cache TanStack. Nessuna chiamata al tocco.
 */
export const OwnerTodayScreen = () => {
  const router = useRouter();
  const { user, autoscuolaRole, instructorId } = useSession();
  const isInstructorOwner = autoscuolaRole === 'INSTRUCTOR_OWNER' && !!instructorId;

  // L'ora corre: lo stato «in guida fino alle…» si aggiorna ogni 30 secondi.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const dayKey = toDateKey(now);

  const params = useMemo(() => {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(+from + 24 * 3600_000);
    return { from: from.toISOString(), to: to.toISOString(), limit: 400 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey]);
  const bootstrap = useAgendaBootstrap(params);
  const settings = useAutoscuolaSettings();
  const monday = useMemo(() => mondayOf(now), [dayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const availability = useSchoolAvailability(monday);
  const { activeCompanyId } = useSession();
  const outOfAvail = useQuery({
    queryKey: ['out-of-availability', activeCompanyId],
    queryFn: () => regloApi.getOutOfAvailabilityAppointments(),
    enabled: !!activeCompanyId,
    staleTime: 60 * 1000,
  });
  // REG-794: malattie e ferie di tutta la scuola, per «Assenze · Ferie dal 22 dic» nel foglio.
  const absences = useInstructorAbsences(null);
  const absencesById = useMemo(() => {
    const out: Record<string, AbsencePeriod[]> = {};
    for (const p of absences.data ?? []) (out[p.instructorId] ??= []).push(p);
    return out;
  }, [absences.data]);

  // Tornando su «Oggi» i dati si rinfrescano in background, se hanno più di un minuto.
  useFocusEffect(
    useCallback(() => {
      if (Date.now() - bootstrap.dataUpdatedAt > 60_000) void bootstrap.refetch();
      if (Date.now() - outOfAvail.dataUpdatedAt > 60_000) void outOfAvail.refetch();
      setNow(new Date());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bootstrap.dataUpdatedAt, outOfAvail.dataUpdatedAt]),
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([bootstrap.refetch(), outOfAvail.refetch(), absences.refetch()]);
    setNow(new Date());
    setRefreshing(false);
  }, [bootstrap, outOfAvail, absences]);

  const appointments = useMemo(() => bootstrap.data?.appointments ?? [], [bootstrap.data]);
  const blocks = useMemo(() => bootstrap.data?.instructorBlocks ?? [], [bootstrap.data]);
  const rawInstructors = useMemo(() => bootstrap.data?.instructors ?? [], [bootstrap.data]);
  const instructors = useMemo(
    () => orderInstructors(rawInstructors, settings.data?.agendaInstructorOrder, isInstructorOwner ? instructorId : null),
    [rawInstructors, settings.data?.agendaInstructorOrder, isInstructorOwner, instructorId],
  );
  const days = useMemo(() => {
    const windowsById: Record<string, AvailWindow[] | undefined> = {};
    for (const ins of instructors) windowsById[ins.id] = availability[ins.id]?.[dayKey];
    return buildInstructorsToday(instructors, appointments, blocks, windowsById, now);
  }, [instructors, availability, dayKey, appointments, blocks, now]);
  const school = useMemo(() => buildSchoolNow(days, now), [days, now]);
  const oobCount = useMemo(() => groupOutOfAvailability(outOfAvail.data ?? []).length, [outOfAvail.data]);

  const goAgenda = useCallback((request: OwnerAgendaRequest) => {
    ownerAgendaRequestStore.set(request);
    router.navigate('/(tabs)/home');
  }, [router]);

  // Per sé stessi (titolare-istruttore) l'editor di sempre; per un collega la stessa
  // schermata «per conto di», con telefono e nome già noti (nessun fetch al tocco).
  const openAvailability = useCallback((ins: InstructorToday['instructor'], absences = false) => {
    if (ins.isMe) {
      router.push('/(tabs)/today/availability');
      return;
    }
    const phone = rawInstructors.find((i) => i.id === ins.id)?.phone ?? '';
    router.push({
      pathname: '/(tabs)/today/availability',
      params: { instructorId: ins.id, name: ins.name, phone, ...(absences ? { focus: 'absences' } : {}) },
    } as never);
  }, [rawInstructors, router]);

  const openInstructor = useCallback((day: InstructorToday) => {
    const ins = day.instructor;
    ownerTodayInstructorStore.set({
      day,
      phone: rawInstructors.find((i) => i.id === ins.id)?.phone ?? null,
      isMe: ins.isMe,
      absenceLine: ins.isMe ? null : nextAbsenceText(absencesById[ins.id] ?? [], new Date()),
      // REG-794: «Disponibilità di …» è una schermata push di questo stack. Prima
      // si chiude il foglio: iOS non presenta nulla mentre ne chiude un altro.
      onAvailability: () => {
        router.back();
        setTimeout(() => openAvailability(ins), SHEET_CLOSE_MS);
      },
      onAbsences: () => {
        router.back();
        setTimeout(() => openAvailability(ins, true), SHEET_CLOSE_MS);
      },
      // Prima si chiude il foglio, poi si cambia tab: iOS non presenta un
      // foglio nuovo mentre ne sta chiudendo un altro.
      onSick: () => {
        router.back();
        setTimeout(() => goAgenda({ kind: 'sick', instructorId: ins.id }), SHEET_CLOSE_MS);
      },
      onWeek: () => {
        router.back();
        setTimeout(() => goAgenda(ins.isMe ? { kind: 'mine' } : { kind: 'week', instructorId: ins.id }), SHEET_CLOSE_MS);
      },
    });
    router.push('/(tabs)/today/instructor');
  }, [rawInstructors, absencesById, openAvailability, router, goAgenda]);

  const openOutOfAvail = useCallback(() => {
    outOfAvailStore.set({
      appointments: outOfAvail.data ?? [],
      onChanged: () => { void outOfAvail.refetch(); void bootstrap.refetch(); },
    });
    router.push('/(tabs)/today/out-of-availability');
  }, [outOfAvail, bootstrap, router]);

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? '';
  const greeting = `${greetingFor(now)}${firstName ? `, ${firstName}` : ''}`;
  const loading = bootstrap.isLoading && !bootstrap.data;

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ClayLargeTitleScroll
        title="Oggi"
        greeting={greeting}
        subtitle={fmtLongDay(now)}
        actions={<InboxBellButton />}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CLAY.ink3} />}
        testID="owner-today"
      >
        {loading ? (
          <View style={s.skeleton}>
            <SkeletonBlock height={230} radius={24} />
            <SkeletonBlock height={64} radius={18} />
            <SkeletonBlock height={300} radius={24} />
          </View>
        ) : (
          <Animated.View entering={SOFT_IN}>
            <SchoolNowCard school={school} />

            {isInstructorOwner ? (
              <AgendaTodayCard
                appointments={appointments}
                instructorBlocks={blocks}
                instructorId={instructorId!}
                now={now}
                mine
                onPress={() => goAgenda({ kind: 'mine' })}
              />
            ) : null}

            {oobCount > 0 ? (
              <ClaySurface
                size="sm"
                padded={false}
                radius={18}
                style={s.oob}
                onPress={openOutOfAvail}
                accessibilityLabel={`${oobCount} guide fuori disponibilità, gestisci`}
                testID="today-out-of-availability"
              >
                <Image source={VITA_ART.campanella} style={s.oobArt} />
                <Text style={s.oobTx} numberOfLines={1}>
                  {oobCount} guid{oobCount === 1 ? 'a' : 'e'} fuori disponibilità
                </Text>
                <Text style={s.oobAction}>Gestisci</Text>
                <Ionicons name="chevron-forward" size={17} color={CLAY.chevron} />
              </ClaySurface>
            ) : null}

            {days.length ? (
              <>
                <Text style={s.section} accessibilityRole="header">Istruttori</Text>
                <ClayList>
                  {days.map((d) => (
                    <ClayListRow
                      key={d.instructor.id}
                      leading={<Avatar userId={d.instructor.userId} name={d.instructor.name} size={44} />}
                      title={d.instructor.isMe ? `${d.instructor.name} (tu)` : d.instructor.name}
                      subtitle={d.line}
                      trailing={d.lessonCount ? <Text style={s.count}>{d.lessonCount}</Text> : undefined}
                      onPress={() => openInstructor(d)}
                      testID={`today-instructor-${d.instructor.id}`}
                    />
                  ))}
                </ClayList>
              </>
            ) : null}
          </Animated.View>
        )}
      </ClayLargeTitleScroll>
    </View>
  );
};

/** La protagonista: chi è in guida adesso, i numeri della giornata e le prossime. */
const SchoolNowCard = React.memo(function SchoolNowCard({ school }: { school: ReturnType<typeof buildSchoolNow> }) {
  const idle = school.totalLessons === 0;
  const label = idle || school.allDone ? 'Oggi' : 'In guida adesso';
  const title = idle
    ? 'Nessuna guida'
    : school.allDone
      ? 'Tutte fatte'
      : `${school.busyNow} su ${school.working} al lavoro`;
  const parts: string[] = [];
  if (!idle) parts.push(`Oggi ${school.totalLessons} guid${school.totalLessons === 1 ? 'a' : 'e'}${school.doneLessons ? `, ${school.doneLessons} già fatt${school.doneLessons === 1 ? 'a' : 'e'}` : ''}`);
  if (school.examNow.length) parts.push(`${school.examNow.join(' e ')} ${school.examNow.length === 1 ? 'è' : 'sono'} all'esame`);
  return (
    <ClaySurface radius={24} padded={false} style={s.hero} testID="today-school-now">
      <View style={s.heroTop}>
        <Image source={school.allDone ? MORALE_ART.espresso : VITA_ART.volante} style={s.heroArt} />
        <View style={s.heroTitles}>
          <Text style={s.heroLabel}>{label}</Text>
          <Text style={s.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {title}
          </Text>
        </View>
      </View>
      {parts.length ? <Text style={s.heroLine}>{parts.join(' · ')}</Text> : null}
      {school.upcoming.length ? (
        <>
          <Text style={s.soon}>Tra poco</Text>
          {school.upcoming.map((u, i) => (
            <View key={u.key} style={[s.soonRow, i > 0 && s.soonDivider]}>
              <Avatar userId={u.instructor.userId} name={u.instructor.name} size={36} />
              <Text style={s.soonTx} numberOfLines={1}>
                <Text style={s.soonTime}>{hhmm(u.start)}</Text>
                {` · ${u.instructor.isMe ? 'Tu' : firstNameOf(u.instructor.name)} con ${u.label}`}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </ClaySurface>
  );
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: 20, paddingBottom: 140 },
  skeleton: { gap: 14, marginTop: 18 },
  hero: { marginTop: 18, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroArt: { width: 64, height: 64 },
  heroTitles: { flex: 1, minWidth: 0 },
  heroLabel: { fontSize: 15, fontWeight: '500', color: CLAY.ink3 },
  heroTitle: { fontSize: 30, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.9, marginTop: 1 },
  heroLine: { fontSize: 15, lineHeight: 21, color: CLAY.ink2, marginTop: 14 },
  soon: { fontSize: 14, fontWeight: '500', color: CLAY.ink3, marginTop: 14, marginBottom: 2 },
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  soonDivider: { borderTopWidth: 0.5, borderTopColor: 'rgba(17,17,17,0.12)' },
  soonTx: { flex: 1, fontSize: 16, color: CLAY.ink, letterSpacing: -0.2 },
  soonTime: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  oob: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingVertical: 10, paddingHorizontal: 14 },
  oobArt: { width: 30, height: 30 },
  oobTx: { flex: 1, fontSize: 15, fontWeight: '500', color: CLAY.ink },
  oobAction: { fontSize: 15, fontWeight: '600', color: CLAY.ink },
  section: { fontSize: 20, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4, marginTop: 28, marginBottom: 10 },
  count: { fontSize: 17, color: CLAY.ink3, fontVariant: ['tabular-nums'] },
});
