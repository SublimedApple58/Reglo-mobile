import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayField } from '../../../src/components/clay';
import { ProfilePhotoEditor } from '../../../src/components/ProfilePhotoEditor';
import { useSession } from '../../../src/context/SessionContext';
import { regloApi } from '../../../src/services/regloApi';
import { CLAY_DANGER } from '../../../src/components/ClayAccountParts';
import { WhatsAppAlertsRow } from '../../../src/components/WhatsAppAlertsRow';

/**
 * «Modifica profilo» istruttore/titolare — REG-639 clay: il form sheet unico
 * (FORM_SHEET + FormSheet). Foto e avvisi WhatsApp sono componenti condivisi
 * col profilo allievo: qui sono solo posizionati.
 */
export default function MoreProfileEditScreen() {
  const router = useRouter();
  const { user, refreshMe } = useSession();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setError('Nome troppo corto');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await regloApi.updateProfile({ name: trimmed, phone: phone.trim() });
      await refreshMe();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornando il profilo');
      setSaving(false);
    }
  };

  return (
    <FormSheet
      title="Modifica profilo"
      subtitle={user?.email ?? undefined}
      testID="profile-edit-sheet"
      cta={<ClayButton title="Salva" onPress={handleSave} loading={saving} testID="profile-edit-save" />}
    >
      <View style={s.body}>
        <ProfilePhotoEditor />
        <ClayField
          label="Nome completo"
          placeholder="Nome"
          value={name}
          onChangeText={(t) => { setName(t); setError(null); }}
          testID="profile-edit-name"
        />
        <ClayField
          label="Numero di cellulare"
          placeholder="Cellulare"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          testID="profile-edit-phone"
        />
        <WhatsAppAlertsRow />
        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  body: { gap: 18 },
  error: { fontSize: 14, color: CLAY_DANGER, paddingHorizontal: 4 },
});
