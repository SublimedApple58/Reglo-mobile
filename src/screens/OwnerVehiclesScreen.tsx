import React from 'react';
import { VehiclesScreen } from './VehiclesScreen';

// Owner and instructor share the same vehicles UI; the screen reads the vehicle
// list from the same endpoint for both roles.
export const OwnerVehiclesScreen = () => <VehiclesScreen />;
