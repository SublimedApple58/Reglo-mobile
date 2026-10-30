import React from 'react';

import { BookingForm } from '../../../src/components/booking/BookingForm';

/** REG-671 — riepilogo «Guida con <nome>» (dopo «Con chi guidi?»). */
export default function QuickGuideScreen() {
  return <BookingForm variant="quick" />;
}
