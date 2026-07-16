# Pattern: chiusura tastiera (iOS "Fatto" + lente di ricerca)

**Problema.** Su iOS alcune tastiere non hanno modo di chiudersi da sole:
- **pad numerici** (`phone-pad`, `number-pad`, `decimal-pad`, `numeric`) → non hanno alcun tasto return;
- **campi multiline** → il return va a capo, non chiude.

L'utente resta bloccato con la tastiera aperta (spesso copre il campo).

**Regola.**

| Tipo campo | Soluzione | Come |
|---|---|---|
| Numerico | toolbar **"Fatto"** (accessorio iOS) | `useDoneAccessory()` |
| Multiline | toolbar **"Fatto"** | `useDoneAccessory()` |
| Ricerca | tasto **cerca/lente** | `returnKeyType="search"` |
| Testo singolo | tasto return nativo | `returnKeyType="done"` / `"next"` (già chiude da solo) |

## `useDoneAccessory()` — `src/components/KeyboardDoneAccessory.tsx`

Hook che restituisce `{ accessoryID, accessory }`. `useId` genera un `nativeID` unico per istanza (niente collisioni tra schermate montate insieme). iOS-only: su Android `accessoryID` è `undefined` e `accessory` è `null` (i pad numerici Android hanno il tasto back di sistema).

```tsx
const { accessoryID, accessory } = useDoneAccessory();
<TextInput ... keyboardType="phone-pad" inputAccessoryViewID={accessoryID} />
{accessory}   // renderizza una volta, in qualsiasi punto del tree della schermata
```

## Wrapper condivisi

- **`Input`** (`src/components/Input.tsx`): auto-collega l'accessorio quando `multiline` o `keyboardType` numerico. Ogni consumer `<Input>` lo eredita gratis — non serve fare nulla.
- **`AuthField`** (`src/components/AuthField.tsx`): inoltra i props al `TextInput`, quindi passare `inputAccessoryViewID={accessoryID}` + rendere `{accessory}` nella schermata (vedi `SignupScreen` per il campo telefono).

## Coverage attuale (2026-07-16)

- Numerici: PhoneGate, Signup (tel), InviteAccept (tel), PasswordReset (OTP), profile-edit ×2 (via `Input`).
- Multiline: manage-lesson-details (note), edit-notes, CreateExam (note), BlockForm (motivo).
- Ricerca (`returnKeyType="search"`): swap-lesson, select-student, select-exam-students, group-students, LocationPickerSheet, SearchableSelect, InlineLocationPicker, InlineLocationForm/location-form (indirizzo), QuizChapters, InstructorNotes, OwnerInstructor.
- Testo singolo (`done`/`next`): vehicle-form (nome/targa), location-form + InlineLocationForm (nome luogo).

**Nuovo campo con tastiera?** Applica la tabella sopra. Se usi `<Input>` è già automatico.
