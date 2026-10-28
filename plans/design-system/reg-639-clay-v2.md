# REG-639 — Design system Clay v2 (mobile)

## Cosa è stato fatto (28/10/2026)

Branch `feat/reg-639-clay-ds` sopra `feat/reg-638-reglo-road`, worktree
`reglo-mobile-worktrees/reg-639`. Sette commit locali, uno per passo, niente
OTA. Solo mobile: il web (nota §10 compresa) si fa dopo.

1. Token `src/theme/clay.ts` (`CLAY`, `CLAY_SHADOW` con `boxShadow` esterno + interno),
   `CLAY_RADIUS`/`FIELD_HEIGHT` in `spacing.ts`, registro `ICONS_3D` (poi eliminato: icone AI, vedi `reg-639-icone-3d.md`) + `<Icon3D>`,
   design-system §0.
2. Componenti `src/components/clay/` (riusando `RoadPressable` → `ClayPressable`,
   `RoadAvatar` → `Avatar` su `UserPhotoCircle`); X di tutti i fogli = cerchio bianco clay.
3. Tab bar clay (icone 3D, bolla in rilievo) + tab Road.
4. «Con chi guidi?» / «Parti con».
5. Guida in corso (testata, controlli mappa, pannello, banner).
6. Riepilogo, «Cosa è successo?», Pagellino da Road.
7. Percorso, informativa, invito, mappa del percorso; docs.

Verifica: typecheck (`tsc --noEmit`, unico errore preesistente in
`TabNavigator.tsx`) e variabili non usate sui file toccati. A schermo: da fare
sul simulatore quando Tiziano lo libera.

## Piano approvato

- **Token**: bianco puro e nero; ombre `raise`/`raiseSm`/`sink`/`ink`/`inkPressed`/`avatar`;
  raggi card 28, tessera 22, foglio 38, campi 46 a capsula; CTA 54/27.
- **Componenti**: CTA, bottone icona, card, riga di lista, ricerca, segmentato,
  avatar, tab bar, form sheet (già unico), controlli mappa, statistiche.
- **Ombre interne**: `boxShadow` nativo RN 0.81 (New Architecture), `inset: true`,
  max 3 livelli, ombra sul contenitore delle liste, mai animata.
- **Docs**: design-system §0 (vince sul resto).
- **Ordine**: Road prima, poi il resto dell'app.

## Decisioni di Tiziano (28/10)

- La X diventa il cerchio bianco in rilievo in tutti i fogli.
- Le icone 3D blu (rotatoria, parcheggio) restano.
- La tab bar cambia subito, con Road. **Poi bocciata (28/10, dopo la prova sul
  simulatore: «sembra la versione finta di quella nativa Apple»): torna la «T1
  piatta» di REG-638, la tab bar NON è clay.**
- Il resto dell'app andrà tutto in clay (prossimo giro).
