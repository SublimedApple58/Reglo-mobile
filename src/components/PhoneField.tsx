import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, ReduceMotion, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { CLAY, CLAY_SHADOW } from '../theme/clay';
import { SOFT } from '../utils/motion';
import { countryPickerStore } from '../stores/countryPickerStore';
import {
  ITALY,
  flagOf,
  looksLikeEmail,
  nationalDigits,
  splitInternational,
  toE164,
  type PhoneCountry,
} from '../utils/phoneCountries';

const ERROR = '#C13515';
const N = ReduceMotion.Never;
const msgIn = FadeIn.duration(200).reduceMotion(N);
const msgOut = FadeOut.duration(150).reduceMotion(N);

export type PhoneValue = { country: PhoneCountry; text: string };

/** Valore iniziale da un numero già scritto (es. `+39333…` o `333…`). */
export function phoneValueFrom(raw?: string | null): PhoneValue {
  const split = raw ? splitInternational(raw) : null;
  return split ? { country: split.country, text: split.national } : { country: ITALY, text: raw ?? '' };
}

/** Il campo contiene un'email (solo con `allowEmail`). */
export const phoneIsEmail = (v: PhoneValue) => looksLikeEmail(v.text);

/** Cosa mandare al server: l'email così com'è, altrimenti il numero in E.164. */
export function phoneSubmitValue(v: PhoneValue): string {
  const text = v.text.trim();
  if (!text) return '';
  if (looksLikeEmail(text)) return text;
  return toE164(v.country, text);
}

/** Abbastanza cifre per un numero vero. */
export const phoneIsComplete = (v: PhoneValue) => !looksLikeEmail(v.text) && nationalDigits(v.text) >= 6;

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'onChange' | 'style'> & {
  label: string;
  value: PhoneValue;
  onChange: (value: PhoneValue) => void;
  /** «Email o telefono» (Accedi, Password dimenticata): il prefisso compare solo quando si scrive un numero. */
  allowEmail?: boolean;
  /** Errore attaccato al campo: bordo rosso e messaggio subito sotto, in dissolvenza. */
  error?: string | null;
  /** Riserva sotto il campo la riga dell'errore: quando compare non sposta nulla. */
  reserveErrorSpace?: boolean;
  /** `clay` = passi del Primo accesso · `auth` = foglio Accedi / Password dimenticata. */
  variant?: 'clay' | 'auth';
  /** Variante scura dei campi `auth` (Android inline). */
  dark?: boolean;
};

/**
 * IL campo telefono di Reglo: a sinistra il prefisso del paese (bandierina e
 * `+39`, Italia preselezionata) che apre il foglio «Prefisso» con ricerca, a
 * destra il numero. Incollare `+41…` o `0041…` sceglie da sé il paese. Si usa
 * ovunque si scrive un numero: Primo accesso, Accedi, Password dimenticata.
 */
