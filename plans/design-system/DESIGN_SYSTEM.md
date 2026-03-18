# Reglo Mobile — Design System Reference

> Fonte di verità per ogni lavoro UI nell'app. Segui queste regole **prima** di scrivere codice.

---

## 1. Palette colori

### Brand
| Token | Valore | Uso |
|---|---|---|
| `colors.primary` | `#EC4899` (rosa) | CTA principali, bottoni primari, tint tab bar, focus input |
| `colors.accent` | `#FACC15` (giallo) | Card "prossima guida", day pill selezionato, azioni secondarie |
| `colors.destructive` | `#EF4444` | Errori, annullamenti, azioni distruttive |
| `colors.positive` | `#22C55E` | Successo, conferme, stati completati |

### Regola d'oro: **70% neutri / 20% rosa / 10% giallo**

### Neutri
| Token | Valore | Uso |
|---|---|---|
| `colors.textPrimary` | `#1F2937` | Testo principale, titoli |
| `colors.textSecondary` | `#6B7280` | Testo secondario, descrizioni |
| `colors.textMuted` | `#9CA3AF` | Placeholder, label terziarie |
| `colors.border` | `#E5E7EB` | Bordi card, separatori |
| `colors.surface` | `#FFFFFF` | Sfondo card |
| `colors.background` | `#FFFFFF` | Sfondo pagina |

### Scale (accesso diretto)
- **Rosa**: `colors.pink[50]` → `colors.pink[700]` (da `#FDF2F8` a `#BE185D`)
- **Giallo**: `colors.yellow[50]` → `colors.yellow[700]` (da `#FEFCE8` a `#A16207`)

### Colori di stato
| Token | Valore | Uso |
|---|---|---|
| `colors.statusScheduledText` | `#CA8A04` | Testo "Programmato" |
| `colors.statusScheduledBg` | `#FEF9C3` | Background badge programmato |
| `colors.statusCompletedText` | `#64748B` | Testo stato completato |

### Colori ausiliari (usati inline, non tokenizzati)
- Sfondo slate chiaro: `#F8FAFC`
- Bordo slate: `#E2E8F0`
- Testo slate scuro: `#0F172A`, `#1E293B`
- Testo slate medio: `#64748B`, `#94A3B8`
- Ambra ombre: `#B45309`, `#D97706`

---

## 2. Border Radius

Definiti in `src/theme/spacing.ts` → `radii`:

| Token | Valore | Quando usarlo |
|---|---|---|
| `radii.sm` | `20` | Bottoni, input, chip, day pill calendario, picker, badge, elementi piccoli |
| `radii.lg` | `35` | Card grandi (prossima guida, agenda, Card primary), CTA hero |

**Regola**: se l'elemento è un contenitore grande (card, sezione) → `radii.lg`. Se è un controllo interattivo o un elemento inline → `radii.sm`.

---

## 3. Spacing

Definiti in `src/theme/spacing.ts`:

| Token | Valore |
|---|---|
| `spacing.xs` | 6 |
| `spacing.sm` | 10 |
| `spacing.md` | 16 |
| `spacing.lg` | 22 |
| `spacing.xl` | 28 |
| `spacing.xxl` | 36 |

---

## 4. Typography

Definiti in `src/theme/typography.ts`:

| Token | Size | Weight | Uso |
|---|---|---|---|
| `typography.title` | 28 | 700 | Titoli pagina ("Ciao, Gabriele") |
| `typography.subtitle` | 18 | 600 | Titoli card, sezioni |
| `typography.body` | 15 | 500 | Testo corrente, label bottoni |
| `typography.caption` | 12 | 600 | Badge, label piccole, metadata |

---

## 5. Ombre

### Card grande (prossima guida, card accent)
```ts
shadowColor: '#B45309',   // ambra scuro
shadowOpacity: 0.35,
shadowRadius: 20,
shadowOffset: { width: 0, height: 10 },
elevation: 10,
```
> Se la card ha `overflow: 'hidden'` (es. per gradient), avvolgila in un `View` wrapper con l'ombra e il `borderRadius`.

### Card agenda / card standard
```ts
shadowColor: '#000',
shadowOpacity: 0.06,
shadowRadius: 10,
shadowOffset: { width: 0, height: 4 },
elevation: 3,
```

### CTA rosa (bottone hero)
```ts
shadowColor: '#EC4899',
shadowOpacity: 0.3,
shadowRadius: 12,
shadowOffset: { width: 0, height: 6 },
elevation: 6,
```

### Day pill calendario (selezionato)
```ts
shadowColor: '#D97706',
shadowOpacity: 0.18,
shadowRadius: 6,
shadowOffset: { width: 0, height: 3 },
elevation: 3,
```

### Modal overlay
```ts
// Backdrop
backgroundColor: 'rgba(0, 0, 0, 0.35)'

// Card modale
shadowColor: 'rgba(0, 0, 0, 0.12)',
shadowOpacity: 0.2,
shadowRadius: 24,
shadowOffset: { width: 0, height: 12 },
elevation: 16,
```

### Ombra generica leggera (bottoni, input)
```ts
shadowColor: 'rgba(0, 0, 0, 0.08)',
shadowOpacity: 0.08,
shadowRadius: 4,
shadowOffset: { width: 0, height: 2 },
elevation: 2,
```

---

## 6. Componenti primitivi

Tutti in `src/components/`. **Non creare nuovi primitivi** — usa questi.

