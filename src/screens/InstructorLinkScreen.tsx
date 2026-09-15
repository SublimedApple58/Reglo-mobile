import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { regloApi } from '../services/regloApi';
import { RegloApiError } from '../services/apiClient';
import type { InstructorLinkPerson } from '../types/regloApi';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * REG-451 — l'allievo si associa al suo istruttore dal QR della card (o col
 * codice a mano). Schermate 1:1 dal prototipo `QR Istruttore.html`: Conferma,
 * Successo, Già associato, Mantieni, Errore, Codice a mano.
 *
 * Scanner: vive in `InstructorQrScanner` (expo-camera, binari ≥ 2.3.0). Sui
 * binari senza il modulo nativo (2.2.0) si parte dal codice a mano e il QR si
 * legge con la fotocamera del telefono (pagina web /i/<codice> → deep link
 * `associa-istruttore?code=` → questa schermata).
 */

/** true se il binario contiene expo-camera (non richiederlo altrimenti: crash). */
function hasCameraModule(): boolean {
  try {
    return !!requireOptionalNativeModule('ExpoCamera');
  } catch {
    return false;
  }
}

type Step =
  | { kind: 'loading' }
  | { kind: 'scanner' }
  | { kind: 'manuale' }
  | { kind: 'conferma'; code: string; instructor: InstructorLinkPerson; companyName: string; current: InstructorLinkPerson | null }
  | { kind: 'gia'; code: string; instructor: InstructorLinkPerson; companyName: string; current: InstructorLinkPerson }
  | { kind: 'successo'; instructor: InstructorLinkPerson; companyName: string }
  | { kind: 'mantieni'; current: InstructorLinkPerson; companyName: string }
  | { kind: 'errore'; code: string | null; title?: string; message?: string };

const NAVY = '#1a1a2e';

const pop = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }] },
  60: { opacity: 1, transform: [{ scale: 1.08 }], easing: Easing.out(Easing.quad) },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.quad) },
}).duration(500);

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function PrimaryButton({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: disabled ? '#d4d4da' : NAVY }, pressed && !disabled && { opacity: 0.9 }]}
    >
      {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={s.btnPrimaryText}>{label}</Text>}
    </Pressable>
  );
}

function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.btn, s.btnSecondary, pressed && { backgroundColor: '#f7f7f7' }]}>
      <Text style={s.btnSecondaryText}>{label}</Text>
    </Pressable>
  );
}

function Header({ left, title, rightWidth, onLeft, marginBottom = 8 }: { left: string; title: string; rightWidth: number; onLeft: () => void; marginBottom?: number }) {
  return (
    <View style={[s.header, { marginBottom }]}>
      <Pressable onPress={onLeft} hitSlop={12}>
        <Text style={s.headerLeft}>{left}</Text>
      </Pressable>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={{ width: rightWidth }} />
    </View>
  );
}

function PersonCard({ person, companyName, tone }: { person: InstructorLinkPerson; companyName: string; tone: 'teal' | 'blue' }) {
  return (
    <View style={s.personCard}>
      <View style={[s.avatar40, tone === 'teal' ? s.teal : s.blue]}>
        <Text style={[s.avatar40Text, { color: tone === 'teal' ? '#0e7490' : '#1e3a5f', fontWeight: tone === 'teal' ? '800' : '700' }]}>{person.initials}</Text>
      </View>
      <View style={{ minWidth: 0, flex: 1 }}>
        <Text style={s.personName} numberOfLines={1}>{person.name}</Text>
        <Text style={s.personSchool} numberOfLines={1}>{companyName}</Text>
      </View>
      <View style={s.activePill}>
        <Text style={s.activePillText}>ATTIVO</Text>
      </View>
    </View>
  );
}

function Caret() {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0, { duration: 450 })), -1);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[s.caret, style]} />;
}

