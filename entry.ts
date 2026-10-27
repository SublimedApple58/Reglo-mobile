// Entry dell'app (package.json "main").
//
// REG-638 Reglo Road: il task GPS di expo-task-manager va definito a livello di
// modulo PRIMA che l'app monti, così iOS/Android possono consegnargli le
// posizioni anche con l'app in background o lo schermo spento. Poi parte
// Expo Router come sempre.
import './src/road/tracking';
import 'expo-router/entry';
