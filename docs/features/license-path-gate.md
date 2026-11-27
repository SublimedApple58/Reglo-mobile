# Percorso patente dell'allievo registrato da solo (REG-410 → REG-812)

> **Dal 27/11/2026 (REG-812) non è più un blocco dentro le tab.** `LicensePathGateScreen` è stato tolto: patente e cambio sono lo step `license` dell'onboarding (`src/screens/onboarding/OnboardingLicenseSteps.tsx`, rotte `app/onboarding/license` e `transmission`), prima delle disponibilità. Vedi [registrazione.md](registrazione.md) e [onboarding-allievo.md](onboarding-allievo.md). Quello che segue resta valido per le regole.

- Riguarda solo chi si è registrato da solo (`selfRegistered`) in un'autoscuola che lascia la scelta all'allievo (`licensePathMode = student_choice`); con la patente fissa (REG-424) non compare.
- Due schermate: «Che patente fai?» (B, AM microcar, B1, AM, A1, A2, A; `STUDENT_LICENSE_CATEGORIES`) e «Cambio manuale o automatico?» (obbligatorio per tutte, con il suggerimento «se non lo sai ancora, scegli manuale»).
- Salvataggio: `regloApi.setLicensePath` dentro `OnboardingContext.submit`, poi invalidazione di `queryKeys.studentPhase`. Il server non sovrascrive una patente già impostata.
- Rete di sicurezza: `app/(tabs)/_layout.tsx` apre lo step se `needsLicensePath` è vero senza step dal server.
- Backstop server-side: `ensureStudentCanBookFromApp` blocca la prenotazione se `selfRegistered && !licenseCategory`.
- Backend: `reglo/docs/features/license-path-selfselect.md`.
