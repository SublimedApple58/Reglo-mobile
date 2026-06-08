import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { spacing } from '../theme';
import { useSession } from '../context/SessionContext';
import { useVehiclesEnabled } from '../hooks/useVehiclesEnabled';
import { isInstructor } from '../utils/roles';

type MenuItem = {
  route: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
};

const VEHICLES_ITEM: MenuItem = {
  route: 'vehicles',
  label: 'Veicoli',
  description: 'Gestisci i veicoli della scuola',
  icon: 'car-outline',
  iconColor: '#CA8A04',
  iconBg: '#FEF9C3',
};

const SETTINGS_ITEM: MenuItem = {
  route: 'settings',
  label: 'Impostazioni',
  description: 'Preferenze e configurazione',
  icon: 'settings-outline',
  iconColor: '#64748B',
  iconBg: '#F1F5F9',
};

const INSTRUCTOR_HOURS_ITEM: MenuItem = {
  route: 'instructor-hours',
  label: 'Ore di guida',
  description: 'Ore settimanali e mensili',
  icon: 'time-outline',
  iconColor: '#1A1A2E',
  iconBg: '#E9EBF2',
};

const INSTRUCTORS_OVERVIEW_ITEM: MenuItem = {
  route: 'instructors-overview',
  label: 'Panoramica Istruttori',
  description: 'Visualizza agenda e gestisci istruttori',
  icon: 'people-outline',
  iconColor: '#1A1A2E',
  iconBg: '#E9EBF2',
};

const LOCATIONS_ITEM: MenuItem = {
  route: 'locations',
  label: 'Luoghi guida',
  description: 'Sede e luoghi extra dove iniziano le guide',
  icon: 'location-outline',
  iconColor: '#22C55E',
  iconBg: '#DCFCE7',
};

export const MoreScreen = () => {
  const router = useRouter();
  const { autoscuolaRole } = useSession();
  const { enabled: vehiclesEnabled } = useVehiclesEnabled();

  const menuItems = useMemo(() => {
    const items: MenuItem[] = [];
    if (autoscuolaRole === 'INSTRUCTOR_OWNER') {
      items.push(INSTRUCTORS_OVERVIEW_ITEM);
    }
    if (isInstructor(autoscuolaRole)) {
      items.push(INSTRUCTOR_HOURS_ITEM);
    }
    if (vehiclesEnabled) {
      items.push(VEHICLES_ITEM);
    }
    if (isInstructor(autoscuolaRole) || autoscuolaRole === 'OWNER') {
      items.push(LOCATIONS_ITEM);
    }
    items.push(SETTINGS_ITEM);
    return items;
  }, [autoscuolaRole, vehiclesEnabled]);

  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.title}>Altro</Text>
        <View style={styles.list}>
          {menuItems.map((item) => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/(tabs)/more/${item.route}` as never)}
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
    fontWeight: '600',
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
