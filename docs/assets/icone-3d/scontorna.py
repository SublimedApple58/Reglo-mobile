"""
Scontorna un'icona 3D generata su bianco puro → PNG trasparente 1x/@2x/@3x.

Metodo usato il 28/10/2026 per le icone `assets/vita/` (design-system §0.9):
1. soggetto = maschera di macOS Vision (`mask.swift`, ritaglio del soggetto)
   unita ai pixel colorati o scuri; i buchi interni piccoli restano
   trasparenti (anelli, spazi fra le razze), quelli grandi si riempiono solo
   se indicati con --riempi-buchi;
2. fuori dal soggetto il bianco diventa alfa («color to alpha»): l'ombra di
   contatto resta come velo grigio semitrasparente;
3. l'ombra sfuma verso i bordi dell'immagine (niente taglio netto sul grigio
   della riga premuta);
4. su bianco il risultato è identico all'originale (scarto massimo ~6/255).

Uso (Python con Pillow, numpy, scipy):
  swiftc -O mask.swift -o mask
  ./mask originale.png maschera.png
  python3 scontorna.py originale.png maschera.png assets/vita/nome --pt 64
  → assets/vita/nome.png, nome@2x.png, nome@3x.png (64/128/192 px)
"""
import argparse

import numpy as np
from PIL import Image
from scipy import ndimage as nd

p = argparse.ArgumentParser()
p.add_argument("originale")
p.add_argument("maschera")
p.add_argument("uscita", help="percorso senza estensione, es. assets/vita/orologio")
p.add_argument("--pt", type=int, default=64, help="lato in punti (1x)")
p.add_argument("--riempi-buchi", type=int, default=0, help="riempi i buchi interni più grandi di N px (0 = mai)")
a = p.parse_args()

H = a.pt * 3
src = np.asarray(Image.open(a.originale).convert("RGB").resize((H, H), Image.LANCZOS)).astype(float)
m = np.asarray(Image.open(a.maschera).convert("L").resize((H, H), Image.BILINEAR)) / 255.0

# Soggetto: Vision + tutto ciò che è colorato o scuro.
chroma = src.max(2) - src.min(2)
lum = src.mean(2)
u = (m > 0.5) | (chroma > 22) | (lum < 140)
if a.riempi_buchi:
    holes = nd.binary_fill_holes(u) & ~u
    lab, k = nd.label(holes)
    for i in range(1, k + 1):
        if (lab == i).sum() > a.riempi_buchi:
            u |= lab == i
u = nd.binary_opening(u, iterations=1)
solid = nd.gaussian_filter(nd.binary_erosion(u, iterations=1).astype(float), 0.8)
obj = np.maximum(m, solid)

# Bianco → alfa fuori dal soggetto, con l'ombra che sfuma verso i bordi.
abg = (255 - src.min(2)) / 255.0
yy, xx = np.mgrid[0:H, 0:H]
d = np.minimum.reduce([xx, yy, H - 1 - xx, H - 1 - yy]).astype(float)
ramp = np.clip(d / (H * 0.28), 0, 1)
ramp = ramp * ramp * (3 - 2 * ramp)
A = np.maximum(obj, abg * ramp)
A[A < 0.025] = 0
Acol = np.maximum(obj, abg)
rgb = np.clip(255 - (255 - src) / np.where(Acol > 0, Acol, 1)[..., None], 0, 255)

im = Image.fromarray(np.dstack([rgb, A * 255]).round().astype(np.uint8), "RGBA")
im.save(f"{a.uscita}@3x.png")
for s, suf in ((a.pt * 2, "@2x"), (a.pt, "")):
    # Ridimensiona in alfa premoltiplicato: niente alone chiaro sui bordi.
    im.convert("RGBa").resize((s, s), Image.LANCZOS).convert("RGBA").save(f"{a.uscita}{suf}.png")
print("ok", a.uscita)
