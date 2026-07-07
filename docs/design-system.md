# Reglo Mobile — Design System Reference

> Fonte di verita per ogni lavoro UI nell'app.
> Leggi questo documento **prima** di scrivere qualsiasi codice UI.

---

## 1. Palette Colori

### 1.1 Token Semantici

Definiti in `src/theme/colors.ts` → oggetto `colors`:

| Token | Hex | Uso |
|---|---|---|
| `colors.primary` | `#1A1A2E` | CTA principali, bottoni primari, tint tab bar, focus input, dot calendario, ombra CTA |
| `colors.accent` | `#FACC15` | Card "prossima guida", day pill selezionato, chip attivi, border today calendario |
| `colors.destructive` | `#EF4444` | Errori, annullamenti, azioni distruttive, toast danger |
| `colors.positive` | `#22C55E` | Successo, conferme, stati completati, toast success, icona celebrazione |
| `colors.textPrimary` | `#1F2937` | Testo principale, titoli, Card dark bg |
| `colors.textSecondary` | `#6B7280` | Testo secondario, descrizioni, frecce navigazione |
| `colors.textMuted` | `#9CA3AF` | Placeholder, label terziarie, weekday calendar headers |
| `colors.border` | `#E5E7EB` | Bordi card, separatori, bordi pulsanti freccia |
| `colors.surface` | `#FFFFFF` | Sfondo card |
| `colors.background` | `#FDFDFD` | Sfondo pagina + tab bar (off-white che sfiora il bianco, mai bianco puro). Tab bar (`GlassTabBar`) e fallback Android degli header blur (`rgba(253,253,253,…)`) usano lo stesso valore. |
| `colors.shadow` | `rgba(0, 0, 0, 0.08)` | Ombra base generica |

### 1.2 Regola d'oro: **70 / 20 / 10**

- **70% neutri** — bianco, grigi, testo scuro
- **20% navy** — CTA, accenti interattivi, focus state
- **10% giallo** — highlight informativi, prossima guida, selezioni temporali

### 1.3 Scale Colori

Accesso diretto via `colors.navy[shade]` e `colors.yellow[shade]`:

**Navy (mono)**
| Shade | Hex | Uso principale |
|---|---|---|
| `50` | `#F4F5F9` | Badge default bg, clock circle bg (RangesEditor), ring celebrazione |
| `100` | `#E9EBF2` | — |
| `200` | `#D6D9E6` | Badge default border, ring BookingCelebration |
| `300` | `#AEB4CC` | — |
| `400` | `#6E7596` | — |
| `500` | `#1A1A2E` | = `colors.primary` |
| `600` | `#14141F` | — |
| `700` | `#0D0D16` | — |

**Giallo (Yellow)**
| Shade | Hex | Uso principale |
|---|---|---|
| `50` | `#FEFCE8` | Badge warning bg, info card modale bg |
| `100` | `#FEF9C3` | `statusScheduledBg`, sfondo day today calendario |
| `200` | `#FEF08A` | Badge warning border |
| `300` | `#FDE047` | — |
| `400` | `#FACC15` | = `colors.accent` |
| `500` | `#EAB308` | — |
| `600` | `#CA8A04` | = `statusScheduledText` |
| `700` | `#A16207` | Testo Button secondary, testo chip attivo |

### 1.4 Colori di Stato (Token)

| Token | Hex | Uso |
|---|---|---|
| `colors.statusScheduledText` | `#CA8A04` | Testo "Programmato" |
| `colors.statusScheduledBg` | `#FEF9C3` | Background badge programmato |
| `colors.statusCompletedText` | `#64748B` | Testo stato completato |

### 1.5 Colori Ausiliari (Inline, Non Tokenizzati)

Usati direttamente negli stili dei componenti:

| Hex | Contesto d'uso |
|---|---|
| `#F8FAFC` | Sfondo input non focused, sfondo SkeletonCard, sfondo time picker scroll container |
| `#E2E8F0` | Bordo input non focused, bordo chip inattivo, underline orario, testo day otherMonth (calendario) |
| `#1E293B` | Testo forte in drawers (CalendarDrawer, TimePickerDrawer), toast info bg |
| `#0F172A` | Toast info shadow |
| `#64748B` | Testo time picker non selezionato, icona add (RangesEditor) |
| `#94A3B8` | Label colonne time picker, weekday headers, frecce disabilitate, hint mascot, icona info toast |
| `#92400E` | Testo selezionato time picker, testo chip attivo (SelectableChip) |
| `#CBD5E1` | Handle drag drawers, testo day non disponibile (calendario) |
| `#B45309` | Ombra ambra card accent (uso inline) |
| `#D97706` | Ombra ambra day pill |
| `#16A34A` | Badge success text, toast success shadow |
| `#BBF7D0` | Badge success border |
| `#F0FDF4` | Badge success bg |
| `#DC2626` | Badge danger text, toast danger shadow |
| `#FECACA` | Badge danger border |
| `#FEF2F2` | Badge danger bg |
| `#FDE68A` | Border info card modale gialla |

### 1.6 Token Deprecati

Gli alias deprecati (`colors.navy` stringa, `colors.glass`, `colors.glassStrong`, `colors.glassBorder`) sono stati **rimossi** da `colors.ts`: erano inutilizzati. `colors.navy` ora è la **scala navy** (oggetto `50…700`), non più una stringa. Usare `colors.primary` / `colors.surface` / `colors.border`.

---

## 2. Typography

Definiti in `src/theme/typography.ts`:

| Token | fontSize | fontWeight | letterSpacing | Uso |
|---|---|---|---|---|
| `typography.title` | 28 | `'700'` | -0.3 | Titoli pagina ("Ciao, Gabriele") |
| `typography.subtitle` | 18 | `'600'` | — | Titoli card, sezioni, header BottomSheet |
| `typography.body` | 15 | `'500'` | — | Testo corrente, label bottoni, input text, option label |
| `typography.caption` | 12 | `'600'` | 0.4 | Badge testo, label piccole, metadata, action pill |

### Varianti Tipografiche nei Componenti

I componenti applicano override specifici ai token base:

**Card — titoli per hierarchy:**
| Hierarchy | fontSize | lineHeight | fontWeight | letterSpacing |
|---|---|---|---|---|
| `primary` | 30 | 34 | `'700'` | -0.4 |
| `secondary` | 22 | 27 | `'700'` | — |
| `tertiary` | 18 | 23 | `'600'` | 0 |

**Card — sottotitoli per hierarchy:**
| Hierarchy | fontSize | lineHeight | fontWeight |
|---|---|---|---|
| `primary` | 16 | 22 | `'600'` |
| `secondary` | 14 | 19 | `'500'` |
| `tertiary` | = `typography.caption` | — | — |

**SectionHeader — titoli per hierarchy:**
| Hierarchy | fontSize | lineHeight | fontWeight | letterSpacing |
|---|---|---|---|---|
| `primary` | 22 | 27 | `'700'` | -0.2 |
| `secondary` | 19 | 24 | `'700'` | — |
| `tertiary` | 17 | 22 | `'600'` | — |

---

## 3. Spacing

Definiti in `src/theme/spacing.ts`:

| Token | Valore (px) | Uso tipico |
|---|---|---|
| `spacing.xs` | 6 | Gap minimi, padding badge verticale, micro gap |
| `spacing.sm` | 10 | Gap card content, padding chip verticale, gap BottomSheet body |
| `spacing.md` | 16 | Padding standard, gap card primary, margin month nav |
| `spacing.lg` | 22 | Padding card, padding BottomSheet, padding drawer |
| `spacing.xl` | 28 | — |
| `spacing.xxl` | 36 | — |

---

## 4. Border Radius

Definiti in `src/theme/spacing.ts` → `radii`:

| Token | Valore (px) | Quando usarlo |
|---|---|---|
| `radii.sm` | 20 | Bottoni, input, chip, toast, suggerimenti SearchableSelect, CTA footer drawer |
| `radii.lg` | 35 | Card primary, SkeletonCard |

### Radii Inline (Non Tokenizzati)

| Valore | Contesto |
|---|---|
| `999` | Badge pill, SelectableChip, action pill SectionHeader, RangesEditor row, add button |
| **`26`** | **CTA card (Airbnb-style)** — Simulazione, Esercitazione, Continua a studiare, Ripassa errori, card capitolo in topic list |
| `24` | Modal card centrata, BottomSheet top radius |
| `28` | CalendarDrawer top radius |
| `22` | BookingCelebration card |
| **`20`** | **Stats inset card** (informativa), card deboli, card sessioni |
| **`18`** | **Schede tile** (griglia schede capitolo e esame), frecce navigazione mese |
| `17` | Frecce CalendarNavigator (circle 34x34) |
| **`16`** | **Bottoni VERO/FALSO quiz**, card base default, info card modale |
| `12` | Item time picker |
| `10` | SkeletonBlock default |
| `CELL_SIZE/2` | Day cell calendario (cerchio perfetto) |

**Regola**: CTA card → `26`. Info card → `20`. Tile griglia → `18`. Bottoni inline → `16`. Pill/chip → `999`. Cerchi → dimensione/2.

---

## 5. Ombre (Shadow Presets)

### 5.0 Principio: Raised vs Recessed

Le ombre comunicano la gerarchia interattiva:
- **Ombra esterna (raised)** = tappabile, azione. L'elemento "galleggia" sopra la pagina.
- **Ombra interna (inset/recessed)** = informativo, non tappabile. L'elemento e' "incassato" nella pagina.

**Mai** dare ombra esterna a card informative. **Mai** dare inset shadow a CTA.

