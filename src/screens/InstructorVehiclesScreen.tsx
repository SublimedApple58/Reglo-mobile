import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { VehiclesScreen } from './VehiclesScreen';
import { useSession } from '../context/SessionContext';
import { colors } from '../theme';

export const InstructorVehiclesScreen = () => {
  const { instructorId } = useSession();

  if (!instructorId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Profilo istruttore mancante</Text>
        </View>
      </Screen>
    );
  }

  return <VehiclesScreen />;
};

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
