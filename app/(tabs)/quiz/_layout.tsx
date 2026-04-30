import { Stack } from 'expo-router';
import { QuizProvider } from '../../../src/context/QuizContext';

export default function QuizLayout() {
  return (
    <QuizProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </QuizProvider>
  );
}
