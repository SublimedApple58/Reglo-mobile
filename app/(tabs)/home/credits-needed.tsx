import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton } from '../../../src/components/clay';
import { CreditsText, PiggyHero } from '../../../src/components/credits/CreditsHero';

/**
 * REG-784 — foglio «Crediti finiti / Mancano 30 minuti»: si apre quando
 * l'allievo prova a prendere una guida che i suoi crediti non coprono
 * (prenotazione, posto liberato, ultimo minuto, scambio). Il server manda il
 * titolo; la riga dice cosa fare.
 */
export default function CreditsNeededSheet() {
  const router = useRouter();
  const { title, line, cta } = useLocalSearchParams<{ title?: string; line?: string; cta?: string }>();
  return (
    <FormSheet
      testID="credits-needed-sheet"
      cta={<ClayButton title={cta || 'Ho capito'} variant="secondary" onPress={() => router.back()} />}
    >
      <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 8 }}>
        <PiggyHero size={120} />
        <CreditsText title={title || 'Crediti finiti'} line={line || 'Ricarica in segreteria e prenoti.'} />
      </View>
    </FormSheet>
  );
}