### 5.1 CTA Card — Ombra Concentrata (v3)

Usata da: card Simulazione, Esercitazione, Ripassa errori, card capitolo (topic list), tile schede.
L'ombra e' stretta e vicina alla card → effetto "oggetto sollevato dal tavolo", non alone diffuso.

```ts
shadowColor: '#000',
shadowOffset: { width: 0, height: 3 },
shadowOpacity: 0.14,
shadowRadius: 6,
elevation: 5,
```

**Press state:**
```ts
opacity: 0.9,
transform: [{ scale: 0.96 }],
```

### 5.2 CTA Navy Primary — GRADIENT (regola 2026-07-02)

Ogni CTA primary navy usa il **gradiente diagonale condiviso** (nato sul
phone gate), NON il navy flat. Componenti in `src/components/GradientCTA.tsx`:

- **Bottone nuovo** → `<Button tone="primary" />` (già gradiente) oppure
  `Pressable` (radius+shadow) + `<GradientCTA style={...}>` come fill.
- **Bottone esistente / conversione** → `<GradientCTABackground radius={R} />`
  come PRIMO figlio del Pressable + rimuovere `backgroundColor` dallo style
  (layout/ombre invariati). `R` = il borderRadius dello style.
- Gradiente: `['#26263F', colors.primary, '#131322']`, start `{0.2,0}` → end `{0.8,1}`.
- Ombra colorata OBBLIGATORIA sul Pressable: `primaryCtaShadow` (shadowColor
  navy `colors.primary`, opacity 0.4, radius 16, offset 0/10, elevation 8) —
  effetto 3D pronunciato, riferimento phone gate (regola 2026-07-03). Mai ombre
  ad-hoc sui CTA gradient: sempre `...primaryCtaShadow` spread nello style.
  Se il gradiente è condizionale (varianti navy/disabled), l'ombra segue la
  STESSA condizione. Il view che porta l'ombra non deve avere
  `overflow: 'hidden'` (iOS la clipperebbe).
- La forma NON cambia mai: pill restano pill, radius restano i loro.
- **Eccezione**: `ForceUpdateScreen` resta navy flat (pure-JS safety net, non
  deve importare moduli nativi).

**Press state:**
```ts
opacity: 0.95,
transform: [{ scale: 0.97 }],
```

### 5.3 Tile Schede — Ombra Leggera

Usata da: griglia schede capitolo, griglia schede esame.

```ts
shadowColor: '#000',
shadowOffset: { width: 0, height: 3 },
shadowOpacity: 0.1,
shadowRadius: 5,
elevation: 3,
```

### 5.4 Card Informativa — Inset Shadow (v3)

Usata da: stats home, stats topic list, stats scheda grid, stats exam schede.
Usa `boxShadow` nativo di React Native 0.81+ con `inset: true`.

```ts
backgroundColor: '#EEEDEB',
borderRadius: 20,
boxShadow: [
  { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: 0, color: 'rgba(0,0,0,0.12)', inset: true },
  { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: 'rgba(0,0,0,0.06)', inset: true },
],
```

Due layer: uno morbido (blur 6) + uno nitido (blur 2) per profondita' realistica.

### 5.5 Card Secondaria — Ombra Leggera

Usata da: countdown esame, capitoli da migliorare, card generiche non-CTA.

```ts
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.06,
shadowRadius: 10,
elevation: 2,
```

### 5.6 BottomSheet / CalendarDrawer

```ts
shadowColor: 'rgba(0, 0, 0, 0.08)',
shadowOpacity: 0.12,
shadowRadius: 18,
shadowOffset: { width: 0, height: -6 },
elevation: 6,
```

### 5.7 Day Pill Calendario (Selezionato)

```ts
shadowColor: '#D97706',
shadowOpacity: 0.18,
shadowRadius: 6,
shadowOffset: { width: 0, height: 3 },
elevation: 3,
```

### 5.7 Toast Notice

```ts
shadowColor: /* varia per tone (vedi sezione ToastNotice) */,
shadowOpacity: 0.3,
shadowRadius: 16,
shadowOffset: { width: 0, height: 8 },
elevation: 10,
```

### 5.8 BookingCelebration Card

```ts
shadowColor: 'rgba(0, 0, 0, 0.08)',
shadowOpacity: 0.12,
shadowRadius: 20,
shadowOffset: { width: 0, height: 10 },
elevation: 16,
```

### 5.9 SearchableSelect Dropdown

```ts
shadowColor: '#000',
shadowOpacity: 0.1,
shadowRadius: 16,
shadowOffset: { width: 0, height: 8 },
elevation: 8,
```

### 5.10 RangesEditor Row

```ts
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.05,
shadowRadius: 8,
elevation: 2,
```

### 5.11 Backdrop Overlay

| Contesto | Valore |
|---|---|
| BottomSheet | `rgba(10, 15, 30, 0.45)` |
| CalendarDrawer | `rgba(0, 0, 0, 0.35)` |
| BookingCelebration | `rgba(14, 24, 40, 0.16)` |
| Modal centrata | `rgba(0, 0, 0, 0.35)` |

---

## 6. Componenti

Tutti in `src/components/`. **Non creare nuovi primitivi** — usa e componi questi.

### 6.1 Screen

**File:** `Screen.tsx`
**Scopo:** Wrapper SafeArea per ogni schermata.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `children` | `ReactNode` | — | Contenuto della schermata |

Stili: `flex: 1`, `backgroundColor: colors.background`, `paddingTop: insets.top`.

---

### 6.2 Card

**File:** `Card.tsx`
**Scopo:** Contenitore generico con gerarchia visiva.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `title` | `string?` | — | Titolo opzionale |
| `subtitle` | `string?` | — | Sottotitolo opzionale |
| `children` | `ReactNode?` | — | Contenuto custom |
| `style` | `ViewStyle?` | — | Override stile container |
| `hierarchy` | `'primary' \| 'secondary' \| 'tertiary'` | `'secondary'` | Livello gerarchico |
| `variant` | `'default' \| 'dark'` | `'default'` | Variante colore |
| `titleStyle` | `TextStyle?` | — | Override stile titolo |
| `subtitleStyle` | `TextStyle?` | — | Override stile sottotitolo |

**Stili base:** `borderRadius: 16`, `borderWidth: 1`, `borderColor: colors.border`, `bg: colors.surface`, `padding: spacing.lg`, `gap: spacing.sm`.

| Hierarchy | borderRadius | shadowOpacity | shadowRadius | elevation | paddingVertical | gap |
|---|---|---|---|---|---|---|
| `primary` | `radii.lg` (35) | 0.12 | 12 | 4 | `spacing.lg` | `spacing.md` |
| `secondary` | 16 | 0.08 | 8 | 2 | `spacing.lg` | `spacing.sm` |
| `tertiary` | 16 | 0.08 | 8 | 2 | `spacing.md` | `spacing.xs` |

**Variant `dark`:** `bg: #1F2937`, `borderColor: rgba(255,255,255,0.1)`, testo bianco, sottotitolo `rgba(255,255,255,0.7)`.

---

### 6.3 Button

**File:** `Button.tsx`
**Scopo:** Bottone standard per azioni.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `label` | `string` | — | Testo del bottone |
| `onPress` | `() => void?` | — | Handler tap |
| `tone` | `'standard' \| 'primary' \| 'danger' \| 'secondary'` | `'standard'` | Tono visivo |
| `disabled` | `boolean` | `false` | Stato disabilitato |
| `fullWidth` | `boolean` | `false` | Larghezza piena |
| `loading` | `boolean` | `false` | Mostra `ActivityIndicator` al posto della label |

**Stili base:** `borderRadius: radii.sm` (20), `borderWidth: 1`, `minHeight: 48`, `paddingVertical: spacing.sm`, `paddingHorizontal: spacing.lg`.

**Loading:** quando `loading` è `true` il bottone mostra uno **spinner** (`ActivityIndicator`, colore = `text` del tone) **al posto della label, che NON cambia testo** (no "Salvataggio…/Prenotazione…/Spostando…"). Il press è disabilitato. Regola di prodotto: per azioni async usare **sempre** lo spinner, mai lo swap di label. Vale anche per le pill custom (CTA picker, conferme): `pending ? <ActivityIndicator color="#fff" /> : <Text>label</Text>`.

**Spinner sul bottone CLICCATO:** se più bottoni async convivono (es. Cancella/Mantieni in una card), lo spinner deve apparire **sul bottone effettivamente premuto**, non su un fratello. Non basta un flag per-riga: tracciare `{ id, action }` e mettere `loading` solo sul match; gli altri restano `disabled`.

| Tone | bg | border | text |
|---|---|---|---|
| `primary` | `#1A1A2E` | `#1A1A2E` | `#FFFFFF` |
| `standard` | `#FFFFFF` | `colors.border` | `colors.textPrimary` |
| `danger` | `#FFFFFF` | `#EF4444` | `#EF4444` |
| `secondary` | `#FFFFFF` | `#FACC15` | `#A16207` |

**Pressed:** `scale: 0.98`. **Disabled:** `opacity: 0.6`, label color → `colors.textMuted`.

---

### 6.4 Badge

**File:** `Badge.tsx`
**Scopo:** Etichetta di stato.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `label` | `string` | — | Testo badge |
| `tone` | `'default' \| 'success' \| 'warning' \| 'danger'` | `'default'` | Tono colore |

**Stili base:** `borderRadius: 999` (pill), `borderWidth: 1`, `paddingVertical: spacing.xs`, `paddingHorizontal: spacing.sm`. Testo: `typography.caption`, `textTransform: 'uppercase'`, `letterSpacing: 0.5`.

