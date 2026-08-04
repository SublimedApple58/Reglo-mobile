import React, { useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SheetScaffold } from '../../../src/components/SheetScaffold';
import { GradientCTABackground, primaryCtaShadow } from '../../../src/components/GradientCTA';
import { Input } from '../../../src/components/Input';
import { settingsStore } from '../../../src/stores/settingsStore';
import { useSession } from '../../../src/context/SessionContext';
import { regloApi } from '../../../src/services/regloApi';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function ProfileEditScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(settingsStore.subscribe, settingsStore.get);
  const { user, refreshMe } = useSession();
  const [photoUploading, setPhotoUploading] = useState(false);

  if (!data) return <View style={s.root} />;

  const { name, phone, saving, setName, setPhone, onSaveProfile } = data;

  const uploadPickedImage = async (asset: ImagePicker.ImagePickerAsset) => {
    setPhotoUploading(true);
    try {
      await regloApi.uploadProfilePhoto({
        uri: asset.uri,
        name: asset.fileName ?? 'foto-profilo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      await refreshMe();
    } catch (error) {
      Alert.alert(
        'Upload non riuscito',
        error instanceof Error ? error.message : 'Riprova tra poco.',
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  // La foto viene caricata ESATTAMENTE come scattata/scelta: nessun
  // editing/crop/resize lato app (l'adattamento avviene solo al download web).
  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadPickedImage(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Fotocamera non disponibile', 'Concedi il permesso dalle impostazioni.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadPickedImage(result.assets[0]);
    }
  };

  const handlePhotoPress = () => {
    if (photoUploading) return;
    Alert.alert('Foto profilo', undefined, [
      { text: 'Scatta una foto', onPress: () => void takePhoto() },
      { text: 'Scegli dalla libreria', onPress: () => void pickFromLibrary() },
      { text: 'Annulla', style: 'cancel' },
    ]);
  };

  return (
    <View style={[s.root, Platform.OS === 'android' && { flex: 1 }]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.closeBtn}>
          <Ionicons name="close" size={20} color="#1A1A2E" />
        </Pressable>
      </View>

      <SheetScaffold
        keyboardAware
        style={{ gap: 16 }}
        contentContainerStyle={{ gap: 16 }}
        footer={
          <Pressable
            onPress={() => { onSaveProfile(); router.back(); }}
            disabled={saving}
            style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }, saving && { opacity: 0.6 }]}
          >
            <GradientCTABackground radius={26} />
            <Text style={s.ctaText}>{saving ? 'Salvataggio...' : 'Salva'}</Text>
          </Pressable>
        }
      >
        <Text style={s.title}>Modifica profilo</Text>

        <View style={s.field}>
          <Text style={s.label}>Foto profilo</Text>
          <Pressable
            onPress={handlePhotoPress}
            style={({ pressed }) => [s.mediaRow, pressed && !photoUploading && { opacity: 0.9 }]}
          >
            <View style={s.photoCircle}>
              {photoUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : user?.photoUrl ? (
                <Image source={{ uri: user.photoUrl }} style={s.photoImage} />
              ) : (
                <Ionicons name="person-outline" size={22} color={colors.textMuted} />
              )}
            </View>
            <Text style={s.mediaRowLabel}>
              {user?.photoUrl ? 'Sostituisci foto' : 'Aggiungi foto'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </Pressable>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Firma</Text>
          <Pressable
            onPress={() => router.push('/(tabs)/settings/signature')}
            style={({ pressed }) => [s.mediaRow, pressed && { opacity: 0.9 }]}
          >
            <View style={s.signatureBox}>
              {user?.signatureUrl ? (
                <Image
                  source={{ uri: user.signatureUrl }}
                  style={s.signatureImage}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons name="create-outline" size={20} color={colors.textMuted} />
              )}
            </View>
            <Text style={s.mediaRowLabel}>
              {user?.signatureUrl ? 'Rifai la firma' : 'Apponi la firma'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </Pressable>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Nome completo</Text>
          <Input placeholder="Nome" value={name} onChangeText={setName} />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Numero di cellulare</Text>
          <Input placeholder="Cellulare" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>
      </SheetScaffold>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: colors.background, paddingTop: 20, paddingHorizontal: spacing.lg, paddingBottom: 32, gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -4, marginBottom: -8 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3, marginBottom: 4 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  mediaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 16,
    backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10,
  },
  mediaRowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1A1A2E' },
  photoCircle: {
    width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
    backgroundColor: '#E9EBF2', alignItems: 'center', justifyContent: 'center',
  },
  photoImage: { width: '100%', height: '100%' },
  signatureBox: {
    width: 76, height: 36, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#F5F6F8', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  signatureImage: { width: '100%', height: '100%' },
  cta: {
    minHeight: 50, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    ...primaryCtaShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
