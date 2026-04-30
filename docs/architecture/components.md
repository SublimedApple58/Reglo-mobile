# Shared Components

## Component → Screen usage map

| Component | Used by (screens) |
|-----------|-------------------|
| **BottomSheet** | AllievoHome, AllievoPayments, ClusterSettings, CreateExam, IstruttoreHome, InstructorManage, InstructorVehicles, NotificationOverlay, OwnerInstructor, OwnerVehicles, RescheduleAppointmentSheet, SwapOffers, TitolareHome **(14)** |
| **TimePickerDrawer** | ClusterSettings, CreateExam, InstructorAvailability, InstructorManage, InstructorVehicles, OwnerVehicles, PublicationModeEditor, RescheduleAppointmentSheet, Settings **(9)** |
| **CalendarDrawer** | AllievoHome, CreateExam, IstruttoreHome, TitolareHome **(4)** |
| **RangesEditor** | InstructorManage, OwnerInstructor, PublicationModeEditor **(3)** |
| **SelectableChip** | CalendarNavigator, ClusterSettings, InstructorManage, Settings **(4)** |
| **WeeklyAgendaView** | IstruttoreHome, TitolareHome **(2)** |
| **BookingCelebration** | AllievoHome, NotificationOverlay, SwapOffers **(3)** |
| **StarRating** | IstruttoreHome, StudentMyNotes, StudentNotesDetail **(3)** |
| **MiniCalendar** | InstructorManage, OwnerInstructor + CalendarDrawer **(3)** |
| **RescheduleAppointmentSheet** | IstruttoreHome **(1)** — depends on BottomSheet + CalendarDrawer + TimePickerDrawer |

## Platform-specific components
- `BottomSheet.tsx` (Android) vs `BottomSheet.ios.tsx` (iOS)
- `GlassTabBar.tsx` (Android) vs `GlassTabBar.ios.tsx` (iOS)

## Key conventions
- BottomSheet always uses handle, never X close button
- Modal for quick actions, BottomSheet for complex scrollable content
- Screen wraps every screen (SafeArea)
