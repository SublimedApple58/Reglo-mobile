# Tipo guida moto (birilli / strada)

Mostra sul mobile il tipo strutturato di una guida moto: **birilli** (prova in
area chiusa, coni) vs **strada**. Attributo del backend impostato in creazione
dal mobile e modificabile dal web. Guide **individuali**
(`AutoscuolaAppointment.motoLessonType`, REG-399) e **di gruppo moto**
(`AutoscuolaGroupLesson.motoLessonType`, REG-406). Web già in prod.

## Scope
- **Guide moto individuali** (REG-399): selettore in creazione (`BookingForm`),
  riga read-only in "Gestisci guida" (`manage-lesson`), chip nello storico.
- **Guide di GRUPPO moto** (REG-406, `kind="moto"`): stessa UX — **selettore in
  creazione** (`CreateGroupLessonScreen`, modalità Moto), **riga read-only in
  gestione** (`manage-group-lesson`), **badge in agenda** sulle card gruppo-moto.
  Il tipo è del **container** (condiviso da tutta la guida), non per-partecipante.
- Su mobile il tipo si sceglie SOLO in creazione (individuali e gruppi); l'edit
  del tipo su una guida esistente vive solo sul web.
- La riga/chip/badge compare **solo** quando il tipo è valorizzato.

## Data
- `AutoscuolaAppointment.motoLessonType?: 'birilli' | 'strada' | null` in
  `src/types/regloApi.ts` (ereditato da `AutoscuolaAppointmentWithRelations`).
- Il campo arriva già dal backend a entrambe le superfici:
  - **Gestisci guida**: via `getAgendaBootstrap` (bootstrap agenda, select con
    `motoLessonType`).
  - **Storico allievo**: via `getAppointments` ramo `full` (`include` → tutti i
    campi scalari).
  - ⚠️ Il ramo `light` di `getAutoscuolaAppointmentsFiltered` (usato dalla vista
    "Guide annullate" allievo, `LessonsOverview`) **non** include ancora il campo
    → follow-up opzionale (non serve in v1).

## Files
| File | Ruolo |
|------|-------|
| `src/utils/motoLessonType.ts` | `MotoLessonType`, `MOTO_LESSON_TYPE_LABELS` (Birilli/Strada), `MOTO_LESSON_TYPE_HINTS`, `MOTO_LESSON_TYPE_ICON` (MaterialCommunityIcons `traffic-cone`/`road-variant`), `asMotoLessonType`, `motoLessonTypeLabel`. Mirror del modulo web `lib/autoscuole/moto-lesson-type.ts`. |
| `app/(tabs)/home/manage-lesson.tsx` | Riga statica read-only "Tipo guida moto" (icona + label + hint) dopo il blocco Veicoli, resa solo se `lesson.motoLessonType` è valorizzato. Legge da `manageLessonStore.lesson`. |
| `src/screens/StudentNotesDetailScreen.tsx` | Chip birilli/strada (icona + label, tinta navy `#EEF0F6`/`#1A1A2E`) nella riga timeline dello storico, per le guide individuali (non esami/gruppi). |
| `src/types/regloApi.ts` | Campo `motoLessonType` su `AutoscuolaAppointment`. |

### Guide di gruppo moto (REG-406)
| File | Ruolo |
|------|-------|
| `src/screens/CreateGroupLessonScreen.tsx` | Selettore Row "Tipo guida moto" in modalità Moto (Row → `optionsPickerStore`, opzioni Non specificato/Birilli/Strada con hint) → `createGroupLesson({motoLessonType})`; reset al cambio kind. |
| `app/(tabs)/home/manage-group-lesson.tsx` | Riga read-only "Tipo guida moto" nel branch moto (dopo "Auto al seguito"), resa solo se `lesson.motoLessonType` valorizzato. |
| `src/utils/weeklyAgenda.ts` | `DayGroupLessonGroup.motoLessonType` (da `appt.groupLessonMotoType` via `asMotoLessonType`). |
| `src/components/DayItinerary.tsx` | Chip badge (icona + label) sulla card gruppo-moto (pill bianca, testo/icona `#C2410C`) quando `g.motoLessonType`. |
| `src/types/regloApi.ts` | `GroupLesson.motoLessonType`, `CreateGroupLessonInput.motoLessonType`, `AutoscuolaAppointment.groupLessonMotoType` (annotazione bootstrap agenda). |

## UI
- **Gestisci guida** (`manage-lesson`): riga come le altre (Istruttore/Luogo/
  Durata/Veicoli) — icona cono (birilli) o strada, label "Birilli"/"Strada",
  sottotitolo "Area chiusa · coni" / "Guida su strada". Sempre statica (read-only
  in v1, sia istruttore sia `ownerMode` titolare).
- **Storico** (`StudentNotesDetailScreen`): chip pill accanto/insieme ai chip
  attività, tinta navy per distinguerlo dai chip gruppo (teal/arancio) ed esame
  (viola).

- **Gruppo moto — creazione** (`CreateGroupLessonScreen`, modalità Moto): Row
  "Tipo guida moto" (icona `flag-outline`, valore label o placeholder "Non
  specificato") → picker Birilli/Strada, come la Row della guida moto singola in
  `BookingForm`.
- **Gruppo moto — gestione** (`manage-group-lesson`): riga read-only come
  `manage-lesson` (icona cono/strada + label), solo se il tipo è impostato.
- **Gruppo moto — agenda** (`DayItinerary`): chip pill bianca (icona + Birilli/
  Strada, testo `#C2410C`) sulla card gruppo-moto arancio.
  - ⚠️ **Pending (dopo OK design)**: replicare lo stesso chip su
    `IstruttoreHomeScreen` (hour-grid) e `WeeklyAgendaView` (settimanale) per
    piena copertura agenda.

## Connected features
- [instructor-manage.md](instructor-manage.md) — la riga vive nello sheet
  "Gestisci guida" (`manageLessonStore.lesson`).
- [notes.md](notes.md) — il chip vive nello storico allievo (`StudentNotesDetailScreen`).
- [group-lessons.md](group-lessons.md) — il tipo sulle guide di gruppo moto
  (creazione/gestione/agenda) vive nelle schermate gruppo (REG-406).
- Backend / web: `../../reglo/docs/features/moto-lesson-type.md` (fonte del campo).
