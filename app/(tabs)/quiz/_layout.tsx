import { Stack } from 'expo-router';
import { useTabStackOptions } from '../../../src/components/tabBarSpace';
import { sheetScreenListeners } from '../../../src/utils/sheetHaptics';

// REG-800: su iOS (barra nativa) le pagine a schermo pieno si tengono lo spazio della barra.
const STACK_OPTIONS = { headerShown: false };

export default function QuizLayout() {
  const stackOptions = useTabStackOptions('quiz', STACK_OPTIONS);
  return <Stack screenListeners={sheetScreenListeners} screenOptions={stackOptions} />;
}
