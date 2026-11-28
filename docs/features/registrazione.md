# Registrazione dell'allievo (REG-812)

«Registrati come allievo» dalla schermata di benvenuto: l'allievo che scarica l'app da solo, con il codice di 6 caratteri dell'autoscuola (o di un istruttore autonomo, o di un luogo). Chi è stato iscritto dall'autoscuola fa invece il [Primo accesso](first-access.md).

Rifatta il 27/11/2026: prima era un modulo unico a foglio (`SignupScreen`, cinque campi insieme, errori in inglese, codice controllato solo alla fine). Ora è un percorso a passi con lo scheletro del Primo accesso (`FirstAccessStepScreen`), uguale su iOS e Android.

## Percorso

1. **Codice di invito** (`index`) — sei caselle (`CodeBoxes`), chiave 3D. «Continua» controlla il codice sul server.
2. **«È la tua autoscuola?» / «È il tuo istruttore?»** (`school`, REG-818, `src/screens/signup/SignupSchoolScreen.tsx`) — fascia in alto (42% dello schermo, angoli inferiori tondi: poster nel bundle `assets/signup/hero-poster.jpg`, sopra il video `expo-av` che parte una volta e resta sull'ultimo fotogramma; `HERO_VIDEO` è null finché non arriva l'mp4) e, a cavallo del bordo, la tessera clay protagonista: logo dell'autoscuola, oppure con un codice istruttore la foto (o le iniziali) dell'istruttore con il logo agganciato. Titolo = autoscuola o istruttore; riga sotto «È la tua autoscuola?», «Sede di <luogo>» o «Il tuo istruttore · <autoscuola>». «Non è lei? / Non è il tuo istruttore? Cambia codice». Entrata in dissolvenza a scalare (260 ms, `ReduceMotion.Never`).
3. **Come ti chiami?** (`name`) — nome e cognome affiancati (in colonna, con l'icona e la tastiera, il cognome finiva sotto la CTA).
4. **La tua email** (`email`) — «Continua» controlla che sia libera; se esiste già: errore + «È il tuo account? Accedi».
5. **Il tuo numero di cellulare** (`phone`) — `PhoneField` con prefisso; sotto, il consenso WhatsApp di REG-500.
6. **Scegli una password** (`password`) — lucchetto 3D (`VITA_ART.lucchetto`).
7. **Tutto giusto?** (`confirm`) — riepilogo, ogni riga riporta al suo passo. «Crea account» chiama `signUp` (una sola scrittura).

Creato l'account la sessione si apre e l'AuthGate porta all'[onboarding](onboarding-allievo.md): **patente e cambio** (step `license`, solo se l'autoscuola lascia la scelta all'allievo), poi le **disponibilità**, poi la home (per chi è in attesa: `AllievoAwaitingScreen`).

## Files

| File | Ruolo |
|------|-------|
| `app/(auth)/signup/*` | Stack dei passi (`_layout` con `SignupProvider`) |
| `src/screens/signup/SignupContext.tsx` | Bozza, `SIGNUP_STEPS`, `signupProgress`, `submit` |
| `src/screens/signup/SignupSteps.tsx` | I sette passi |
| `src/components/CodeBoxes.tsx` | Codice a caselle (un `TextInput` invisibile sopra) |
| `src/screens/onboarding/OnboardingLicenseSteps.tsx` | «Che patente fai?» e «Cambio manuale o automatico?» |
| `src/screens/AllievoAwaitingScreen.tsx` | Home «Ci siamo quasi» (primo ingresso in fase AWAITING) |
| `src/screens/CompanySelectScreen.tsx` | «Quale autoscuola?» per chi ne ha più di una |
| `src/services/regloApi.ts` | `checkSignupCode`, `checkSignupEmail`, `studentRegister`, `setLicensePath` |

## Backend

- `POST /api/mobile/auth/student-register/check` — `{ schoolCode }` → `SignupSchool` (nome, logo, istruttore con foto e colore dal REG-818, luogo, `asksLicensePath`); `{ email }` → `{ emailAvailable }`. Limite di tentativi per IP.
- `POST /api/mobile/auth/student-register` — crea l'account; messaggi in italiano, uno alla volta.
- Step `license` in `onboarding` di `/api/mobile/me` (prima di `availability`), salvato da `PATCH /api/autoscuole/me/license-path`.

## Regole

- Una domanda per schermata, icona 3D eroe a 64 pt, CTA «Continua» che sale con la tastiera, solo dissolvenze.
- Il fuoco arriva a schermata ferma (`useFocusAfterPush`), mai `autoFocus`.
- Nessun controllo lasciato alla fine: codice ed email si verificano al loro passo.
- Tolto con REG-812: l'invito via link email in app (`InviteAcceptScreen`, rotta `invite/[token]`, `createInvite`/`getInviteContext`/`acceptInvite`). Gli inviti dello staff si accettano dal web.
- Rete di sicurezza in `app/(tabs)/_layout.tsx`: se `needsLicensePath` è vero ma `/me` non ha mandato lo step (backend precedente), lo step `license` si apre da lì.

## Connessioni

- → **Onboarding allievo**: `OnboardingContext` salva patente e cambio dentro `submit`, prima di `completeOnboarding`.
- → **WhatsApp alerts** (REG-500): il consenso è scritto nel passo del cellulare, `whatsappConsent: true`.
- → **Student phase**: la fase di atterraggio la decide `student-register` (AWAITING / TEORIA / PRATICA).
