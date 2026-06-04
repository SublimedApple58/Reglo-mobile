// Drives the notes/group-students page sheet (manage the instructor's cluster).
export type GroupStudent = {
  id: string;
  firstName: string;
  lastName: string;
  assignedInstructorId: string | null;
};

export type GroupStudentsStoreData = {
  allStudents: GroupStudent[];
  assignedIds: string[];
  onConfirm: (ids: string[]) => void;
};

let _data: GroupStudentsStoreData | null = null;
const _listeners = new Set<() => void>();

export const groupStudentsStore = {
  set(data: GroupStudentsStoreData) {
    _data = data;
    _listeners.forEach((fn) => fn());
  },
  get(): GroupStudentsStoreData | null {
    return _data;
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};
