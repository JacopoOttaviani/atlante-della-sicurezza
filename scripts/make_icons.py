#!/usr/bin/env python3
"""Disegna le icone del sito (favicon, icona per la schermata iniziale, manifest) dal marchio del meridiano.

Il marchio è lo stesso del wordmark in index.html: cerchio, ellisse e linea dell'equatore. Qui sta in oro
su un quadrato scuro dagli angoli arrotondati. Tre varianti della stessa geometria:

- grande:  img/favicon.svg (sorgente vettoriale, usata dai browser moderni), img/icon-192.png, img/icon-512.png;
- piccola: tratti più spessi, perché a 16 e 32 pixel quelli del wordmark si impastano; finisce in favicon.ico
           (a 16 pixel una variante ancora più netta, con i tratti allineati alla griglia dei pixel);
- piena:   fondo a tutto campo e marchio un po' più piccolo, per le icone che il sistema ritaglia da sé
           (iOS la arrotonda, Android la può rendere circolare): img/apple-touch-icon.png e img/icon-512-maskable.png.

I PNG li fotografa Chrome headless a 1024 pixel su fondo trasparente, poi Pillow li riduce (LANCZOS).

Uso:  python3 scripts/make_icons.py
"""
import os
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
INK = "#121614"     # --ink del tema chiaro: il fondo dell'icona
GOLD = "#d9a226"    # --gold-ink del tema scuro: il marchio

# Ogni variante è nel riquadro 0-64: (raggio angoli, raggio del globo, tratto cerchio, tratto ellisse/equatore).
VARIANTS = {
    "large": dict(corner=14, r=19, w1=5.0, w2=4.0),
    "small": dict(corner=14, r=24, w1=8.0, w2=6.4),
    "tiny":  dict(corner=14, r=24, w1=8.0, w2=8.0, rx=12),   # a 16 px ogni tratto cade su righe intere di pixel
    "full":  dict(corner=0,  r=17.5, w1=5.0, w2=4.0),
}


def svg(variant, size=None):
    v = VARIANTS[variant]
    rx = v.get("rx") or round(v["r"] * 3.3 / 8, 2)   # proporzione dell'ellisse del wordmark (rx 3.3 su r 8)
    dims = f' width="{size}" height="{size}"' if size else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"{dims}>\n'
        f'  <rect width="64" height="64" rx="{v["corner"]}" fill="{INK}"/>\n'
        f'  <g fill="none" stroke="{GOLD}" stroke-linecap="round">\n'
        f'    <circle cx="32" cy="32" r="{v["r"]}" stroke-width="{v["w1"]}"/>\n'
        f'    <ellipse cx="32" cy="32" rx="{rx}" ry="{v["r"]}" stroke-width="{v["w2"]}"/>\n'
        f'    <path d="M{32 - v["r"]} 32h{2 * v["r"]}" stroke-width="{v["w2"]}"/>\n'
        f'  </g>\n'
        f'</svg>\n'
    )


def render(variant, px, tmp):
    """Fotografa la variante a px×px con Chrome e restituisce l'immagine RGBA."""
    from PIL import Image

    page = os.path.join(tmp, f"{variant}.html")
    shot = os.path.join(tmp, f"{variant}.png")
    with open(page, "w") as f:
        f.write('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}'
                'svg{display:block}</style></head><body>' + svg(variant, px) + "</body></html>")
    cmd = [
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
        f"--user-data-dir={os.path.join(tmp, 'profile-' + variant)}", "--default-background-color=00000000",
        f"--window-size={px},{px}", f"--screenshot={shot}", "file://" + page,
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    im = Image.open(shot).convert("RGBA")
    if im.size != (px, px):
        sys.exit(f"screenshot inatteso per {variant}: {im.size}")
    if VARIANTS[variant]["corner"] and im.getpixel((0, 0))[3] != 0:
        sys.exit(f"{variant}: l'angolo non è trasparente, Chrome ha ignorato --default-background-color")
    return im


def main():
    from PIL import Image  # Pillow: pip install pillow

    img = ROOT / "img"
    img.mkdir(exist_ok=True)
    (img / "favicon.svg").write_text(svg("large"))

    with tempfile.TemporaryDirectory() as tmp:
        large = render("large", 1024, tmp)
        small = render("small", 512, tmp)
        tiny = render("tiny", 512, tmp)
        full = render("full", 1024, tmp)

    def down(im, px):
        return im.resize((px, px), Image.LANCZOS)

    down(large, 512).save(img / "icon-512.png", optimize=True)
    down(large, 192).save(img / "icon-192.png", optimize=True)
    down(full, 512).save(img / "icon-512-maskable.png", optimize=True)
    down(full, 180).convert("RGB").save(img / "apple-touch-icon.png", optimize=True)  # iOS non vuole trasparenza

    ico = [down(large, 48), down(small, 32), down(tiny, 16)]
    ico[0].save(ROOT / "favicon.ico", format="ICO", sizes=[i.size for i in ico], append_images=ico[1:])
    check = Image.open(ROOT / "favicon.ico")
    if sorted(check.info.get("sizes", [])) != [(16, 16), (32, 32), (48, 48)]:
        sys.exit(f"favicon.ico incompleto: {check.info.get('sizes')}")

    for p in ["favicon.ico", "img/favicon.svg", "img/icon-192.png", "img/icon-512.png",
              "img/icon-512-maskable.png", "img/apple-touch-icon.png"]:
        print(f"{p:28} {os.path.getsize(ROOT / p) / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
