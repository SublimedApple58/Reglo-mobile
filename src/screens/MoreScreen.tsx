import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, ClayList, ClayListRow } from '../components/clay';
import { AppVersionFooter, ClayTextRow } from '../components/ClayAccountParts';
import { MonthHoursCard } from '../components/MonthHoursCard';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
import { useSession } from '../context/SessionContext';
import { useVehiclesEnabled } from '../hooks/useVehiclesEnabled';
import { isInstructor, isOwner } from '../utils/roles';

type MenuItem = { route: string; label: string };

const VEHICLES_ITEM: MenuItem = { route: 'vehicles', label: 'Veicoli' };
const SETTINGS_ITEM: MenuItem = { route: 'settings', label: 'Impostazioni' };
const INSTRUCTOR_HOURS_ITEM: MenuItem = { route: 'instructor-hours', label: 'Ore di guida' };
const INSTRUCTORS_OVERVIEW_ITEM: MenuItem = { route: 'instructors-overview', label: 'Panoramica Istruttori' };
const LOCATIONS_ITEM: MenuItem = { route: 'locations', label: 'Luoghi guida' };
const EVALUATION_SHEET_ITEM: MenuItem = { route: 'evaluation-sheet', label: 'Pagellino' };
const APPEARANCE_ITEM: MenuItem = { route: 'appearance', label: 'Aspetto agenda' };

/**
 * Tab «Tu» (istruttore / titolare) — REG-639 clay, direzione «D · Mix»:
 * titolo grande col volto a destra (tocco = profilo), per l'istruttore la card
 * del mese (ore guidate + grafico delle settimane), poi un'unica lista clay
 * senza icone con «Esci» in rosso in fondo, versione sotto.
 */
export const MoreScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, autoscuolaRole, instructorId, signOut } = useSession();
  const { enabled: vehiclesEnabled } = useVehiclesEnabled();
  const name = user?.name?.trim() || user?.email?.split('@')[0] || 'Account';

  const management = useMemo(() => {
    const out: MenuItem[] = [];
    if (autoscuolaRole === 'INSTRUCTOR_OWNER') out.push(INSTRUCTORS_OVERVIEW_ITEM);
    if (isInstructor(autoscuolaRole)) out.push(INSTRUCTOR_HOURS_ITEM);
    if (vehiclesEnabled) out.push(VEHICLES_ITEM);
    if (isInstructor(autoscuolaRole) || autoscuolaRole === 'OWNER') out.push(LOCATIONS_ITEM);
    // Voci del pagellino: le configurano titolari E istruttori — sono loro a
    // compilarlo tutti i giorni (stesso gate lato server).
    if (isInstructor(autoscuolaRole) || isOwner(autoscuolaRole)) out.push(EVALUATION_SHEET_ITEM);
    // Colori agenda (Aspetto): gestibili dallo staff — titolari E istruttori.
    if (isInstructor(autoscuolaRole) || isOwner(autoscuolaRole)) out.push(APPEARANCE_ITEM);
    return out;
  }, [autoscuolaRole, vehiclesEnabled]);

  const go = (route: string) => router.push(`/(tabs)/more/${route}` as never);

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.head}>
          <Text style={s.title} accessibilityRole="header">
            {isInstructor(autoscuolaRole) ? 'Tu' : 'Altro'}
          </Text>
          <Pressable
            onPress={() => go('profile-edit')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${name}, modifica profilo`}
            testID="more-profile-card"
          >
            {user?.photoUrl ? (
              <View style={[s.photo, CLAY_SHADOW.avatar]}>
                <Image source={{ uri: user.photoUrl }} style={s.photo} />
              </View>
            ) : (
              <Avatar userId={user?.id} name={name} size={46} />
            )}
          </Pressable>
        </View>

        {isInstructor(autoscuolaRole) && instructorId ? (
          <View style={s.month}>
            <MonthHoursCard instructorId={instructorId} onPress={() => go(INSTRUCTOR_HOURS_ITEM.route)} />
          </View>
        ) : null}

        <ClayList style={s.list}>
          {[...management, SETTINGS_ITEM].map((item) => (
            <ClayListRow key={item.route} title={item.label} onPress={() => go(item.route)} testID={`more-${item.route}`} />
          ))}
          <ClayTextRow title="Esci" danger onPress={() => { void signOut(); }} testID="more-sign-out" />
        </ClayList>

        <AppVersionFooter />
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: 20, paddingBottom: 140 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 },
  title: { fontSize: 32, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.9 },
  photo: { width: 46, height: 46, borderRadius: 23 },
  month: { marginTop: 18 },
  list: { marginTop: 18 },
});
