# Reglo Autoscuole Mobile

Expo + React Native + TypeScript app for the Reglo Autoscuole module.

## Stack
- Expo SDK (latest stable)
- React Navigation (tabs + stack-ready)
- TypeScript
- Expo Blur + Reanimated for glass UI

## Quick start
```bash
npm install
npm run ios
# or
npm run android
```

## Structure
- `src/components` reusable glass components
- `src/screens` role-based home screens
- `src/navigation` tab navigation
- `src/services` stubbed service layer (fake data)
- `src/data` mock data
- `src/theme` colors, spacing, typography

## Notes
- UI is iOS-first with liquid glass styling and a custom animated tab bar.
- Colors align with Reglo palette (`#AFE2D4`, `#324D7A`).

## API client
- Real API client lives in `src/services/regloApi.ts` (base URL: `https://app.reglo.it/api`).
- Auth/session state is handled in `src/context/SessionContext.tsx` (token stored via `expo-secure-store`).
