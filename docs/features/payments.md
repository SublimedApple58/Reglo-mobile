# Payments

## What it does
Student payment management: Stripe payment methods, auto-payments, payment history, pay-now, PDF documents.

## Key files
- `src/screens/AllievoPaymentsScreen.tsx` (29KB)
- `src/utils/payment.ts` — status/phase label mappers

## Features
- Add/remove payment methods via Stripe Setup Intent
- Auto-payments toggle with setup flow
- Payment history with pagination (12 items/page, "load more")
- Per-appointment payment events (succeeded, pending, failed, partial)
- View/download/share PDF invoices (`expo-file-system`)
- Status labels: paid (success), partial_paid (warning), insoluto (danger)

## API functions used
`getPaymentProfile`, `getPaymentHistory`, `createSetupIntent`, `confirmPaymentMethod`, `removePaymentMethod`, `preparePayNow`, `finalizePayNow`, `getAppointmentPaymentDocument`

## Components used
Screen, BottomSheet, Button, Skeleton, ScrollHintFab

## Connected features
- **Booking Flow** — payment profile needed for booking
- **Settings** — payment method management also in SettingsScreen