| Tone | bg | text | border |
|---|---|---|---|
| `default` | `navy[50]` (`#F4F5F9`) | `colors.primary` (`#1A1A2E`) | `navy[200]` (`#D6D9E6`) |
| `success` | `#F0FDF4` | `#16A34A` | `#BBF7D0` |
| `warning` | `#FEFCE8` | `#CA8A04` | `#FEF08A` |
| `danger` | `#FEF2F2` | `#DC2626` | `#FECACA` |

---

### 6.5 Input

**File:** `Input.tsx`
**Scopo:** Campo di testo con focus state.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `label` | `string?` | — | Non renderizzato (passato a TextInput via spread) |
| `...props` | `TextInputProps` | — | Tutte le props native |

**Stili wrapper:**
- Default: `borderRadius: radii.sm`, `borderWidth: 1`, `borderColor: #E2E8F0`, `bg: #F8FAFC`
- Focused: `borderColor: colors.primary` (`#1A1A2E`), `bg: #FFFFFF`

**Stili input:** `typography.body`, `color: colors.textPrimary`, `paddingHorizontal: 18`, `paddingVertical: 14`. Placeholder color: `colors.textMuted`.

---

### 6.6 SelectableChip

**File:** `SelectableChip.tsx`
**Scopo:** Chip toggle con animazione colore.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `label` | `string` | — | Testo chip |
| `active` | `boolean` | — | Stato attivo |
| `onPress` | `() => void` | — | Handler tap |
| `style` | `ViewStyle?` | — | Override container |
| `textStyle` | `TextStyle?` | — | Override testo |

**Stili:** `borderRadius: 999`, `borderWidth: 1`, `paddingVertical: spacing.sm`, `paddingHorizontal: spacing.md`.

| Stato | bg | border | text |
|---|---|---|---|
| Inattivo | `#F8FAFC` | `#E2E8F0` | `#64748B` |
| Attivo | `#FACC15` | `#FACC15` | `#92400E` |

**Animazione:** `Animated.timing` 180ms su bg, border e text color. Pressed: `opacity: 0.85`.

---

### 6.7 SectionHeader

**File:** `SectionHeader.tsx`
**Scopo:** Titolo sezione con action pill opzionale.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `title` | `string` | — | Titolo sezione |
| `action` | `string?` | — | Testo action pill (opzionale) |
| `subtitle` | `string?` | — | Sottotitolo (opzionale) |
| `hierarchy` | `'primary' \| 'secondary' \| 'tertiary'` | `'secondary'` | Gerarchia visiva |

**Action pill:** `borderRadius: 999`, `borderWidth: 1`, `borderColor: colors.border`, `bg: #FFFFFF`, `paddingHorizontal: spacing.sm`, `paddingVertical: 4`. Testo: `typography.caption` con `textTransform: 'none'`.

---

### 6.8 ToastNotice

**File:** `ToastNotice.tsx`
**Scopo:** Notifica temporanea in overlay.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `message` | `string \| null` | — | `null` per nascondere |
| `tone` | `'success' \| 'info' \| 'danger'` | `'info'` | Tono colore |
| `durationMs` | `number` | `2600` | Durata visibilita |
| `onHide` | `() => void?` | — | Callback dopo scomparsa |

| Tone | bg | text | icon | iconColor | shadowColor |
|---|---|---|---|---|---|
| `success` | `#22C55E` | `#FFFFFF` | `checkmark-circle` | `#FFFFFF` | `#16A34A` |
| `info` | `#1E293B` | `#FFFFFF` | `information-circle` | `#94A3B8` | `#0F172A` |
| `danger` | `#EF4444` | `#FFFFFF` | `alert-circle` | `#FFFFFF` | `#DC2626` |

**Stili toast:** `borderRadius: radii.sm`, `maxWidth: 400`, `width: 100%`, `gap: 12`. Posizione: `top: spacing.sm + insets.top`, centrato, `zIndex: 50`.

**Animazione entrata:** spring `translateY` (-30 → 0), spring `scale` (0.92 → 1), timing `opacity` (0 → 1, 200ms).
**Animazione uscita:** timing 250ms `opacity` → 0, `translateY` → -20, `scale` → 0.95.

---

### 6.9 BottomSheet

**File:** `BottomSheet.tsx` (Android/default) + `BottomSheet.ios.tsx` (iOS)
**Scopo:** Drawer modale dal basso. Usare **solo** per contenuti complessi con scroll.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `visible` | `boolean` | — | Visibilita |
| `onClose` | `() => void` | — | Callback chiusura |
| `onClosed` | `() => void?` | — | Callback post-animazione chiusura |
| `title` | `string?` | — | Titolo header |
| `children` | `ReactNode` | — | Contenuto |
| `footer` | `ReactNode?` | — | Footer fisso in basso |
| `minHeight` | `number?` | 320 (con footer) | Altezza minima |
| `dragEnabled` | `boolean` | `true` | Abilita drag-to-dismiss |
| `closeDisabled` | `boolean` | `false` | Impedisce chiusura |
| `closeOnBackdrop` | `boolean` | `true` | Chiusura su tap backdrop |
| `bottomInsetMode` | `'safe' \| 'none'` | `'safe'` | Gestione safe area bottom |
| `showHandle` | `boolean` | `false` | Mostra handle drag visivo |
| `titleRight` | `ReactNode?` | — | Elemento a destra del titolo |

**Stili sheet:** `borderTopLeftRadius: 24`, `borderTopRightRadius: 24`, `bg: #FFFFFF`, `padding: spacing.lg`.

**Animazione apertura:** backdrop `opacity` timing 180ms, sheet `spring` (damping: 22, stiffness: 240).
**Animazione chiusura:** backdrop `opacity` timing 160ms, sheet `translateY` timing 260ms.
**Drag:** soglia dismiss: `dy > 120 || vy > 0.9`. Over-drag verso l'alto limitato a -8px con fattore 0.2.
**Keyboard:** Offset automatico per tastiera con cap al `topInset`.
**Handle:** barra 40x4px, `bg: #CBD5E1`, `borderRadius: 2`.

---

### 6.10 CalendarDrawer

**File:** `CalendarDrawer.tsx`
**Scopo:** Drawer con calendario mensile per selezione data.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `visible` | `boolean` | — | Visibilita |
| `onClose` | `() => void` | — | Callback chiusura |
| `onSelectDate` | `(date: Date) => void` | — | Callback selezione |
| `selectedDate` | `Date` | — | Data selezionata |
| `maxWeeks` | `number` | `4` | Settimane navigabili nel futuro |
| `caption` | `string \| null` | `'Scegli un giorno...'` | Testo sotto mascotte |

**Layout:** Drawer autonomo (non usa BottomSheet). `borderTopRadius: 28`. Grid 6x7 (42 celle).
**Day cell:** `44x44px`, `borderRadius: 22` (cerchio).

| Stato Day | bg | borderWidth | borderColor | text color | fontWeight |
|---|---|---|---|---|---|
| Default | — | — | — | `#1E293B` | `'600'` |
| Today | — | 2 | `#FACC15` | `#1E293B` | `'700'` |
| Selected | `#1A1A2E` | — | — | `#FFFFFF` | `'700'` |
| Unavailable | — | — | — | `#CBD5E1` | `'600'` |
| Other month | — | — | — | `#E2E8F0` | `'600'` |

**Navigazione mese:** frecce circolari 36x36, `borderRadius: 18`, `borderWidth: 1`, `borderColor: #E5E7EB`. Label mese: `fontSize: 18`, `fontWeight: '700'`.
**Weekday headers:** `fontSize: 11`, `fontWeight: '700'`, `color: #94A3B8`, uppercase.
**Mascotte:** immagine `duck-calendar.png` (120x85px) con caption e hint.

---

### 6.11 MiniCalendar

**File:** `MiniCalendar.tsx`
**Scopo:** Calendario inline (non drawer) per schermate gestione.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `selectedDate` | `string \| null` | — | Formato `YYYY-MM-DD` |
| `onSelectDate` | `(date: string) => void` | — | Callback con `YYYY-MM-DD` |
| `markedDates` | `Set<string>?` | — | Date con dot indicatore |
| `maxWeeks` | `number` | `12` | Settimane navigabili |

**Day cell:** `40x40px`, `borderRadius: 20`. Day text: `fontSize: 14`.
**Selezionato:** `bg: #1A1A2E` (navy), testo bianco. **Today:** border 2 `#1A1A2E`. **`selectedToday`:** fill navy (la selezione domina). No giallo.
**Marked dot:** cerchio `5x5px`, `bg: #1A1A2E`, posizione `absolute bottom: 4`.
**Fade transition:** `Animated.timing` 220ms su opacity al cambio mese.
**LayoutAnimation:** attivato su Android per transizioni mese (`easeInEaseOut`).

---

### 6.12 TimePickerDrawer

**File:** `TimePickerDrawer.tsx`
**Scopo:** Drawer per selezione orario con scroll colonne.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `visible` | `boolean` | — | Visibilita |
| `onClose` | `() => void` | — | Callback chiusura |
| `onSelectTime` | `(date: Date) => void` | — | Callback con data+orario |
| `selectedTime` | `Date` | — | Orario selezionato |

