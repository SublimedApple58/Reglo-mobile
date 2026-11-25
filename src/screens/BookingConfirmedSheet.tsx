import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { FormSheet } from '../components/SheetScaffold';
import { BookingConfirmedBody, BookingConfirmedCta } from '../components/BookingConfirmed';
import { bookingConfirmedStore } from '../stores/bookingConfirmedStore';

/**
 * REG-790 — conferma come foglio a sé (guida presa dagli Scambi): stesso
 * contenuto dello stato finale del foglio «Orari». Il seed vale per tutta la
 * vita del foglio.
 */
export default function BookingConfirmedSheet() {
  const router = useRouter();
  const [data] = useState(() => bookingConfirmedStore.get());
  useEffect(() => () => bookingConfirmedStore.clear(), []);

  if (!data) return <FormSheet />;

  const open = data.onOpenLesson
    ? () => {
        const { lesson, onOpenLesson } = data;
        router.back();
        setTimeout(() => onOpenLesson?.(lesson), 350);
      }
    : undefined;

  return (
    <FormSheet testID="booking-confirmed-sheet" cta={<BookingConfirmedCta onDone={() => router.back()} onOpenLesson={open} />}>
      <BookingConfirmedBody data={data} />
    </FormSheet>
  );
}