export function InstructorLinkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ code?: string }>();
  const initialCode = typeof params.code === 'string' && params.code.trim() ? params.code.trim() : null;

  const cameraAvailable = useRef(hasCameraModule()).current;
  const [step, setStep] = useState<Step>(
    initialCode ? { kind: 'loading' } : cameraAvailable ? { kind: 'scanner' } : { kind: 'manuale' },
  );
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  // Aperto da Profilo (non da deep link): "Annulla" torna allo scanner/codice.
  const inFlow = useRef(!initialCode);
  const inputRef = useRef<TextInput>(null);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  }, [router]);

  const toScanner = useCallback(() => {
    inFlow.current = true;
    setStep({ kind: 'scanner' });
  }, []);

  const toManual = useCallback(() => {
    inFlow.current = true;
    setManualCode('');
    setStep({ kind: 'manuale' });
  }, []);

  const errorCopy = (err: unknown): { title: string; message: string } => {
    if (err instanceof RegloApiError && err.status === 403) {
      return { title: 'Solo per gli allievi', message: 'Solo gli allievi possono associarsi a un istruttore.' };
    }
    return { title: 'Codice non verificato', message: 'Non riesco a verificare il codice. Controlla la connessione e riprova.' };
  };

  const verify = useCallback(async (code: string) => {
    setBusy(true);
    try {
      const preview = await regloApi.getInstructorLinkPreview(code);
      if (preview.status === 'invalid') {
        setStep({ kind: 'errore', code: preview.code ?? code.toUpperCase() });
        return;
      }
      setStep({
        kind: 'conferma',
        code: preview.code,
        instructor: preview.instructor,
        companyName: preview.companyName,
        current: preview.currentInstructor,
      });
    } catch (err) {
      setStep({ kind: 'errore', code: code.toUpperCase().slice(0, 12), ...errorCopy(err) });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (initialCode) void verify(initialCode);
  }, [initialCode, verify]);

  const link = useCallback(async (code: string) => {
    setBusy(true);
    try {
      const res = await regloApi.linkInstructor(code);
      if (res.status !== 'linked') {
        setStep({ kind: 'errore', code });
        return;
      }
      await queryClient.invalidateQueries();
      setStep({ kind: 'successo', instructor: res.instructor, companyName: res.companyName });
    } catch (err) {
      setStep({ kind: 'errore', code, ...errorCopy(err) });
    } finally {
      setBusy(false);
    }
  }, [queryClient]);

  const padTop = Math.max(insets.top, 44) + 16;
  const padBottom = Math.max(28, insets.bottom + 8);
  const shell = [s.shell, { paddingTop: padTop, paddingBottom: padBottom }];

  if (step.kind === 'loading') {
    return (
      <View style={[shell, s.center]}>
        <StatusBar style="dark" />
        <ActivityIndicator color={NAVY} />
      </View>
    );
  }

  if (step.kind === 'scanner') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { InstructorQrScanner } = require('../components/InstructorQrScanner') as typeof import('../components/InstructorQrScanner');
    return (
      <InstructorQrScanner
        paddingTop={padTop}
        paddingBottom={padBottom}
        onClose={close}
        onManual={toManual}
        onScanned={(data) => {
          setStep({ kind: 'loading' });
          void verify(data);
        }}
      />
    );
  }

  if (step.kind === 'manuale') {
    const chars = manualCode.split('');
    const ready = manualCode.length === 6;
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#ffffff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar style="dark" />
        <View style={shell}>
          <Header left="Indietro" title="CODICE ISTRUTTORE" rightWidth={56} onLeft={cameraAvailable ? toScanner : close} marginBottom={28} />
          <Text style={[s.title, { textAlign: 'left' }]}>Inserisci il codice</Text>
          <Text style={[s.body, { marginTop: 10, textAlign: 'left', maxWidth: undefined }]}>
            Lo trovi stampato sotto il QR della card del tuo istruttore. 6 caratteri.
          </Text>
          <Pressable style={s.boxes} onPress={() => inputRef.current?.focus()} testID="instructor-link-code-boxes">
            {Array.from({ length: 6 }).map((_, i) => {
              const ch = chars[i];
              const active = !ch && i === chars.length;
              if (ch) {
                return (
                  <View key={i} style={[s.box, s.boxFilled]}>
                    <Text style={s.boxText}>{ch}</Text>
                  </View>
                );
              }
              if (active) {
                return (
                  <View key={i} style={s.boxRing}>
                    <View style={[s.box, s.boxActive]}>
                      <Caret />
                    </View>
                  </View>
                );
              }
              return <View key={i} style={[s.box, s.boxEmpty]} />;
            })}
          </Pressable>
          <TextInput
            ref={inputRef}
            testID="instructor-link-code-input"
            value={manualCode}
            onChangeText={(t) => setManualCode(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6))}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={() => ready && void verify(manualCode)}
            style={s.hiddenInput}
          />
          <View style={s.hintRow}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#929292" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="12" cy="12" r="10" />
              <Path d="M12 8v4M12 16h.01" />
            </Svg>
            <Text style={s.hintText}>Maiuscole e numeri, senza spazi.</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={s.buttons}>
            <PrimaryButton
              label="Continua"
              disabled={!ready}
              loading={busy}
              onPress={() => {
                Keyboard.dismiss();
                void verify(manualCode);
              }}
            />
            {cameraAvailable ? <SecondaryButton label="Scansiona il QR" onPress={toScanner} disabled={busy} /> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step.kind === 'conferma') {
    const onConfirm = () => {
      if (step.current) {
        setStep({ kind: 'gia', code: step.code, instructor: step.instructor, companyName: step.companyName, current: step.current });
      } else {
        void link(step.code);
      }
    };
    const onCancel = () => (inFlow.current ? (cameraAvailable ? toScanner() : toManual()) : close());
    return (
      <View style={shell}>
        <StatusBar style="dark" />
        <Header left="Annulla" title="ASSOCIAZIONE" rightWidth={52} onLeft={onCancel} />
        <View style={s.center}>
          <View style={s.bigAvatarWrap}>
            <Animated.View entering={pop} style={[s.bigAvatar, s.teal]}>
              <Text style={s.bigAvatarText}>{step.instructor.initials}</Text>
            </Animated.View>
            <View style={s.qrBadge}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <Rect x="3" y="3" width="7" height="7" rx="1" />
                <Rect x="14" y="3" width="7" height="7" rx="1" />
                <Rect x="3" y="14" width="7" height="7" rx="1" />
                <Path d="M14 14h3v3M21 14v3M14 21h3M21 21h-1" />
              </Svg>
            </View>
          </View>
          <Text style={s.school}>{step.companyName}</Text>
          <Text style={s.title}>{step.instructor.name}</Text>
          <Text style={s.body}>Vuoi che sia il tuo istruttore di riferimento? Vedrà le tue guide e potrà prenotarle per te.</Text>
          <View style={s.codePill}>
            <Text style={s.codePillText}>{step.code}</Text>
          </View>
        </View>
        <View style={s.buttons}>
          <PrimaryButton label="Conferma associazione" onPress={onConfirm} loading={busy} />
          <SecondaryButton label="Non è il mio istruttore" onPress={onCancel} disabled={busy} />
        </View>
      </View>
    );
  }

  if (step.kind === 'gia') {
    const currentFirst = firstName(step.current.name);
    return (
      <View style={shell}>
        <StatusBar style="dark" />
        <View style={s.center}>
          <Animated.View entering={pop} style={[s.icon96, { backgroundColor: '#fff6d6' }]}>
            <Svg width={42} height={42} viewBox="0 0 24 24" fill="none" stroke="#b58400" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <Circle cx="9" cy="7" r="4" />
              <Path d="m16 11 2 2 4-4" />
            </Svg>
          </Animated.View>
          <Text style={s.title}>Hai già un istruttore</Text>
          <Text style={s.body}>
            Sei associato a <Text style={s.bodyStrong}>{step.current.name}</Text>. Vuoi passare a {step.instructor.name}? Le guide già prenotate restano valide.
          </Text>
          <View style={s.swapRow}>
            <View style={[s.swapCard, { backgroundColor: '#f7f7f7' }]}>
              <View style={[s.avatar32, s.blue]}>
                <Text style={[s.avatar32Text, { color: '#1e3a5f', fontWeight: '700' }]}>{step.current.initials}</Text>
              </View>
              <Text style={s.swapName} numberOfLines={1}>{step.current.name}</Text>
            </View>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#929292" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M5 12h14M13 6l6 6-6 6" />
            </Svg>
            <View style={[s.swapCard, { backgroundColor: NAVY }]}>
              <View style={[s.avatar32, s.teal]}>
                <Text style={[s.avatar32Text, { color: '#0e7490', fontWeight: '800' }]}>{step.instructor.initials}</Text>
              </View>
              <Text style={[s.swapName, { color: '#ffffff' }]} numberOfLines={1}>{step.instructor.name}</Text>
            </View>
          </View>
        </View>
        <View style={s.buttons}>
          <PrimaryButton label="Cambia istruttore" onPress={() => void link(step.code)} loading={busy} />
          <SecondaryButton
            label={`Mantieni ${currentFirst}`}
            disabled={busy}
            onPress={() => setStep({ kind: 'mantieni', current: step.current, companyName: step.companyName })}
          />
        </View>
      </View>
    );
  }

  if (step.kind === 'successo') {
    return (
      <View style={shell}>
        <StatusBar style="dark" />
        <View style={s.center}>
          <Animated.View entering={pop} style={[s.icon96, { backgroundColor: '#e6f6ec' }]}>
            <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#1f9d55" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M5 12.5 10 17.5 19 7" />
            </Svg>
          </Animated.View>
          <Text style={s.title}>{`Sei associato a\n${step.instructor.name}`}</Text>
          <Text style={s.body}>Da ora le tue guide sono seguite da questo istruttore. Lo trovi nel tuo profilo.</Text>
          <PersonCard person={step.instructor} companyName={step.companyName} tone="teal" />
        </View>
        <PrimaryButton label="Vai alle guide" onPress={() => router.replace('/(tabs)/home')} />
      </View>
    );
  }

  if (step.kind === 'mantieni') {
    const currentFirst = firstName(step.current.name);
    return (
      <View style={shell}>
        <StatusBar style="dark" />
        <View style={s.center}>
          <Animated.View entering={pop} style={[s.icon96, s.blue]}>
            <Text style={[s.bigAvatarText, { fontSize: 34, color: '#1e3a5f' }]}>{step.current.initials}</Text>
          </Animated.View>
          <Text style={s.title}>{`Resti con\n${step.current.name}`}</Text>
          <Text style={s.body}>
            Nessuna modifica: il tuo istruttore di riferimento è ancora {currentFirst}. Potrai cambiare in qualsiasi momento dal profilo.
          </Text>
          <PersonCard person={step.current} companyName={step.companyName} tone="blue" />
        </View>
        <PrimaryButton label="Torna al profilo" onPress={close} />
      </View>
    );
  }

  // errore
  return (
    <View style={shell}>
      <StatusBar style="dark" />
      <View style={s.center}>
        <Animated.View entering={pop} style={[s.icon96, { backgroundColor: '#fde8ec' }]}>
          <Svg width={42} height={42} viewBox="0 0 24 24" fill="none" stroke="#c8354f" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Rect x="3" y="3" width="7" height="7" rx="1" />
            <Rect x="14" y="3" width="7" height="7" rx="1" />
            <Rect x="3" y="14" width="7" height="7" rx="1" />
            <Path d="m15 15 6 6M21 15l-6 6" />
          </Svg>
        </Animated.View>
        <Text style={s.title}>{step.title ?? 'Codice non valido'}</Text>
        <Text style={s.body}>
          {step.message ?? 'Questo QR non appartiene alla tua autoscuola o è stato disattivato. Chiedi in segreteria una card aggiornata.'}
        </Text>
        {step.code ? (
          <View style={[s.codePill, s.codePillMuted]}>
            <Text style={s.codeReadLabel}>
              Codice letto: <Text style={s.codeReadValue}>{step.code}</Text>
            </Text>
          </View>
        ) : null}
      </View>
      <View style={s.buttons}>
        {cameraAvailable ? (
          <>
            <PrimaryButton label="Scansiona di nuovo" onPress={toScanner} />
            <SecondaryButton label="Inserisci il codice a mano" onPress={toManual} />
          </>
        ) : (
          <>
            <PrimaryButton label="Inserisci il codice a mano" onPress={toManual} />
            <SecondaryButton label="Chiudi" onPress={close} />
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { fontSize: 15, fontWeight: '600', color: '#6a6a6a' },
  headerTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: '#929292' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, color: '#222222', lineHeight: 29, textAlign: 'center' },
  school: { fontSize: 13, fontWeight: '600', color: '#929292', marginBottom: 6 },
  body: { fontSize: 15, fontWeight: '500', color: '#6a6a6a', lineHeight: 22.5, marginTop: 14, maxWidth: 280, textAlign: 'center' },
  bodyStrong: { color: '#222222', fontWeight: '700' },
  bigAvatarWrap: { width: 104, height: 104, marginBottom: 22 },
  bigAvatar: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  bigAvatarText: { fontSize: 38, fontWeight: '800', letterSpacing: -0.5, color: '#0e7490' },
  qrBadge: {
    position: 'absolute', right: -4, bottom: -4, width: 34, height: 34, borderRadius: 17,
    backgroundColor: NAVY, borderWidth: 3, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
  },
  teal: { backgroundColor: '#d9f2f4' },
  blue: { backgroundColor: '#dbeafe' },
  codePill: { marginTop: 22, backgroundColor: '#f7f7f7', borderWidth: 1, borderColor: '#dddddd', borderRadius: 99, paddingVertical: 8, paddingHorizontal: 14 },
  codePillText: { fontSize: 12, fontWeight: '700', letterSpacing: 2, color: '#222222' },
  codePillMuted: { borderWidth: 0 },
  codeReadLabel: { fontSize: 12, fontWeight: '600', color: '#929292' },
  codeReadValue: { color: '#6a6a6a', letterSpacing: 1.5 },
  icon96: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  buttons: { gap: 10 },
  btn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  btnSecondary: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#dddddd' },
  btnSecondaryText: { fontSize: 16, fontWeight: '600', color: '#222222' },
  personCard: {
    marginTop: 26, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f7f7f7',
    borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, alignSelf: 'stretch',
  },
  avatar40: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatar40Text: { fontSize: 14, letterSpacing: -0.5 },
  personName: { fontSize: 14, fontWeight: '700', color: '#222222' },
  personSchool: { fontSize: 12, fontWeight: '500', color: '#929292' },
  activePill: { backgroundColor: '#e6f6ec', borderRadius: 99, paddingVertical: 5, paddingHorizontal: 9 },
  activePillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, color: '#1f9d55' },
  swapRow: { marginTop: 26, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  swapCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, minWidth: 0 },
  avatar32: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatar32Text: { fontSize: 12 },
  swapName: { fontSize: 13, fontWeight: '700', color: '#222222', flexShrink: 1 },
  boxes: { flexDirection: 'row', gap: 8, marginTop: 28 },
  box: { flex: 1, height: 58, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  boxFilled: { borderColor: '#222222', backgroundColor: '#ffffff' },
  boxRing: { flex: 1, borderRadius: 17, margin: -3, borderWidth: 3, borderColor: 'rgba(26,26,46,0.12)' },
  boxActive: { borderColor: NAVY, backgroundColor: '#ffffff' },
  boxEmpty: { borderColor: '#dddddd', backgroundColor: '#f7f7f7' },
  boxText: { fontSize: 24, fontWeight: '800', color: '#222222' },
  caret: { width: 2, height: 26, backgroundColor: NAVY, borderRadius: 1 },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1, left: -100 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  hintText: { fontSize: 13, fontWeight: '500', color: '#929292' },
});
