# Tipo guida moto (birilli / strada) — sola lettura

Mostra sul mobile il tipo strutturato di una guida moto individuale: **birilli**
(prova in area chiusa, coni) vs **strada**. È un attributo del backend
(`AutoscuolaAppointment.motoLessonType`, REG-399) impostato dal web; il mobile in
v1 lo **mostra soltanto** (nessuna scrittura). Web già in prod.

## Scope
- **Sola lettura (v1)**: nessun controllo mobile imposta/modifica il tipo.
- Solo **guide moto individuali**. Le guide di gruppo moto non hanno il campo.
- La riga/chip compare **solo** quando `motoLessonType` è valorizzato (il BE lo
  setta solo per le guide moto).

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

## UI
- **Gestisci guida** (`manage-lesson`): riga come le altre (Istruttore/Luogo/
  Durata/Veicoli) — icona cono (birilli) o strada, label "Birilli"/"Strada",
  sottotitolo "Area chiusa · coni" / "Guida su strada". Sempre statica (read-only
  in v1, sia istruttore sia `ownerMode` titolare).
- **Storico** (`StudentNotesDetailScreen`): chip pill accanto/insieme ai chip
  attività, tinta navy per distinguerlo dai chip gruppo (teal/arancio) ed esame
  (viola).

## Connected features
- [instructor-manage.md](instructor-manage.md) — la riga vive nello sheet
  "Gestisci guida" (`manageLessonStore.lesson`).
- [notes.md](notes.md) — il chip vive nello storico allievo (`StudentNotesDetailScreen`).
- Backend / web: `../../reglo/docs/features/moto-lesson-type.md` (fonte del campo).
