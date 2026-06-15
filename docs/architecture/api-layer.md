# API Layer & Types

## Files
- `src/services/apiClient.ts` — HTTP client with JWT + company headers, 401 auto-invalidation
- `src/services/regloApi.ts` — 80+ typed endpoint functions
- `src/types/regloApi.ts` — 100+ type definitions

## Base URL
`https://app.reglo.it/api`

## Response pattern
```typescript
type ApiResponse<T> = ApiSuccess<T> | ApiError;
// Always check: if (response.success) { response.data }
```

## High-traffic types (used across many screens)
| Type | Screen count |
|------|-------------|
| `AutoscuolaAppointmentWithRelations` | 14 |
| `InstructorClusterSettings` | 9 |
| `AutoscuolaStudent` | 7 |
| `NotificationItem` | 3 |

## Most-called API functions
| Function | Callers |
|----------|---------|
| `getAutoscuolaSettings` | 10 screens |
| `getInstructorSettings` | 7 screens |
| `getAppointments` | 7 screens |
| `getAvailabilitySlots` | 7 screens |
| `cancelAppointment` | 6 screens |
| `setDailyAvailabilityOverride` | 5 screens |
| `getStudents` | 5 screens |

## Cross-repo impact
When backend types change, update `src/types/regloApi.ts` first, then grep for the type name to find all consuming screens.
