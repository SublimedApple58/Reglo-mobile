export const formatTime = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDay = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
};

/**
 * Durata di una guida da leggere in una riga (REG-760): «45 min», «1 h»,
 * «1 h 30», «2 h 30». null se manca la fine (esame senza orario) o non è
 * dopo l'inizio. Gemella di `formatLessonDuration` in
 * reglo/lib/autoscuole/lesson-duration.ts: stesso formato sul web.
 */
export const formatLessonDuration = (startsAt: string, endsAt: string | null | undefined) => {
  if (!endsAt) return null;
  const min = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000);
  if (!Number.isFinite(min) || min <= 0) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
};

export const formatRelativeTime =(isoDate: string): string => {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'ora';
  if (diffMin < 60) return `${diffMin} min fa`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'ora' : 'ore'} fa`;
  if (diffDays < 2) return 'ieri';
  if (diffDays < 7) return `${diffDays} giorni fa`;
  return new Date(isoDate).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
  });
};
