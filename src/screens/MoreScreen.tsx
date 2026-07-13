import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  icon: keyof typeof Ionicons.glyphMap;
};

const VEHICLES_ITEM: MenuItem = {
  route: 'vehicles',
  label: 'Veicoli',
  icon: 'car-outline',
};

const SETTINGS_ITEM: MenuItem = {
  route: 'settings',
  label: 'Impostazioni',
  icon: 'settings-outline',
};

const INSTRUCTOR_HOURS_ITEM: MenuItem = {
  route: 'instructor-hours',
  label: 'Ore di guida',
  icon: 'time-outline',
};

const INSTRUCTORS_OVERVIEW_ITEM: MenuItem = {
  route: 'instructors-overview',
  label: 'Panoramica Istruttori',
  icon: 'people-outline',
};

const LOCATIONS_ITEM: MenuItem = {
  route: 'locations',
  label: 'Luoghi guida',
  icon: 'location-outline',
};

const initialsFrom = (name: string | null, email: string): string => {
  const src = (name ?? '').trim();
  if (src) {
    const parts = src.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? '';
    const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (a + b).toUpperCase() || '·';
  }
  return (email[0] ?? '·').toUpperCase();
};

type Section = { key: string; title: string; items: MenuItem[] };

export const MoreScreen = () => {
  const router = useRouter();
  const { user, autoscuolaRole, companies, activeCompanyId } = useSession();
  const { enabled: vehiclesEnabled } = useVehiclesEnabled();
  const companyName = companies.find((c) => c.id === activeCompanyId)?.name ?? null;
  const roleText =
    autoscuolaRole === 'INSTRUCTOR_OWNER' ? 'Titolare e istruttore'
    : autoscuolaRole === 'OWNER' ? 'Titolare'
    : autoscuolaRole === 'INSTRUCTOR' ? 'Istruttore'
    : autoscuolaRole === 'STUDENT' ? 'Allievo'
    : null;

  const sections = useMemo(() => {
    const management: MenuItem[] = [];
    if (autoscuolaRole === 'INSTRUCTOR_OWNER') management.push(INSTRUCTORS_OVERVIEW_ITEM);
    if (isInstructor(autoscuolaRole)) management.push(INSTRUCTOR_HOURS_ITEM);
    if (vehiclesEnabled) management.push(VEHICLES_ITEM);
    if (isInstructor(autoscuolaRole) || autoscuolaRole === 'OWNER') management.push(LOCATIONS_ITEM);

    const out: Section[] = [];
    if (management.length) out.push({ key: 'gestione', title: 'Gestione', items: management });
    out.push({ key: 'account', title: 'Account', items: [SETTINGS_ITEM] });
    return out;
  }, [autoscuolaRole, vehiclesEnabled]);

  const name = user?.name?.trim() || user?.email?.split('@')[0] || 'Account';

  return (
    <Screen>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Altro</Text>

        {/* Profile card — big, centered (avatar on top). Opens profile-edit. */}
        <Pressable
          onPress={() => router.push('/(tabs)/more/profile-edit' as never)}
          style={({ pressed }) => [styles.hero, pressed && { opacity: 0.95 }]}
        >
          <View style={styles.editBadge}>
            <Ionicons name="create-outline" size={17} color="#929292" />
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsFrom(user?.name ?? null, user?.email ?? '')}</Text>
          </View>
          <Text style={styles.heroName} numberOfLines={1}>{name}</Text>
          {user?.email ? <Text style={styles.heroEmail} numberOfLines={1}>{user.email}</Text> : null}
          {roleText ? <Text style={styles.heroSub} numberOfLines={1}>{roleText}</Text> : null}
          {companyName ? (
            <View style={styles.companyPill}>
              <Ionicons name="business-outline" size={12} color="#929292" />
              <Text style={styles.companyText} numberOfLines={1}>{companyName}</Text>
            </View>
          ) : null}
        </Pressable>

        {sections.map((section, si) => (
          <React.Fragment key={section.key}>
            {si > 0 ? <View style={styles.divider} /> : null}
            {section.items.map((item) => (
              <Pressable
                key={item.route}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => router.push(`/(tabs)/more/${item.route}` as never)}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={item.icon} size={23} color="#1A1A2E" />
                </View>
                <Text style={[styles.rowTitle, { flex: 1 }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color="#AEB4CC" />
              </Pressable>
            ))}
          </React.Fragment>
        ))}
      </ScrollView>
    </Screen>
  );
};

const SHADOW = {
  shadowColor: '#1A1A2E',
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 140,
  },
  title: {
    fontSize: 30,
    fontWeight: '600',
    color: '#1A1A2E',
    letterSpacing: -0.4,
    marginBottom: 20,
  },

  hero: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 30,
    ...SHADOW,
  },
  editBadge: { position: 'absolute', top: 14, right: 14 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 30, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.4 },
  heroName: { fontSize: 21, fontWeight: '600', color: '#1A1A2E', letterSpacing: -0.3, marginTop: 16 },
  heroEmail: { fontSize: 14, fontWeight: '400', color: '#929292', marginTop: 4 },
  heroSub: { fontSize: 13, fontWeight: '400', color: '#AEB4CC', marginTop: 2 },
  companyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 12,
  },
  companyText: { fontSize: 12, fontWeight: '600', color: '#6A6A6A' },

  // Menu = FLAT list on the page background (NOT wrapped in a card). Cards are
  // only for standalone items like the profile hero above.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  rowPressed: { backgroundColor: '#F4F5F9' },
  iconWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15.5, fontWeight: '500', color: '#1A1A2E' },
  divider: { height: 1, backgroundColor: '#F0F1F5', marginVertical: 14 },
});
