# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run on web
npx expo start -c  # Start with cache cleared
```

EAS builds: `eas build --profile development|preview|production --platform ios|android`

No test runner or linter is configured in this project.

## Architecture

**Expo 54 + React Native 0.81.5 + Expo Router 6 + TypeScript 5.9**

### Auth & Session

`SessionContext` manages all auth state via React Context (no Redux/Zustand). Auth status flows through: `loading → unauthenticated → company_select → ready`. The root `_layout.tsx` wraps everything in `SessionProvider` and uses `AuthGate` to redirect based on status.

Tokens are stored in `expo-secure-store` (native) / `localStorage` (web). The API client (`src/services/apiClient.ts`) attaches JWT via `Authorization` header and company context via `x-reglo-company-id` header.

### Routing

File-based routing with two groups:
- `(auth)/` — login, signup, company-select, role-blocked, invite/[token]
- `(tabs)/` — home, role, payments, settings

Tabs are **conditional by role**: `role` tab shows only for OWNER/INSTRUCTOR, `payments` tab shows only for STUDENT (with autoPayments enabled). iOS uses native tabs (`NativeTabs` + native glass tab bar via `GlassTabBar.ios.tsx`), Android uses custom tab bar in `GlassTabBar.tsx`.

### Role-Based Screens

Each tab dispatches to role-specific screens in `src/screens/`:
- **STUDENT (Allievo)**: AllievoHomeScreen, AllievoPaymentsScreen
- **INSTRUCTOR (Istruttore)**: IstruttoreHomeScreen, InstructorManageScreen
- **OWNER (Titolare)**: TitolareHomeScreen, OwnerInstructorScreen

### API Layer

- `src/services/apiClient.ts` — HTTP client factory with JWT + company headers
- `src/services/regloApi.ts` — Typed endpoint functions
- `src/types/regloApi.ts` — All API types; uses discriminated union `ApiResponse<T>` = `ApiSuccess<T> | ApiError`
- Base URL: `https://app.reglo.it/api`

### Design System

**Riferimento completo: [`plans/design-system/DESIGN_SYSTEM.md`](plans/design-system/DESIGN_SYSTEM.md)** — leggilo prima di toccare qualsiasi UI.

Rosa Brand (`#EC4899`) + Giallo Accent (`#FACC15`) + sfondo bianco. Regola: 70% neutri / 20% rosa / 10% giallo.

- **Radii**: `radii.sm` (20) per elementi piccoli, `radii.lg` (35) per card grandi
- **Modali centrate** (non BottomSheet) per azioni rapide
- **Ombre colorate** (ambra sulle card gialle, rosa sui CTA)
- Theme tokens in `src/theme/`: `colors.ts`, `typography.ts`, `spacing.ts` (`radii` in spacing)

Core components in `src/components/`: `Card`, `Button`, `Input`, `Badge`, `BottomSheet`, `Screen`, `Skeleton`, `ToastNotice`, `SelectableChip`, `SectionHeader`, `CalendarNavigator`, `BookingCelebration`, `SearchableSelect`, `ScrollHintFab`.

### Key Patterns

- Animations use `react-native-reanimated` (shared values, `useAnimatedStyle`, entering/exiting transitions)
- `Screen` component wraps all screens with SafeArea handling
- Centered `<Modal>` for quick actions; `BottomSheet` only for complex scrollable content
- Stripe integration via `@stripe/stripe-react-native` (initialized in root layout)
- Push notifications via `expo-notifications` with device token registration
