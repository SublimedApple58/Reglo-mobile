# REG-671 — Agenda istruttore: creare guida o blocco dal fantasma

**Fatto (30/10/2026, branch `feat/reg-671-agenda-crea`, NON rilasciato: serve l'ok di Tiziano).**
Implementato fedele alle anteprime approvate (`/tmp/hiro-anteprime/agenda-crea/`),
provato sul simulatore contro prod senza salvare nulla; catture finali in
`/tmp/hiro-anteprime/agenda-crea-finale/`. Dettagli: `docs/features/quick-book.md`.

## Piano prodotto (approvato)
- Tocco → fantasma subito nello slot (trascinabile, ridimensionabile, scivola dove si tocca).
- Card in basso con i 5 tipi in 3D: Guida, Di gruppo (se attiva), Esame, Teoria, Blocca.
- Guida: «Con chi guidi?» (ricerca, suggeriti, tutti) → riepilogo «Guida con <nome>».
- Blocca: «Blocca l'orario» (fascia, ripeti ogni settimana, motivo).
- Riuso di logica e API esistenti, nessun backend nuovo.

## Scelte di Tiziano
1. Card con i CINQUE tipi in 3D come nell'anteprima.
2. Il titolare puro PUÒ creare dall'agenda mobile (come il web): sceglie l'istruttore nei fogli.
3. La prenotazione multipla resta SOLO nel «+».

## Note di implementazione
- «Tutti» è una card sola fino a 20 allievi (come l'anteprima); oltre, card per lettera (FlatList).
- Con più istruttori sulla griglia il fantasma non si ferma sugli eventi altrui.
- Esame e Di gruppo riusano i loro fogli, seminati con orario e durata del fantasma.

## Da provare prima del rilascio
- Salvataggio vero (guida, blocco, teoria, esame, gruppo) su un'autoscuola di prova.
- Titolare puro (nessun account di prova sul simulatore).
- Android.
