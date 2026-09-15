import React, { useEffect, useRef } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';

/**
 * REG-451 — schermata "Scanner" del prototipo `QR Istruttore.html`: anteprima
 * fotocamera a tutto schermo, riquadro con angoli e linea di scansione,
 * "Inserisci il codice a mano" in basso.
 *
 * Importa `expo-camera` (modulo nativo): va caricato SOLO se il binario lo
 * contiene — vedi `hasCameraModule()` in InstructorLinkScreen.
 */

const RED = '#ff5c7a';

export function InstructorQrScanner({
  paddingTop,
  paddingBottom,
  onClose,
  onManual,
  onScanned,
}: {
  paddingTop: number;
  paddingBottom: number;
  onClose: () => void;
  onManual: () => void;
  onScanned: (data: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const lock = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  const granted = !!permission?.granted;
  const denied = !!permission && !permission.granted && !permission.canAskAgain;

  return (
    <View style={s.root} testID="instructor-qr-scanner">
      <StatusBar style="light" />
      {granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (lock.current || !data) return;
            lock.current = true;
            onScanned(data);
          }}
        />
      ) : null}
      {granted ? <View style={[StyleSheet.absoluteFill, s.dim]} pointerEvents="none" /> : null}

      <View style={[s.content, { paddingTop, paddingBottom }]}>
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={s.headerLeft}>Chiudi</Text>
          </Pressable>
          <Text style={s.headerTitle}>SCANSIONA QR</Text>
          <View style={{ width: 48 }} />
        </View>

        <View style={s.center}>
          <View style={s.frame}>
            <View style={[s.corner, s.tl]} />
            <View style={[s.corner, s.tr]} />
            <View style={[s.corner, s.bl]} />
            <View style={[s.corner, s.br]} />
            <View style={s.line} />
          </View>
          <Text style={s.hint}>
            {denied
              ? 'Per inquadrare il QR consenti a Reglo di usare la fotocamera.'
              : 'Inquadra il QR sulla card del tuo istruttore'}
          </Text>
          {denied ? (
            <Pressable onPress={() => void Linking.openSettings()} hitSlop={8}>
              <Text style={s.settingsLink}>Apri le impostazioni</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={s.buttons}>
          <Pressable onPress={onManual} style={({ pressed }) => [s.manualBtn, pressed && { opacity: 0.85 }]}>
            <Text style={s.manualText}>Inserisci il codice a mano</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111118' },
  dim: { backgroundColor: 'rgba(17,17,24,0.35)' },
  content: { flex: 1, paddingHorizontal: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerLeft: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  headerTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: 'rgba(255,255,255,0.6)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240 },
  corner: { position: 'absolute', width: 44, height: 44, borderColor: '#ffffff' },
  tl: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 14 },
  tr: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 14 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 14 },
  br: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 14 },
  line: {
    position: 'absolute', left: 16, right: 16, top: 119, height: 2, backgroundColor: RED,
    shadowColor: RED, shadowOpacity: 1, shadowRadius: 7, shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  hint: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 32, maxWidth: 260, lineHeight: 22.5, textAlign: 'center' },
  settingsLink: { marginTop: 12, fontSize: 14, fontWeight: '700', color: '#ffffff', textDecorationLine: 'underline' },
  buttons: { gap: 10 },
  manualBtn: {
    height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  manualText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
});