| Componente | File | Note |
|---|---|---|
| `Card` | `Card.tsx` | hierarchy: primary/secondary/tertiary. variant: default/dark |
| `Button` | `Button.tsx` | tone: primary/standard/danger/secondary. `fullWidth` prop |
| `Input` | `Input.tsx` | Focus border → `colors.primary` |
| `Badge` | `Badge.tsx` | tone: default (rosa)/success/warning/danger |
| `BottomSheet` | `BottomSheet.tsx` / `.ios.tsx` | Drawer dal basso (usare solo per contenuti complessi con scroll) |
| `Screen` | `Screen.tsx` | Wrapper SafeArea, sfondo bianco |
| `Skeleton` | `Skeleton.tsx` | `SkeletonBlock` + `SkeletonCard` per loading |
| `ToastNotice` | `ToastNotice.tsx` | tone: success/info/danger |
| `SelectableChip` | `SelectableChip.tsx` | Attivo: bg `#1F2937` + testo bianco |
| `SectionHeader` | `SectionHeader.tsx` | Titolo sezione con action pill opzionale |
| `BookingCelebration` | `BookingCelebration.tsx` | Animazione conferma prenotazione |
| `ScrollHintFab` | `ScrollHintFab.tsx` | Fab per scroll up/down |
| `SearchableSelect` | `SearchableSelect.tsx` | Input con dropdown suggerimenti |
| `CalendarNavigator` | `CalendarNavigator.tsx` | Navigazione settimana/mese (usato in schermate istruttore/titolare) |

---

## 7. Pattern UI

### Modali centrate (preferite rispetto ai BottomSheet)
Per azioni rapide (proposte, conferme, form brevi) usare un `<Modal transparent animationType="fade">` con card centrata:

```tsx
<Modal transparent animationType="fade" visible={open} onRequestClose={close}>
  <View style={styles.modalOverlay}>
    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>Titolo</Text>
      {/* Info card gialla per proposte */}
      <View style={styles.modalInfoCard}>
        <Text style={styles.modalInfoLabel}>Label dorata</Text>
        <Text style={styles.modalInfoDateTime}>Data • Ora</Text>
        <Text style={styles.modalInfoMeta}>Dettaglio</Text>
      </View>
      {/* Azioni */}
      <Button label="Azione primaria" tone="primary" fullWidth />
      <Button label="Azione secondaria" tone="standard" fullWidth />
      <Pressable><Text style={styles.modalTextActionLabel}>Azione rossa</Text></Pressable>
    </View>
  </View>
</Modal>
```

**Stili modale**:
- `modalOverlay`: flex center, backdrop `rgba(0,0,0,0.35)`
- `modalCard`: bg bianco, `borderRadius: 24`, padding 24, gap 16, ombra forte
- `modalInfoCard`: bg `#FEF9C3`, border `#FDE68A`, borderRadius 16
- `modalTextActionLabel`: rosso `#EF4444`, bold, centrato (per "Rifiuta")

### Card "Prossima guida" (gradient giallo)
Usa `LinearGradient` da `expo-linear-gradient`:
```tsx
<View style={styles.nextLessonShadow}>
  <LinearGradient
    colors={['#FACC15', '#FDE68A']}
    start={{ x: 0, y: 0 }}
    end={{ x: 0.8, y: 1 }}
    style={styles.nextLessonCard}
  >
    {/* contenuto con testo bianco */}
  </LinearGradient>
</View>
```
Il wrapper esterno porta l'ombra ambra, il gradient interno ha `overflow: 'hidden'`.

### CTA Hero (bottone grande rosa)
Pressable custom (non il componente Button) con `minHeight: 58`, `fontSize: 18`, `borderRadius: radii.sm`, ombra rosa.

### Calendario orizzontale (day picker)
ScrollView orizzontale con pill da 58×72px, borderRadius 16. Giorno selezionato: bg `#FEF9C3` + border `#FACC15` + ombra ambra. Scroll automatico al centro del giorno selezionato via `onLayout` (mount) e `useEffect` (tap).

### Dettaglio guida (modale)
Card centrata con: header (titolo + ×), info card grigia (`#F8FAFC`), sezioni ISTRUTTORE / VEICOLO / PAGAMENTO con label uppercase `#94A3B8` 12px e valori bold `#1E293B` 14px.

---

## 8. Animazioni

- Libreria: `react-native-reanimated` per animazioni performanti
- Press effect su bottoni: `scale: 0.98`
- Transizioni modale: `animationType="fade"` (nativo RN)
- Celebrazione prenotazione: `BookingCelebration` (sparkles + checkmark animato)

---

## 9. Piattaforme

- **iOS**: `NativeTabs` + `GlassTabBar.ios.tsx` (glass nativa mantenuta per tab bar)
- **Android**: Tab bar custom in `GlassTabBar.tsx` (bg bianco, highlight rosa)
- **Comune**: tutto il resto è cross-platform, niente branching `Platform.OS` nei componenti UI

---

## 10. Cosa NON fare

- **Non** usare `BlurView` o `expo-blur` (rimosso dal design system, eccetto `GlassTabBar.ios.tsx`)
- **Non** creare nuovi primitivi — estendi quelli esistenti
- **Non** hardcodare colori — usa sempre i token da `src/theme/colors.ts`
- **Non** hardcodare border radius — usa `radii.sm` o `radii.lg`
- **Non** usare BottomSheet per azioni rapide — preferisci modali centrate
- **Non** approssimare i valori Figma — riproduci esattamente dimensioni, colori, spacing
