"""Sbiadisce SOLO i verdi di un'illustrazione (prati, alberi), lasciando gli altri colori.

python3 scripts/sbiadisci-verdi.py <ingresso.jpg> <uscita.jpg> [saturazione] [schiarita] [gradi-verso-giallo]
Default = «molto forte» scelto da Tiziano per la copertina della Home (REG-793):
saturazione rimasta 0.42 (−58%), schiarita 0.25 verso il bianco, tinta −8° (resta calda).
Altre prove: lieve 0.80/0.08/0, media 0.66/0.15/0, forte 0.55/0.20/5.
"""
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
ks = float(sys.argv[3]) if len(sys.argv) > 3 else 0.42
kv = float(sys.argv[4]) if len(sys.argv) > 4 else 0.25
dh = float(sys.argv[5]) if len(sys.argv) > 5 else 8

im = Image.open(src).convert('RGB')
hsv = np.asarray(im.convert('HSV')).astype(np.float32) / 255
h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]


def bump(x, lo, hi, soft):
    return np.clip((x - lo) / soft, 0, 1) * np.clip((hi - x) / soft, 0, 1)


# peso morbido sulle tinte verdi (65°–175°), solo dove c'è colore
w = bump(h, 65, 175, 15) * np.clip((s - 0.12) / 0.15, 0, 1)
s2 = s * (1 - w * (1 - ks))
v2 = v + (1 - v) * kv * w
h2 = (h - dh * w) % 360
arr = np.dstack([h2 / 360, s2, v2])
Image.fromarray((np.clip(arr, 0, 1) * 255).round().astype(np.uint8), 'HSV').convert('RGB').save(dst, quality=92)
