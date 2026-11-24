import React from 'react';
import { useRouter } from 'expo-router';
import { StudentMyNotesScreen } from '../../../src/screens/StudentMyNotesScreen';

/** REG-786: «Come stai andando» dalla tab Guide (prima era la tab Note). */
export default function GuideNotesRoute() {
  const router = useRouter();
  return <StudentMyNotesScreen onBack={() => router.back()} lessonDetailPath="/(tabs)/guide/lesson-detail" />;
}
