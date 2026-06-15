# Password Reset (OTP via email)

"Password dimenticata?" flow on the login form. 3 steps: **email → 6-digit code → new
password**, then **auto-login**. Backend: see `reglo/docs/features/password-reset.md`.

## Files

| File | Role |
|------|------|
| `src/screens/PasswordResetScreen.tsx` | The 3-step screen. `mode: 'sheet'` (iOS native form sheet) / `'inline'` (Android full-navy). Internal `step` state. Reuses `AuthField`, `ToastNotice`, signup code-input pattern. |
| `app/(auth)/password-reset-sheet.tsx` | iOS route — `formSheet` + `fitToContents` (no ScrollView). |
| `app/(auth)/password-reset.tsx` | Android route — inline. |
| `app/(auth)/_layout.tsx` | Stack.Screen options for both routes. |
| `app/_layout.tsx` | `allowedAuthLeaves` includes `password-reset` / `password-reset-sheet`. |
| `src/services/regloApi.ts` | `passwordResetRequest`, `passwordResetVerify`, `passwordResetConfirm`. |
| `src/types/regloApi.ts` | `PasswordReset{Request,Verify,Confirm}Input`, `PasswordResetConfirmResult`. |
| `src/context/SessionContext.tsx` | `applyAuthPayload(payload)` — shared by signIn/signUp; used for reset auto-login. |
| `src/screens/LoginScreen.tsx` | `onForgot` → `router.push` to the platform route (replaced the old `Alert`). |

## Behaviour

- `request` always succeeds (generic copy shown client-side — no enumeration).
  Resend has a 60s countdown.
- `verify` throws `RegloApiError` (400) on wrong/expired code → inline error.
- `confirm` returns `{ autoLogin: true, payload }` → `applyAuthPayload` flips the
  root status to `ready` and `app/_layout.tsx` routes into the app. Fallback
  `{ autoLogin: false }` → success toast + back to login.
- Success haptic via the OTA-safe `src/utils/haptics.ts` shim (no-op until the
  next native build bundles expo-haptics).

## Platform pattern

Mirrors the login auth split: iOS opens a native content-hugging **form sheet**
(X / back top-left, no grabber, white `contentStyle`); Android renders the
**inline navy** screen. No new native module → **OTA-safe**.

## Connections

- **Session & Auth** (`architecture/session-auth.md`): adds `applyAuthPayload`.
- Backend contract: `AuthPayload` must match `reglo` login/confirm response.
