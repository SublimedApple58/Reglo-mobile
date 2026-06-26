# Handoff — Esperienza allievo MOTO coerente (UI moto-aware)

_Per il prossimo agente, anche senza memoria di sessione. NON è un changelog: contiene obiettivo, dove e come lavorare, situazione finale ideale. Le cose già fatte stanno in git + nelle memorie._

Branch: **`feature/vehicles-redesign`** (reglo-mobile + reglo). Da fare prima del rilascio della feature veicoli / guide di gruppo moto.

## Obiettivo
Un allievo che fa un **percorso moto** (categoria patente `AM | A1 | A2 | A`) oggi vede un'app **tutta orientata all'auto**: hero con la macchina da corsa 🏎️, card guide con la 🚗, icona Home "auto" nella tab bar. Va resa **coerente col percorso moto** (iconografia / illustrazioni / wording moto) **mantenendo identica la struttura e il layout dell'app** — si sostituiscono solo asset/icone/etichette auto-specifici, mai la disposizione. Gli allievi auto (categoria `B`) devono restare **invariati**.

Tema collegato (stessa esperienza): nelle **guide di gruppo moto** l'allievo non vede mai la moto assegnata né l'auto al seguito — il dato c'è già nell'API ma non è renderizzato (punto 4 sotto).

## Regole di lavoro (SEMPRE)
1. **Prima di QUALSIASI lavoro UI**: applica la skill **`/ui-ux-pro-max`** e leggi `docs/design-system.md`.
2. **Mono-navy**, niente rosa, font weight **500/600** (mai 700+). Vedi memorie `project_mobile_navy_mono`, `feedback_font_weight`.
3. **Niente deploy / OTA senza ok esplicito dell'utente.**
4. Type-check mobile: `./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TabNavigator" | grep "error TS"` (`noUnusedLocals` OFF; l'errore `TabNavigator` è pre-esistente).

## Il segnale da usare (già disponibile)
- L'allievo conosce la propria categoria: in `AllievoHomeScreen.tsx` ci sono già `studentLicenseCategory` + `studentTransmission` (intorno a riga ~160) e `studentLicenseLabel` (es. "A2 · Manuale", riga ~163, già corretto — tenerlo).
- Per-guida è più preciso usare la **categoria del veicolo dell'appuntamento**: `appointment.vehicle?.licenseCategory` (gli appuntamenti includono già `vehicle`). Per una guida di gruppo moto, la moto dell'allievo è in `getGroupLesson().participants[self].vehicleName/licenseCategory`.
- **Manca un helper**: `src/utils/license.ts` ha `LICENSE_CATEGORY_LABELS`/`transmissionLabel` ma **non** `isMotoLicenseCategory`. Aggiungerlo (mirror del backend `reglo/lib/autoscuole/license.ts`):
  ```ts
  export const MOTO_LICENSE_CATEGORIES: LicenseCategory[] = ['AM', 'A1', 'A2', 'A'];
  export const isMotoLicenseCategory = (c?: string | null) =>
    !!c && (MOTO_LICENSE_CATEGORIES as string[]).includes(c);
  ```

## Asset da aggiungere
Oggi esistono solo `assets/icons/fluent-car.png` e `assets/icons/fluent-racing.png` (auto). **Serve un'icona 3D moto** (es. `fluent-motorcycle.png`) nello **stesso stile/pipeline** delle altre fluent 3D — vedi memoria `reference_3d_icons_pipeline`: pack **Microsoft Fluent 3D** (MIT, raw github), de-pink (hue-shift rosa/rosso→blu/navy), in RN **mai `tintColor`** (l'icona è già colorata). Ritaglio/dimensioni coerenti con `fluent-car.png`. Se non c'è un "motorcycle" 3D adeguato, valutare moto/scooter equivalente in tono mono-navy.

