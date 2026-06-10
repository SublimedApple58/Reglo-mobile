# Performance — Student Settings Load Optimization (FE + BE + Redis)

## What was done

The student settings screen on mobile was extremely slow to load. Root cause: the
screen blocked its skeleton on a ~10-call network waterfall, the heaviest being
**7 per-day `getAvailabilitySlots` calls** that only feed the Disponibilità
sub-page. Plus per-request backend overhead (token write on every request,
uncached settings reads).

### Phase 1 — FE non-blocking load (`reglo-mobile`)
- `src/screens/SettingsScreen.tsx`: `loadSettings` now sets `initialLoading=false`
  immediately after the parallel batch (payment + settings + students); the
  availability preset is loaded in the **background** (fire-and-forget) instead
  of blocking the whole screen. Profile card + payment appear instantly.

### Phase 2 — Availability slots date-range endpoint (BE + mobile)
- `reglo/lib/actions/autoscuole-availability.actions.ts`: `getAvailabilitySlots`
  now accepts optional `from`/`to`. For a range it runs **1 base query + 1
  override query** (`date: { gte, lte }`) and builds slots for every day in the
  range. Backward compatible (legacy single `date` still works). Range capped at
  31 days.
- `reglo/app/api/autoscuole/availability/slots/route.ts`: forwards `from`/`to`.
- `reglo-mobile/src/services/regloApi.ts`: `getAvailabilitySlots` params accept
  `from`/`to`.
- `reglo-mobile/.../SettingsScreen.tsx`: `loadStudentAvailabilityPreset` makes
  **1 range call** for the week instead of 7 per-day calls; groups returned slots
  by calendar day.

### Phase 3 — DB indexes (`reglo`)
Migration `20260601142732_add_settings_perf_indexes`:
- `CompanyMember(companyId, autoscuolaRole)` — students list query
- `AutoscuolaAppointment(companyId, studentId, paymentRequired, paymentStatus)` —
  unpaid-appointments query in the payment profile

### Phase 5 — Mobile token write throttling (`reglo`)
- `reglo/lib/mobile-auth.ts`: `getMobileToken` previously issued a
  `mobileAccessToken.update()` (writing `lastUsedAt`) on **every** mobile request.
  Now it writes at most once per hour (or when the sliding expiry actually needs
  extending). Revocation stays immediate (the `findFirst` still hits the DB).

### Redis — settings read caching (`reglo`)
- `reglo/lib/actions/autoscuole-settings.actions.ts`:
  `getAutoscuolaSettingsForCompany` now reads `limits` through the existing
  Redis-backed `getCachedCompanyServiceLimits` (5min TTL, SETTINGS segment,
  invalidated by `updateAutoscuolaSettings`). `getAutoscuolaSettings` is called on
  nearly every screen, so this removes a DB round-trip from the hot path.

## Phase 4 — NOT done (intentional)
Full TanStack Query migration of `SettingsScreen` was evaluated and skipped:
the `(tabs)` screens stay mounted (no `unmountOnBlur`), so `loadSettings` runs
once per session and re-entry is already instant. With the FE now non-blocking and
the BE reads cached, a full rewrite of the 1300-line multi-role screen is
medium-risk for marginal gain (only cross-screen dedup of getStudents /
getPaymentProfile). Revisit only if cross-screen dedup is needed.

## Deploy notes
- Restart the `reglo` dev server to pick up route/action changes; reload the app.
- Prod: `pnpm migrate:prod` for the indexes. `CREATE INDEX` (non-concurrent) locks
  writes during creation — run in a low-traffic window, or convert to
  `CREATE INDEX CONCURRENTLY` manually if `AutoscuolaAppointment` is large.

## Verification
- `tsc --noEmit` clean on both repos for all changed files.
- `eslint` clean on changed backend files.
- Migration applied to dev DB; Prisma client regenerated.