**Layout:** Usa `BottomSheet` con `showHandle` e `footer` (CTA conferma).
**Colonne:** 2 ScrollView affiancate (Ore 0-23, Minuti 0/15/30/45). Item height: `48px`, column height: `250px`.
**Item selezionato:** `bg: #FACC15`, `fontWeight: '700'`, `color: #92400E`.
**Item non selezionato:** `color: #64748B`, `fontWeight: '500'`.
**Label colonne:** `fontSize: 12`, `fontWeight: '700'`, `color: #94A3B8`, uppercase.
**CTA footer:** `bg: #1A1A2E`, `borderRadius: radii.sm`, `minHeight: 52`, ombra navy.
**Mascotte:** `duck-clock.png` (100x73px).
**Auto-scroll:** scroll al valore selezionato al mount con `setTimeout` 100ms.

---

### 6.13 RangesEditor

**File:** `RangesEditor.tsx`
**Scopo:** Editor fasce orarie con add/remove.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `ranges` | `TimeRange[]` | — | `{ startMinutes, endMinutes }` |
| `onChange` | `(ranges) => void` | — | Callback modifica |
| `onPickTime` | `(index, field) => void` | — | Callback tap su orario |
| `onAddRange` | `() => void` | — | Callback aggiungi fascia |
| `disabled` | `boolean` | `false` | Stato disabilitato |

**Row:** `borderRadius: 999`, `bg: #FFFFFF`, `paddingVertical: 14`. Ombra leggera (`shadowOpacity: 0.05`).
**Clock icon circle:** `36x36`, `borderRadius: 18`, `bg: #EEF0F4` (navy tint), icona `time` color `#1A1A2E`.
**Time text:** `fontSize: 16`, `fontWeight: '600'`, `color: #1E293B`, `textDecorationLine: 'underline'`, underline color `#E2E8F0`.
**Add button:** `borderRadius: 999`, `borderWidth: 1.5`, `borderStyle: 'dashed'`, `borderColor: #CBD5E1`. Testo `fontSize: 14`, `color: #64748B`.
**Animazioni:** `FadeIn.duration(200)` / `FadeOut.duration(150)` (react-native-reanimated).

---

### 6.14 SearchableSelect

**File:** `SearchableSelect.tsx`
**Scopo:** Input con dropdown suggerimenti filtrati.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `label` | `string?` | — | Label sopra il campo |
| `placeholder` | `string?` | — | Placeholder input |
| `value` | `string \| null` | — | Valore selezionato |
| `options` | `SearchableSelectOption[]` | — | `{ value, label, subtitle? }` |
| `onChange` | `(value) => void` | — | Callback selezione |
| `onFocus` | `() => void?` | — | Callback focus |
| `disabled` | `boolean` | `false` | Stato disabilitato |
| `emptyText` | `string` | `'Nessun risultato.'` | Testo lista vuota |
| `maxSuggestions` | `number` | `8` | Massimo suggerimenti |
| `persistSelectedLabel` | `boolean` | `true` | Mantieni label nel campo |

**Input wrapper:** come `Input` (`borderRadius: radii.sm`, bordo `#E2E8F0` / focus `colors.primary`), con icona search (`Ionicons search`, 20px, `#94A3B8`).
**Dropdown:** `position: absolute`, `top: 100%`, `marginTop: spacing.xs`, `borderRadius: radii.sm`, `bg: #FFFFFF`, `maxHeight: 220`, `zIndex: 200`.
**Option selezionata:** `bg: navy[50]`. **Option pressed:** `opacity: 0.72`.
**Animazione apertura:** timing 180ms `opacity` + `translateY` (-6 → 0) + `scale` (0.98 → 1).

---

### 6.15 CalendarNavigator

**File:** `CalendarNavigator.tsx`
**Scopo:** Navigazione temporale con chip Giorno/Settimana/Mese/Oggi.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `initialMode` | `'day' \| 'week' \| 'month'` | `'week'` | Modalita iniziale |
| `initialDate` | `Date?` | `new Date()` | Data iniziale |
| `onChange` | `(range) => void` | — | Callback con `CalendarNavigatorRange` |
| `style` | `ViewStyle?` | — | Override container |

**Frecce:** circle `34x34`, `borderRadius: 17`, `borderWidth: 1`, `borderColor: colors.border`, `bg: #FFFFFF`. Pressed: `opacity: 0.72`.
**Range label:** `typography.body` con `fontWeight: '700'`, `textTransform: 'capitalize'`, centrato.
**Mode chips:** row di `SelectableChip` con `gap: spacing.xs`.

---

### 6.16 Skeleton

**File:** `Skeleton.tsx`
**Scopo:** Placeholder loading animato.

**SkeletonBlock:**

| Prop | Tipo | Default |
|---|---|---|
| `width` | `number \| string` | `'100%'` |
| `height` | `number` | `14` |
| `radius` | `number` | `10` |
| `style` | `ViewStyle?` | — |

`bg: rgba(0,0,0,0.06)`. Animazione pulse: `opacity` 0.42 ↔ 0.9, durata 760ms ciascuna direzione, `Easing.inOut(quad)`, loop infinito.

**SkeletonCard:** `borderRadius: radii.lg`, `bg: #F8FAFC`, `padding: 16`, `gap: 10`.

---

### 6.17 BookingCelebration

**File:** `BookingCelebration.tsx`
**Scopo:** Overlay animato per conferma prenotazione.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `visible` | `boolean` | — | Attiva animazione |
| `onHidden` | `() => void?` | — | Callback fine animazione |

**Durata totale:** ~1550ms (1450ms animazione + 100ms hold).
**Elementi:** backdrop fade, ring espansione (`navy[200]`), 5 sparkle burst (`colors.primary`), card centrale con checkmark.
**Card:** `minWidth: 248`, `borderRadius: 22`, `bg: #FFFFFF`. Icona: `checkmark-circle` 46px `colors.positive` in cerchio 66px con `bg: rgba(34,197,94,0.12)`, `border: rgba(34,197,94,0.35)`.
**Testo:** "Prenotazione confermata", `typography.subtitle`.

---

### 6.18 ScrollHintFab

**File:** `ScrollHintFab.tsx`
**Scopo:** FAB flottante per indicare contenuto scrollabile.

| Prop | Tipo | Default | Note |
|---|---|---|---|
| `direction` | `'up' \| 'down'` | — | Direzione freccia |
| `onPress` | `() => void` | — | Handler tap |
| `style` | `ViewStyle?` | — | Override posizione |

**Bottone:** circle `38x38`, `borderRadius: 19`, `borderWidth: 1`, `borderColor: colors.border`, `bg: #FFFFFF`. Icona `chevron-down` 19px (ruotata 180deg per `up`).
**Animazione float:** loop spring `translateY` ±7px con delay e bounce.
**Pressed:** `scale: 0.96`.

---

### 6.19 GlassTabBar

**File:** `GlassTabBar.tsx` (Android) + `GlassTabBar.ios.tsx` (iOS)
**Scopo:** Tab bar personalizzata.

- **iOS:** usa token deprecati `glass*` + `BlurView` nativo per effetto vetro.
- **Android:** tab bar custom con `bg: #FFFFFF`, highlight navy.

---

## 7. Pattern UI

### 7.1 Modali Centrate

Per azioni rapide (proposte, conferme, form brevi). **Preferire sempre rispetto a BottomSheet** per interazioni semplici.

```tsx
<Modal transparent animationType="fade" visible={open} onRequestClose={close}>
  <View style={styles.modalOverlay}>
    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
    <View style={styles.modalCard}>
      {/* contenuto */}
    </View>
  </View>
</Modal>
```

**Stili:**
- `modalOverlay`: `flex: 1`, `justifyContent: 'center'`, `alignItems: 'center'`, `backgroundColor: rgba(0,0,0,0.35)`
- `modalCard`: `bg: #FFFFFF`, `borderRadius: 24`, `padding: 24`, `gap: 16`, ombra forte (§5.8)
- Info card interna: `bg: #FEF9C3`, `border: #FDE68A`, `borderRadius: 16`
- Azione distruttiva testo: `color: #EF4444`, bold, centrato

### 7.2 Card "Prossima Guida" (Gradient Giallo)

```tsx
<View style={styles.nextLessonShadow}>
  <LinearGradient
    colors={['#FACC15', '#FDE68A']}
    start={{ x: 0, y: 0 }}
    end={{ x: 0.8, y: 1 }}
    style={styles.nextLessonCard}
  >
    {/* contenuto */}
  </LinearGradient>
</View>
```

Il wrapper esterno porta l'ombra ambra (§5.5), il gradient interno ha `overflow: 'hidden'` e `borderRadius: radii.lg`.

### 7.3 CTA Hero (Bottone Grande Navy)

`Pressable` custom (non il componente `Button`) con `minHeight: 58`, `fontSize: 18`, `fontWeight: '700'`, `borderRadius: radii.sm`, ombra navy (§5.4). **Pressed:** `scale: 0.98`, `opacity: 0.85`.

### 7.4 Mascotte (Duck)

Pattern ricorrente nei drawer:
- `duck-calendar.png` in CalendarDrawer (120x85px)
- `duck-clock.png` in TimePickerDrawer (100x73px)
- Posizionata in sezione centrata con caption e hint text sotto

### 7.5 Form a Card — Gerarchia Input (3D primario vs Lista secondario)

Pattern di riferimento: **`app/(tabs)/home/new-booking.tsx`** ("Nuova prenotazione", rifatta 2026-06-08) + **`manage-lesson.tsx`** ("Gestisci guida"). Regola: la **gerarchia visiva comunica la priorità del dato**. Niente bordi sui campi — solo superfici bianche + ombra, oppure righe piatte.

**Titolo pagina** = hero (vedi §12.7), **senza divider sotto**.

