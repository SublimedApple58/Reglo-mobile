# Collapsible Hero Screen Pattern

Pattern riutilizzabile per tutte le home screen degli allievi (TEORIA, PRATICA, PATENTATO, AWAITING).
Implementazione di riferimento: `src/screens/AllievoTheoryHomeScreen.tsx`.

---

## Layout Structure

```
+---------------------------------------------+
|  (status bar)                                |  <- behind hero gradient
|  "Ciao, Nome"        (white, text-shadow)    |  <- heroGreeting
|  [Label]             (primary bg, small pill) |  <- heroLabel
|                                              |
|           DUCK IMAGE                         |  <- heroImage (resizeMode: contain)
|           (centered, phase-specific)         |
|                                              |
|  ░░░░░ FADE GRADIENT ░░░░░░░░░░░░░░░░░░░░░  |  <- transparent -> colors.background
+─────── SHEET (borderTopRadius: 36) ─────────+
|                                              |
|  [ Card content ]                            |  <- cards on colors.surface
|  [ Card content ]                            |
|  [ Shortcut ] [ Shortcut ]                   |
|                                              |
+---------------------------------------------+
```

## Three Layers (z-order)

1. **Hero** (z=0) — position absolute, behind everything. Animated with parallax + fade.
2. **ScrollView** (z=1) — transparent background, content scrolls over the hero.
3. **Sticky header** (z=2) — position absolute top, fades in when hero collapses.

## Constants

```typescript
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = Math.min(SCREEN_HEIGHT * 0.50, 450);
const HEADER_BAR_HEIGHT = 56;
const FADE_HEIGHT = 100;
```

- `HERO_HEIGHT`: 50% of screen, capped at 450px
- `HEADER_BAR_HEIGHT`: height of the collapsed sticky header bar (below safe area)
- `FADE_HEIGHT`: height of the dissolve gradient at the bottom of the hero
- `collapsedHeight = insets.top + HEADER_BAR_HEIGHT` (computed at runtime)
- `scrollRange = HERO_HEIGHT - collapsedHeight` (distance over which collapse animation runs)

## Scroll-Driven Animations (Reanimated, UI thread)

### Hero

```typescript
heroStyle = useAnimatedStyle(() => ({
  transform: [
    { translateY: interpolate(scrollY, [0, scrollRange], [0, -scrollRange * 0.5], CLAMP) },
    { scale: interpolate(scrollY, [-100, 0], [1.15, 1], CLAMP) },
  ],
  opacity: interpolate(scrollY, [0, scrollRange * 0.7], [1, 0], CLAMP),
}));
```

- **Parallax**: hero moves up at half the scroll speed
- **Overscroll zoom**: pull down -> hero scales to 1.15x (elastic feel)
- **Fade**: hero fades out at 70% of scroll range

### Sticky Header

```typescript
stickyStyle = useAnimatedStyle(() => ({
  opacity: interpolate(scrollY, [scrollRange * 0.5, scrollRange * 0.85], [0, 1], CLAMP),
  transform: [
    { translateY: interpolate(scrollY, [scrollRange * 0.5, scrollRange * 0.85], [8, 0], CLAMP) },
  ],
}));
```

- Fades in + slides up during the last 35% of the scroll range
- `pointerEvents="none"` so it doesn't block scroll touches

## Hero Composition

```
<Animated.View style={[hero, { height: HERO_HEIGHT, paddingTop: insets.top }, heroStyle]}>
  <LinearGradient colors={['#FAE0EF', '#F5E6EE']} absoluteFill />   <- pink gradient bg
  <Text style={heroGreeting}>Ciao, {firstName}</Text>                <- white, weight 800, text-shadow
  <View style={heroLabel}><Text>Teoria</Text></View>                 <- primary bg pill
  <Image source={duckImage} resizeMode="contain" />                  <- phase-specific duck
  <LinearGradient colors={['transparent', colors.background]} />     <- dissolve fade
</Animated.View>
```

### Hero Gradient Background

Per-phase colors (to be defined for other phases):

| Phase     | Gradient                        |
|-----------|---------------------------------|
| TEORIA    | `['#FAE0EF', '#F5E6EE']` (pink) |
| PRATICA   | TBD                             |
| PATENTATO | TBD                             |
| AWAITING  | TBD                             |

