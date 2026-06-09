import React from 'react';
import { StudentNotesDetailScreen } from '../../../src/screens/StudentNotesDetailScreen';

// Modal presentation of the student detail from the home stack — so opening a
// student from the exam sheet stacks a proper modal (with its own X close)
// instead of cross-tab navigating into the notes tab and getting stuck.
export default function HomeStudentDetailRoute() {
  return <StudentNotesDetailScreen />;
}
