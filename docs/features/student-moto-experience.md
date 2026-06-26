# Student moto experience (UI moto-aware)

_Last updated: 2026-06-26 — branch `feature/vehicles-redesign`._

Makes the allievo app **coherent with a motorcycle path** (license `AM | A1 | A2 | A`)
without changing structure/layout: only car-specific assets/icons/labels are swapped.
Car students (category `B`) are **unchanged** (default branch = today's car art).

## The signal
- Per-guide (most precise): the appointment's vehicle category — `appointment.vehicle?.licenseCategory`.
- Fallback: the student's own category — `useStudentPhase().licenseCategory` (label `studentLicenseLabel`).
- Helper: `src/utils/license.ts` → `MOTO_LICENSE_CATEGORIES` + `isMotoLicenseCategory(c)` (mirror of backend `reglo/lib/autoscuole/license.ts`).

## Shared art chooser
`src/utils/lessonArt.ts` — one place so the per-screen `require()`s never drift:
- `lessonArtSource(category)` → `fluent-motorcycle.png` (moto) | `fluent-car.png` (car) — cards / lists / empty states.
- `heroArtSource(category)` → `fluent-motorcycle.png` (moto) | `fluent-racing.png` (car) — the "prossima guida" hero (no racing-moto asset exists).
- Asset `assets/icons/fluent-motorcycle.png`: Microsoft Fluent 3D sport motorcycle (MIT), framing matched to `fluent-car.png` (256×256). Pipeline + de-pink notes: memory `reference_3d_icons_pipeline`. **Never `tintColor`** (pre-coloured).

## Files
- `src/utils/license.ts` — `isMotoLicenseCategory`.
- `src/utils/lessonArt.ts` — chooser helpers (NEW).
- `src/screens/AllievoHomeScreen.tsx` — hero (`heroArtSource(nextLesson.vehicle?.licenseCategory ?? studentLicenseCategory)`), mini-cards (per-guide), empty state + exam prompt (`lessonArtSource(studentLicenseCategory)`).
- `app/(tabs)/home/all-lessons.tsx` — per-guide list icon (`lessonArtSource(lesson.vehicle?.licenseCategory)`).
- `src/components/GlassTabBar.tsx` — new `isStudentMoto` prop → Home tab icon override `bicycle-outline` (Ionicons has no "motorcycle"; reuses the instructor-side moto proxy). Teoria override wins over moto.
- `app/(tabs)/_layout.tsx` — computes `isStudentMoto = isStudent && isMotoLicenseCategory(studentLicenseCategory)`, passes it to `GlassTabBar`.

## Group moto lessons (student side)
See `group-lessons.md` → "Student view — moto-aware". `group-lesson-detail.tsx` shows the
self-assigned moto + follow car + "Guida di gruppo moto"; `GroupLessonInvitesScreen.tsx`
shows "Ti verrà assegnata una moto". Needs backend `getGroupLessonInvites` to expose `kind`.

## Out of scope / unchanged
- `StudentNotesDetailScreen.tsx`: vehicle is text-only (`appt.vehicle?.name`) — already shows the real (moto) vehicle name, no illustration to swap.
- No layout/structure changes; category `B` renders exactly as before.

## Connections
- `vehicles` (license categories), `group-lessons` (moto kind), `student-phase` (`useStudentPhase` license category), `booking-flow` (`AllievoHomeScreen`).
