import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ToggleSwitch } from './ToggleSwitch';
import { regloApi } from '../services/regloApi';
import { colors } from '../theme/colors';

/**
 * «Avvisi su WhatsApp» nel profilo (REG-500).
 *
 * Chi non ha l'app aperta riceve promemoria e cambi di programma su WhatsApp,
 * dal numero di Reglo. Qui la persona li spegne o li riaccende da sé: spegnere
 * vale come rispondere STOP. Niente aggiornamento ottimistico (regola del
 * 17/06): l'interruttore si muove solo quando il backend ha risposto.
 */
export function WhatsAppAlertsRow() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const pref = await regloApi.getWhatsAppPreference();
      setEnabled(pref.enabled);
    } catch {
      setEnabled(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onChange = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await regloApi.setWhatsAppPreference(next);
      await load();
    } catch {
      setError('Non siamo riusciti a salvare. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.row}>
      <Ionicons name="logo-whatsapp" size={22} color="#111111" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.title}>Avvisi su WhatsApp</Text>
        <Text style={s.subtitle}>
          {error ?? 'Promemoria e cambi di programma delle tue guide, dal numero di Reglo.'}
        </Text>
      </View>
      {enabled === null || busy ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <ToggleSwitch value={enabled} onValueChange={onChange} activeColor="#111111" />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EBEBEB',
  },
  title: { fontSize: 15, fontWeight: '600', color: '#111111' },
  subtitle: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginTop: 1, lineHeight: 18 },
});
