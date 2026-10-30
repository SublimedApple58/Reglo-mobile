import React from 'react';
import { BookingForm } from '../../../src/components/booking/BookingForm';

/* The full "Nuova prenotazione" flow lives in the shared <BookingForm> (the
 * agenda's ghost uses its `quick` variant, `home/quick-guide`). Renders its own
 * FormSheet (FORM_SHEET). */
export default function NewBookingScreen() {
  return <BookingForm />;
}
