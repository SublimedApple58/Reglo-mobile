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
- `src/screens/firstAccess/FirstAccessStepScreen.tsx` — scheletro: barra con «indietro» (`ClayIconButton`), linea di avanzamento (scaleX 260 ms, ease-out, `ReduceMotion.Never`), titolo 30/600, CTA `ClayButton` fissa in fondo che sale CON la tastiera (iOS: `keyboardWillShow` → `withTiming` sulla traslazione, stessa durata della tastiera; niente `KeyboardAvoidingView`), errore in dissolvenza, `revealKey` porta in vista il fondo quando compare un errore. `useFocusAfterPush(ref)`: il primo passo apre la tastiera a push finito (`transitionEnd` del genitore), non con `autoFocus`.
- `src/components/PhoneField.tsx` — IL campo telefono: prefisso a sinistra (bandierina + `+39`, Italia preselezionata) che apre il foglio `(auth)/country-picker` (`FORM_SHEET` + `FormSheet` con ricerca, «Più usati» in cima, poi per lettera; store `countryPickerStore`). Incollare `+41…`/`0041…` sceglie il paese. Errore attaccato al campo (bordo rosso + messaggio sotto, 200 ms, riga riservata con `reserveErrorSpace`). `allowEmail` per «Email o telefono»: il prefisso compare alla prima cifra. Varianti `clay` (Primo accesso) e `auth` (fogli Accedi / Password dimenticata). Valore al server: `phoneSubmitValue` → E.164 (lo zero iniziale cade fuori da IT/SM/VA) o l'email.
- `src/utils/phoneCountries.ts` — paesi, prefissi, bandierine, `toE164`, `splitInternational`.
- `src/screens/firstAccess/FirstAccessSteps.tsx` — i sei passi.
- `assets/web/3d/chiave-3d*.png` — copia da `../reglo/public/images/3d/chiave-3d.png`.
- `regloApi.firstAccessStart` / `firstAccessComplete` (salva token e autoscuola come `login`); tipi `FirstAccessStartResult`, `FirstAccessCompleteInput`.

## Punti d'ingresso
- iOS `AuthWelcomeScreen` (redesign 09/11): CTA nera «Registrati come allievo», CTA bianca «Primo accesso» con la riga d'aiuto «Ti ha già iscritto l'autoscuola? Scegli Primo accesso.», in fondo il link discreto «Hai già un account? **Accedi**».
- Android `LoginScreen` inline: stessa riga sopra «Sei un allievo? Registrati».
- Login: il campo è «Email o telefono» (`PhoneField allowEmail`). Se il server risponde `code: "ACTIVATION_REQUIRED"` (numero di un account mai attivato) l'app chiude il foglio e apre il «Primo accesso» col numero già scritto.
- `PasswordResetScreen`: accetta email o telefono (`PhoneField allowEmail`); col telefono il codice va all'email dell'account.
- `app/_layout.tsx` `allowedAuthLeaves` include `first-access` e `country-picker` (senza, l'AuthGate rimanda al benvenuto appena si apre il foglio dei prefissi).
- `app/(auth)/_layout.tsx`: `first-access` con `contentStyle` bianco (mai il grigio del tema dietro lo stack annidato).

## Sfarfallio al tocco di «Primo accesso» (fix 09/11)
Causa: il campo aveva `autoFocus`, quindi la tastiera partiva a metà del push e il `KeyboardAvoidingView` spostava «Continua» dal fondo a sopra la tastiera in un fotogramma, con la schermata ancora in movimento. Ora: push pulito, tastiera a push finito, CTA che sale insieme alla tastiera. Su iOS 26 `useAnimatedKeyboard` dà l'altezza solo a tastiera arrivata: non usarlo per seguire la tastiera.

## Sicurezza (scelta consapevole)
Senza codice, chi conosce il numero di un allievo non ancora attivato può attivarlo al posto suo. Protezioni: solo account mai attivati; limiti per numero e per IP sul server; risposta generica; il titolare vede sul web se e quando l'allievo ha attivato l'account.

## Note
- OTA-safe: nessun modulo nativo nuovo (`@react-native-community/datetimepicker` è già nel binario).
- Le app già installate senza questo OTA: il login col numero di un account non attivato mostra il messaggio «Tocca Primo accesso», ma il bottone non c'è finché non arriva l'OTA.
