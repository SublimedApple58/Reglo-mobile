# Primo accesso (allievo creato dall'autoscuola col telefono)

Richiesta Ricca, decisione Tiziano 09/11/2026: l'autoscuola crea l'allievo **dal web** con solo nome, cognome, telefono e percorso. Niente email, niente password, **nessun codice**. Il ragazzo apre l'app, tocca «Primo accesso», scrive il numero e, se c'è un allievo mai attivato con quel numero, completa i suoi dati ed entra.

> Branch `feat/allievo-telefono` (mobile da `origin/master`, web da `origin/staging`). Backend in `../reglo/docs/features/allievo-telefono.md`.

## Flusso
Uno stack a schermo intero, un passo per schermata, push e swipe indietro nativi:

| Rotta | Passo | Note |
|---|---|---|
| `(auth)/first-access/index` | Numero di telefono | chiave 3D della web app; `POST /api/mobile/auth/first-access/start` → permesso 30 min + nome, cognome, autoscuola. Risposta generica se il numero non c'è o è già attivo |
| `name` | «Ciao Giulia»: conferma nome e cognome | precompilati dall'autoscuola, modificabili |
| `email` | Email (obbligatoria) | validazione al blur; unicità controllata dal server alla fine |
| `password` | Password sua (obbligatoria, ≥ 6) | Mostra/Nascondi, `textContentType="newPassword"` |
| `birth` | Data di nascita | iOS ruota nativa (`display="spinner"`), Android calendario nativo; 14–100 anni |
| `confirm` | «Tutto giusto?» riepilogo in `ClayList` | righe premibili riportano al passo; `POST .../first-access/complete` → `AuthPayload`; momento caldo «Eccoti, Giulia» (auto 3D, dissolvenza 180 ms) per 1,4 s, poi `applyAuthPayload` e l'`AuthGate` porta nelle tab |

## File
- `app/(auth)/first-access/_layout.tsx` + una rotta per passo (re-export).
- `src/screens/firstAccess/FirstAccessContext.tsx` — stato condiviso tra i passi (provider nel layout), formattatori.
- `src/screens/firstAccess/FirstAccessStepScreen.tsx` — scheletro: barra con «indietro» (`ClayIconButton`), linea di avanzamento (scaleX 260 ms, ease-out, `ReduceMotion.Never`), titolo 30/600, CTA `ClayButton` fissa sopra la tastiera, errore in dissolvenza.
- `src/screens/firstAccess/FirstAccessSteps.tsx` — i sei passi.
- `assets/web/3d/chiave-3d*.png` — copia da `../reglo/public/images/3d/chiave-3d.png`.
- `regloApi.firstAccessStart` / `firstAccessComplete` (salva token e autoscuola come `login`); tipi `FirstAccessStartResult`, `FirstAccessCompleteInput`.

## Punti d'ingresso
- iOS `AuthWelcomeScreen`: riga «L'autoscuola ti ha già iscritto? **Primo accesso**» sotto i due bottoni.
- Android `LoginScreen` inline: stessa riga sopra «Sei un allievo? Registrati».
- Login: il campo è «Email o telefono». Se il server risponde `code: "ACTIVATION_REQUIRED"` (numero di un account mai attivato) l'app chiude il foglio e apre il «Primo accesso» col numero già scritto.
- `PasswordResetScreen`: accetta email o telefono; col telefono il codice va all'email dell'account.
- `app/_layout.tsx` `allowedAuthLeaves` include `first-access`.

## Sicurezza (scelta consapevole)
Senza codice, chi conosce il numero di un allievo non ancora attivato può attivarlo al posto suo. Protezioni: solo account mai attivati; limiti per numero e per IP sul server; risposta generica; il titolare vede sul web se e quando l'allievo ha attivato l'account.

## Note
- OTA-safe: nessun modulo nativo nuovo (`@react-native-community/datetimepicker` è già nel binario).
- Le app già installate senza questo OTA: il login col numero di un account non attivato mostra il messaggio «Tocca Primo accesso», ma il bottone non c'è finché non arriva l'OTA.