### Duck Assets

Located in `assets/ducks/`:

| Phase     | Asset file             |
|-----------|------------------------|
| TEORIA    | `duck-step-theory.png` |
| PRATICA   | `duck-step-pratica.png`|
| PATENTATO | `duck-step-patentato.png` |
| AWAITING  | `duck-step-awaiting.png`  |

### Hero Label

Per-phase label configuration:

| Phase     | Icon             | Text       |
|-----------|------------------|------------|
| TEORIA    | `book-outline`   | Teoria     |
| PRATICA   | `car-outline`    | Pratica    |
| PATENTATO | `trophy-outline` | Patentato  |
| AWAITING  | `hourglass-outline` | In attesa |

## Sheet (Content Container)

```typescript
sheet: {
  backgroundColor: colors.background,   // #F8F7F4 — matches root bg, no color mismatch
  borderTopLeftRadius: 36,
  borderTopRightRadius: 36,
  marginTop: -spacing.xs,               // slightly overlaps the fade zone
  paddingTop: spacing.lg,
  paddingHorizontal: spacing.md,
  paddingBottom: spacing.xxl * 3,        // extends well past tab bar
  gap: spacing.md,
  shadowColor: 'rgba(0, 0, 0, 0.08)',
  shadowOffset: { width: 0, height: -4 },  // shadow upward
  shadowOpacity: 1,
  shadowRadius: 16,
  elevation: 4,
}
```

Key rules:
- Background MUST be `colors.background` (not `colors.surface`) to avoid color mismatch when scrolling
- Shadow points upward (`height: -4`) for sheet-over-hero depth
- `paddingBottom` large enough so content doesn't cut off before tab bar

## Cards Inside Sheet

```typescript
card: {
  backgroundColor: colors.surface,       // white — pops against sheet bg
  borderRadius: 24,
  padding: spacing.lg,                   // 22
  shadowColor: 'rgba(0, 0, 0, 0.16)',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 1,
  shadowRadius: 18,
  elevation: 4,
  gap: 8,
}
```

## CTA Pill Button

```typescript
cta: {
  height: 52,
  borderRadius: 26,                      // full pill
  backgroundColor: colors.primary,
  shadowColor: 'rgba(236, 72, 153, 0.45)',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 1,
  shadowRadius: 18,
  elevation: 5,
}
ctaPressed: {
  opacity: 0.95,
  transform: [{ scale: 0.97 }],         // tactile press feedback
}
```

## Shortcut Cards

```typescript
shortcut: {
  backgroundColor: colors.surface,
  borderRadius: 24,
  padding: spacing.lg,
  shadowColor: 'rgba(0, 0, 0, 0.14)',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 1,
  shadowRadius: 14,
  elevation: 3,
}
```

## Scroll Content Padding

```typescript
contentContainerStyle: {
  paddingTop: HERO_HEIGHT - FADE_HEIGHT * 0.3,  // content starts near bottom of hero
  paddingBottom: spacing.md,
  gap: spacing.md,
}
```

## Sticky Collapsed Header

```typescript
<Animated.View style={[stickyHeader, { height: collapsedHeight, paddingTop: insets.top }, stickyStyle]}>
  <LinearGradient colors={[colors.primary, '#DB2777']} diagonal />
  <Text>Ciao, {firstName}</Text>    // white
  <Text>Teoria</Text>               // white 80% opacity
</Animated.View>
```

## Entrance Animations

Cards use staggered `FadeInUp` from `react-native-reanimated`:

```typescript
entering={FadeInUp.delay(N).duration(280)}
```

Stagger pattern (60ms base increment), adapts based on visible sections:
- First card: 60ms
- Second card: 100-120ms
- Third element: 160ms

## Do NOT Use

- `<Screen>` component — this pattern handles safe area and background manually
- `PhaseProgressBar` — replaced by the hero + label system
- `overflow: 'hidden'` on the hero — clips the greeting text

## Phase-Specific Content

Each phase has different content inside the sheet. Only the hero + sheet structure is shared.

| Phase     | Sheet Content |
|-----------|--------------|
| TEORIA    | Countdown (if exam date), Milestone card + CTA, Shortcuts (Simulazione, Capitoli) |
| PRATICA   | TBD |
| PATENTATO | TBD |
| AWAITING  | TBD |
