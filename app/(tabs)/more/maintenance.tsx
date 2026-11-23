import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { FormSheet } from '../../../src/components/SheetScaffold';
import { ClayButton, ClayField, ClayList } from '../../../src/components/clay';
import { SettingCheckRow } from '../../../src/components/SettingsRows';
import { CLAY_DANGER } from '../../../src/components/ClayAccountParts';
import { useSession } from '../../../src/context/SessionContext';
import { regloApi } from '../../../src/services/regloApi';
import { CLAY } from '../../../src/theme/clay';
import { MaintenanceScope } from '../../../src/types/regloApi';

const SCOPES: Array<{ value: MaintenanceScope; title: string; subtitle: string }> = [
  {
    value: 'OWNER_ONLY',
    title: 'Solo te',
    subtitle: "Web e app del titolare. Istruttori e allievi continuano a usare l'app.",
  },
  {
    value: 'EVERYONE',
    title: 'Tutti',
    subtitle: 'Anche istruttori e allievi. Si fermano promemoria, WhatsApp e segreteria.',
  },
];

const normalize = (value: string) =>
  value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('it-IT');

/**
 * REG-773 — «Metti in manutenzione» (titolare). Form sheet di conferma:
 * ambito + nome dell'autoscuola scritto, perché il titolare non può annullare
 * (lo sblocco lo fa solo il backoffice). Vedi docs/features/maintenance-mode.md.
 */
export default function MaintenanceSheet() {
  const router = useRouter();
  const { companies, activeCompanyId, refreshMe } = useSession();
  const companyName = companies.find((item) => item.id === activeCompanyId)?.name ?? '';
  const [scope, setScope] = useState<MaintenanceScope>('OWNER_ONLY');
  const [typed, setTyped] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = normalize(companyName).length > 0 && normalize(typed) === normalize(companyName);
  // Legato a `!saving` (regola di FormSheet): dopo la conferma il foglio si
  // chiude senza la domanda «Vuoi uscire senza salvare?».
  const dirty = !saving && (typed.length > 0 || scope !== 'OWNER_ONLY');

  const handleConfirm = async () => {
    if (!confirmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await regloApi.activateMaintenance({ scope, confirmName: typed });
      // Prima si chiude il foglio, poi la sessione passa alla schermata di
      // manutenzione (che smonta tutta l'app, foglio compreso).
      router.back();
      setTimeout(() => {
        refreshMe().catch(() => undefined);
      }, 350);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non è stato possibile attivare la manutenzione.');
      setSaving(false);
    }
  };

  return (
    <FormSheet
      title="Metti in manutenzione"
      subtitle={
        <Text style={s.lead}>
          L&apos;account si blocca subito. Nessun dato viene cancellato, ma{' '}
          <Text style={s.strong}>non potrai riattivarlo tu</Text>: lo sblocco lo fa solo Reglo.
        </Text>
      }
      busy={saving}
      dirty={dirty}
      testID="maintenance-sheet"
      cta={
        <ClayButton
          title="Metti in manutenzione"
          onPress={handleConfirm}
          disabled={!confirmed}
          loading={saving}
          testID="maintenance-confirm"
        />
      }
    >
      <View style={s.body}>
        <View>
          <Text style={s.section}>chi blocchi</Text>
          <ClayList>
            {SCOPES.map((option) => (
              <SettingCheckRow
                key={option.value}
                title={option.title}
                subtitle={option.subtitle}
                checked={scope === option.value}
                onPress={() => setScope(option.value)}
                testID={`maintenance-scope-${option.value}`}
              />
            ))}
          </ClayList>
        </View>
        <ClayField
          label={`Per confermare scrivi ${companyName}`}
          placeholder={companyName}
          value={typed}
          onChangeText={(text) => {
            setTyped(text);
            setError(null);
          }}
          autoCapitalize="words"
          autoCorrect={false}
          testID="maintenance-confirm-name"
        />
        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  body: { gap: 22 },
  lead: { fontSize: 15, lineHeight: 22, fontWeight: '500', color: CLAY.ink3 },
  strong: { fontWeight: '600', color: CLAY.ink },
  section: { fontSize: 17, fontWeight: '600', color: CLAY.ink, marginBottom: 8, marginLeft: 4 },
  error: { fontSize: 14, color: CLAY_DANGER, paddingHorizontal: 4 },
});
