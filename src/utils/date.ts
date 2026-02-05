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
