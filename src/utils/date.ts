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

export const formatRelativeTime = (isoDate: string): string => {
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
