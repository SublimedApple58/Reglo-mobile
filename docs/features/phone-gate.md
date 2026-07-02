# Phone Gate (allievo senza numero di cellulare)

Gate **bloccante** per gli allievi il cui account non ha un numero di
cellulare (`user.phone` vuoto/null): la registrazione lo chiede obbligatorio
da tempo, questo intercetta gli account più vecchi. Finché il numero non viene
salvato l'allievo non può usare NULLA dell'app.

## Files

| File | Ruolo |
|------|-------|
| `src/screens/PhoneGateScreen.tsx` | La schermata (Airbnb 3D style: icona gradient navy con ombra colorata, card input in rilievo, CTA gradient con freccia, link "Esci") |
| `app/(tabs)/_layout.tsx` | Mount point: early-return `<PhoneGateScreen />` al posto dell'intero albero Tabs quando `status === 'ready' && isStudent && !user.phone` |

## Comportamento

- **Blocco totale**: il gate sostituisce `<Tabs>` + `NotificationOverlay` — non
  esistono route raggiungibili, niente back/close. Uniche uscite: salvare il
  numero o "Esci" (logout, con Alert di conferma).
- **Solo allievi** (`isStudentRole`); istruttori/titolari non sono mai bloccati.
- **Input**: prefisso fisso 🇮🇹 +39 + tastiera phone-pad. Normalizzazione: si
  scarta un prefisso esplicito `+39`/`0039` digitato, poi solo cifre; MAI
  strippare un "39" nudo iniziale (i 393… sono numeri reali). Valido con 8–11
  cifre; CTA disabilitata altrimenti, spinner durante il salvataggio.
- **Salvataggio**: `regloApi.updateProfile({ name, phone: "+39 <cifre>" })` →
  `PATCH /api/mobile/profile` (il `name` è obbligatorio min(3) lato BE, si
  rimanda quello corrente invariato, fallback email) → `refreshMe()` →
  `user.phone` popolato → il gate scompare da solo al re-render del layout.

## Connessioni

- **SessionContext**: legge `user`/`status`, usa `refreshMe` + `signOut`.
- **Backend**: `reglo/app/api/mobile/profile/route.ts` (già esistente, nessuna
  modifica BE necessaria).
- **Design**: preview approvata in iterazione (Airbnb-style 3D, mono-navy).