export const PhoneField = forwardRef<TextInput, Props>(function PhoneField(
  {
    label,
    value,
    onChange,
    allowEmail,
    error,
    reserveErrorSpace,
    variant = 'clay',
    dark,
    placeholder,
    onFocus,
    onBlur,
    ...input
  },
  ref,
) {
  const router = useRouter();
  const innerRef = useRef<TextInput | null>(null);
  const [focused, setFocused] = useState(false);
  const latest = useRef(value);
  latest.current = value;

  const email = allowEmail && looksLikeEmail(value.text);
  // Con «email o telefono» il prefisso aspetta la prima cifra: per l'email non c'entra.
  const showPrefix = allowEmail ? value.text.trim().length > 0 && !email : true;

  const setRefs = (node: TextInput | null) => {
    innerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const change = (text: string) => {
    // Incollato con prefisso internazionale → il paese si sceglie da sé.
    if (!looksLikeEmail(text)) {
      const split = splitInternational(text);
      if (split) {
        onChange({ country: split.country, text: split.national });
        return;
      }
    }
    onChange({ ...latest.current, text });
  };

  const openPicker = () => {
    Keyboard.dismiss();
    countryPickerStore.set({
      selectedIso: value.country.iso,
      onPick: (country) => {
        onChange({ ...latest.current, country });
        // Il foglio si sta chiudendo: la tastiera torna a foglio chiuso.
        setTimeout(() => innerRef.current?.focus(), 420);
      },
    });
    router.push('/(auth)/country-picker');
  };

  const errorOpacity = useAnimatedStyle(
    () => ({ opacity: withTiming(error ? 1 : 0, { duration: 200, easing: SOFT, reduceMotion: N }) }),
    [error],
  );

  const auth = variant === 'auth';
  const defaultPlaceholder = value.country.iso === 'IT' ? '333 123 4567' : 'Numero di telefono';

  return (
    <View style={auth ? a.wrap : c.wrap}>
      <Text style={auth ? [a.label, dark && a.labelDark] : c.label}>{label}</Text>
      <View
        style={
          auth
            ? [a.box, dark ? a.boxDark : a.boxLight, focused && (dark ? a.boxDarkFocus : a.boxLightFocus)]
            : [c.box, CLAY_SHADOW.sink]
        }
      >
        {showPrefix ? (
          <Animated.View entering={allowEmail ? msgIn : undefined} style={s.prefixWrap}>
            <Pressable
              onPress={openPicker}
              hitSlop={{ top: 10, bottom: 10, left: 10 }}
              style={({ pressed }) => [s.prefix, pressed && s.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Prefisso ${value.country.name} +${value.country.dial}. Cambia`}
              testID="phone-country"
            >
              <Text style={s.flag}>{flagOf(value.country.iso)}</Text>
              <Text style={[auth ? a.dial : c.dial, dark && a.inkDark]}>+{value.country.dial}</Text>
              <Ionicons name="chevron-down" size={13} color={dark ? '#8B8B8B' : CLAY.ink4} />
            </Pressable>
            <View style={[s.divider, dark && s.dividerDark]} />
          </Animated.View>
        ) : null}
        <TextInput
          ref={setRefs}
          keyboardType={allowEmail ? undefined : 'phone-pad'}
          textContentType={allowEmail ? 'username' : 'telephoneNumber'}
          autoComplete={allowEmail ? 'username' : 'tel-national'}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={placeholder ?? defaultPlaceholder}
          placeholderTextColor={dark ? '#8B8B8B' : auth ? '#A7A7A7' : CLAY.ink4}
          {...input}
          value={value.text}
          onChangeText={change}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[auth ? a.input : c.input, auth && (dark ? a.inkDark : a.inkLight)]}
        />
        {/* Bordo d'errore: si accende in 200 ms, non cambia la misura del campo. */}
        <Animated.View pointerEvents="none" style={[auth ? a.errorRing : c.errorRing, errorOpacity]} />
      </View>
      <View style={reserveErrorSpace ? s.errorSlot : null}>
        {error ? (
          <Animated.Text entering={msgIn} exiting={msgOut} style={s.error} testID="phone-error">
            {error}
          </Animated.Text>
        ) : null}
      </View>
    </View>
  );
});

/** Stato del campo: `const phone = usePhoneValue(params.phone)`. */
export function usePhoneValue(initial?: string | null) {
  const [value, setValue] = useState<PhoneValue>(() => phoneValueFrom(initial));
  // Il numero può arrivare dopo (es. param di navigazione): lo si prende una volta.
  const seeded = useRef(!!initial);
  useEffect(() => {
    if (!seeded.current && initial) {
      seeded.current = true;
      setValue(phoneValueFrom(initial));
    }
  }, [initial]);
  return useMemo(() => ({ value, setValue }), [value]);
}

const s = StyleSheet.create({
  prefixWrap: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  prefix: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 12, alignSelf: 'stretch' },
  pressed: { opacity: 0.55 },
  flag: { fontSize: 20, lineHeight: 24 },
  divider: { width: StyleSheet.hairlineWidth * 2, height: 22, backgroundColor: 'rgba(17,17,17,0.12)', marginRight: 12 },
  dividerDark: { backgroundColor: 'rgba(245,239,230,0.18)' },
  errorSlot: { minHeight: 18 },
  error: { fontSize: 13.5, lineHeight: 18, fontWeight: '500', color: ERROR, paddingHorizontal: 4, marginTop: 8 },
});

/** Variante clay: stessa misura e incavo di `ClayField`. */
const c = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 15, fontWeight: '500', color: CLAY.ink, paddingHorizontal: 2 },
  box: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dial: { fontSize: 16.5, fontWeight: '500', color: CLAY.ink, letterSpacing: -0.2 },
  input: { flex: 1, fontSize: 16.5, color: CLAY.ink, letterSpacing: -0.2, paddingVertical: 12 },
  errorRing: { ...StyleSheet.absoluteFillObject, borderRadius: 16, borderWidth: 1.5, borderColor: ERROR },
});

/** Variante dei fogli Accedi / Password dimenticata: stessa misura di `AuthField`. */
const a = StyleSheet.create({
  wrap: { marginTop: 13 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6, marginLeft: 3, color: '#0A0A0A' },
  labelDark: { color: '#B0B0B0' },
  box: { height: 54, borderRadius: 15, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  boxLight: { backgroundColor: '#FFFFFF', borderColor: '#EBEBEB' },
  boxLightFocus: { borderColor: '#111111' },
  boxDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(245,239,230,0.16)' },
  boxDarkFocus: { borderColor: 'rgba(245,239,230,0.55)', backgroundColor: 'rgba(255,255,255,0.08)' },
  dial: { fontSize: 15, fontWeight: '500', color: '#111111' },
  input: { flex: 1, fontSize: 15, fontWeight: '500', paddingVertical: 0 },
  inkLight: { color: '#111111' },
  inkDark: { color: '#F5EFE6' },
  errorRing: { position: 'absolute', top: -1.5, left: -1.5, right: -1.5, bottom: -1.5, borderRadius: 15, borderWidth: 1.5, borderColor: ERROR },
});
