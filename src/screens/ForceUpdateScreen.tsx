import React, { useState } from 'react';
import { Image, Linking, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';

import { storeUrl } from '../config/forceUpdate';

/**
 * Full-screen, non-dismissable "update required" gate for legacy binaries.
 * Pure JS (Image + Text + Pressable + Linking) so it can never crash the old
 * binary it ships to via OTA. No SafeAreaProvider dependency — it renders above
 * the whole app tree.
 */
export function ForceUpdateScreen() {
  const [opening, setOpening] = useState(false);

  const openStore = async () => {
    setOpening(true);
    try {
      await Linking.openURL(storeUrl());
    } catch {
      // ignore — the user can still open the store manually
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.center}>
        <Image source={require('../../assets/icon.png')} style={s.logo} resizeMode="cover" />
        <Text style={s.title}>Aggiorna Reglo</Text>
        <Text style={s.body}>
          È disponibile una nuova versione dell&apos;app.{'\n'}
          Aggiornala per continuare a usare Reglo.
        </Text>
      </View>

      <Pressable
        onPress={openStore}
        disabled={opening}
        style={({ pressed }) => [s.button, pressed && { opacity: 0.9 }]}
      >
        <Text style={s.buttonText}>{opening ? 'Apertura…' : 'Aggiorna ora'}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FDFDFD',
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 24 : 64,
    paddingBottom: 40,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  logo: { width: 88, height: 88, borderRadius: 22 },
  title: { fontSize: 22, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3 },
  body: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6A6A6A',
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2 },
});
