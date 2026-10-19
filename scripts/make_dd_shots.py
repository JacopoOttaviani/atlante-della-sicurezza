#!/usr/bin/env python3
"""Prepara le foto delle schede degli approfondimenti (img/dd/<chiave>.jpg), nello stesso filtro del film della home.

Il film in apertura ha in vc.css il filtro «Sorveglianza»:
    .vh-media video { filter: grayscale(1) contrast(1.5) brightness(1.06) blur(0.3px) }
e sopra, come strati, il verde freddo dei monitor (#b4cdc2 in multiply), le righe, la vignetta e la grana.
Le schede (.dd-card) disegnano la foto in ::before, dove un filter spegnerebbe anche il verde: per questo la parte
tonale è cotta qui nel file (scala di grigi con i pesi di CSS, contrasto, luminosità, un filo di sfocatura) e vc.css
aggiunge solo gli strati, con gli stessi valori di .vh-media. La chiave è il data-dd della scheda; una scheda nuova
prende la foto appena c'è il file e la sua regola in vc.css (blocco «approfondimenti: la foto delle schede»).

Foto da Unsplash, licenza Unsplash (uso libero, anche commerciale, senza obbligo di citazione): le citiamo lo stesso,
qui sotto. Luoghi e oggetti, nessun volto: accanto a titoli su stranieri in carcere, rimpatri e minori una persona
riconoscibile sembrerebbe indicata come esempio.
«lift» schiarisce i notturni prima del filtro (gamma), che con il contrasto a 1.5 altrimenti diventano neri.

Uso:  python3 scripts/make_dd_shots.py          (scarica le foto da images.unsplash.com e riscrive img/dd/)
      python3 scripts/make_dd_shots.py minori   (solo le chiavi indicate, le altre foto restano come sono)
"""
import io
import pathlib
import urllib.request

import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "img" / "dd"
W, H = 1000, 500          # 2:1; la scheda più larga (una colonna su tablet) la ritaglia a 3:1 con background-size: cover

# chiave: (file su images.unsplash.com, pagina della foto, autore, fuoco x, fuoco y del ritaglio 2:1, lift)
SHOTS = {
    "carceri":    ("photo-1774106148193-34b3622dcffe", "a-long-hallway-with-prison-cells-on-the-left-SZSh5wHtmPY", "Anil Baki Durmus", 0.5, 0.5, 1.0),
    "rimpatri":   ("photo-1762960294856-7bedd842ae87", "airport-jet-bridge-at-night-with-planes-and-vehicles-PsTviXbeCgk", "Alexander Schimmeck", 0.5, 0.5, 0.9),
    "percezione": ("photo-1772400862581-1608fd542da3", "empty-street-with-buildings-and-clock-tower-at-night-ca_5BEvg-LY", "Mohamed Marey", 0.5, 0.55, 0.9),
    "autori":     ("photo-1676829482890-08da580bf542", "a-couple-of-police-cars-parked-next-to-each-other-Fn57NtC4ddk", "Alex Suprun", 0.5, 0.6, 0.75),
    "minori":     ("photo-1544919982-b61976f0ba43", "portable-basketball-hoop-20K-JZ2ppbE", "Piotr Osmenda", 0.5, 0.5, 0.75),
    "cautelari":  ("photo-1660784670019-33a36fd82515", "a-courtroom-with-a-large-wooden-bench-ZV0kXnONoHo", "Rai Singh Uriarte", 0.5, 0.45, 1.0),
}


def crop21(im, fx, fy):
    sw, sh = im.size
    cw, ch = (round(sh * W / H), sh) if sw / sh > W / H else (sw, round(sw * H / W))
    x = min(max(round(fx * sw - cw / 2), 0), sw - cw)
    y = min(max(round(fy * sh - ch / 2), 0), sh - ch)
    return im.crop((x, y, x + cw, y + ch)).resize((W, H), Image.LANCZOS)


def tone(im, lift):
    a = np.asarray(im.convert("RGB"), dtype=np.float64) / 255
    v = a @ np.array([0.2126, 0.7152, 0.0722])        # grayscale(1), i pesi di CSS
    v = v ** lift
    v = np.clip((v - 0.5) * 1.5 + 0.5, 0, 1)          # contrast(1.5)
    v = np.clip(v * 1.06, 0, 1)                         # brightness(1.06)
    g = Image.fromarray(np.round(v * 255).astype(np.uint8), "L")
    return g.filter(ImageFilter.GaussianBlur(0.5))      # blur(0.3px), a circa due pixel del file per pixel CSS


def main(keys):
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (file, page, author, fx, fy, lift) in SHOTS.items():
        if keys and key not in keys:
            continue
        req = urllib.request.Request(f"https://images.unsplash.com/{file}?w=1600&q=85&fm=jpg", headers={"User-Agent": "atlante-della-sicurezza"})
        with urllib.request.urlopen(req, timeout=60) as r:
            src = Image.open(io.BytesIO(r.read()))
        dest = OUT / f"{key}.jpg"
        tone(crop21(src, fx, fy), lift).save(dest, quality=70, optimize=True, progressive=True)
        print(f"{dest.relative_to(ROOT)}  {dest.stat().st_size // 1024} KB  foto di {author}, https://unsplash.com/photos/{page}")


if __name__ == "__main__":
    import sys
    main(sys.argv[1:])