**① Input PRIMARI → righe in card bianca elevata (3D, NO bordi).** Per i dati più importanti (es. allievo, giorno, ora, durata).
```tsx
// card group
group: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 16, marginBottom: 14,
  shadowColor: '#1A1A2E', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 }
// riga dentro la card: icona outline (26w) + label + valore + chevron
row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, minHeight: 64 }
rowLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' }   // nome campo
rowValue: { fontSize: 14, color: '#717171' }                     // selezione corrente
rowPlaceholder: { fontSize: 14, color: '#94A3B8' }               // quando vuoto
divider: { height: hairline, backgroundColor: '#EFF0F3' }        // SOLO tra righe interne
chevron: 'chevron-forward' 18 '#C7CBD1'
```
Più righe correlate possono stare nella stessa card (es. Giorno + Ora + Durata). L'allievo usa un **avatar a iniziali** (44, `backgroundColor: N100`) al posto dell'icona.

**② Input SECONDARI → righe piatte a lista (NO card, NO ombra).** Per i dati meno prioritari (es. luogo, veicolo, tipo). Stesso markup `row` ma su sfondo trasparente, preceduti da una caption.
```tsx
listCaption: { fontSize: 12, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.4,
  textTransform: 'uppercase', marginLeft: 6 }   // es. "DETTAGLI"
list: { paddingHorizontal: 6 }                   // righe + divider tra loro, niente superficie
```

**③ Opzioni OPTIONAL → banner tinto leggero (NO ombra).** Per un extra non necessario (es. "Prenotazione multipla"): si distingue dalle card bianche, legge come secondario.
```tsx
optBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F4F5F9',
  borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14 }   // N50, flat
optIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF' }  // icona in cerchio bianco
```

**④ CTA footer** = riepilogo a sinistra (label muted + valore navy, la durata va a capo se la riga è lunga) + `Button tone="primary"` a destra. **In loading mostra lo spinner, NON cambia label** (`<Button loading={pending} .../>`, vedi §6.3).

Sintesi gerarchia: **card 3D bianca = primario · lista piatta = secondario · banner tinto = optional**.

### 7.6 Picker via Form Sheet Nativa (store seed-and-callback)

Ogni sotto-input di un form NON si apre inline ma in una **route nativa** (Expo Router), seminata via store + callback. Pattern: il parent fa `store.set({ ...dati, onConfirm/onSelect })` poi `router.push('/(tabs)/home/<route>')`; la route legge lo store con `useSyncExternalStore`, e su conferma chiama la callback e fa `router.back()`. Vedi [[reference_native_formsheet]].

| Cosa | Route | Store | Presentazione |
|------|-------|-------|--------------|
| Data (calendario mesi) | `select-date` | `dayPickerStore` | `modal` |
| Ora (ruota) | `time-picker` | `timePickerStore` | `formSheet` + `fitToContents` |
| Allievo (ricerca + lista, single) | `select-student` | `studentPickerStore` | `modal` |
| Allievi (ricerca + checkbox, MULTI) | `select-exam-students` | `examStudentsStore` | `modal` |
| Durata / Veicolo / Tipo / Aggiungi allievo | `select-options` (≤7 voci) / `select-options-long` (>7, scrollabile) — route scelta da `optionsPickerPath()` DOPO `optionsPickerStore.set()` | `optionsPickerStore` | `formSheet fitToContents` / `modal` (2026-07-07: il form sheet clippava le liste lunghe senza scroll) |
| Luogo (+ crea) | `manage-lesson-location` (+ `-location-form`) | `locationPickerStore` (+ `locationFormStore`) | `formSheet` + `fitToContents` |

Liste **scrollabili a lunghezza variabile** → `presentation: 'modal'` (page sheet). Liste **corte content-hugging** → `formSheet` + `sheetAllowedDetents: 'fitToContents'` + **NIENTE ScrollView interna** (vedi [[reference_formsheet_layout_rule]]).

---

## 8. Animazioni

> **Filosofia: L'app deve sentirsi viva.**
> Ogni transizione di stato, ogni interazione, ogni cambiamento di contenuto deve avere un'animazione.
> L'assenza di animazione e un bug visivo.
> L'obiettivo e un'app che respira — fluida, reattiva, con personalita.

### 8.1 Libreria e Gerarchia

| Libreria | Quando usarla | Note |
|---|---|---|
| **`react-native-reanimated`** | **Preferita per tutto il nuovo codice.** Shared values, `useAnimatedStyle`, `withSpring`, `withTiming`, entering/exiting layout transitions, gesture handler. | Gira sul UI thread — sempre 60fps. |
| **`Animated` (RN core)** | Codice esistente (BottomSheet, ToastNotice, BookingCelebration, SelectableChip, Skeleton, ScrollHintFab, MiniCalendar, SearchableSelect). Accettabile per animazioni semplici. | Migrare gradualmente a reanimated. |
| **`LayoutAnimation`** | Transizioni di layout one-shot (aggiunta/rimozione elementi, cambio altezza). | Abilitare su Android: `UIManager.setLayoutAnimationEnabledExperimental(true)`. |

**Regola:** per ogni nuovo componente o nuova animazione, usare `react-native-reanimated`. Non aggiungere nuovo codice con `Animated` core.

### 8.2 Curve di Easing — Reference

| Nome | Config | Carattere | Quando usare |
|---|---|---|---|
| **Snappy** | `withSpring({ damping: 20, stiffness: 300 })` | Scatto deciso, poco rimbalzo | Press feedback, toggle, chip |
| **Bouncy** | `withSpring({ damping: 12, stiffness: 200 })` | Rimbalzo morbido, giocoso | Celebrazioni, entrata elementi, FAB |
| **Gentle** | `withSpring({ damping: 22, stiffness: 240 })` | Fluido, nessun rimbalzo | Drawer apertura, sheet slide-in |
| **Swift** | `withTiming(value, { duration: 200, easing: Easing.out(Easing.cubic) })` | Veloce, decelerazione naturale | Fade, color change, scale |
| **Slow reveal** | `withTiming(value, { duration: 400, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })` | Elegante, graduale | Entrata contenuto pagina, skeleton → contenuto |
| **Elastic** | `withSpring({ damping: 8, stiffness: 150 })` | Rimbalzo forte, playful | Successo, badge counter, notifiche importanti |

### 8.3 Scala Durate

| Categoria | Durata | Esempi |
|---|---|---|
| **Micro** | 80–150ms | Press scale, color change, opacity toggle |
| **Standard** | 150–300ms | Fade in/out, slide, chip toggle, dropdown |
| **Enfasi** | 300–500ms | Entrata card, stagger list items, drawer open |
| **Drammatica** | 500–1500ms | Celebrazione, onboarding, prima apparizione |

**Regola:** se un'animazione non rientra in queste fasce, probabilmente e troppo lenta o troppo veloce.

### 8.4 Pattern Obbligatori — Micro-interazioni

Ogni elemento interattivo **deve** avere feedback tattile animato:

#### Press Feedback (OBBLIGATORIO su ogni Pressable/TouchableOpacity)

```ts
// Standard — per bottoni, card, chip
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(pressed.value ? 0.97 : 1, { damping: 20, stiffness: 300 }) }],
}));

// Leggero — per elementi piccoli (icon button, day cell, option row)
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(pressed.value ? 0.92 : 1, { damping: 15, stiffness: 200 }) }],
}));

// CTA Hero — per azioni principali
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(pressed.value ? 0.96 : 1, { damping: 20, stiffness: 280 }) }],
  opacity: withTiming(pressed.value ? 0.88 : 1, { duration: 100 }),
}));
```

**Nessun elemento tappabile deve avere transizione solo `opacity` senza `scale`.** L'utente deve sempre percepire che "sta premendo qualcosa di fisico".

#### Toggle / Switch State

```ts
// Cambio stato (attivo/inattivo, selezionato/deselezionato)
backgroundColor: withTiming(active ? ACTIVE_COLOR : INACTIVE_COLOR, { duration: 180 }),
borderColor: withTiming(active ? ACTIVE_BORDER : INACTIVE_BORDER, { duration: 180 }),
```

Usato da: SelectableChip, day cell calendario, filtri. **Sempre animare** bg + border + text color insieme.

### 8.5 Pattern Obbligatori — Entrata Contenuto

#### Fade + Slide Up (Standard per contenuto che appare)

```ts
// Singolo elemento
entering={FadeIn.duration(300).delay(delay)}
// oppure
entering={FadeInDown.duration(350).springify().damping(18)}
```

#### Stagger List (OBBLIGATORIO per liste e griglie)

Ogni lista di card, righe agenda, slot disponibili **deve** avere entrata staggerata:

```ts
// Ogni item riceve un delay incrementale
const STAGGER_DELAY = 50; // ms tra ogni item

// Per item index i:
entering={FadeInDown.duration(350).delay(i * STAGGER_DELAY).springify().damping(18)}
```

| Contesto | Delay base | Delay stagger | Animazione |
|---|---|---|---|
| Card lista (home, agenda) | 0ms | 60ms per item | `FadeInDown` + spring |
| Slot disponibili booking | 100ms | 40ms per item | `FadeIn` + `scale` 0.95→1 |
| Righe tabella/gestione | 0ms | 50ms per item | `FadeInRight` |
| Badge / chip row | 0ms | 30ms per item | `FadeIn` + `scale` 0.9→1 |

**Massimo stagger:** cappare a ~8 item (400ms totali). Oltre, tutto appare insieme.

#### Skeleton → Contenuto

Quando il dato arriva e lo skeleton viene sostituito dal contenuto reale:

```ts
// Skeleton: gia presente con pulse
// Contenuto: entra con fade + leggero scale-up
entering={FadeIn.duration(400)}
// oppure per piu impatto:
entering={FadeIn.duration(300).springify()}
```

