import * as SecureStore from 'expo-secure-store';

const STUDENT_KEY = 'reglo_selected_student_id';
const INSTRUCTOR_KEY = 'reglo_selected_instructor_id';
const AGENDA_VIEW_MODE_KEY = 'reglo_agenda_view_mode';

export const sessionStorage = {
  getSelectedStudentId: async () => SecureStore.getItemAsync(STUDENT_KEY),
  setSelectedStudentId: async (studentId: string | null) => {
    if (!studentId) {
      await SecureStore.deleteItemAsync(STUDENT_KEY);
      return;
    }
    await SecureStore.setItemAsync(STUDENT_KEY, studentId);
  },
  getSelectedInstructorId: async () => SecureStore.getItemAsync(INSTRUCTOR_KEY),
  setSelectedInstructorId: async (instructorId: string | null) => {
    if (!instructorId) {
      await SecureStore.deleteItemAsync(INSTRUCTOR_KEY);
      return;
    }
    await SecureStore.setItemAsync(INSTRUCTOR_KEY, instructorId);
  },
  getAgendaViewMode: async (): Promise<'day' | 'week'> => {
    const val = await SecureStore.getItemAsync(AGENDA_VIEW_MODE_KEY);
    return val === 'week' ? 'week' : 'day';
  },
  setAgendaViewMode: async (mode: 'day' | 'week') => {
    await SecureStore.setItemAsync(AGENDA_VIEW_MODE_KEY, mode);
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(STUDENT_KEY);
    await SecureStore.deleteItemAsync(INSTRUCTOR_KEY);
    await SecureStore.deleteItemAsync(AGENDA_VIEW_MODE_KEY);
  },
};
