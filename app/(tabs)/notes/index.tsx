import React from 'react';
import { useSession } from '../../../src/context/SessionContext';
import { InstructorNotesScreen } from '../../../src/screens/InstructorNotesScreen';
import { StudentMyNotesScreen } from '../../../src/screens/StudentMyNotesScreen';

export default function NotesRoute() {
  const { autoscuolaRole } = useSession();

  if (autoscuolaRole === 'OWNER' || autoscuolaRole === 'INSTRUCTOR') {
    return <InstructorNotesScreen />;
  }

  return <StudentMyNotesScreen />;
}
