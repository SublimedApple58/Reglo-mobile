"""Auto rossa su bianco (Gemini) -> PNG trasparenti auto-34-<colore>{,@2x,@3x}.png.

python3 scripts/auto-colori.py <auto-rossa.png|jpeg> assets/road/cars
Ricetta e prompt: docs/design-system.md §0.9 «Copertine e auto» (REG-793).
Il corpo rosso (componente rossa più grande) prende il colore del veicolo
mantenendo luci e ombre; la L rossa sul cartello resta rossa.
"""
import sys, colorsys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.float32) / 255.0
H, W, _ = a.shape

# 1) sfondo: bianco quasi puro collegato ai bordi
mx, mn = a.max(2), a.min(2)
white = (mn > 0.90) & (mx - mn < 0.06)
lab, _ = ndimage.label(white)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
fg = ~bg
fg = ndimage.binary_fill_holes(fg)
fg = ndimage.binary_opening(fg, iterations=2)
# tieni solo l'oggetto principale
lab2, n2 = ndimage.label(fg)
if n2 > 1:
    sizes = ndimage.sum(fg, lab2, range(1, n2 + 1))
    fg = lab2 == (1 + int(np.argmax(sizes)))
alpha = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
alpha = np.asarray(alpha).astype(np.float32) / 255.0
alpha = np.clip((alpha - 0.15) / 0.85, 0, 1)

# 2) corpo rosso: solo tinta rossa satura (esclude paraurti marrone, fari gialli,
#    gomme scure, cartello crema); poi i riflessi rosati collegati al corpo
hsv = np.asarray(im.convert('HSV')).astype(np.float32)
hh, ss, vv = hsv[..., 0], hsv[..., 1], hsv[..., 2]
redhue = (hh <= 14) | (hh >= 245)
red = redhue & (ss >= 110) & (vv >= 60) & fg
red = ndimage.binary_opening(red, iterations=1)
lab3, n3 = ndimage.label(red)
sizes = ndimage.sum(red, lab3, range(1, n3 + 1))
big = sizes.max()
body = np.isin(lab3, [i + 1 for i, sz in enumerate(sizes) if sz > 0.05 * big])
soft = ((hh <= 16) | (hh >= 240)) & (ss >= 60) & (vv >= 150) & fg
body = ndimage.binary_propagation(body, mask=soft | body)
v = mx
# bordo morbido del corpo per non lasciare aloni rossi
bodyw = ndimage.gaussian_filter(body.astype(np.float32), 1.0)
vref = float(np.median(v[body]))
factor = v / max(vref, 1e-6)

TARGETS = {
    'bianco': (243, 240, 236, 0.55),
    'argento': (212, 213, 214, 0.7),
    'grigio': (145, 147, 149, 0.9),
    'nero': (62, 62, 64, 1.0),
    'rosso': None,
    'arancio': (232, 112, 40, 1.0),
    'giallo': (240, 190, 40, 1.0),
    'verde': (52, 150, 100, 1.0),
    'azzurro': (90, 176, 212, 1.0),
    'blu': (36, 70, 140, 1.0),
}

def save(rgb, name):
    rgba = np.dstack([np.clip(rgb, 0, 1), alpha])
    img = Image.fromarray((rgba * 255).round().astype(np.uint8), 'RGBA')
    img = img.crop(img.getbbox())
    for scale, (cw, ch) in (('@3x', (240, 195)), ('@2x', (160, 130)), ('', (80, 65))):
        pad = round(cw * 0.02)
        k = min((cw - 2 * pad) / img.width, (ch - 2 * pad) / img.height)
        t = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        canvas.paste(t, ((cw - t.width) // 2, ch - pad - t.height), t)
        canvas.save(f'{out}/auto-34-{name}{scale}.png', optimize=True)

for name, tgt in TARGETS.items():
    if tgt is None:
        rgb = a
    else:
        tr, tg, tb, k = tgt
        f = 1 + k * (factor - 1)
        col = np.stack([np.full((H, W), tr / 255), np.full((H, W), tg / 255), np.full((H, W), tb / 255)], -1) * f[..., None]
        # riflessi: un po' di bianco dove l'originale era molto chiaro
        rgb = a * (1 - bodyw[..., None]) + col * bodyw[..., None]
    save(rgb, name)
    print('ok', name)
