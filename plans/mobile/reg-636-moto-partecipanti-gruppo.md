# REG-636 — Moto per partecipante nei gruppi moto (mobile)

Piano completo, decisioni e riepilogo: `reglo/plans/autoscuole/reg-636-moto-partecipanti-gruppo.md`.

Parte mobile: chip moto nel roster `manage-group-lesson-participants` → picker `select-options` (solo moto compatibili + «A rotazione») → `Alert` nativo per lo scambio; titolare in modalità titolare apre il roster con `motoOnly`. Regole in `src/utils/groupMoto.ts` (mirror del backend). Doc: `docs/features/group-lessons.md`.