Introdurre **un helper unico** per non sparpagliare la scelta in ogni schermata:
```ts
// es. src/utils/lessonArt.ts
export const lessonArtSource = (licenseCategory?: string | null) =>
  isMotoLicenseCategory(licenseCategory)
    ? require('../../assets/icons/fluent-motorcycle.png')
    : require('../../assets/icons/fluent-car.png');
```
(per l'hero c'è la variante "racing" 🏎️ `fluent-racing.png`: o si crea una moto sportiva equivalente, oppure si usa la moto normale anche nell'hero — decisione di design.)

## File da toccare

### 1. `src/screens/AllievoHomeScreen.tsx` (cuore del problema)
Illustrazioni `require()` hardcoded su auto (numeri di riga indicativi, verificarli):
- **Hero "prossima guida"** — `fluent-racing.png` (~riga 1622) → per moto: icona moto.
- **Mini-card guide imminenti** (carosello "Vedi tutte le guide") — `fluent-car.png` (~riga 1703) → moto. Meglio **per-guida** su `appointment.vehicle?.licenseCategory` (resta corretto anche in casi misti).
- **Empty state** ("Le tue guide", nessuna guida) — `fluent-car.png` (~riga 1494) → moto se allievo moto.
- **Prompt esame** — `fluent-car.png` (~riga 1555) → moto-izzare per coerenza.

### 2. `app/(tabs)/home/all-lessons.tsx`
Usa `fluent-car.png` per le righe guida → stessa logica per-guida moto-aware.

### 3. `src/components/GlassTabBar.tsx` (icona Home tab)
`ICON_MAP.home = 'car-sport-outline'` (riga 19). Esiste **già** un pattern di override context-aware (righe ~158-160: `isStudentTeoria && route.name === 'home'`). Aggiungere un override analogo: se l'allievo è moto → home icon moto. Ionicons non ha "motorcycle"; l'app usa già **`'bicycle-outline'`** come proxy moto lato istruttore — usare quello (o una soluzione migliore concordata). Serve esporre il flag "studente moto" in quel punto (come per `isStudentTeoria`).

### 4. Guide di GRUPPO moto — lato allievo (gap di visualizzazione, non di logica)
- `app/(tabs)/home/group-lesson-detail.tsx`: oggi mostra `lesson.vehicleName` (~riga 95) che per un gruppo **moto è `null`** → la riga veicolo sparisce. Mostrare invece **la moto assegnata all'allievo**: `lesson.participants` → la voce dell'utente loggato → `vehicleName` (+ `licenseCategory`), più l'**auto al seguito** `lesson.followVehicleName`, ed etichetta/icona "guida di gruppo **moto**". (Tutti i campi sono già nel payload: `kind`, `fleet`, `followVehicleName`, `participants[].vehicleName`.)
- `src/screens/GroupLessonInvitesScreen.tsx` (~righe 138-168): la riga veicolo (`inv.vehicleName`) è `null` per i gruppi moto → non appare. Indicare almeno che è una guida **moto** ("ti verrà assegnata una moto"). NB: richiede una **piccola aggiunta backend** — esporre `kind` nel payload invito (`getGroupLessonInvites` / `broadcastGroupLessonInvite` in `reglo/lib/actions/autoscuole-availability.actions.ts`), perché la moto specifica si conosce solo all'accettazione.
- Card "Guida di gruppo" nella home allievo (`AllievoHomeScreen`, ~righe 1729-1763, icona `fluent-people.png` ~1800): opzionale, mostrare la moto assegnata quando disponibile.

### 5. `src/screens/StudentNotesDetailScreen.tsx`
Verificare l'iconografia/veicolo nel dettaglio guida/note dell'allievo e renderla moto-aware dove serve.

## Vincoli
- **Struttura/layout invariati**: si sostituiscono solo asset/icone/etichette auto-specifici. Niente nuove sezioni o riorganizzazioni.
- **Non rompere gli allievi auto (B)**: tutto identico per categoria `B` (default = ramo auto attuale).
- Riusare un **helper unico** (`lessonArtSource` / `isMotoLicenseCategory`) invece di duplicare i `require` condizionali ovunque.
- `fluent-*` 3D in RN: **mai `tintColor`**.

## Situazione finale ideale
Un allievo A2/A apre l'app e vede un'esperienza **coerentemente moto**: hero e card guide con icona moto, icona Home moto nella tab bar, empty state moto; nel dettaglio di una guida di gruppo moto vede **"La tua moto: …"** + **"Auto al seguito: …"** e l'etichetta "guida di gruppo moto"; l'invito segnala che è una guida moto. Un allievo B continua a vedere esattamente l'app di oggi (auto). La scelta dell'icona è guidata dalla **categoria del veicolo della guida** (fallback: categoria patente dell'allievo) via un helper condiviso.

## Contesto feature gruppo-moto (per capire i dati)
La feature "guide di gruppo moto" (kind="moto": flotta di moto + 1 auto al seguito condivisa, ogni allievo riceve una moto auto-assegnata) è **già fatta** BE+web+mobile-creazione e documentata in `reglo/docs/features/group-lessons.md` (sezione "Moto group lessons") e `reglo-mobile/docs/features/group-lessons.md`. Memoria: `project_group_moto_lessons`. Il payload `getGroupLesson` espone già `kind`, `fleet`, `followVehicleName`, e `participants[].vehicleName` (la moto del singolo). Questo handoff riguarda **solo la resa UI lato allievo moto**, non la logica.

## Verifica (su staging)
Demo "Autoscuola Reglo" su `staging.reglo.it` (vedi `reglo/docs/STAGING.md`). Login come allievo **moto** (es. Simone / A2 — controllare le credenziali allievo nella demo) e verificare home / card / dettaglio / tab; poi login come allievo **B** per confermare che nulla è cambiato. Build app contro staging: `npm run ios:staging` (richiede `reglo-mobile/.staging-bypass`). Le modifiche UI sono solo JS → hot-reload, niente rebuild nativo (salvo l'aggiunta del nuovo asset, che richiede reload del bundler).
