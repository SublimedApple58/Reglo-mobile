import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClayList, ClayListRow, Icon3D } from '../components/clay';
import { useSession } from '../context/SessionContext';
import { CLAY } from '../theme/clay';
import { VITA_ART } from '../theme/vitaArt';
import { fadeIn } from './firstAccess/FirstAccessStepScreen';
import { OnboardingExit } from './onboarding/OnboardingExit';

const NOTES_ART = require('../../assets/icons3d-ai/blocconote.png');

/**
 * Home dell'allievo in attesa (fase AWAITING): si è registrato con il codice
 * ma l'autoscuola non l'ha ancora attivato, quindi né teoria né guide.
 *
 * REG-812: è il «primo ingresso» dopo la registrazione, rifatta con lo stesso
 * tono dell'onboarding — bianco, titolo a sinistra, una sola cosa protagonista
 * (il messaggio), sotto il percorso come lista clay. Niente pillola «In
 * corso» né etichetta in maiuscolo: la tappa di adesso si riconosce perché è
 * l'unica piena, le altre sono tenui. Nessuna CTA: tocca all'autoscuola.
 */
const STEPS = [
  { key: 'AWAITING', title: 'In attesa', now: 'Sei qui: stiamo attivando il tuo accesso', later: '', art: VITA_ART.orologio },
  { key: 'TEORIA', title: 'Teoria', now: '', later: "Quiz e lezioni per l'esame di teoria", art: NOTES_ART },
  { key: 'PRATICA', title: 'Foglio rosa', now: '', later: 'Cominci le guide', art: VITA_ART.volante },
  { key: 'PATENTATO', title: 'Patente', now: '', later: "L'esame di guida, e ci sei", art: VITA_ART.esame },
] as const;

export const AllievoAwaitingScreen: React.FC = () => {
  const { user, companies, activeCompanyId } = useSession();
  const insets = useSafeAreaInsets();
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? '';
  const school = companies.find((c) => c.id === activeCompanyId)?.name;

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={fadeIn}>
          <Icon3D source={VITA_ART.edificio} size={64} style={s.hero} />
          <Text style={s.title}>{firstName ? `Ci siamo quasi, ${firstName}` : 'Ci siamo quasi'}</Text>
          <Text style={s.subtitle}>
            {school ? `${school} deve solo attivare il tuo accesso.` : 'La tua autoscuola deve solo attivare il tuo accesso.'}{' '}
            Ti avvisiamo appena è pronto.
          </Text>

          <Text style={s.section}>Il tuo percorso</Text>
          <ClayList>
            {STEPS.map((step, i) => (
              <ClayListRow
                key={step.key}
                leading={<Icon3D source={step.art} size={40} width={48} />}
                title={step.title}
                subtitle={i === 0 ? step.now : step.later}
                dimmed={i !== 0}
                chevron={false}
              />
            ))}
          </ClayList>

          <View style={s.exit}>
            <OnboardingExit />
          </View>
        </Animated.View>
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
  section: { fontSize: 17, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.2, marginTop: 34, marginBottom: 12, paddingHorizontal: 2 },
  exit: { marginTop: 28 },
});
