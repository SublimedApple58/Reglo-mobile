# Tab bar — iOS nativa Liquid Glass + set icone Reglo (REG-800)

Regole visive e tabella delle icone: `docs/design-system.md` §6.19. Qui i file e il funzionamento.

## Come funziona

- `app/(tabs)/_layout.tsx` decide la barra (`TabBarKind`):
  - **iOS → `native`**: `NativeTabs` di `expo-router/unstable-native-tabs` (UITabBar di react-native-screens 4.16; su iOS 26 il vetro Liquid Glass di sistema). Le voci sono `NativeTabs.Trigger` nell'ordine `TAB_ORDER`, solo quelle visibili (la prima visibile è la tab d'avvio). Icone `Icon src={{ default, selected }}` dai PNG, etichetta `Label`, badge `Badge` su Notifiche solo con non lette.
  - **Android → `js`**: `Tabs` con `AppTabBar` (barra JS), come prima, con gli stessi disegni in SVG.
  - **Una voce sola (allievo in attesa/patentato) → `none`**: `Tabs` senza barra, scena con la sola safe area in fondo.
  - Su iOS la barra nativa, una volta montata, resta fino al riavvio anche se si scende a una voce sola (smontarla a caldo fa scattare `assertExactlyOneFocusedTab` di react-native-screens).
- `TabSceneContext` (in `src/components/tabBarSpace.ts`) porta il tipo di barra e le radici «sotto il vetro» alle schermate.
- Icone: `src/theme/tabIconArt.ts` (SVG, sorgente unica) → Android `SvgXml`; iOS PNG in `assets/tab-icons/` generati da `scripts/build-tab-icons.ts`, mappati in `src/components/tabIcons.ts` (`TAB_ICON_PNG`, `tabIconKey`).
- `patches/expo-router+6.0.23.patch`: le immagini delle tab native vanno come `imageSource` (colori originali) invece di `templateSource` (tinta della barra). Tutto JS → passa con l'OTA, niente build nativa.

## Spazio sotto la barra (iOS)

- Radici sotto il vetro (`underGlass`: Oggi, Road, Allievi, Tu, Guide, Scambi; Home tranne allievo in teoria/attesa/patentato) → `useTabBarOverlap()` (con la barra nativa vale per tutti i ruoli).
- Pagine push negli stack delle tab → `useTabStackOptions(tab, STACK_OPTIONS)` in ogni `app/(tabs)/<tab>/_layout.tsx`, lista `TAB_FULL_PAGES`. **Una pagina push nuova va aggiunta lì.**
- Tab senza stack (`inbox.tsx`) → `useTabRootPadding`.
- Altezza barra nativa: `NATIVE_TAB_BAR_BODY` (49) + safe area + eventuale «Torna in Road».

## Road e Agenda

- `RoadMiniBar` (REG-700) su iOS galleggia sopra la barra nativa (`NativeRoadMiniBar` nel layout), la sua altezza entra in `useTabBarHeight` (`setTabBarMiniHeight`).
- Barra del blocco fantasma (`src/components/agenda/ghost.tsx`): con la barra nativa non la copre, le sta sopra (`bottom = barOverlap`).
- `NotificationOverlay`: la campanella del titolare apre `today/notifications` (la tab Notifiche è nascosta e con la barra nativa una tab nascosta non si apre).

## Limiti noti

- Etichette spente: su iOS 26 nere di sistema (il grigio di `labelStyle` è ignorato).
- `minimizeBehavior="onScrollDown"` non scatta con react-native-screens 4.16 (da riprovare con SDK 55, che ha anche `bottomAccessory` per la «Torna in Road»).
- Con NativeTabs tutte le tab visibili si montano all'avvio (le JS erano pigre).
- In build di sviluppo un cambio composto delle voci ad app aperta (es. ruolo forzato da istruttore a titolare) ha fatto scattare l'asserzione di react-native-screens (solo `!NDEBUG`); un inserimento semplice («Oggi» che compare) no.

## File

`app/(tabs)/_layout.tsx`, `app/(tabs)/*/_layout.tsx`, `app/(tabs)/inbox.tsx`, `src/components/AppTabBar.tsx`, `src/components/tabBarSpace.ts`, `src/components/tabIcons.ts`, `src/theme/tabIconArt.ts`, `assets/tab-icons/*`, `scripts/build-tab-icons.ts`, `patches/expo-router+6.0.23.patch`, `src/components/agenda/ghost.tsx`, `src/components/NotificationOverlay.tsx`.
