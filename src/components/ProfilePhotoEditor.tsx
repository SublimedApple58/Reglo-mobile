import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSession } from '../context/SessionContext';
import { regloApi } from '../services/regloApi';
import { invalidateUserPhoto } from '../services/userPhotos';
import { colors } from '../theme/colors';

/**
 * Avatar grande centrato con pill "Modifica" (stile Airbnb) per caricare la
 * propria foto profilo. Usato dai profile-edit di allievo (settings) e
 * istruttore/titolare (more). La foto parte ESATTAMENTE come scattata/scelta:
 * nessun editing/crop lato app.
 */
export function ProfilePhotoEditor({ size = 128 }: { size?: number }) {
  const { user, refreshMe } = useSession();
  const [uploading, setUploading] = useState(false);

  const initials = useMemo(() => {
    const source = (user?.name ?? user?.email ?? 'U').trim();
    const parts = source.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return source.slice(0, 2).toUpperCase();
  }, [user?.email, user?.name]);

  const uploadPickedImage = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    try {
      await regloApi.uploadProfilePhoto({
        uri: asset.uri,
        name: asset.fileName ?? 'foto-profilo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      await refreshMe();
      if (user?.id) invalidateUserPhoto(user.id);
    } catch (error) {
      Alert.alert(
        'Upload non riuscito',
        error instanceof Error ? error.message : 'Riprova tra poco.',
      );
    } finally {
      setUploading(false);
    }
  };

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

  const handlePress = () => {
    if (uploading) return;
    Alert.alert('Foto profilo', undefined, [
      { text: 'Scatta una foto', onPress: () => void takePhoto() },
      { text: 'Scegli dalla libreria', onPress: () => void pickFromLibrary() },
      { text: 'Annulla', style: 'cancel' },
    ]);
  };

  const circle = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={s.block}>
      <Pressable onPress={handlePress} style={s.wrap}>
        {user?.photoUrl ? (
          <Image source={{ uri: user.photoUrl }} style={circle} />
        ) : (
          <View style={[circle, s.fallback]}>
            <Text style={s.initials}>{initials}</Text>
          </View>
        )}
        <View style={s.editPill}>
          {uploading ? (
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
  );
}

const s = StyleSheet.create({
  block: { alignItems: 'center', marginTop: 4, marginBottom: 10 },
  wrap: { alignItems: 'center' },
  fallback: {
    backgroundColor: '#E9EBF2', alignItems: 'center', justifyContent: 'center',
  },
  initials: { fontSize: 36, fontWeight: '600', color: colors.primary, letterSpacing: -0.5 },
  editPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 8,
    marginTop: -18, minHeight: 34, justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  editPillText: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
});
