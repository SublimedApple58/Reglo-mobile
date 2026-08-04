# Foto profilo + Firma allievo

**Stato:** implementato su branch `feature/foto-firma-allievo` (2026-08-04). Backend: `reglo/docs/features/student-photo-signature.md`.

⚠️ **Richiede build nativa**: `expo-image-picker` è un modulo nativo NON presente nel binario runtime 2.1.0 → niente OTA per questa feature; serve dev build (o nuova build store con bump runtime).

## Cosa fa

- **Foto profilo**: da `profile-edit`, riga "Foto profilo" → Alert con "Scatta una foto" / "Scegli dalla libreria" (`expo-image-picker`, `allowsEditing: false`, `quality: 1` — l'originale parte com'è, nessun adattamento). Upload multipart → `POST /api/mobile/profile/photo`. La foto diventa l'avatar (SettingsScreen mostra la foto al posto delle iniziali).
- **Firma**: da `profile-edit`, riga "Firma" → route fullscreen `settings/signature` (`PAGE_SHEET`): pad touch con canvas a striscia larga (aspect 2.1), disegno via `PanResponder` + `react-native-svg`, Cancella/Conferma. Alla conferma invia i **tratti vettoriali** (`strokes` + dimensioni canvas + strokeWidth) a `POST /api/mobile/profile/signature`; il server rasterizza in PNG. Spinner → await → `refreshMe()` (niente optimistic).

## File

| File | Ruolo |
|------|-------|
| `src/components/ProfilePhotoEditor.tsx` | Avatar grande + pill "Modifica" con picker/upload/refresh (condiviso allievo + istruttore/titolare) |
| `app/(tabs)/settings/profile-edit.tsx` | Profile-edit allievo: `ProfilePhotoEditor` + riga "Firma" (link al pad) |
| `app/(tabs)/more/profile-edit.tsx` | Profile-edit istruttore/titolare: `ProfilePhotoEditor` (niente firma) |
| `app/(tabs)/settings/signature.tsx` | Pad firma fullscreen (PanResponder + Svg Path) |
| `app/(tabs)/settings/_layout.tsx` | Registra `signature` con `PAGE_SHEET` |
| `src/screens/SettingsScreen.tsx` | Avatar profile card: foto se `user.photoUrl`, altrimenti iniziali |
| `src/services/apiClient.ts` | Supporto `FormData` (multipart: niente Content-Type manuale, no JSON.stringify) |
| `src/services/regloApi.ts` | `uploadProfilePhoto`, `uploadSignature` |
| `src/types/regloApi.ts` | `UserPublic.photoUrl/signatureUrl` (solo da `/me`), `UploadMediaPayload`, `SignaturePoint/Stroke`, `UploadSignatureInput` |
| `app.json` | Plugin `expo-image-picker` con permessi IT (photos + camera) |

## Foto negli avatar OVUNQUE (estensione 2026-08-04)

- `src/services/userPhotos.ts` — cache + batching (60ms) su `GET /api/autoscuole/user-photos`; hook `useUserPhotoUrl`/`useInstructorPhotoUrl` + `invalidateUserPhoto`.
- `src/components/UserPhotoCircle.tsx` — wrapper: foto se presente, children (iniziali) altrimenti.
- Siti patchati: DayItinerary, WeeklyLiveCard, IstruttoreHomeScreen, exam-manage, CreateExamScreen, CreateGroupLessonScreen, manage-group-lesson-participants, InstructorNotesScreen, notes/group-students, StudentNotesDetailScreen, swap-lesson/swap-detail/SwapOffersScreen, OwnerInstructorScreen (via `instructor.userId`), MoreScreen (self, da `user.photoUrl`).
- Picker inclusi: `select-student` e `select-exam-students` (il `value` delle opzioni È lo userId), `OptionsPickerSheet` (nuovo campo opzionale `leadingUserId` su `OptionItem`, seedato da "Aggiungi allievo"), avatar allievo selezionato in `BookingForm`.

## Connessioni

- **Settings** (`features/settings.md`): la profile card e `profile-edit` sono di quella feature; qui si aggiungono le due righe media.
- **Session** (`src/context/SessionContext.tsx`): `refreshMe()` dopo ogni upload aggiorna `user.photoUrl/signatureUrl` ovunque.
- Il web scarica gli asset in variante originale/portale: vedi doc backend.

## Note

- Su simulatore la fotocamera non funziona: usare "Scegli dalla libreria".
- Il canvas firma è volutamente una striscia orizzontale: il portale la vuole 30×6mm.
