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

## Git flow & Staging

Ambienti: **dev** → **staging** (CONDIVISO) → **prod** (`master`). Lavori grossi: **feature branch dedicato su entrambi i repo** (`reglo` + `reglo-mobile`), mai diretto su `master` finché non finito/approvato.

- **Testare contro staging**: `npm run ios:staging` / `android:staging` puntano l'app all'API `staging.reglo.it` (serve `reglo-mobile/.staging-bypass` col Protection Bypass secret). Modifiche solo-JS = hot-reload, niente rebuild nativo.
- Il mobile **non** ha un branch `staging` proprio da deployare: si testa contro il **backend** di staging. Il flusso `ship:staging` (allinea `origin/staging` nel branch → ship) vive lato `reglo` — vedi `../reglo/docs/architecture/git-flow.md`.
- **Rilascio prod** (solo con OK utente): merge → `master`, poi OTA `eas update --platform ios --branch production` **poi** `--platform android` (MAI `--auto`, MAI `--platform all`); native build solo se cambia lo strato nativo → checklist «Rilascio build nativa (store) + OTA dopo» in `docs/git-flow.md` (runtimeVersion, store, force-update floor, recovery).

Dettagli: [docs/git-flow.md](docs/git-flow.md) · staging operativo: `../reglo/docs/STAGING.md`.

## Conventions

- TypeScript strict mode (Expo tsconfig base)
- Screens in `src/screens/`, components in `src/components/`, API in `src/services/`
- `react-native-reanimated` for animations (shared values, useAnimatedStyle, FadeIn/FadeOut, withSpring)
- `Screen` component wraps all screens (SafeArea)
- Sheets: ONE form sheet for everything — route preset `FORM_SHEET` + `<FormSheet>` component (`src/components/SheetScaffold.tsx`). No handle/grabber, no swipe to dismiss: it closes ONLY with the clay X (white raised circle, `ClayIconButton`) top-right. Never build a sheet by hand. See `docs/design-system.md` §13.2 (and §0 for the clay style). The old rule «`BottomSheet` with handle, never X» is superseded (REG-639, 28/10/2026).
- Centered `Modal` for quick actions
- Theme tokens in `src/theme/`: `colors.ts`, `spacing.ts`, `typography.ts`, `clay.ts` (clay v2). Palette = **white, black (`#111111`), neutrals + clay volume** (`CLAY`, `CLAY_SHADOW`, `CLAY_CTA`, design-system §0). No blue/navy. Colour comes ONLY from the few AI-generated 3D icons (`Icon3D`, `src/road/markerArt.ts`, `src/theme/moraleArt.ts`, `assets/icons3d-ai/`) and photos.
- Icons: as FEW as possible (none where text and hierarchy suffice). The ones kept are 3D, AI-generated in one style with the prompt in design-system §0.4. Microsoft Fluent 3D emoji are banned and REMOVED from the app (REG-639, 28/10/2026: all `assets/icons/fluent-*.png` deleted) — never add them back. Empty states / milestones use the AI «morale» icons (`MORALE_ART`, `ClayEmpty`); student screens use `assets/icons3d-ai/`. Only the theory-path illustrations in `assets/icons/` (`stat-*`, `cta-*`, `chapters/`…) remain, to be redone when theory is touched. Mono icons only for commands (X, search, chevron, back, +, recenter).
  - Pink `#EC4899` is NOT a UI colour: it survives only as one choice («Rosa») in the agenda colour palette (`src/utils/agendaColors.ts`). Never use it for UI.
  - Yellow `#FACC15` (`colors.accent` / `yellow` scale) stays only as an accent where it is already used: pagellino stars (`StarRating`, `EvaluationSheetScreen`, `EvaluationItemSheet`, notes screens), pagellino bars in `StudentMyNotesScreen`/`StudentNotesDetailScreen`, toggle track and highlights in the legacy unmounted `InstructorManageScreen`, «Programmata» status and day-pill highlight in `IstruttoreHomeScreen`, `NotificationOverlay`, `PhaseCard`, `QuizChaptersScreen` (`yellow` scale), `Button` variant `secondary`. Never on toggles in clay screens (use `ClayToggle`). Don't add new uses.
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
