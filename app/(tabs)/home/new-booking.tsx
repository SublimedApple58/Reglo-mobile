import React from 'react';
import { BookingForm } from '../../../src/components/booking/BookingForm';

/* The full "Nuova prenotazione" flow lives in the shared <BookingForm> (also
 * reused embedded by the quick-book sheet). This route is the standalone shell. */
export default function NewBookingScreen() {
  return <BookingForm />;
}
