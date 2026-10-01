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

/**
 * REG-585 (secondo giro) — segnale "questa guida è condivisa", lato mobile.
 *
 * Sul web serviva a capire che due blocchi su colonne diverse erano la stessa
 * guida. Qui l'istruttore vede solo la propria agenda, quindi il problema non
 * si pone: serve sapere che NON è da solo, e con chi. Per questo si escludono
 * sempre i propri panni e si nominano gli altri.
 *
 * `myInstructorId` assente (titolare, o vista "tutti") = non c'è un "io" da
 * togliere: si elencano tutti i coinvolti.
 */
export function sharedWithNames(
  lesson: {
    instructorId?: string | null;
    instructorName?: string | null;
    instructor?: { id?: string | null; name?: string | null } | null;
    coInstructors?: Array<{ id: string; name: string }> | null;
  },
  myInstructorId?: string | null,
): string[] {
  const co = lesson.coInstructors ?? [];
  if (!co.length) return [];
  const mainId = lesson.instructorId ?? lesson.instructor?.id ?? null;
  const mainName = lesson.instructorName ?? lesson.instructor?.name ?? null;
  return [
    ...(mainId || mainName ? [{ id: mainId, name: mainName }] : []),
    ...co,
  ]
    .filter((i) => !myInstructorId || i.id !== myInstructorId)
    .map((i) => i.name)
    .filter((n): n is string => !!n && n.trim().length > 0);
}

/** "Luca" · "Luca e Sara" · "Luca e altri 2" — regge anche i nomi lunghi. */
export function formatSharedWith(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names[0]} e altri ${names.length - 1}`;
}
