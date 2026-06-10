# Sezione "Allievi" — redesign + migrazioni drawer

## What was done
Redesigned the instructor "Allievi" section: ClusterSettings ("Il mio gruppo") aligned to the design system + migrated off custom drawers; InstructorNotesScreen palette refined.

## User directives
- Both screens (list + group settings).
- Migrate TimePickerDrawer ×3 and the students BottomSheet to routes now.

## Changes
1. **`app/(tabs)/notes/_layout.tsx`** — `contentStyle` background + registered `time-picker` (formSheet) and `group-students` (page-sheet/modal) routes.
2. **`app/(tabs)/notes/time-picker.tsx`** (NEW) — formSheet time picker, shared `timePickerStore` (clone of the settings one, for the notes stack).
3. **`src/stores/groupStudentsStore.ts`** (NEW) + **`app/(tabs)/notes/group-students.tsx`** (NEW) — page-sheet to manage the cluster's students (search + checklist + confirm), replacing the custom BottomSheet.
4. **`src/screens/ClusterSettingsScreen.tsx`** — Switch tracks yellow `#FACC15` → pink `#EC4899` (×7); palette `#1E293B` → `#1A1A2E`; the 3 `TimePickerDrawer`s → `openTimePicker` (timePickerStore + push `notes/time-picker`); the students `BottomSheet` → `openStudentsSheet` (groupStudentsStore + push `notes/group-students`). Removed dead state (drawer visibility, draft ids, filteredSheetStudents) + dead BottomSheet styles + `FlatList`/`TextInput`/`TimePickerDrawer`/`BottomSheet` imports.
5. **`src/screens/InstructorNotesScreen.tsx`** — slate `#1E293B` → `#1A1A2E` (×5).
6. Docs: settings.md (cluster section), routing.md, impact-map.md (BottomSheet/TimePickerDrawer used-by lists corrected; ClusterSettings removed).

## Verify
- tsc clean (only pre-existing TabNavigator error).
- Zero yellow / zero slate in ClusterSettings.
- Time rows open the formSheet picker; "Gestisci" opens the page-sheet; selections persist on confirm.

## Follow-up (not done)
InstructorNotesScreen still uses a raw blocking-ish load (getAgendaBootstrap + getAppointments); could move to a cache-first hook. ClusterSettings empty-state could get a Fluent icon.
