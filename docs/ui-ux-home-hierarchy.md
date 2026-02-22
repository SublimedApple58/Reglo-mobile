# Reglo Mobile — Home UI/UX Hierarchy (Allievo + Istruttore)

## Obiettivo
Definire una gerarchia visiva unica a 3 livelli per le home `Allievo` e `Istruttore`, così da rendere subito chiaro:
- cosa è prioritario adesso;
- cosa è operativamente importante nel periodo selezionato;
- cosa è di supporto/configurazione.

## Livelli Gerarchici

### Livello 1 — Focus Immediato
Uso: elementi time-critical e azioni principali “adesso”.

Specifiche tecniche:
- `GlassCard` con `hierarchy="primary"`
- `title`: `30/34`, `700`, letter spacing negativa
- `subtitle`: `16/22`, `600`
- contenuto chiave (data/ora guida): `24/30`, `700`
- ombra card: più profonda (`shadowRadius` ~18, `elevation` alta)
- CTA: bottone full-width, tono `primary`/`danger` in base all’azione

### Livello 2 — Operativo
Uso: contenuto operativo principale del range corrente (agenda, prenotazioni).

Specifiche tecniche:
- `GlassCard` con `hierarchy="secondary"`
- `title`: `22/27`, `700`
- `subtitle`: `14/19`, `500`
- righe lista: card interne con bordo + ombra media
- CTA: full-width dove rilevante; tono `standard` o `primary` secondo il task

### Livello 3 — Supporto e Contesto
Uso: navigazione periodo, disponibilità, blocchi di setup.

Specifiche tecniche:
- `GlassCard` con `hierarchy="tertiary"`
- `title`: `18/23`, `600`
- `subtitle`: stile caption (`12` circa), contrasto più morbido
- ombra leggera (`shadowRadius` ~8, `elevation` bassa)
- CTA: minima prominenza (`standard`) salvo eccezioni funzionali

## Mappatura Sezioni — Home Allievo

Livello 1:
- `Prossima guida`

Livello 2:
- `Prenota una guida`

Livello 3:
- `Calendario guide`
- `Agenda guide`
- `Disponibilità` (spostata in `Impostazioni` per ridurre rumore nella home)

Note operative:
- “Prossima guida” usa tipografia più grande per data/ora e CTA full-width.
- “Agenda guide” mantiene badge di stato e CTA dettagli come elemento operativo.
- “Calendario guide” resta di contesto in home.
- “Disponibilità” è gestita da `Impostazioni` per tenere la home focalizzata su prenotazione + agenda.

## Mappatura Sezioni — Home Istruttore

Livello 1:
- `Prossima guida`

Livello 2:
- `Nuova prenotazione`
- `Agenda guide`

Livello 3:
- `Calendario`

Note operative:
- il blocco “Prossima guida” mostra stato e dettagli con contrasto massimo.
- “Nuova prenotazione” e “Agenda guide” restano al centro del flusso operativo.
- il calendario agisce da controllo di contesto, non da focus principale.

## Pattern di Bottoni

- Livello 1:
  - azioni critiche: `primary` e `danger`, full-width
- Livello 2:
  - azioni operative: `primary` o `standard`, full-width nelle card azione
- Livello 3:
  - azioni di supporto: prevalentemente `standard`

## File Coinvolti

- `/Users/tizianodifelice/reglo-mobile/src/components/GlassCard.tsx`
- `/Users/tizianodifelice/reglo-mobile/src/components/SectionHeader.tsx`
- `/Users/tizianodifelice/reglo-mobile/src/screens/AllievoHomeScreen.tsx`
- `/Users/tizianodifelice/reglo-mobile/src/screens/IstruttoreHomeScreen.tsx`
