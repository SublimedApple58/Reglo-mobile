export const isInstructor = (role: string | null | undefined): boolean =>
  role === 'INSTRUCTOR' || role === 'INSTRUCTOR_OWNER';

export const isOwner = (role: string | null | undefined): boolean =>
  role === 'OWNER' || role === 'INSTRUCTOR_OWNER';

export const isStudent = (role: string | null | undefined): boolean =>
  role === 'STUDENT';

/**
 * Prima schermata dopo l'avvio o il login: «Oggi» per i titolari (REG-794),
 * la home (Agenda per l'istruttore) per tutti gli altri.
 */
export const homeRouteFor = (role: string | null | undefined): '/(tabs)/today' | '/(tabs)/home' =>
  isOwner(role) ? '/(tabs)/today' : '/(tabs)/home';
