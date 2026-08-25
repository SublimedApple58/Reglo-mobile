# Colori blocchi agenda (criterio Aspetto)

Le card delle **guide individuali normali** nell'agenda istruttore/titolare
prendono il colore dal criterio company (`durata` default | `patente`), con
colori personalizzati per voce (override) ed eccezioni pre-costruite. Il criterio
si imposta dal pannello **Aspetto** — sul web **e ora anche da mobile** (owner:
`Altro → Aspetto agenda`), condividendo la stessa action. È la replica mobile di
`reglo/docs/features/appearance-settings.md`. Esami, guide di gruppo,
blocchi istruttore e stati **annullata/assente** restano col loro colore.

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
| `src/utils/agendaColors.ts` | Porta 1:1 di `reglo/lib/autoscuole/agenda-color-criterion.ts`: entries durata/patente (stessi hex/soglie), eccezioni (`automatic`/`exam_ready`/`moto`), normalizzatori, `resolveAgendaColorConfig(settings)`, `resolveGuideBlockStyle(ctx, config)` (output stile RN: `{ backgroundColor, shadowColor }`) |
| `src/components/DayItinerary.tsx` | Day-detail + espansione inline in `WeeklyOverview`: legge la config via `useAutoscuolaSettings`, tinge la card guida (`styles.card`) |
| `src/screens/IstruttoreHomeScreen.tsx` | Timeline giornaliera (`itinCard`): stessa tinta sulle guide normali via `agendaColorConfig` (memo su `settings`) |
| `src/components/WeeklyAgendaView.tsx` | Griglia oraria (vista `grid`, la più simile al web): `getLessonLook(appt, config)` colora i blocchi guida col criterio (pastello soft + testo scuro). Priorità mantenute: annullata/assente → grigio, esame-il-giorno-dopo (`examNextDay`) → rosso, poi criterio. Config via `useAutoscuolaSettings` in `WeekPage` |
| `src/screens/AppearanceSettingsScreen.tsx` + `app/(tabs)/more/appearance.tsx` | **Pannello "Aspetto agenda"** (staff, scrittura): scelta criterio (radio + chip anteprima con `flex:1`, no overflow), colori per voce, toggle/colore eccezioni (badge conteggio attive). Auto-save via `regloApi.updateAgendaColorSettings` + `setQueryData` sulla cache `useAutoscuolaSettings` + `ToastNotice`/rollback su errore |
| `src/stores/colorPickerStore.ts` + `app/(tabs)/more/color-picker.tsx` | Swatch picker formSheet (palette curata `AGENDA_SWATCHES` = 16 swatch del web) + "Colore standard" (reset override), seed-and-callback |
| `src/screens/MoreScreen.tsx` | Voce **"Aspetto agenda"** in `Altro` → gate `isInstructor \|\| isOwner` (staff) |
| `src/services/regloApi.ts` | `updateAgendaColorSettings(input)` → `PATCH /api/autoscuole/agenda-colors` (solo i 3 campi `agendaColor*`) |
| `reglo/lib/actions/autoscuole-settings.actions.ts` + `reglo/app/api/autoscuole/agenda-colors/route.ts` | **Backend scoped** `updateAgendaColorSettings` + route `PATCH`: staff-gated (`canManageAgendaColors`), valida/normalizza i 3 campi, scrive `limits`, invalida cache Redis (AGENDA+SETTINGS), ritorna i settings risolti |

**Tre superfici agenda coperte** (tutte anche in `ownerMode`, `TitolareHome` = wrapper): timeline giornaliera (`itinCard`), day-detail/settimana (`DayItinerary`), griglia oraria (`WeeklyAgendaView`).

## Comportamento

- **Criterio `durata`**: bucket per minuti (≤30, ≤45, ≤60, ≤90, >90) — stesse
  soglie/hex del web.
- **Criterio `patente`**: colore per patente della guida risolta
  dall'allievo (`licenseTagForStudent`: categoria + suffisso " autom." se
  `transmission === 'automatic'`). Il suffisso automatico vince → ciano dedicato.
- **Eccezioni** (vincono sul criterio, prima che matcha, ordine registry; solo
  se attive e pertinenti al criterio):
  - `automatic` (ON default, solo criterio durata): guida a cambio automatico →
    ciano. Match: `vehicle.transmission` o `student.transmission === 'automatic'`.
  - `exam_ready` (OFF, entrambi i criteri): `student.examReady` → viola.
  - `moto` (OFF, entrambi): `isMotoLicenseCategory(student.licenseCategory)` →
    arancio.
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
