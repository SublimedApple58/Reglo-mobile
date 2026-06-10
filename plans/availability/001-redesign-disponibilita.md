# Redesign sezione "Disponibilità" (istruttore)

> Stato: IMPLEMENTATO.

## Cosa è stato fatto
- `role.tsx` → cartella stack `role/` (`_layout`, `index`, `availability-exception` page-sheet, `time-picker`).
- `InstructorAvailabilityScreen` riscritto come shell: header large-title BlurView collassabile, badge modalità, skeleton d'immediatezza fino a risoluzione modalità, poi editor in `FadeIn`. Pull-to-refresh remonta l'editor via `editorKey`.
- Nuovo `DefaultAvailabilityEditor` ("Settimana tipo + Eccezioni") + `availabilityExceptionStore` + page-sheet `role/availability-exception` (una volta / ricorrente / assente, modifica+rimozione).
- `PublicationModeEditor` restyle: striscia giorni navy + barra selezione navy + puntino "oggi" rosa, `ToggleSwitch`, CTA navy, skeleton al cambio settimana, Fluent calendar.
- `RangesEditor` + `MiniCalendar` → navy (giallo/rosa rimossi).
- Doc aggiornati: `availability-editor.md`, `impact-map.md`, `INDEX.md`, `design-system.md` (6.11 / 6.13).
- `tsc` pulito (resta solo l'errore pre-esistente nel legacy `TabNavigator`).

---

## Obiettivo
Rivedere entrambe le modalità della sezione Disponibilità (Predefinita + Pubblicazione) con:
- **Immediatezza**: UI/shell subito, piccoli `SkeletonBlock` che svaniscono con `FadeIn(400)` all'arrivo dei dati. Niente più spinner/SkeletonCard a tutto schermo.
- **Blu navy `#1A1A2E`** come colore attivo/selezione e CTA; rosa solo micro-accento. Giallo eliminato (era nei `dayCircle`).
- **Fluent 3D** nelle intestazioni di sezione + empty state.
- `ToggleSwitch` custom al posto dello `Switch` nativo.

## Decisioni utente
- Lo switch di modalità NON è in-screen (si decide nelle Impostazioni, già ridisegnate).
- CTA tutte navy (anche Pubblica).
- Modalità Predefinita ripensata da zero → **"Settimana tipo + Eccezioni"**.

## Scoperta chiave
`InstructorManageScreen` e il vecchio `AvailabilityEditor` sono **legacy non montati** (l'app usa Expo Router; `TabNavigator` React-Navigation non è referenziato in `app/`). Il consumer live è solo `InstructorAvailabilityScreen` via `app/(tabs)/role.tsx`. Quindi la Predefinita si può ripensare senza rischi su allievo/veicolo.

## Architettura nuova (Predefinita)
- **Settimana tipo** (inline): toggle 7 giorni navy + fasce condivise (`RangesEditor`) + Salva navy → `createAvailabilitySlots`.
- **Eccezioni**: lista override (`getDailyAvailabilityOverrides`) + "Aggiungi eccezione" → formSheet che unifica:
  - *Una volta* (MiniCalendar) → `setDailyAvailabilityOverride(date, ranges|[])`
  - *Ricorrente* (giorno settimana + N settimane) → `setRecurringAvailabilityOverride(dayOfWeek, ranges|[], weeksAhead)`
  - Eccezione esistente tappabile → modifica/rimozione (`deleteDailyAvailabilityOverride`).

## Fasi / File
1. `src/components/RangesEditor.tsx` — orologio navy (no rosa).
2. `src/components/MiniCalendar.tsx` — selected/today/dot navy (no giallo/rosa).
3. `src/stores/availabilityExceptionStore.ts` — nuovo store reattivo.
4. `src/screens/DefaultAvailabilityEditor.tsx` — nuovo editor Predefinita.
5. `src/screens/PublicationModeEditor.tsx` — restyle navy + ToggleSwitch + skeleton-on-week-change + Fluent.
6. `src/screens/InstructorAvailabilityScreen.tsx` — shell large-title BlurView collassabile + immediatezza.
7. `app/(tabs)/role.tsx` → `app/(tabs)/role/` (stack): `_layout`, `index`, `availability-exception` (formSheet), `time-picker`.
8. tsc + doc (`docs/features/availability-editor.md`, `design-system.md`, `impact-map.md`).

Legacy `InstructorManageScreen` non toccato.
