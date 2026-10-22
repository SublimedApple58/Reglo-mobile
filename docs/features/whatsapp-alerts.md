# Avvisi su WhatsApp — consenso dell'utente (REG-500)

Reglo manda promemoria e cambi di programma anche su WhatsApp, dal numero di
Reglo, a chi **non** riceve la push (cascata App → WhatsApp → Email, decisa
lato backend in `reglo/lib/autoscuole/channel-cascade.ts`). Sul mobile c'è solo
la parte di consenso.

## File

| File | Cosa fa |
|------|---------|
| `src/components/WhatsAppAlertsRow.tsx` | Riga «Avvisi su WhatsApp» con interruttore. Legge e scrive `/api/mobile/me/whatsapp`. Niente aggiornamento ottimistico: spinner → risposta → rilettura. |
| `app/(tabs)/settings/profile-edit.tsx` | Profilo allievo: la riga sta sotto il cellulare. |
| `app/(tabs)/more/profile-edit.tsx` | Profilo istruttore/titolare: stessa riga. |
| `src/screens/SignupScreen.tsx` | Frase di consenso sotto il modulo; manda `whatsappConsent: true` alla registrazione. |
| `src/services/regloApi.ts` | `getWhatsAppPreference`, `setWhatsAppPreference`. |
| `src/types/regloApi.ts` | `WhatsAppPreference`, `StudentRegisterInput.whatsappConsent`. |

## Regole

- Spegnere = revoca (`User.whatsappOptOutAt`), lo stesso effetto di rispondere
  STOP al numero di Reglo. Riaccendere registra il consenso
  (`whatsappConsentSource: app_profilo`).
- Gli utenti già registrati prima del 22/10 hanno consenso implicito: ogni
  messaggio WhatsApp porta «Rispondi STOP per non ricevere più questi avvisi».
- Solo JS: si rilascia via OTA, nessun modulo nativo.