**Non** fare apparire il contenuto senza transizione dopo uno skeleton — e un salto visivo fastidioso.

### 8.6 Pattern Obbligatori — Transizioni di Stato

#### Cambio Numerico (Counter / Badge Count)

Quando un numero cambia (es. contatore lezioni, importo, badge):

```ts
// Scale bounce sul cambio
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(1, { damping: 8, stiffness: 200 }) }],
}));
// Trigger: setValue(0.85) poi lasciare lo spring tornare a 1
```

#### Empty State → Contenuto (e viceversa)

```ts
// Empty state esce
exiting={FadeOut.duration(200)}
// Contenuto entra
entering={FadeIn.duration(300).delay(150)}
```

#### Stato Successo / Errore

Dopo un'azione (prenotazione, pagamento, errore):

| Stato | Animazione | Durata |
|---|---|---|
| Successo | `BookingCelebration` pattern (sparkle + scale) | 1450ms |
| Successo leggero | Checkmark icon `FadeIn` + `scale` bounce | 400ms |
| Errore | Shake orizzontale (3 oscillazioni) | 300ms |
| Warning | Pulse opacity (2 cicli) | 600ms |

```ts
// Shake per errore
const shake = useSharedValue(0);
shake.value = withSequence(
  withTiming(-8, { duration: 50 }),
  withTiming(8, { duration: 50 }),
  withTiming(-6, { duration: 50 }),
  withTiming(6, { duration: 50 }),
  withTiming(0, { duration: 50 }),
);
```

### 8.7 Pattern Obbligatori — Drawer e Modal

#### Drawer (BottomSheet / CalendarDrawer)

| Fase | Animazione | Config |
|---|---|---|
| Apertura backdrop | `opacity` timing | 180ms |
| Apertura sheet | `translateY` spring | Gentle: damping 22, stiffness 240 |
| Chiusura backdrop | `opacity` timing | 160ms |
| Chiusura sheet | `translateY` timing | 260ms |
| Drag snap-back | `translateY` spring | stiffness 220, damping 18 |
| Dismiss threshold | — | `dy > 120 \|\| vy > 0.9` |
| Over-drag up | clamped | max -8px, fattore 0.2 |

#### Modal Centrata

```ts
// Entrata: scale + fade combinati
entering: FadeIn.duration(200)
// Card interna: spring scale
cardScale: withSpring(1, { damping: 18, stiffness: 260 }) // da 0.92
cardOpacity: withTiming(1, { duration: 200 })

// Uscita: fade rapido
exiting: FadeOut.duration(150)
cardScale: withTiming(0.95, { duration: 150 })
```

### 8.8 Pattern Obbligatori — Scroll e Navigazione

#### Scroll-Driven Header (Parallax Leggero)

Per schermate con header grande (home):

```ts
// Header title: fade + translateY basato su scrollY
const titleOpacity = interpolate(scrollY.value, [0, 80], [1, 0], 'clamp');
const titleTranslateY = interpolate(scrollY.value, [0, 80], [0, -20], 'clamp');
```

#### Tab Switch

Al cambio tab, il contenuto della nuova tab deve entrare con:

```ts
// Cross-fade: vecchio tab esce, nuovo entra
entering={FadeIn.duration(200)}
exiting={FadeOut.duration(150)}
```

#### Pull-to-Refresh

Animazione custom per il pull-to-refresh (non il default di sistema):
- Icona o mascotte duck che ruota/rimbalza durante il pull
- Spring snap-back al rilascio

#### Navigazione Calendario (Mese Avanti/Indietro)

```ts
// Slide orizzontale + fade
// Avanti: contenuto esce a sinistra, nuovo entra da destra
// Indietro: contenuto esce a destra, nuovo entra da sinistra
// Con cross-fade opacity
duration: 250ms
easing: Easing.out(Easing.cubic)
```

### 8.9 Pattern Obbligatori — Apparizioni e Notifiche

#### Toast Entrata/Uscita

| Fase | Proprieta | Config |
|---|---|---|
| Entrata | `translateY` | spring: damping 18, stiffness 300 (da -30 a 0) |
| Entrata | `scale` | spring: damping 16, stiffness 280 (da 0.92 a 1) |
| Entrata | `opacity` | timing 200ms (0 → 1) |
| Uscita | `opacity` | timing 250ms (1 → 0) |
| Uscita | `translateY` | timing 250ms (0 → -20) |
| Uscita | `scale` | timing 250ms (1 → 0.95) |

#### FAB / Floating Action Button

```ts
// Entrata: scale da 0 con bounce
entering={ZoomIn.springify().damping(12)}
// Uscita:
exiting={ZoomOut.duration(200)}
// Idle: floating loop (come ScrollHintFab)
translateY: loop spring ±7px
```

### 8.10 Pattern Obbligatori — Loading e Progress

#### Skeleton Pulse (Esistente)

```ts
opacity: loop(
  sequence(
    timing(0.9, { duration: 760, easing: Easing.inOut(Easing.quad) }),
    timing(0.42, { duration: 760, easing: Easing.inOut(Easing.quad) }),
  )
)
```

#### Spinner / Activity Indicator

