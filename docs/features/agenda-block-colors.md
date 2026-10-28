# Colori blocchi agenda (criterio Aspetto)

Le card delle **guide individuali normali** nell'agenda istruttore/titolare
prendono il colore dal criterio company (`durata` default | `patente`), con
colori personalizzati per voce (override) ed eccezioni pre-costruite. Il criterio
si imposta dal pannello **Aspetto** — sul web **e ora anche da mobile** (owner:
`Altro → Aspetto agenda`), condividendo la stessa action. È la replica mobile di
`reglo/docs/features/appearance-settings.md`. Esami, guide di gruppo,
blocchi istruttore e stati **annullata/assente** restano col loro colore.

> **REG-639 clay (29/10/2026) — come si disegna oggi.** Il blocco della guida
> è a **fondo pieno in tinta pastello** (`softenTint`, come prima), **senza
> bordo e senza barretta**, con un'**ombra morbida nella stessa tinta** e testo
> scuro. Un solo punto: `src/utils/agendaLook.ts` (`guideLook`), usato dalla
> griglia settimanale `WeeklyAgendaView`, l'unica vista dell'Agenda. Il colore è
> **esattamente quello di «Aspetto agenda»**, blu e azzurri compresi (Tiziano
> 29/10). Dettagli nella sezione in fondo. `DayItinerary`, la
> timeline `itinCard` e la vista Giorno `AgendaDayView` (provata il 28/10 con la
> barretta, bocciata il 29/10) non esistono più.

## Origine dati (nessuna modifica backend)

- Il setting arriva già nella risposta di `GET /api/autoscuole/settings`
  (`getAutoscuolaSettings` → `AutoscuolaSettingsData`): campi
  `agendaColorCriterion`, `agendaColorOverrides`, `agendaColorExceptions`.
  Prima il mobile non li tipizzava/consumava; ora sì.
- I dati per-guida sono già su `AutoscuolaAppointmentWithRelations`:
  `student.licenseCategory` / `student.transmission` / `student.examReady` +
  `vehicle` → bastano per criterio `patente` e per tutte le eccezioni.

## Files

| File | Ruolo |
|------|------|
| `src/types/regloApi.ts` | Campi `agendaColorCriterion?/Overrides?/Exceptions?` su `AutoscuolaSettings` + tipi `AgendaColorCriterion`, `AgendaColorOverrides`, `AgendaColorExceptions` |
| `src/utils/agendaColors.ts` | Porta 1:1 di `reglo/lib/autoscuole/agenda-color-criterion.ts`: entries durata/patente (stessi hex/soglie), eccezioni (`exam_ready`/`moto`), contrassegno guide automatiche (REG-622), normalizzatori, `resolveAgendaColorConfig(settings)`, `resolveGuideBlockStyle(ctx, config)` (output stile RN: `{ backgroundColor, shadowColor }`) |
| `src/utils/agendaLook.ts` | **REG-639**: `guideLook(appt, config)` → `{ bar, wash, text, sub, ring, muted, glow }`, unico punto dell'aspetto di una guida; con `AGENDA_BLOCK_BAR = false` `bar` è `null` e `wash` è il pastello pieno; `glow` = ombra in tinta. `EXAM_LOOK` (bianco, ombra neutra), `GROUP_LOOK` (verde foglia pastello), `GROUP_MOTO_LOOK` (ambra pastello); `blockLabel` («Pausa» per `lesson_buffer`) |
| `src/components/WeeklyAgendaView.tsx` | **Vista Settimana** (griglia oraria, l'unica vista dell'Agenda): `getLessonLook` è un adattatore di `guideLook` (fondo = `wash`, ombra `tintShadow(glow)`, niente bordo; la barretta `eventBar` compare solo se `AGENDA_BLOCK_BAR` torna `true`). Config via `useAutoscuolaSettings` in `WeekPage` |
| ~~`DayItinerary.tsx`~~ / ~~timeline `itinCard` di `IstruttoreHomeScreen`~~ | Eliminati con REG-638 (28/10): storico |
| `src/screens/AppearanceSettingsScreen.tsx` + `app/(tabs)/more/appearance.tsx` | **Pannello "Aspetto agenda"** (staff, scrittura): design editoriale/flat (no card-in-card) — criterio come **segmented control**, liste piatte con divisori inset, **pallini colore VIVI** (`vividHex`, non la tinta soft del blocco), eccezioni con **`ToggleSwitch`** custom (no Switch RN) + badge conteggio attive. Testo minimo (niente caption/descrizioni). Auto-save via `regloApi.updateAgendaColorSettings` + `setQueryData` + `ToastNotice`/rollback |
| `src/stores/colorPickerStore.ts` + `app/(tabs)/more/color-picker.tsx` | Swatch picker formSheet (palette curata `AGENDA_SWATCHES` = 16 swatch del web) + "Colore standard" (reset override), seed-and-callback |
| `src/screens/MoreScreen.tsx` | Voce **"Aspetto agenda"** in `Altro` → gate `isInstructor \|\| isOwner` (staff) |
| `src/services/regloApi.ts` | `updateAgendaColorSettings(input)` → `PATCH /api/autoscuole/agenda-colors` (solo i 3 campi `agendaColor*`) |
| `reglo/lib/actions/autoscuole-settings.actions.ts` + `reglo/app/api/autoscuole/agenda-colors/route.ts` | **Backend scoped** `updateAgendaColorSettings` + route `PATCH`: staff-gated (`canManageAgendaColors`), valida/normalizza i 3 campi, scrive `limits`, invalida cache Redis (AGENDA+SETTINGS), ritorna i settings risolti |

