export const isInstructor = (role: string | null | undefined): boolean =>
  role === 'INSTRUCTOR' || role === 'INSTRUCTOR_OWNER';

export const isOwner = (role: string | null | undefined): boolean =>
  role === 'OWNER' || role === 'INSTRUCTOR_OWNER';

export const isStudent = (role: string | null | undefined): boolean =>
  role === 'STUDENT';
