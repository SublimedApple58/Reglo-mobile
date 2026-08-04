import React, { useMemo, useState, useSyncExternalStore } from 'react';
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

const AVATAR_SIZE = 128;

export default function ProfileEditScreen() {
  const router = useRouter();
  const data = useSyncExternalStore(settingsStore.subscribe, settingsStore.get);
  const { user, refreshMe } = useSession();
  const [photoUploading, setPhotoUploading] = useState(false);

  const initials = useMemo(() => {
    const source = (user?.name ?? user?.email ?? 'U').trim();
    const parts = source.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return source.slice(0, 2).toUpperCase();
  }, [user?.email, user?.name]);

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

        {/* Avatar grande centrato con pill "Modifica", stile Airbnb */}
        <View style={s.avatarBlock}>
          <Pressable onPress={handlePhotoPress} style={s.avatarWrap}>
            {user?.photoUrl ? (
              <Image source={{ uri: user.photoUrl }} style={s.avatarImage} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={s.editPill}>
              {photoUploading ? (
                <ActivityIndicator size="small" color="#1A1A2E" />
              ) : (
                <>
                  <Ionicons name="camera" size={15} color="#1A1A2E" />
                  <Text style={s.editPillText}>Modifica</Text>
                </>
              )}
            </View>
          </Pressable>
        </View>

        {/* Firma: riga piatta con hairline, senza card bordata */}
        <Pressable
          onPress={() => router.push('/(tabs)/settings/signature')}
          style={({ pressed }) => [s.signatureRow, pressed && { opacity: 0.7 }]}
        >
          {user?.signatureUrl ? (
            <Image
              source={{ uri: user.signatureUrl }}
              style={s.signaturePreview}
              resizeMode="contain"
            />
          ) : (
            <Ionicons name="create-outline" size={24} color="#1A1A2E" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.signatureTitle}>Firma</Text>
            <Text style={s.signatureSubtitle}>
              {user?.signatureUrl ? 'Tocca per rifarla' : 'Apponi la tua firma con il dito'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
        </Pressable>

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
  avatarBlock: { alignItems: 'center', marginTop: 4, marginBottom: 10 },
  avatarWrap: { alignItems: 'center' },
  avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarFallback: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#E9EBF2', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 36, fontWeight: '600', color: colors.primary, letterSpacing: -0.5 },
  editPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 8,
    marginTop: -18, minHeight: 34, justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  editPillText: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  signatureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EBEBEB',
  },
  signaturePreview: { width: 64, height: 32 },
  signatureTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  signatureSubtitle: { fontSize: 13, fontWeight: '500', color: colors.textMuted, marginTop: 1 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  cta: {
    minHeight: 50, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    ...primaryCtaShadow,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
