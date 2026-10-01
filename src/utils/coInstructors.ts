/**
 * REG-585 — più istruttori sulla stessa guida di gruppo o esame.
 *
 * `instructorId` resta il PRINCIPALE (è lui che risponde della guida);
 * `coInstructors` sono i colleghi che la condividono. Per l'istruttore non
 * cambia niente: una guida condivisa è una sua guida a tutti gli effetti —
 * la vede in agenda e ci può agire (presenze, esito) come il principale.
 */
export type WithInstructors = {
  instructorId?: string | null;
  coInstructors?: Array<{ id: string }> | null;
};

/** True se l'istruttore porta questa guida, da principale o da aggiunto. */
export function lessonInvolvesInstructor(
  lesson: WithInstructors,
  instructorId: string | null | undefined,
): boolean {
  if (!instructorId) return false;
  if (lesson.instructorId === instructorId) return true;
  return (lesson.coInstructors ?? []).some((co) => co.id === instructorId);
}

/** "Mario + Luca" — per le righe di riepilogo. Null se non c'è nessuno. */
export function formatInstructorNames(
  mainName: string | null | undefined,
  coInstructors: Array<{ name: string }> | null | undefined,
): string | null {
  const names = [mainName, ...(coInstructors ?? []).map((c) => c.name)].filter(
    (n): n is string => !!n && n.trim().length > 0,
  );
  return names.length ? names.join(' + ') : null;
}
