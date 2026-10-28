import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClayList, ClayListRow, ClaySection } from '../components/clay';
import { ClayPageHeader } from '../components/ClayPageHeader';
import { AppVersionFooter, ClayTextRow, ProfileSummaryCard } from '../components/ClayAccountParts';
import { CLAY } from '../theme/clay';
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
 * Tab «Tu» (istruttore / titolare) — REG-639 clay: titolo grande, card
 * profilo in rilievo (volto + nome + ruolo · autoscuola), poi le liste clay
 * «Gestione» e «Account» senza icone, «Esci» in rosso, versione in fondo.
 */
export const MoreScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, autoscuolaRole, companies, activeCompanyId, signOut } = useSession();
  const { enabled: vehiclesEnabled } = useVehiclesEnabled();
  const companyName = companies.find((c) => c.id === activeCompanyId)?.name ?? null;
  const roleText =
    autoscuolaRole === 'INSTRUCTOR_OWNER' ? 'Titolare e istruttore'
    : autoscuolaRole === 'OWNER' ? 'Titolare'
    : autoscuolaRole === 'INSTRUCTOR' ? 'Istruttore'
    : autoscuolaRole === 'STUDENT' ? 'Allievo'
    : null;

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
        <ClayPageHeader title={isInstructor(autoscuolaRole) ? 'Tu' : 'Altro'} />

        <View style={s.profile}>
          <ProfileSummaryCard
            user={user}
            detail={[roleText, companyName].filter(Boolean).join(' · ') || user?.email}
            onPress={() => go('profile-edit')}
            testID="more-profile-card"
          />
        </View>

        {management.length ? (
          <ClaySection title="Gestione">
            <ClayList>
              {management.map((item) => (
                <ClayListRow key={item.route} title={item.label} onPress={() => go(item.route)} testID={`more-${item.route}`} />
              ))}
            </ClayList>
          </ClaySection>
        ) : null}

        <ClaySection title="Account">
          <ClayList>
            <ClayListRow title={SETTINGS_ITEM.label} onPress={() => go(SETTINGS_ITEM.route)} testID="more-settings" />
            <ClayTextRow title="Esci" danger onPress={() => { void signOut(); }} testID="more-sign-out" />
          </ClayList>
        </ClaySection>

        <AppVersionFooter />
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: 20, paddingBottom: 140 },
  profile: { marginTop: 20 },
});
