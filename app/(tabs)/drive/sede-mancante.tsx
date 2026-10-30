import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton } from '../../../src/components/clay';
import { CLAY } from '../../../src/theme';

/**
 * REG-658 «Manca l'indirizzo della sede»: la sede dell'autoscuola non ha
 * ancora l'indirizzo, quindi il giro della prossima guida non sa dove
 * chiudersi. Lo inserisce il titolare dalla web app (lì è bloccante, REG-656);
 * qui solo un avviso: non blocca Road. Si apre da solo una volta per avvio
 * (`headquartersPrompt`). Form sheet unico: X, trascinando giù o «Ho capito».
 */
export default function RoadSedeMancanteSheet() {
  const router = useRouter();
  return (
    <FormSheet
      testID="road-sede-mancante"
      cta={<ClayButton title="Ho capito" onPress={() => router.back()} testID="road-sede-mancante-ok" />}
    >
      <View style={s.body}>
        <Image source={require('../../../assets/web/settings/sede-autoscuola.png')} style={s.art} resizeMode="contain" />
        <Text style={s.title}>Manca l&apos;indirizzo della sede</Text>
        <Text style={s.text}>
          Il titolare deve ancora inserirlo nella web app, in Impostazioni › Sede e luoghi. Fino ad allora il giro
          della prossima guida si chiude all&apos;ultima tappa.
        </Text>
        <Text style={s.note}>Road funziona lo stesso: puoi partire come sempre.</Text>
      </View>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  body: { alignItems: 'center', paddingTop: 4, paddingBottom: 6 },
  art: { width: 96, height: 96, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '600', color: CLAY.ink, letterSpacing: -0.4, textAlign: 'center' },
  text: { fontSize: 15.5, fontWeight: '400', color: CLAY.ink2, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  note: { fontSize: 14, fontWeight: '400', color: CLAY.ink3, textAlign: 'center', marginTop: 12 },
});