**Una superficie agenda** (anche in `ownerMode`, `TitolareHome` = wrapper): la griglia settimanale (`WeeklyAgendaView`) via `agendaLook.guideLook`. (Fino al 28/10 c'erano anche la timeline `itinCard` e `DayItinerary`; la vista Giorno `AgendaDayView` è durata una notte.)

## Comportamento

- **Criterio `durata`**: bucket per minuti (≤30, ≤45, ≤60, ≤90, >90) — stesse
  soglie/hex del web.
- **Criterio `patente`**: colore per patente della guida risolta
  dall'allievo (`licenseTagForStudent`: categoria + suffisso " autom." se
  `transmission === 'automatic'`). Il suffisso NON cambia colore: "B autom." è
  una B (REG-622, la distingue il bordo).
  Una voce per ogni patente (REG-461: anche CE/C1/C1E, DE/D1/D1E, CQC, ADR);
  le sotto-categorie ereditano colore e override della madre C/D finché non
  personalizzate (`resolveColorOverride`, usato anche dai pallini di
  `AppearanceSettingsScreen`).
- **Eccezioni** (vincono sul criterio, prima che matcha, ordine registry; solo
  se attive e pertinenti al criterio):
  - `exam_ready` (OFF, entrambi i criteri): `student.examReady` → viola.
  - `moto` (OFF, entrambi): `isMotoLicenseCategory(student.licenseCategory)` →
    arancio.
- **Guide automatiche: bordo, non colore (REG-622, 2026-10-18)**. Prima c'era
  il ciano (eccezione `automatic` / voce `autom`); ora la guida tiene il colore
  normale e, se `automaticLessonMarker` è acceso (default sì), prende
  `borderWidth` 2 + `borderColor` (nero `#111111` o `automaticLessonMarkerColor`).
  Match: `vehicle.transmission` o `student.transmission === 'automatic'`
  (`automaticMarkerColorFor`). Solo guide individuali; nella griglia vale anche
  sopra il rosso `examNextDay`. Niente badge. Il backend risolve già l'eredità
  dai setting vecchi; se i campi mancano (backend vecchio) resta acceso. Nella
  schermata Aspetto agenda: sezione "GUIDE AUTOMATICHE" (toggle + riga "Colore
  del bordo" che apre `more/color-picker` con reset "Nero (standard)").
- **Override**: hex scelto dal titolare (namespace `durata`/`patente`/`eccezioni`)
  → ammorbidito come i default (vedi resa "Airbnb soft" sotto).
- **Resa "Airbnb soft"** (`softenTint`): tutte le tinte (default + override) sono
  desaturate leggermente (0.18) e schiarite verso il bianco (0.42) → palette
  sussurrata, pulita, mai sgargiante. **Divergenza voluta dall'intensità del web**
  (più satura): scelta di design mobile richiesta dal titolare. Le voci/criterio
  restano identici — cambia solo il rendering del colore.
- Le guide **annullate/assenti** (`cancelled`/`no_show`) NON vengono tinte
  (restano nel look grigio dello stato). Gli **esami** nella timeline giornaliera
  (`config.isExam`) sono esclusi dalla tinta criterio.
- **Griglia oraria (deviazione voluta):** i blocchi usavano un proprio palette
  di stato (navy/ambra/rosso). Ora: annullata/assente → grigio, `examNextDay` →
  rosso (segnale di priorità mantenuto SOPRA il criterio), altrimenti criterio.
  Rimosso l'ambra "oltre le 6 obbligatorie" (`mandatoryLesson === false`) — non
  esiste nel criterio web.
- Se i settings non sono ancora arrivati → default `durata` + eccezioni di
  default (nessuna regressione, look storico dei bucket).

## Fuori scope

- **Vista allievo** (`AllievoHomeScreen`): mostra le guide dell'allievo stesso,
  non è l'agenda scuola → nessuna tinta criterio.
- **Editing su mobile**: dal pannello "Aspetto agenda" (`Altro → Aspetto agenda`),
  gestibile dallo **staff** dell'autoscuola — **titolari E istruttori** (non
  allievi). Usa un endpoint **scoped**: `PATCH /api/autoscuole/agenda-colors` →
  action `updateAgendaColorSettings` (gate `canManageAgendaColors` = admin |
  owner | instructor) che scrive **solo** i 3 campi `agendaColor*` — così
  allargare il permesso resta sicuro (nessun altro setting sensibile
  raggiungibile). Il web continua a usare `updateAutoscuolaSettings` (owner) sullo
  stesso JSON `limits` → dati coerenti; la **visibilità del pannello web** resta
  owner (follow-up se si vuole esporlo agli istruttori anche lì).

