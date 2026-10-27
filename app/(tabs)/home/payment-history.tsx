import React from 'react';

import { PaymentHistorySheet } from '../../../src/components/PaymentHistorySheet';

/**
 * Storico pagamento di una guida (REG-637) — aperto dalla schermata Pagamenti
 * dell'allievo, quindi registrato in ENTRAMBI gli stack che la ospitano.
 */
export default function PaymentHistoryRoute() {
  return <PaymentHistorySheet />;
}
