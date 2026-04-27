import React from 'react';
import { useSession } from '../../../src/context/SessionContext';
import { isInstructor, isOwner } from '../../../src/utils/roles';
import { InstructorNotesScreen } from '../../../src/screens/InstructorNotesScreen';
import { StudentMyNotesScreen } from '../../../src/screens/StudentMyNotesScreen';

export default function NotesRoute() {
  const { autoscuolaRole } = useSession();

  if (isOwner(autoscuolaRole) || isInstructor(autoscuolaRole)) {
    return <InstructorNotesScreen />;
  }

  return <StudentMyNotesScreen />;
}
