# Colori blocchi agenda (criterio Aspetto)

Le card delle **guide individuali normali** nell'agenda istruttore/titolare
prendono il colore dal criterio company (`durata` default | `patente`), con
colori personalizzati per voce (override) ed eccezioni pre-costruite. Il criterio
si imposta dal pannello **Aspetto** — sul web **e ora anche da mobile** (owner:
`Altro → Aspetto agenda`), condividendo la stessa action. È la replica mobile di
`reglo/docs/features/appearance-settings.md`. Esami, guide di gruppo,
blocchi istruttore e stati **annullata/assente** restano col loro colore.

> **REG-639 clay (notte 28/10/2026) — come si disegna oggi.** Il colore non è
> più il fondo pastello del blocco: è una **barretta piena a sinistra** + una
> **tinta leggerissima** dello stesso colore come fondo (12% di colore), testo
> sempre nero. Un solo punto per vista Giorno e vista Settimana:
> `src/utils/agendaLook.ts` (`guideLook`). Sul mobile i colori **blu/azzurri**
> diventano neutri (`NEUTRAL_BLUE`). Dettagli nella sezione «Barretta + tinta»
> in fondo. `DayItinerary` e la timeline `itinCard` citate sotto non esistono
> più (REG-638): le superfici sono `AgendaDayView` e `WeeklyAgendaView`.

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
| `src/utils/agendaLook.ts` | **REG-639**: `guideLook(appt, config)` → `{ bar, wash, text, sub, ring, muted }`, unico punto dell'aspetto di una guida per le due viste; `EXAM_LOOK` (barretta nera su bianco), `GROUP_LOOK` (verde foglia `#2FA36B`), `GROUP_MOTO_LOOK` (ambra `#F5A524`); `blockLabel` («Pausa» per `lesson_buffer`) |
| `src/components/agenda/AgendaDayView.tsx` | **Vista Giorno** (REG-639): card guida = `EventCard` con barretta `look.bar` e fondo `look.wash`; config via `useAutoscuolaSettings` |
| `src/components/WeeklyAgendaView.tsx` | **Vista Settimana** (griglia oraria, la più simile al web): `getLessonLook` ora è un adattatore di `guideLook` (fondo = `wash`, barretta `eventBar` 3pt a sinistra). Config via `useAutoscuolaSettings` in `WeekPage` |
| ~~`DayItinerary.tsx`~~ / ~~timeline `itinCard` di `IstruttoreHomeScreen`~~ | Eliminati con REG-638 (28/10): storico |
| `src/screens/AppearanceSettingsScreen.tsx` + `app/(tabs)/more/appearance.tsx` | **Pannello "Aspetto agenda"** (staff, scrittura): design editoriale/flat (no card-in-card) — criterio come **segmented control**, liste piatte con divisori inset, **pallini colore VIVI** (`vividHex`, non la tinta soft del blocco), eccezioni con **`ToggleSwitch`** custom (no Switch RN) + badge conteggio attive. Testo minimo (niente caption/descrizioni). Auto-save via `regloApi.updateAgendaColorSettings` + `setQueryData` + `ToastNotice`/rollback |
| `src/stores/colorPickerStore.ts` + `app/(tabs)/more/color-picker.tsx` | Swatch picker formSheet (palette curata `AGENDA_SWATCHES` = 16 swatch del web) + "Colore standard" (reset override), seed-and-callback |
| `src/screens/MoreScreen.tsx` | Voce **"Aspetto agenda"** in `Altro` → gate `isInstructor \|\| isOwner` (staff) |
| `src/services/regloApi.ts` | `updateAgendaColorSettings(input)` → `PATCH /api/autoscuole/agenda-colors` (solo i 3 campi `agendaColor*`) |
| `reglo/lib/actions/autoscuole-settings.actions.ts` + `reglo/app/api/autoscuole/agenda-colors/route.ts` | **Backend scoped** `updateAgendaColorSettings` + route `PATCH`: staff-gated (`canManageAgendaColors`), valida/normalizza i 3 campi, scrive `limits`, invalida cache Redis (AGENDA+SETTINGS), ritorna i settings risolti |

**Due superfici agenda coperte** (tutte e due anche in `ownerMode`, `TitolareHome` = wrapper): vista Giorno (`AgendaDayView`) e vista Settimana (`WeeklyAgendaView`), entrambe via `agendaLook.guideLook`. (Fino al 28/10 erano tre: timeline `itinCard`, `DayItinerary`, griglia.)

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

## Barretta + tinta e `NEUTRAL_BLUE` (REG-639 clay, notte 28/10/2026)

**Resa.** `agendaBlockStyle(entry, override)` restituisce, oltre al vecchio
`backgroundColor` pastello (`softenTint`, usato ancora dai pallini/anteprime
del pannello Aspetto via `previewColor`), due campi nuovi:
- `barColor` = il colore **vivo** della voce (`vividHex`: override del
  titolare, altrimenti la hue satura dietro l'hex di default);
- `washColor` = `mixWithWhite(barColor, 0.88)` → 12% di colore sul bianco.

`guideLook` li usa così: barretta piena `bar` a sinistra, fondo `wash`, testo
nero `#111111`, secondario `rgba(17,17,17,0.58)`. Il bordo delle guide
automatiche (REG-622) resta (`ring`).

**Priorità (in `guideLook`, invariata nella sostanza):**
1. `cancelled` / `no_show` → aspetto tenue (`MUTED_LOOK`: barretta `#CFCFCF`,
   fondo bianco, testo grigio);
2. `examNextDay` → rosso `#C13515` (barretta) + tinta rossa al 10%, con il
   bordo automatiche se serve;
3. eccezioni attive (`exam_ready`, `moto`) → poi criterio `durata`|`patente`
   (`resolveGuideBlockStyle`);
4. nessuno stile risolto → barretta nera su bianco.

Esami, guide di gruppo e blocchi istruttore NON passano dal criterio: esami
= barretta nera su bianco (niente più viola), gruppi = verde foglia, gruppi
moto = ambra (gli stessi accenti delle icone 3D, §0.4), blocchi/pause = righe
quiete grigie (Giorno) o blocchi bianchi tratteggiati grigi (Settimana).

**Interruttore `AGENDA_BLOCK_BAR`** (`src/utils/agendaColors.ts`, `true`):
`false` → `guideLook` torna al fondo pastello pieno (`backgroundColor`) senza
barretta. Punto unico.

**`NEUTRAL_BLUE`** (`src/utils/agendaColors.ts`, `true`) — **decisione della
notte, da confermare con Tiziano**: sul mobile niente blu/azzurro in agenda.
Se il colore vivo della voce (default o scelto dall'autoscuola) ha tinta fra
180° e 245° (saturazione ≥ 0.35) (`isBlueHue`: dall'azzurro/ciano al blu, escluso il viola; i grigi
con saturazione < 12% non contano), il blocco diventa **neutro**: barretta nera
`#111111` + scheda bianca senza tinta. Colpisce di default (verificato sugli
hex vivi, 28/10): il bucket `d30` («Fino a 30 minuti», 217°), le patenti B
(217°) e BE (239°), **ADR e «Patente non impostata»** (grigio-ardesia 215°,
saturazione sopra la soglia), e gli swatch Azzurro, Ciano, Blu, Indaco,
**Grigio** scelti dal titolare.

Soglia corretta la notte stessa (180°–245°, saturazione ≥ 0.35): il viola (`#8B5CF6`, 258°), i grigi e i grigio-ardesia (ADR, «Patente non impostata», «Grigio») restano col loro colore; l'indaco (`#6366F1`, 239°) conta come blu.

