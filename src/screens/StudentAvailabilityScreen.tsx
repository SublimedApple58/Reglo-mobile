import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { ClayLargeTitleScroll } from '../components/ClayLargeTitle';
import { ClayButton } from '../components/clay';
import { SkeletonBlock } from '../components/Skeleton';
import { StudentAvailabilityEditor } from '../components/studentAvailability/StudentAvailabilityEditor';
import { ToastNotice, type ToastTone } from '../components/ToastNotice';
import { useSession } from '../context/SessionContext';
import { useMyStudentAvailability } from '../hooks/queries/useMyStudentAvailability';
import { queryKeys } from '../hooks/queries/queryKeys';
import { regloApi } from '../services/regloApi';
import { CLAY } from '../theme/clay';
import type { StudentBandsByDay } from '../types/regloApi';
import { SOFT_SWAP_IN, SOFT_SWAP_OUT } from '../utils/motion';
import { DEFAULT_BANDS, hasAnyBand, sameDays } from '../utils/studentAvailability';
import { fadeIn } from './firstAccess/FirstAccessStepScreen';

/**
 * REG-802 · Profilo › Disponibilità dell'allievo: stesso editor dello step
 * dell'onboarding (settimana, «Va bene qualsiasi orario», sette giorni) in una
 * pagina col titolo grande che collassa allo scroll. «Salva» compare solo con
 * modifiche e resta finché il server non risponde (spinner, niente chiusura
 * anticipata come la pagina di prima).
 */
export function StudentAvailabilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeCompanyId } = useSession();
  const query = useMyStudentAvailability();
  const bands = query.data?.bands ?? DEFAULT_BANDS;
  const [days, setDays] = useState<StudentBandsByDay | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);

  // Le scelte nascono dal server una volta sola; poi comanda la pagina.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !query.data) return;
    seeded.current = true;
    setDays(query.data.days);
  }, [query.data]);

  const saved = query.data?.days ?? {};
  const dirty = days !== null && !sameDays(days, saved, bands);
  const canSave = dirty && hasAnyBand(days);

  const save = async () => {
    if (!days || saving) return;
    setSaving(true);
    try {
      const data = await regloApi.saveMyAvailability(days);
      queryClient.setQueryData(queryKeys.studentAvailability(activeCompanyId), data);
      setDays(data.days);
      setToast({ text: 'Disponibilità salvate', tone: 'success' });
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : 'Non siamo riusciti a salvare', tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ClayLargeTitleScroll
        title="Disponibilità"
        subtitle="Quando puoi fare guida. Puoi sempre prenotare anche altri orari: queste servono per avvisarti dei posti adatti a te."
        onBack={() => router.back()}
        contentContainerStyle={[s.scroll, dirty && s.scrollWithCta]}
      >
        {days ? (
          <Animated.View entering={fadeIn}>
            <StudentAvailabilityEditor
              days={days}
              bands={bands}
              onChange={setDays}
              dayHref="/(tabs)/settings/student-day"
            />
            {!hasAnyBand(days) ? (
              <Text style={s.note}>Scegli almeno una fascia per salvare.</Text>
            ) : null}
          </Animated.View>
        ) : (
          <View style={s.skeleton}>
            <SkeletonBlock height={190} radius={28} />
            <SkeletonBlock height={62} radius={28} />
            <SkeletonBlock height={320} radius={28} />
          </View>
        )}
      </ClayLargeTitleScroll>
      {dirty ? (
        <Animated.View entering={SOFT_SWAP_IN} exiting={SOFT_SWAP_OUT} style={s.bottom}>
          <ClayButton title="Salva" onPress={save} loading={saving} disabled={!canSave || saving} testID="student-availability-save" />
        </Animated.View>
      ) : null}
      <ToastNotice message={toast?.text ?? null} tone={toast?.tone} onHide={() => setToast(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  scrollWithCta: { paddingBottom: 110 },
  skeleton: { gap: 14 },
  note: { fontSize: 13.5, lineHeight: 19, color: CLAY.ink3, marginTop: 12, paddingHorizontal: 4 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, backgroundColor: CLAY.bg },
});
