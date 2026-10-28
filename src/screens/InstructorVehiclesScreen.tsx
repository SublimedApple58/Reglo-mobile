import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ClayEmpty } from '../components/clay';
import { CLAY } from '../theme/clay';
import { VehiclesScreen } from './VehiclesScreen';
import { useSession } from '../context/SessionContext';

export const InstructorVehiclesScreen = () => {
  const { instructorId } = useSession();

  if (!instructorId) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <ClayEmpty title="Profilo istruttore mancante" />
      </View>
    );
  }

  return <VehiclesScreen />;
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CLAY.bg, justifyContent: 'center' },
});