## Sync col web

Se cambiano hex/soglie/eccezioni o si aggiunge un criterio in
`reglo/lib/autoscuole/agenda-color-criterion.ts`, aggiornare in parallelo
`src/utils/agendaColors.ts` (palette duplicata client-side per scelta). **Non**
rimuovere `softenTint`: la resa mobile è volutamente più soft del web (richiesta
di design del titolare) — gli hex-sorgente restano allineati, diverge solo il
rendering.

## Veicolo nei blocchi (REG-633)

Setting dell'autoscuola `agendaShowVehicle` (spento di default; conta solo con
`vehiclesEnabled`), stesso JSON `limits` del web. Acceso, le guide mostrano il
**nome** del mezzo (mai la targa), troncato con ellissi; guida moto = «Moto +
moto extra + Auto al seguito», come la timeline giornaliera della home.

| File | Ruolo |
|------|------|
| `src/utils/agendaVehicle.ts` | `agendaVehicleLabel(appt)` (mirror di `reglo/lib/autoscuole/agenda-vehicle-label.ts`) + `showVehicleOnBlocks(settings)` |
| `src/components/DayItinerary.tsx` | Card guida: riga propria sotto nome e durata, allineata al nome, con icona auto/moto (`car-side`/`motorbike`; moto = patente moto dell'allievo, auto al seguito o moto extra). Accanto al badge di tipo non ci stava: il primo giro «1h · Fiat Pa…» era illeggibile |
| `src/components/WeeklyAgendaView.tsx` | Griglia: terza riga `lessonVehicle` sotto l'orario, solo nei blocchi alti ≥50pt (un'ora o più); nei blocchi bassi non c'è spazio in colonne da ~52pt |
| `src/screens/AppearanceSettingsScreen.tsx` | Sezione «VEICOLO» con `ToggleSwitch`, visibile solo col modulo veicoli; salva via `updateAgendaColorSettings({ agendaShowVehicle })` |

La timeline giornaliera della home (`itinCard`) mostrava già il veicolo sempre
e resta così. Allievo escluso. Esami (raggruppati) e guide di gruppo (card con
i posti) non mostrano il veicolo.

## Fondo pastello e ombra in tinta (REG-639 clay)

**Resa (dal 29/10/2026).** `agendaBlockStyle(entry, override)` restituisce
`backgroundColor` = il pastello (`softenTint` dell'override del titolare o
dell'hex di default) e, in più, `barColor` = il colore **vivo** della voce
(`vividHex`) e `washColor` = `mixWithWhite(barColor, 0.88)`.

`guideLook` con `AGENDA_BLOCK_BAR = false` (oggi) usa: fondo pieno
`backgroundColor`, nessuna barretta (`bar: null`), testo `#111111`, secondario
`rgba(17,17,17,0.58)`, e `glow` = il colore vivo al 38% per l'ombra morbida in
tinta (`tintShadow` nella griglia: y 4, blur 10, spread −3). Nessun bordo, salvo
quello delle guide automatiche (REG-622, `ring`).

**Priorità (in `guideLook`):**
1. `cancelled` / `no_show` → aspetto tenue (`MUTED_LOOK`: fondo `#F3F3F3`, testo
   grigio, ombra neutra leggera);
2. `examNextDay` → rosso `#C13515` pastello (80% bianco) con ombra rossa, più il
   bordo automatiche se serve;
3. eccezioni attive (`exam_ready`, `moto`) → poi criterio `durata`|`patente`
   (`resolveGuideBlockStyle`);
4. nessuno stile risolto → bianco con ombra neutra.

Esami, guide di gruppo e blocchi istruttore NON passano dal criterio: esami =
bianco con ombra neutra (niente più viola), gruppi = verde foglia pastello,
gruppi moto = ambra pastello (gli accenti delle icone 3D, §0.4), con ombra in
tinta; blocchi/pause = bianchi tratteggiati grigi.

**Interruttore `AGENDA_BLOCK_BAR`** (`src/utils/agendaColors.ts`, oggi
`false`): `true` → barretta piena a sinistra + tinta leggerissima (12%) su
fondo quasi bianco, la resa provata la notte del 28/10 e **bocciata da
Tiziano** il 29/10. Punto unico.

**Colori = «Aspetto agenda» (decisione di Tiziano, 29/10/2026).** I blocchi
usano esattamente il colore scelto dall'autoscuola, anche blu o azzurro. La
regola `NEUTRAL_BLUE` (blu/azzurri resi neutri solo sul mobile), provata la
notte del 28/10, è stata eliminata insieme alla nota in «Aspetto agenda».

