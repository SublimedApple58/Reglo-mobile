# CLAUDE.md — Reglo Mobile (iOS + Android)

## Commands

```bash
npm start              # Start Expo dev server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator
npx expo start -c      # Start with cache cleared
```

**EAS:** `eas build --profile development|preview|production --platform ios|android`
**OTA:** `eas update --platform ios --branch production --message "..."` then same for `--platform android` separately. **IMPORTANT:** Always use `--branch production` for prod deploys. Never use `--auto` (it targets `master` instead of `production`). Always run `--platform ios` and `--platform android` separately (never `--platform all`).

No test runner or linter configured.

## Conventions

- TypeScript strict mode (Expo tsconfig base)
- Screens in `src/screens/`, components in `src/components/`, API in `src/services/`
- `react-native-reanimated` for animations (shared values, useAnimatedStyle, FadeIn/FadeOut, withSpring)
- `Screen` component wraps all screens (SafeArea)
- `BottomSheet` with handle (never X close button). iOS and Android have separate implementations.
- Centered `Modal` for quick actions; `BottomSheet` for complex scrollable content
- Theme tokens in `src/theme/`: colors (pink #EC4899, yellow #FACC15), spacing, typography
- Design system reference: `docs/design-system.md` — read before UI work (also kept at `plans/design-system/DESIGN_SYSTEM.md`)
- All API responses use `ApiResponse<T> = ApiSuccess<T> | ApiError` — always check `response.success`
- Three roles: STUDENT (allievo), INSTRUCTOR (istruttore), OWNER (titolare). Tabs conditional by role.

## Documentation

All feature and architecture docs are in `docs/`. Read `docs/INDEX.md` to find the relevant feature.

### Action Flows

#### CREATE a new feature
1. Read `docs/INDEX.md` — check if a related feature exists
2. Read `docs/impact-map.md` — identify connections to existing features
3. Read connected feature docs in `docs/features/` — understand interfaces
4. Read `docs/design-system.md` if the feature has UI
5. Implement following existing patterns
6. Create `docs/features/<new-feature>.md`
7. Update `docs/INDEX.md` and `docs/impact-map.md`
8. If backend changes needed, switch to `../reglo/` and follow its action flow

#### MODIFY an existing feature
1. Read `docs/INDEX.md` — find the feature file
2. Read `docs/features/<feature>.md` — understand all files and shared components involved
3. Read `docs/impact-map.md` — find connected features
4. Read each connected feature doc — understand what might break
5. Make the change
6. If a shared component changed: verify ALL screens listed in its "Used by" section
7. If an API type changed: grep for the type name across all screens
8. Update `docs/features/<feature>.md` if behavior changed

#### DELETE / REMOVE a feature
1. Read `docs/features/<feature>.md` — list ALL files involved
2. Read `docs/impact-map.md` — find ALL dependent features
3. Read connected docs — plan dependency removal
4. Remove code, update connected features
5. Delete the feature doc, update INDEX and impact-map

## Agent Instructions

- Read `docs/design-system.md` before any UI changes.
- Test both iOS and Android rendering — tab bars and bottom sheets differ per platform.
- For notification changes, follow the full checklist in `../reglo/docs/features/notifications.md`.
- **Always follow the Action Flows above. Always consult docs/impact-map.md before completing a change.**
