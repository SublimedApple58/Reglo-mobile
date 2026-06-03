# Instructor/Owner Settings — Redesign (mirror student branch)

## What was done
Redesigned the instructor/owner branch of `SettingsScreen` (`renderNonStudentContent`) to mirror the already-redesigned student branch and the allievo app's design system. Removed all yellow. Profile editing moved to a sub-page in the "Altro" stack.

## Scope (confirmed with user)
Only the **Impostazioni** screen (`SettingsScreen`, instructor/owner branch). NOT "Il mio gruppo" (`ClusterSettingsScreen`) nor the "Altro" hub (`MoreScreen`) — those stay for a later pass (note: `ClusterSettingsScreen` still has yellow Switch tracks `#FACC15` and a custom `BottomSheet` + `TimePickerDrawer` ×3 to migrate).

## User directives
- Profile → **sub-page** like the student.
- `SelectableChip` → **navy globally**, never yellow again, model everything on the student settings.
- **Same structure as the student** (large title, no blur header).

## Changes
1. **`src/components/SelectableChip.tsx`** — active state from yellow (`#FEF9C3/#FDE047/#A16207`) → **outline navy** (`#FFFFFF` bg, `#1A1A2E` border, `#1A1A2E` text), borderWidth 1.5. Shared component → also fixes the yellow chips in `ClusterSettingsScreen` and the owner agenda settings.
2. **`app/(tabs)/more/profile-edit.tsx`** (NEW) — profile-edit formSheet for the "Altro" stack (copy of `settings/profile-edit.tsx`), bound to `settingsStore`.
3. **`app/(tabs)/more/_layout.tsx`** — registered `profile-edit` as a formSheet (`fitToContents`, grabber) + added `contentStyle: { backgroundColor: colors.background }` (fixes formSheet bottom color band) + explicit Stack.Screen entries.
4. **`src/screens/SettingsScreen.tsx`**
   - Removed `if (!isStudent) return` guard on the `settingsStore` publish → profile fields published for all roles so `more/profile-edit` works.
   - `renderNonStudentContent`: hero accordion → **profile card → `/(tabs)/more/profile-edit`** (no more inline edit, no `yellowDot`); Vista agenda → white `sectionCard`, segmented **outline navy** (was amber); Disponibilità → white `sectionCard`, navy chips; Agenda (owner) → white `sectionCard` accordion, neutral header icon (was yellow `#FEF9C3/#CA8A04`); Notifiche + account → flat `menuGroup` rows (like student).
   - Added styles: `sectionCard`, `sectionLabel`, `sectionHint`, `sectionHeaderRow`, `sectionIcon`, `sectionHeaderTitle`, `sectionHeaderSub`. Updated `settingsCardStyles.viewModeBtnActive/TextActive` to navy.
   - Removed dead legacy styles: `heroCard/heroRow/heroAvatar*/heroMeta/heroName/heroEmail/heroDivider/heroCompanyRow/yellowDot/heroCompanyName`, `menuCard/menuRow/menuIcon/menuTextWrap/menuTitle/menuSubtitle/menuDivider/expandedContent`, `dangerCard/dangerTitle`, `notifDot/notifDotOn/notifDotOff`.

## Amendment (final shape, per user feedback)
User: the controls must be **normal settings rows that open a formSheet** (like the student's Disponibilità/Pagamento), not inline open controls. Only the profile is a card.
- New formSheet sub-pages in the "Altro" stack: `more/agenda-view.tsx` (day/week), `more/availability-mode.tsx` (default/publication + "Gestisci disponibilità"), `more/agenda-settings.tsx` (owner: weeks + reminders). Registered in `more/_layout.tsx`.
- New `src/stores/instructorSettingsStore.ts` — SettingsScreen publishes instructor/owner values + handlers (agenda view pick, availability-mode pick w/ API + rollback, manage availability, owner save) for the sub-pages.
- `renderNonStudentContent`: the three inline sections became **one `menuGroup`** of rows (Vista agenda / Disponibilità / Agenda / Notifiche), each with current-value hint + chevron, pushing to its formSheet. Removed the owner accordion.
- Cleanup: removed now-dead `AnimatedChevron`/`AnimatedSection` (+ pruned reanimated imports to `Animated, FadeInUp`), `SelectableChip` import, `weekPresets`, `toReminderLabel`, `activeSection`/`toggleSection`, `settingsCardStyles`, and the `flatSection`/`section*` styles.

## Verify
- tsc clean (only pre-existing `src/navigation/TabNavigator.tsx` error remains).
- No yellow on the screen; pink only on CTAs; selection = outline navy.
- Instructor/owner profile card opens the formSheet and saves (refreshMe).
- INSTRUCTOR_OWNER sees Vista agenda + Disponibilità + Agenda.
