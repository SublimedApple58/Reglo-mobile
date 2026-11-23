import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClayButton, Icon3D } from '../components/clay';
import { useSession } from '../context/SessionContext';
import { CLAY } from '../theme/clay';
import { softStagger } from '../utils/motion';

/**
 * REG-773 — schermata dell'autoscuola in manutenzione. Prende il posto di
 * tutta l'app per chi è bloccato; l'unica azione è «Esci». Il testo è quello
 * di una manutenzione tecnica neutra: uguale per tutti i ruoli, non dice mai
 * chi l'ha attivata né l'ambito. Allo sblocco la sessione si aggiorna al
 * ritorno in primo piano (SessionContext) e l'app riparte da sola.
 */
export function MaintenanceScreen() {
  const insets = useSafeAreaInsets();
  const { companies, activeCompanyId, signOut } = useSession();
  const [leaving, setLeaving] = useState(false);
  const companyName = companies.find((item) => item.id === activeCompanyId)?.name ?? 'La tua autoscuola';

  const handleSignOut = () => {
    setLeaving(true);
    signOut().catch(() => setLeaving(false));
  };

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]} testID="maintenance-screen">
      <StatusBar style="dark" />
      <View style={s.center}>
        <Animated.View entering={softStagger(0)}>
          <Icon3D source={require('../../assets/icons3d-ai/barriera-grande.png')} size={150} />
        </Animated.View>
        <Animated.Text entering={softStagger(1)} style={s.title}>
          {companyName} è in manutenzione
        </Animated.Text>
        <Animated.Text entering={softStagger(2)} style={s.body}>
          L&apos;account è temporaneamente in manutenzione e l&apos;app tornerà disponibile il prima possibile.
        </Animated.Text>
      </View>
      <Animated.View entering={softStagger(3)}>
        <ClayButton title="Esci" variant="secondary" onPress={handleSignOut} loading={leaving} testID="maintenance-sign-out" />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    marginTop: 14,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: CLAY.ink,
    textAlign: 'center',
  },
  body: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: CLAY.ink3,
    textAlign: 'center',
  },
});

