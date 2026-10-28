import React from 'react';
import { BookingForm } from '../../../src/components/booking/BookingForm';

/* The full "Nuova prenotazione" flow lives in the shared <BookingForm> (also
 * reused embedded by the quick-book sheet). Standalone it renders its own
 * FormSheet (FORM_SHEET). */
export default function NewBookingScreen() {
  return <BookingForm />;
}
