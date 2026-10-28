# REG-639 — handoff (stato al 28/10/2026, sera)

Design system «clay leggero» + «vita» + testata unica + Pagamenti: **tutto in
produzione su iOS**. Le regole del design system stanno in
`docs/design-system.md` §0 (è la fonte di verità: leggila prima di toccare UI).

## Stato

- **master mobile = `d5c6fc8`** (pushato). Runtime **2.4.0**, solo **iOS**.
- **Android NON ha una build 2.4.0**: nessun OTA Android è stato pubblicato da
  REG-638 in poi. Gli OTA vanno pubblicati con `--platform ios` finché non esce
  la build Android 2.4.0.
- **Build store**: SOLO quando lo ordina Tiziano (locale, `eas build --local`,
  poi `eas submit --path`; checklist in `docs/git-flow.md`).

### OTA iOS production (runtime 2.4.0), dal più vecchio

| Giro | Commit master | Update group |
|---|---|---|
| REG-638 Road + via il blu | — | `c3ac50f3` |
| REG-639 passo 1 (clay su Road e istruttore) | `597796a` | `66d7d0d4` |
| Passo 2: foto copertina sede (web + mobile; migrazione `20261101120000_location_cover_photo` in prod) | `9d2cf59` | `f5cc6963` |
| Fluidità (ombre, pressione tonda, fogli che si chiudono col gesto) | `8f2f84a` | `e6ad8891` (il precedente `6cfa4a2c` aveva l'URL API vuoto) |
| Passo 3: «vita» su tutte le schermate | `f88438d` | `7f46b7fe` |
| Allievi: testata unica che collassa ovunque, Il mio gruppo, picker a spunta | `4b503b0` | `e773b290-f124-4e0a-ad63-e184b6d92c56` |
| Pagamenti + icone 3D trasparenti + segmentato nativo | `88c7b1a` | `6d38f144-8aa1-49de-b129-90c4ae29014f` (iOS update `01a18314-7b72-7fb3-8353-2fd50950be8f`) |
| Memorabile (vita dosata, salvadanaio, via obbligo dal dettaglio allievo e dal foglio guida) | `d5c6fc8` | `8433fb42-4e22-4502-ae8f-533c86929c64` (iOS update `01a18342-9c41-70e1-a25a-e5962f2075f4`) |
| Feedback «pagata» (casella che si riempie, riga che si chiude, foglio che si accorcia insieme con `useSheetAnticipate`; niente toast nei fogli, toast senza barretta verde) | `2ff82d1` | `3f2bbc47-0868-4a02-9694-ac25541902ab` (iOS update `01a1836c-1d30-7f15-af63-3f5a6efdf94c`) |
| **Giro Road** (note sulla guida in Road, «Avvia con Road» nel foglio della guida, tab bar B in vetro, tab Road senza salto, foto con skeleton/dissolvenza/cache, avatar non tagliato; web: copie avatar 512 px `e637386`) | **`c1c52e6`** | **`6725469b-83d4-43ce-ba73-b515934a68e3`** (iOS update `01a183c3-c1ec-77d7-81f2-fc01e0445786`) |

**Come si pubblica un OTA** (dal worktree che ha i `node_modules` giusti; la
copia principale `reglo-mobile` oggi NON ha `node_modules` aggiornati e
`eas update` lì fallisce su `expo-location` → prima `npm install`):

```
env -u EXPO_PUBLIC_API_URL -u CI eas update --branch production --platform ios --message "…"
```

Mai `EXPO_PUBLIC_API_URL=` vuoto (rompe l'API), mai `--auto`, mai `--platform all`.

## Branch e worktree vivi (`~/Developer/reglo/reglo-mobile-worktrees/`)

Tutti i branch REG-638/639 sono **già dentro master** (0 commit avanti).

| Worktree | Branch | Note |
|---|---|---|
| `reg-639-pagamenti` | `feat/reg-639-pagamenti` (= master `88c7b1a`) | **Metro 8081 gira da qui contro prod** (task della sessione chiusa: va riavviato dal nuovo terminale se serve) |
| `reg-639-allievi` | `feat/reg-639-allievi` (`4b503b0`) | da cancellare |
| `reg-639-vita` | `feat/reg-639-vita-tutto` (`f88438d`) | da cancellare |
| `reg-639` | `feat/reg-639-sede-foto` (`9d2cf59`) | da cancellare |
| `reg-638` | `feat/reg-638-reglo-road` (`b2dc947`) | **ATTENZIONE: gli altri worktree hanno `node_modules` = symlink a `../reg-638/node_modules`**. Cancellarlo per ultimo, dopo aver fatto `npm install` nella copia principale (o nel worktree che resta) |
| `reg-500` | `feature/reg-500-whatsapp-consent` | non è REG-639: non toccare |

Web: `~/Developer/reglo/reglo-worktrees/reg-639` (`feat/reg-639-sede-foto`,
`cd4e5ac`, già in main/staging) — da cancellare.

Altro da pulire (solo con l'ok di Tiziano): simulatore «Reglo Vita (Claude)»
(spento), anteprime in `/tmp/hiro-anteprime/` (`clay`, `vita`, `fluidita`,
`allievi`, `allievi-feedback`, `pagamenti`, `pagamenti-feedback`), branch locale
`feat/reg-639-clay-ds`.

## Giro «memorabile» (28/10 notte) — IN PRODUZIONE su iOS

Approvato da Tiziano. Branch `feat/reg-639-memorabile` (worktree
`reglo-mobile-worktrees/reg-639-memorabile`) → **master `d5c6fc8`** (pushato),
**OTA iOS production runtime 2.4.0, gruppo `8433fb42-4e22-4502-ae8f-533c86929c64`**
(iOS update `01a18342-9c41-70e1-a25a-e5962f2075f4`); bundle verificato su
`https://app.reglo.it/api`. Niente Android, niente build nativa. Piano e stato in
`plans/design-system/reg-639-memorabile.md`; tavole in `/tmp/hiro-anteprime/memorabile/`.
Metro 8081 gira da questo worktree contro prod.

**Metro da un worktree nuovo con `node_modules` linkati a `../reg-638`: la
prima volta va avviato con `--clear`** (`env -u EXPO_PUBLIC_API_URL npx expo
start --port 8081 --clear`), altrimenti l'app mostra «Welcome to Expo» (il
bundle non trova la cartella `app`). Copiare anche `.env.local` da un altro
worktree. Il simulatore si ricollega con `xcrun simctl terminate` + `launch`.

## Cosa resta

1. **App allievo, testata**: le schermate intere dello studente (Impostazioni,
   Notifiche dello studente, …) usano ancora `ClayPageHeader` (testata dentro
   lo scroll, non collassa). Vanno portate su `ClayLargeTitleScroll` come
   l'istruttore (§0.5). In `SettingsScreen` e `NotificationInboxScreen` il ramo
   studente è ancora quello vecchio.
2. **App allievo, «Le tue guide»** (`src/components/LessonsOverview.tsx`): tab a
   pillola che scorrono (`LedgerFilterBar`) e glifi tondi colorati
   (`StateGlyph`) di `src/components/ledger/LedgerUI.tsx`. Da rifare come
   Pagamenti: segmentato nativo (max 3 voci), mesi come `ClaySection`, righe in
   `ClayList`, un solo segnale di stato. Quando nessuno usa più
   `LedgerFilterBar`/`StateGlyph`, togliere anche quelli.
3. **Road, chip «Percorso»** (`RoadHistoryChip` in
   `src/components/road/RoadLessonCard.tsx`, usato anche in
   `StudentNotesDetailScreen`): è ancora a pillola.
4. **`HoldRing`** (`src/components/HoldRing.tsx`): non lo usa più nessuno (la
   pressione lunga di Pagamenti è diventata la casella): da cancellare.
5. **Pulizia worktree/branch/anteprime** (sopra), solo con l'ok di Tiziano.
6. **Build store** (iOS e la prima Android 2.4.0) solo su ordine di Tiziano.

## File chiave

| Cosa | File |
|---|---|
| Regole del design system | `docs/design-system.md` §0 (0.1 principi · 0.2 vita · 0.3 token · 0.4 volume · 0.5 testata · 0.6 fogli · 0.7 liste e scelte · 0.8 animazioni · 0.9 icone 3D · 0.10 componenti) |
| Token e ombre | `src/theme/clay.ts`, `src/theme/spacing.ts` |
| Componenti clay | `src/components/clay/` (index) |
| Testata che collassa | `src/components/ClayLargeTitle.tsx` |
| Fogli | `src/components/SheetScaffold.tsx` (`FormSheet`), `src/utils/sheetPresentation.ts` (`FORM_SHEET`) |
| Righe da Impostazioni | `src/components/SettingsRows.tsx` |
| Picker condiviso a spunta | `src/components/OptionsPickerSheet.tsx`, `src/stores/optionsPickerStore.ts` |
| Segmentato nativo / SwiftUI | `src/components/PaymentsFilter.tsx`, `src/components/SFSymbol.tsx` (`SWIFT_UI`) |
| Icone «vita» | `assets/vita/`, `src/theme/vitaArt.ts` |
| Icone Road / morale | `src/road/markerArt.ts`, `src/theme/moraleArt.ts` |
| Generare icone 3D | prompt in design-system §0.9, reference `docs/assets/icone-ref/`, scontorno `docs/assets/icone-3d/` (`mask.swift` + `scontorna.py`) |
| Pagamenti | `src/screens/StudentPaymentsScreen.tsx`, `src/components/PaymentHistorySheet.tsx`, doc `docs/features/lesson-payments.md` |
| Il mio gruppo | `src/screens/ClusterSettingsScreen.tsx`, `app/(tabs)/notes/booking-rules.tsx`, `limits.tsx`, `extras.tsx` |
| Piani dei giri | `plans/design-system/reg-639-*.md` |

## Regole di lavoro (ricordate da Tiziano)

- Prima l'anteprima (catture ritagliate in `/tmp/hiro-anteprime/<task>/` con
  riga `HIRO_SHOT`), poi l'ok, poi merge/push/OTA solo quando Tiziano lo dice.
- Simulatore su PROD con Metro e hot reload; dati di prod in sola lettura, mai
  notifiche/email/WhatsApp a persone vere.
- Un giro = un branch da `origin/master` + un worktree; prima del rilascio
  `git fetch` + merge di `origin/master` nel branch, typecheck
  (`npx tsc --noEmit -p .`; l'errore in `TabNavigator.tsx(27)` è vecchio),
  nessun file nativo toccato, poi fast-forward di master.