Se serve un loading puntuale (non skeleton), usare un cerchio che ruota con:
- Colore: `colors.primary` (#1A1A2E)
- Size: 24px (inline), 40px (centrato in pagina)
- Animazione: rotazione continua `withRepeat(withTiming(360deg, { duration: 800 }), -1)`

#### Progress Bar Animata

Per azioni con progresso (upload, pagamento in corso):
```ts
width: withTiming(`${progress}%`, { duration: 300, easing: Easing.out(Easing.cubic) })
// Colore: gradient da colors.accent a colors.primary
```

### 8.11 Pattern Consigliati — Delight

Animazioni non obbligatorie ma che aggiungono personalita:

#### Confetti / Sparkle

Dopo un pagamento completato o un traguardo raggiunto. Pattern come `BookingCelebration` ma con variazioni:
- Particelle piu piccole e colorate (navy + giallo + verde)
- Burst radiale piu ampio
- Durata: 1200–1800ms

#### Mascotte Animata

Le immagini duck possono avere micro-animazioni:
- Leggero `rotate` oscillante (±3deg, loop lento 2s)
- Bounce `translateY` ±4px al mount

#### Haptic Feedback

Abbinare animazioni visive con feedback tattile (via `expo-haptics`):

| Azione | Haptic | Animazione visiva |
|---|---|---|
| Tap bottone | `impactAsync(Light)` | Scale spring |
| Prenotazione confermata | `notificationAsync(Success)` | BookingCelebration |
| Errore form | `notificationAsync(Error)` | Shake |
| Toggle chip | `selectionAsync()` | Color transition |
| Drag-to-dismiss release | `impactAsync(Medium)` | Spring snap |

### 8.12 Checklist Animazione per Nuovo Componente

Prima di considerare un componente "finito", verificare:

- [ ] **Press feedback**: ogni `Pressable` ha `scale` spring (0.92–0.98)
- [ ] **Entrata**: il componente ha un'animazione di mount (`entering` o manuale)
- [ ] **Stato toggle**: se ha stati, la transizione e animata (colore, scale, o entrambi)
- [ ] **Lista**: se renderizza N item, ha stagger delay
- [ ] **Loading**: se ha stato loading, usa Skeleton con transizione a contenuto reale
- [ ] **Uscita**: se puo essere rimosso, ha `exiting` (FadeOut minimo)
- [ ] **useNativeDriver**: tutte le animazioni `Animated` core usano `useNativeDriver: true`
- [ ] **Reanimated preferito**: nuovo codice usa `react-native-reanimated`, non `Animated` core
- [ ] **Nessun layout jank**: nessun salto visivo quando il contenuto cambia

### 8.13 Animazioni Esistenti — Reference Completa

Tabella di tutte le animazioni attualmente implementate nel codice:

| Componente | Pattern | Tipo | Config |
|---|---|---|---|
| Button | Press scale | transform | `scale: 0.98` (statico, no spring) |
| SelectableChip | Color toggle | timing | 180ms su bg + border + text |
| SelectableChip | Press opacity | opacity | `0.85` |
| BottomSheet | Drawer open | spring | damping: 22, stiffness: 240 |
| BottomSheet | Drawer close | timing | 260ms translateY |
| BottomSheet | Backdrop in/out | timing | 180ms / 160ms |
| BottomSheet | Drag snap-back | spring | stiffness: 220, damping: 18 |
| BottomSheet | Keyboard offset | timing | durata da evento OS |
| CalendarDrawer | Drawer open | spring | damping: 22, stiffness: 240 |
| CalendarDrawer | Drawer close | timing | 260ms |
| CalendarDrawer | Drag | PanResponder | soglia 120px / 0.9 vy |
| MiniCalendar | Month fade | timing | 220ms opacity |
| MiniCalendar | Month layout | LayoutAnimation | easeInEaseOut |
| TimePickerDrawer | Auto-scroll | scrollTo | 100ms setTimeout |
| ToastNotice | Entrata | spring + timing | damping 16–18, stiffness 280–300, opacity 200ms |
| ToastNotice | Uscita | timing | 250ms opacity + translateY + scale |
| ToastNotice | Auto-dismiss | setTimeout | 2600ms default |
| Skeleton | Pulse | timing loop | 760ms, easeInOut(quad), 0.42↔0.9 |
| BookingCelebration | Full sequence | timing | 1450ms easeOut(cubic) |
| BookingCelebration | Sparkle burst | interpolate | 5 punti radiali |
| BookingCelebration | Ring expansion | interpolate | scale 0.5→1.5, opacity 0→0.4→0 |
| ScrollHintFab | Float loop | spring loop | speed 9–10, bounce 10–12, ±7px |
| ScrollHintFab | Press | transform | `scale: 0.96` |
| SearchableSelect | Dropdown open | timing | 180ms opacity + translateY + scale |
| SearchableSelect | Dropdown close | timing | 120ms |
| RangesEditor | Row enter | FadeIn (reanimated) | 200ms |
| RangesEditor | Row exit | FadeOut (reanimated) | 150ms |

### 8.14 Web — Note per Cross-Platform

Quando queste animazioni vengono portate sulla web app:

| Concetto RN | Equivalente Web | Note |
|---|---|---|
| `react-native-reanimated` | **Framer Motion** o **CSS transitions/animations** | Framer Motion e il piu vicino come API mentale |
| `withSpring` | `transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)` | Cubic-bezier con overshoot per simulare spring |
| `withTiming` | `transition: all <duration>ms <easing>` | Mapping diretto |
| `FadeIn/FadeOut` | `@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }` | O Framer Motion `animate={{ opacity: 1 }}` |
| Stagger | Framer Motion `staggerChildren: 0.06` o `animation-delay: calc(var(--i) * 60ms)` | CSS custom properties per indice |
| `PanResponder` | Drag API HTML5 o `framer-motion` drag | `useDrag` da `@use-gesture/react` per gesture |
| `LayoutAnimation` | CSS `transition` su `height`/`max-height` o Framer `layout` prop | Framer `layout` e il piu fluido |
| Spring physics | `cubic-bezier(0.34, 1.56, 0.64, 1)` (bouncy) o `cubic-bezier(0.22, 1, 0.36, 1)` (gentle) | Approssimare — web non ha spring nativo |
| `Easing.out(Easing.cubic)` | `cubic-bezier(0.33, 1, 0.68, 1)` | Ease-out standard |
| `Easing.inOut(Easing.quad)` | `cubic-bezier(0.45, 0, 0.55, 1)` | Per pulse/skeleton |

**Regola web:** preferire `transform` e `opacity` per trigger GPU compositing. Mai animare `width`, `height`, `padding`, `margin` direttamente — usare `scale` e `translate`.

---

## 9. Piattaforme

| Aspetto | iOS | Android |
|---|---|---|
| Tab bar | `GlassTabBar.ios.tsx` — BlurView nativo, effetto vetro | `GlassTabBar.tsx` — custom, bg bianco, highlight navy |
| Tabs | `NativeTabs` (Expo Router) | Custom tab bar |
| BottomSheet | `BottomSheet.ios.tsx` (implementazione specifica) | `BottomSheet.tsx` |
| Keyboard handling | `keyboardWillShow` + `keyboardWillChangeFrame` + `keyboardDidShow` | `keyboardDidShow` / `keyboardDidHide` |
| LayoutAnimation | Nativo | Richiede `UIManager.setLayoutAnimationEnabledExperimental(true)` |
| Ombre | `shadowColor` + `shadowOpacity` + `shadowRadius` + `shadowOffset` | `elevation` (valore numerico) |

**Regola:** tutto il resto e cross-platform. Niente branching `Platform.OS` nei componenti UI (eccetto BottomSheet e GlassTabBar).

---

## 10. Icone

### 10.1 Icone Vettoriali (UI funzionale)

Libreria: **`@expo/vector-icons` → `Ionicons`**

Uso: navigazione, bottoni, badge di stato, indicatori. Sempre monocromatiche.

| Icona | Size | Contesto |
|---|---|---|
| `time` | 18 | RangesEditor clock circle |
| `trash-outline` | 18 | RangesEditor rimuovi fascia |
| `add-circle` | 18 | RangesEditor aggiungi fascia |
| `search` | 20 | SearchableSelect |
| `checkmark-circle` | 22 / 46 | ToastNotice success / BookingCelebration |
| `information-circle` | 22 | ToastNotice info |
| `alert-circle` | 22 | ToastNotice danger |
| `sparkles` | 18 | BookingCelebration burst |
| `chevron-down` | 19 | ScrollHintFab |

### 10.2 Icone 3D (elementi decorativi e identita visiva)

Libreria: **Microsoft Fluent Emoji 3D** (`assets/icons/`)

Le icone 3D danno personalita e calore all'app. Si usano per decorare card, CTA, statistiche e sezioni tematiche. **Mai** per navigazione o bottoni funzionali piccoli.

**Source:** [github.com/microsoft/fluentui-emoji](https://github.com/microsoft/fluentui-emoji) — cartella `assets/{Nome}/3D/` — PNG 256x256 con trasparenza RGBA.

**Dimensioni standard:**

| Contesto | Size (px) | Esempio |
|---|---|---|
| CTA card (azione principale) | 44x44 | Simulazione, Esercitazione |
| Stat tile (dato numerico) | 32x32 | Accuratezza, Quiz fatti |
| Inline tag / subtitle | 16x16 | "Percorso teoria" sotto il greeting |
| Card navigazione (topic list) | 52x52 | Capitolo nell'elenco argomenti |
| Banner / card orizzontale | 36x36 | Ripassa errori, countdown esame |

**Icone attualmente in uso:**

| File | Emoji | Contesto |
|---|---|---|
| `stat-accuracy.png` | Bullseye | Stat accuratezza risposte |
| `stat-quizzes.png` | Memo | Stat quiz completati |
| `stat-topics.png` | Books | Stat argomenti studiati |
| `stat-countdown.png` | Alarm clock | Countdown esame |
| `cta-exam.png` | Clipboard | CTA Simulazione esame |
| `cta-practice.png` | Graduation cap | CTA Esercitazione |
| `review-retry.png` | Counterclockwise arrows | Ripassa errori |
| `study-books.png` | Books (colorati) | Sfoglia argomenti |
| `tag-theory.png` | Open book | Tag "Percorso teoria" |
| `chapters/chapter-XX.png` | Vari (25 icone) | Icona per capitolo nella lista argomenti |

**Regola:** quando aggiungi una nuova sezione decorativa (card, stat, CTA tematica), cerca sempre prima un'emoji Fluent 3D appropriata. Usa `require('../../assets/icons/...')` con `Image` component, mai URI remoti.

---

## 11. Z-Index Scale

| Livello | Valore | Uso |
|---|---|---|
| ScrollHintFab | `4` | Sopra il contenuto scroll |
| ToastNotice | `50` | Sopra tutto tranne modal |
| SearchableSelect container | `40` | Sopra contenuto form |
| SearchableSelect dropdown | `200` | Sopra tutto nel form |

---

## 12. Gerarchia Visiva — CTA vs Informazioni

### 12.1 Principio Fondamentale

**Le azioni devono essere "forti", i dati devono essere "silenziosi".**

L'utente deve capire a colpo d'occhio cosa e tappabile e cosa e informativo. Mai confondere card azione con card dato — devono essere visivamente opposte.

### 12.2 Card Azione (CTA)

Le CTA usano **ombre esterne concentrate** per sembrare "sollevate" dalla pagina. Invitano al tap.

| Livello | Aspetto | Ombra | Esempio |
|---|---|---|---|
| **CTA Primaria** | `bg: colors.primary`, testo bianco, `borderRadius: 26` | **Nessuna ombra** — il colore pieno fa il lavoro | "Continua a studiare" |
| **CTA Card** | `bg: colors.surface` o `#1A1A2E` (dark), icona 3D 44px, `borderRadius: 26` | `shadowOpacity: 0.14, shadowRadius: 6, height: 3` (concentrata) | Simulazione, Esercitazione |
| **CTA Secondaria** | `bg: colors.surface`, icona 3D 36px, layout orizzontale, `borderRadius: 26` | `shadowOpacity: 0.14, shadowRadius: 6, height: 3` (concentrata) | Ripassa errori |
| **Tile Schede** | bg colorato per stato, `borderRadius: 18` | `shadowOpacity: 0.1, shadowRadius: 5, height: 3` | Griglia schede |

**Press state CTA:** `opacity: 0.9, transform: [{ scale: 0.96 }]`

Ogni CTA card ha un'icona 3D Fluent prominente (44px) in alto a sinistra. L'icona e il primo elemento visivo che l'utente nota.

**Principio ombre concentrate:** `shadowRadius` basso (5-6) + `shadowOffset.height` corto (3) = ombra stretta vicino alla card → effetto 3D "sollevato dal tavolo". Evitare `shadowRadius` > 10 sulle CTA (troppo disperso, sembra alone).

### 12.3 Card Informativa (Stat/Dato)

Le card informative usano **ombre interne (inset shadow)** per sembrare "incassate" nella pagina. Non invitano al tap.

```ts
// Inset shadow nativo (React Native 0.81+)
boxShadow: [
  { offsetX: 0, offsetY: 2, blurRadius: 6, spreadDistance: 0, color: 'rgba(0,0,0,0.12)', inset: true },
  { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: 'rgba(0,0,0,0.06)', inset: true },
],
backgroundColor: '#EEEDEB',  // leggermente piu scuro del background
borderRadius: 20,
```

Stat con icone 3D (32px), numeri grossi (`fontSize: 20, fontWeight: 800`), label muted. Layout orizzontale con divider hairline tra le stat.

### 12.4 Confronto Visivo

| Proprieta | CTA (Azione) | Info (Dato) |
|---|---|---|
| Ombra | **Esterna concentrata** (radius 6, height 3) | **Interna/inset** (boxShadow inset) |
| Background | Bianco o dark (#1A1A2E) | Grigio caldo (#EEEDEB) |
| Border Radius | **26** | **20** |
| Icone 3D | 44px, prominenti | 32-34px, decorative |
| Testo valori | 15px, bold | 14-15px, bold |
| Testo label | 12px, muted | 10px, muted |
| Tappabile | Si | No |

### 12.5 Sezioni e Label

Le sezioni usano label uppercase muted per introdurre gruppi di CTA:

```ts
sectionLabel: {
  fontSize: 13, fontWeight: '700', color: colors.textMuted,
  letterSpacing: 0.5, textTransform: 'uppercase',
  marginBottom: 10,
}
```

Esempio: `PRONTO PER L'ESAME?` sopra le card Simulazione/Esercitazione.

### 12.6 Ordine Gerarchia Home (Top → Bottom)

1. **Greeting** — "Ciao, {nome}" (24px) con subtitle "Percorso teoria" + icona 3D libro (16px)
2. **CTA Primaria** — "Continua a studiare" (navy, full-width, borderRadius 26, **no shadow**)
3. **CTA Card** — Simulazione (dark) + Esercitazione (bianca) affiancate (borderRadius 26, shadow concentrata)
4. **CTA Secondaria** — "Ripassa i tuoi errori" (borderRadius 26, shadow concentrata)
5. **Stats inset** — Accuratezza / Quiz fatti / Argomenti (borderRadius 20, inset shadow, icone 3D 34px, valori 15px)
6. **Countdown** — Esame teoria (se data impostata)
7. **Sezione azionabile** — "Da migliorare" con capitoli deboli (tappabili)

### 12.7 Titoli Pagina

| Schermata | fontSize | fontWeight | letterSpacing |
|---|---|---|---|
| Home quiz ("Ciao, {nome}") | 24 | 600 | -0.3 |
| Lista argomenti ("Studio per Argomento") | 24 | 600 | -0.3 |
| Schede esame ("Schede d'Esame") | 24 | 600 | -0.3 |
| Sezione capitolo ("4. Segnali di obbligo") | 22 | 600 | -0.3 |

**Regola peso:** i titoli grandi/pagina/header/sheet usano **`fontWeight: '600'`** — NON 800 (l'800 risultava un grassetto troppo pronunciato). Vale **ovunque** (large title, header schermate, titoli dei formSheet). I numeri grandi decorativi (countdown esame, valori stat, badge) restano 800. `compactTitle` 600, sottotitoli 500.
**Regola size:** titoli pagina top-level a 24px. Sotto-pagine / titoli sheet a 20-22px. Mai superare 24px per i large title.

---

## 13. Pattern Nativi iOS

### 13.1 iOS Large Title con BlurView

Pattern per schermate con lista scrollabile. Il titolo grande scompare nello scroll e il titolo compatto appare nella barra blur.

```ts
// Header sticky
headerWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }
// iOS: BlurView intensity={80} tint="systemChromeMaterialLight"
// Android: View con backgroundColor rgba(255,255,255,0.92)

// Large title: opacity e translateY interpolati su scrollY
// Compact title: opacity interpolata (appare quando large title scompare)
// Border: hairline che appare con lo scroll
```

Usato in: AllievoTheoryHomeScreen, TopicListScreen, SchedaGridScreen.

### 13.2 Native FormSheet (Expo Router)

Per modali con contenuto adattivo: Expo Router screen con `presentation: 'formSheet'` + `sheetAllowedDetents: 'fitToContents'` + `sheetGrabberVisible: true`. Lo sheet si adatta all'altezza del contenuto e mostra il grabber nativo iOS.

```tsx
// app/(tabs)/home/_layout.tsx
<Stack.Screen
  name="my-sheet"
  options={{
    presentation: 'formSheet',
    sheetAllowedDetents: 'fitToContents',
    sheetGrabberVisible: true,
    headerShown: false,
  }}
/>
```

Per passare dati tra screen e sheet: usare uno store reattivo in `src/stores/` con `useSyncExternalStore`.

**IMPORTANTE:** con `fitToContents` non usare `flex: 1` ne' `ScrollView` nel root — il contenuto deve avere altezza esplicita. Usare `View` per contenuto fisso, `ScrollView` solo per contenuto lungo con detent fissi (es. `[0.7, 0.95]`).

**Schermi migrati a formSheet:**
- `lesson-detail` — dettaglio guida (fitToContents)
- `booking-flow` — prenotazione guida 2 step (fitToContents)
- `quiz-hint` — hint quiz con HTML (fitToContents)

### 13.3 Haptic Feedback

Abbinare sempre animazioni con feedback tattile (`expo-haptics`):

| Azione | Haptic | Quando |
|---|---|---|
| Risposta quiz corretta | `notificationAsync(Success)` | Swipe/tap VERO/FALSO |
| Risposta quiz sbagliata | `notificationAsync(Error)` | Swipe/tap VERO/FALSO |
| Tap bottone generico | `impactAsync(Light)` | Ogni CTA |
| Swipe card | `impactAsync(Light)` | Al rilascio swipe |

---

## 14. Regole e Divieti

### Da fare

- Usare **sempre** i token da `src/theme/` per colori, tipografia, spacing, radii
- Usare i componenti esistenti in `src/components/` — comporli, non duplicarli
- Per azioni rapide: **Modal centrata**. Per contenuti scrollabili: **FormSheet nativo** via Expo Router (`presentation: 'formSheet'`)
- Per hint/dettagli scrollabili: **FormSheet nativo** (mai BottomSheet custom, mai `<Modal>` inline)
- Avvolgere card con gradient in un `View` wrapper per l'ombra (l'ombra non funziona con `overflow: 'hidden'`)
- Touch target minimo: **44x44px** (rispettato da day cell calendario, bottoni freccia, chip)
- Animazioni: usare `useNativeDriver: true` dove possibile
- Ombre: specificare sempre **sia** `shadowColor/Opacity/Radius/Offset` (iOS) **sia** `elevation` (Android)
- **Icone 3D Fluent** per elementi decorativi: CTA card, stat, sezioni tematiche, topic list
- **Icone Ionicons** per UI funzionale: navigazione, bottoni, badge stato
- **Inset shadow** (`boxShadow` con `inset: true`) per card informative non tappabili
- **Ombre esterne** per CTA e card tappabili
- **Gerarchia CTA chiara**: la distanza visiva tra azioni e informazioni deve essere evidente (vedi sezione 12)
- **Colore Reglo solo per CTA**: navy (#1A1A2E) riservato a bottoni primari, tab bar attiva, piccoli tag. Mai per sfondi grandi o card informative
- **iOS Large Title** per schermate con lista: BlurView header + titolo che collassa
- **FormSheet nativi = niente grabber, X in alto a destra.** Nel route: `sheetGrabberVisible: false`. Nello screen, come PRIMO figlio del root: un `topBar` con la pill X (`closeBtn` 34×34, bg `#E2E8F0`, `Ionicons name="close"` → `router.back()`). Pattern di riferimento: `app/(tabs)/home/swap-lesson.tsx`. Vale per TUTTI i formSheet (mai l'handle nativo).
- **Liste = righe FLAT sullo sfondo** (icona + testo + chevron/`•••`), separate da divider hairline. La card si usa **solo per elementi singoli/standalone** (es. hero profilo, "Sede principale"). Vedi `MoreScreen.tsx`, `LocationsScreen.tsx`.
- **Azioni per riga in un menu nativo** (`ActionSheetIOS` / `Alert` su Android), non bottoni inline dentro la riga — la riga resta pulita. **Tap sulla riga = azione primaria** (es. apri il formsheet di modifica); il `•••` apre il menu secondario (Maps/Elimina).
- **"Aggiungi" / "Nuovo" = icona `+` nell'header** (alto a destra), pattern mobile nativo. Mai un bottone "Aggiungi" piazzato in mezzo alla pagina.
- **Testo visivamente leggero**: righe di lista / voci / body → `'400'`; titoli e nomi → `'500'`–`'600'` max. Mai `'700'`/`'800'` (vedi §2). Confronto di riferimento: Airbnb.

### Da NON fare

- **Non** wrappare una **lista in una card** (card bianca con dentro N righe). Le liste vanno flat sullo sfondo con divider hairline; la card è solo per item singoli/standalone.
- **Non** mettere bottoni di azione inline dentro ogni riga di lista (Maps/Modifica/Elimina ecc.) — usare un menu nativo aperto dalla riga.
- **Non** usare font-weight pesanti (`700`/`800`) né `600` su righe di lista/body — l'utente vuole leggerezza visiva.

- **Non** usare `BlurView` / `expo-blur` eccetto negli header sticky (iOS Large Title pattern) e `GlassTabBar.ios.tsx`
- **Non** creare nuovi primitivi — estendi quelli esistenti
- **Non** hardcodare colori senza motivo — usa i token da `colors.ts`
- **Non** usare radii arbitrari — segui la scala: `radii.sm` (20), `radii.lg` (35), `999` (pill), o valori inline documentati
- **Non** usare BottomSheet per contenuti read-only — preferisci PageSheet nativo
- **Non** approssimare i valori Figma — riproduci esattamente dimensioni, colori, spacing
- **Non** usare class component — solo functional component con hooks
- **Non** animare `width`/`height` — usare `transform` e `opacity` per performance
- **Non** usare Ionicons dove serve personalita visiva — usa icone 3D Fluent
- **Non** usare icone 3D Fluent per bottoni funzionali piccoli (nav, close, chevron)
- **Non** dare ombre esterne a card informative — usare inset shadow
- **Non** dare inset shadow a CTA — usare ombre esterne
- **Non** usare colore navy per sfondi grandi, card informative, o elementi non interattivi
