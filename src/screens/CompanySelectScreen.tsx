import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClayList, ClayListRow, Icon3D } from '../components/clay';
import { FadeImage } from '../components/FadeImage';
import { useSession } from '../context/SessionContext';
import { CLAY } from '../theme/clay';
import { VITA_ART } from '../theme/vitaArt';
import { fadeIn, fadeOut } from './firstAccess/FirstAccessStepScreen';
import { OnboardingExit } from './onboarding/OnboardingExit';

/**
 * Scelta dell'autoscuola per chi ne ha più di una e nessuna attiva
 * (`status === 'company_select'`). REG-812: rifatta sullo stile dell'onboarding
 * — titolo a sinistra, una lista clay con logo e nome, lo spinner sulla riga
 * toccata (mai un cambio di etichetta), «Esci» discreto in fondo.
 */
export const CompanySelectScreen = () => {
  const { companies, selectCompany, user } = useSession();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? '';

  const handleSelect = async (companyId: string) => {
    if (loadingId) return;
    setError(null);
    setLoadingId(companyId);
    try {
      await selectCompany(companyId);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Non siamo riusciti a entrare. Riprova.');
      setLoadingId(null);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Icon3D source={VITA_ART.edificio} size={64} style={s.hero} />
        <Text style={s.title}>Quale autoscuola?</Text>
        <Text style={s.subtitle}>
          {firstName ? `Ciao ${firstName}, sei` : 'Sei'} in più di un&apos;autoscuola. Scegli dove entrare: potrai cambiare
          dal profilo.
        </Text>

        <View style={s.list}>
          <ClayList>
            {companies.map((company) => (
              <ClayListRow
                key={company.id}
                leading={
                  company.logoUrl ? (
                    <FadeImage source={{ uri: company.logoUrl }} style={s.logo} resizeMode="contain" />
                  ) : (
                    <Icon3D source={VITA_ART.edificio} size={40} width={48} />
                  )
                }
                title={company.name}
                trailing={
                  loadingId === company.id ? (
                    <Animated.View entering={fadeIn} exiting={fadeOut}>
                      <ActivityIndicator color={CLAY.ink} />
                    </Animated.View>
                  ) : undefined
                }
                chevron={loadingId !== company.id}
                dimmed={!!loadingId && loadingId !== company.id}
                onPress={() => handleSelect(company.id)}
                testID={`company-${company.id}`}
              />
            ))}
          </ClayList>
        </View>
        {error ? (
          <Animated.Text entering={fadeIn} exiting={fadeOut} style={s.error}>
            {error}
          </Animated.Text>
        ) : null}

        <View style={s.exit}>
          <OnboardingExit />
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  content: { paddingHorizontal: 24 },
  hero: { marginBottom: 18 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.8 },
  subtitle: { fontSize: 16, lineHeight: 22, color: CLAY.ink3, marginTop: 8 },
  list: { marginTop: 28 },
  logo: { width: 48, height: 40, borderRadius: 10 },
  error: { fontSize: 14.5, lineHeight: 20, fontWeight: '500', color: '#C13515', marginTop: 16 },
  exit: { marginTop: 28 },
});
