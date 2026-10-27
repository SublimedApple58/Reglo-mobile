import * as SecureStore from 'expo-secure-store';

const STUDENT_KEY = 'reglo_selected_student_id';
const INSTRUCTOR_KEY = 'reglo_selected_instructor_id';
/** Storica: la vista agenda si sceglieva (giorno/settimana/griglia). Ora c'è solo la griglia. */
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
  /** Toglie la vecchia preferenza «Vista agenda» dal telefono (REG-638: solo griglia). */
  forgetAgendaViewMode: async () => {
    await SecureStore.deleteItemAsync(AGENDA_VIEW_MODE_KEY).catch(() => undefined);
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(STUDENT_KEY);
    await SecureStore.deleteItemAsync(INSTRUCTOR_KEY);
    await SecureStore.deleteItemAsync(AGENDA_VIEW_MODE_KEY);
  },
};
