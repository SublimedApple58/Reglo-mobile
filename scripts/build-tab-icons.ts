/**
 * REG-800 — genera i PNG delle icone della tab bar iOS da `src/theme/tabIconArt.ts`.
 *
 *   npx tsx scripts/build-tab-icons.ts
 *
 * Scrive `assets/tab-icons/<chiave>.png` (a riposo, tratto grigio) e
 * `<chiave>-on.png` (accesa, a colori) in @1x/@2x/@3x. Le tab native di iOS le
 * mostrano a colori originali (patch di expo-router, vedi
 * `patches/expo-router+*.patch`), quindi il grigio è già dentro l'immagine.
 *
 * Il rasterizzatore è `sharp` del repo web (`../reglo` dalla copia principale,
 * `../../reglo` da un worktree): il mobile non lo ha tra le dipendenze.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { TAB_ICON_COLOR, TAB_ICON_KEYS, TAB_ICON_OFF, TAB_ICON_OUTLINE, TAB_ICON_SIZE } from '../src/theme/tabIconArt';

const root = path.resolve(__dirname, '..');
const webCandidates = [path.resolve(root, '../reglo'), path.resolve(root, '../../reglo')];
const web = webCandidates.find((p) => existsSync(path.join(p, 'node_modules/sharp')));
if (!web) {
  console.error('sharp non trovato: serve il repo web con node_modules in', webCandidates.join(' o '));
  process.exit(1);
}
type Sharp = (input: Buffer, opts?: { density?: number }) => {
  resize: (w: number, h: number) => { png: () => { toFile: (file: string) => Promise<unknown> } };
};
const sharp = createRequire(path.join(web, 'package.json'))('sharp') as Sharp;

const out = path.join(root, 'assets/tab-icons');
mkdirSync(out, { recursive: true });

async function render(svg: string, file: string, scale: number) {
  const px = TAB_ICON_SIZE * scale;
  // Densità alta e poi riduzione: bordi puliti anche a @1x.
  await sharp(Buffer.from(svg), { density: 72 * scale * 4 })
    .resize(px, px)
    .png()
    .toFile(path.join(out, file));
}

async function main() {
  for (const key of TAB_ICON_KEYS) {
    const off = TAB_ICON_OUTLINE[key].replace(/currentColor/g, TAB_ICON_OFF);
    const on = TAB_ICON_COLOR[key];
    for (const scale of [1, 2, 3]) {
      const suffix = scale === 1 ? '' : `@${scale}x`;
      await render(off, `${key}${suffix}.png`, scale);
      await render(on, `${key}-on${suffix}.png`, scale);
    }
  }
  console.log(`PNG scritti in ${path.relative(root, out)} (${TAB_ICON_KEYS.length} icone × 2 stati × 3 scale)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
