# Manage-lesson (Gestisci guida) → Expo Router native sheet migration

## What was done

Migrated the instructor "Gestisci guida" detail sheet from an inline
`NativePageSheet` (RN `<Modal>`) to the app's proven **Expo Router route + store**
pattern, so its sub-pickers open as real native sheets that stack — matching the
student-detail experience (`notes/[studentId]`).

**Root cause we fixed:** two hand-rolled RN `<Modal>`s cannot stack on iOS, so a
`NativeFormSheet` picker over the `NativePageSheet` never opened. The app routes
around this everywhere via `react-native-screens` (Expo Router) native sheets.

## Files

New:
- `src/stores/manageLessonStore.ts` — snapshot (lesson + flags) + callbacks the
  parent publishes; route renders from it via `useSyncExternalStore`.
- `src/stores/instructorPickerStore.ts`, `src/stores/locationPickerStore.ts`.
- `app/(tabs)/home/manage-lesson.tsx` — `presentation: 'modal'` (page sheet,
  scrollable, keyboard-friendly). Owns local drafts (notes/types/rating/
  instructor) + availability check. Header X close + ••• menu, footer
  Presente/Assente + Salva (navy).
- `app/(tabs)/home/manage-lesson-instructor.tsx` — `formSheet` fitToContents.
- `app/(tabs)/home/manage-lesson-location.tsx` — `formSheet` fitToContents
  (`InlineLocationPicker`, search hidden).
- `app/(tabs)/home/manage-lesson-location-form.tsx` — `formSheet`, keyboard-aware
  (`InlineLocationForm` + existing `locationFormStore`).

Modified:
- `app/(tabs)/home/_layout.tsx` — registered the 4 routes.
- `src/screens/IstruttoreHomeScreen.tsx` — `openLessonDrawer` now seeds
  `manageLessonStore` + `router.push`; a sync effect keeps the snapshot fresh;
  `handleSaveDetails(payload): Promise<boolean>` and `handleStatusAction(action,
  types)` take route input; the inline lesson `NativePageSheet` + the two broken
  `NativeFormSheet`s were removed.
- `src/utils/lessonTypes.ts` — added `normalizeLessonType`, `resolveInitialLessonTypes`.

## Behaviour notes / amendments

- **Save closes the sheet on success** (returns `true`): the parent `ToastNotice`
  renders under the modal route, so dismissing reveals the refreshed home + toast.
- **Sposta / Scambia / Cancella** and **Presente / Assente** `router.back()` first,
  then run the parent flow (no modal stacking). Status actions use the captured
  `lesson` (sheetLesson is null by the time they fire).
- Location change is applied optimistically (unchanged behaviour).
- The booking sheet still uses in-page mode swaps (out of scope here).

## Amendment — "command center" refactor (Airbnb pass)

Restructured the main sheet around quick actions + a details sub-sheet:

- **Top:** only X close (the `•••` menu is gone). Two icon-only circle CTAs
  (Chiama, WhatsApp) centered under the hero.
- **Ring:** 3D gradient ring (`ProgressRing`, gradient + drop shadow + rounded
  caps), centered, no labels under it. `SkeletonRing` while progress loads.
- **Quick-action pills** under the ring (Sposta / Scambia / Elimina) driven by
  `menuOptions`; each `router.back()` then runs the parent flow.
- **Istruttore / Luogo:** flat rows; **both auto-save on selection** (no global
  Salva). Instructor change runs an availability check and reverts with an
  `Alert` if unavailable (toast would be hidden under the modal).
- **New "Dettagli guida" 3D card CTA** → `home/manage-lesson-details` formSheet
  ([0.9] detent) holding tipo guida (chips) + valutazione (stars) + note + its
  own Salva. The card shows a live summary (tipo · voto · note).
- **Footer:** only Presente / Assente (the "Salva dettagli" CTA is removed).

Store contract (`manageLessonStore`) changed: `onSave`/`ManageLessonSavePayload`
→ `onSaveDetails` (+ `ManageLessonDetailsPayload`) and `onChangeInstructor`;
`onStatus` no longer takes lessonTypes (derives them from the lesson). Parent:
`handleSaveDetails` → `saveLessonDetails(lesson, input)` (instructor block
removed) + new `changeLessonInstructor(lesson, instructor)`.

New/changed files: `app/(tabs)/home/manage-lesson-details.tsx` (new),
`src/components/ProgressRing.tsx` (new), `SkeletonRing` added to
`src/components/Skeleton.tsx`, `manage-lesson.tsx` rewritten, `_layout.tsx`
(route registered), `manageLessonStore.ts` + `IstruttoreHomeScreen.tsx` rewired.

## Follow-ups

- Dead code remains in `IstruttoreHomeScreen` (old draft state, availability
  effect, `handleOpenInstructorPicker`, unused `NativeFormSheet` import) — safe
  to delete in a cleanup pass (`noUnusedLocals` is off so it doesn't error).
- Verify formSheet-over-modal stacking on a real device (TestFlight).
