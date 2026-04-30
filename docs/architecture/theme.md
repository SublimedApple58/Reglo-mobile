# Theme & Design System

## Reference
`plans/design-system/DESIGN_SYSTEM.md` — read before any UI changes.

## Files
- `src/theme/colors.ts` — brand pink #EC4899, yellow #FACC15, scales 50-700
- `src/theme/typography.ts` — title (28/700), subtitle (18/600), body (15/500), caption (12/600)
- `src/theme/spacing.ts` — xs:6, sm:10, md:16, lg:22, xl:28, xxl:36. Radii: sm:20, lg:35

## Color rule
70% neutrals / 20% pink / 10% yellow

## Shadow presets (defined in DESIGN_SYSTEM.md)
base, card, drawer, CTA pink, card accent amber, day pill, toast, celebration, dropdown, range row

## Usage
Imported by 32 screens + 20 components. Theme token changes affect the entire app visually.
