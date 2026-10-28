import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ClayLargeTitleScroll } from '../components/ClayLargeTitle';
import { Avatar, ClayList, ClayListRow } from '../components/clay';
import { AppVersionFooter, ClayTextRow } from '../components/ClayAccountParts';
import { MonthHoursCard } from '../components/MonthHoursCard';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
import { useSession } from '../context/SessionContext';
import { useVehiclesEnabled } from '../hooks/useVehiclesEnabled';
import { isInstructor, isOwner } from '../utils/roles';
import { FadeImage } from '../components/FadeImage';

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
      <ClayLargeTitleScroll
        title={isInstructor(autoscuolaRole) ? 'Tu' : 'Altro'}
        contentContainerStyle={s.content}
        actions={
          <Pressable
            onPress={() => go('profile-edit')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${name}, modifica profilo`}
            testID="more-profile-card"
          >
            {user?.photoUrl ? (
              <View style={[s.photo, CLAY_SHADOW.avatar]}>
                <FadeImage source={{ uri: user.photoUrl }} style={s.photo} />
              </View>
            ) : (
              <Avatar userId={user?.id} name={name} size={40} />
            )}
          </Pressable>
        }
      >
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
      </ClayLargeTitleScroll>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: 20, paddingBottom: 140 },
  photo: { width: 40, height: 40, borderRadius: 20 },
  month: { marginTop: 18 },
  list: { marginTop: 18 },
});
