export const paymentStatusLabel = (status: string) => {
  if (status === 'paid') return { label: 'Pagato', tone: 'success' as const };
  if (status === 'partial_paid') return { label: 'Parziale', tone: 'warning' as const };
  if (status === 'insoluto') return { label: 'Insoluto', tone: 'danger' as const };
  if (status === 'waived') return { label: 'Non dovuto', tone: 'default' as const };
  if (status === 'pending_penalty') return { label: 'In attesa', tone: 'warning' as const };
  return { label: 'Da gestire', tone: 'default' as const };
};

export const paymentPhaseLabel = (phase: string) => {
  if (phase === 'penalty') return 'Penale';
  if (phase === 'settlement') return 'Saldo';
  if (phase === 'manual_recovery') return 'Recupero';
  return phase;
};

export const paymentEventStatusLabel = (status: string) => {
  if (status === 'succeeded') return { label: 'Riuscito', tone: 'success' as const };
  if (status === 'failed') return { label: 'Fallito', tone: 'danger' as const };
  if (status === 'abandoned') return { label: 'Abbandonato', tone: 'warning' as const };
  if (status === 'processing') return { label: 'In elaborazione', tone: 'default' as const };
  if (status === 'pending') return { label: 'In attesa', tone: 'default' as const };
  return { label: status, tone: 'default' as const };
};

export const invoiceStatusLabel = (status: string | null | undefined) => {
  if (!status) return 'N/D';
  if (status === 'issued') return 'Emessa';
  if (status === 'pending_fic') return 'In attesa FIC';
  if (status === 'pending') return 'In attesa';
  if (status === 'not_required') return 'Non richiesta';
  if (status === 'failed') return 'Errore';
  return status;
};
