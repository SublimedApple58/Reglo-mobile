import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayField } from '../../../src/components/clay';
import { ownerInstructorSheetStore } from '../../../src/stores/ownerInstructorSheetStore';
import { regloApi } from '../../../src/services/regloApi';
import { CLAY } from '../../../src/theme/clay';

/**
 * «Invita istruttore» (Panoramica istruttori del titolare, REG-639 clay):
 * form sheet unico con il campo email. Registrato in `role/` e in `more/`
 * (che lo ri-esporta). Seed: `ownerInstructorSheetStore.setInvite`.
 */
export default function InstructorInviteSheet() {
  const router = useRouter();
  const data = useSyncExternalStore(ownerInstructorSheetStore.subscribe, ownerInstructorSheetStore.getInvite);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => { ownerInstructorSheetStore.clearInvite(); };
  }, []);

  const handleSendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setError('Inserisci un indirizzo email valido');
      return;
    }
    setInviteSending(true);
    try {
      await regloApi.createInvite({ email, autoscuolaRole: 'INSTRUCTOR' });
      const onSent = data?.onSent;
      router.back();
      if (onSent) setTimeout(onSent, 250);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nell\'invio dell\'invito');
    } finally {
      setInviteSending(false);
    }
  };

  return (
    <FormSheet
      title="Invita istruttore"
      testID="instructor-invite-sheet"
      onClose={() => { if (!inviteSending) router.back(); }}
      busy={inviteSending}
      cta={
        <ClayButton
          title="Invia invito"
          onPress={handleSendInvite}
          loading={inviteSending}
          disabled={inviteSending}
          testID="instructor-invite-send"
        />
      }
    >
      <View style={s.body}>
        <Text style={s.text}>
          Inserisci l'email dell'istruttore. Riceverà un invito per scaricare l'app e unirsi alla tua autoscuola.
        </Text>
        <ClayField
          label="Email"
          placeholder="Email istruttore"
          value={inviteEmail}
          onChangeText={(v) => { setInviteEmail(v); if (error) setError(null); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
          testID="instructor-invite-email"
        />
      </View>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  body: { gap: 18 },
  text: { fontSize: 15, lineHeight: 21, color: CLAY.ink3, paddingHorizontal: 2 },
});
