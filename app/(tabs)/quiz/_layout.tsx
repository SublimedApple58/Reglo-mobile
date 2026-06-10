import { Stack } from 'expo-router';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';

export default function QuizLayout() {
  return <Stack screenListeners={sheetScreenListeners} screenOptions={{ headerShown: false }} />;
}
