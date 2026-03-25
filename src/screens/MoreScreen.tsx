import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../theme';

type MenuItem = {
  route: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    route: 'vehicles',
    label: 'Veicoli',
    description: 'Gestisci i veicoli della scuola',
    icon: 'car-outline',
    iconColor: '#CA8A04',
    iconBg: '#FEF9C3',
  },
  {
    route: 'settings',
    label: 'Impostazioni',
    description: 'Preferenze e configurazione',
    icon: 'settings-outline',
    iconColor: '#64748B',
    iconBg: '#F1F5F9',
  },
];

export const MoreScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.title}>Altro</Text>
        <View style={styles.list}>
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => navigation.navigate(item.route)}
            >
              <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={22} color={item.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>{item.label}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
  },
  list: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    gap: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  cardDescription: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
});
