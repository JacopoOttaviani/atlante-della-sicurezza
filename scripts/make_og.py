#!/usr/bin/env python3
"""Fotografa scripts/og-card.html e scrive l'immagine di anteprima per i social (1200×630, JPEG).

Serve la cartella del progetto su una porta libera (la scheda legge data/), apre la pagina con
Chrome headless a scala 2 e la riduce a 1200×630 con Pillow. WhatsApp scarta le anteprime pesanti,
quindi la qualità JPEG scende finché il file non sta sotto il limite.

Uso:  python3 scripts/make_og.py [--theme light|dark] [--lang it|en] [--out img/og-image.jpg] [--max-kb 250]
      (--lang en scrive la scheda dell'edizione inglese, img/og-image-en.jpg)
"""
import argparse
import os
import pathlib
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--theme", default="dark", choices=["light", "dark"])
    ap.add_argument("--lang", default="it", choices=["it", "en"])
    ap.add_argument("--out")
    ap.add_argument("--max-kb", type=int, default=250)
    ap.add_argument("--keep-png", help="salva anche il PNG a scala 2 qui")
    a = ap.parse_args()
    a.out = a.out or str(ROOT / "img" / ("og-image-en.jpg" if a.lang == "en" else "og-image.jpg"))

    from PIL import Image  # Pillow: pip install pillow

    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", str(ROOT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        url = f"http://127.0.0.1:{port}/scripts/og-card.html?theme={a.theme}&lang={a.lang}"
        for _ in range(50):  # aspetta che il server risponda
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/data/vc.json", timeout=1).read(10)
                break
            except Exception:
                time.sleep(0.1)
        with tempfile.TemporaryDirectory() as tmp:
            png = os.path.join(tmp, "card.png")
            cmd = [
                CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                f"--user-data-dir={os.path.join(tmp, 'profile')}",
                "--force-device-scale-factor=2", "--window-size=1200,630",
                "--virtual-time-budget=15000", f"--screenshot={png}", url,
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
            im = Image.open(png).convert("RGB")
            if im.size != (2400, 1260):
                sys.exit(f"screenshot inatteso: {im.size}")
            if a.keep_png:
                im.save(a.keep_png)
            im = im.resize((1200, 630), Image.LANCZOS)
            out = pathlib.Path(a.out)
            out.parent.mkdir(parents=True, exist_ok=True)
            for q in range(88, 60, -4):
                im.save(out, "JPEG", quality=q, optimize=True, progressive=False, subsampling=0)
                kb = out.stat().st_size / 1024
                if kb <= a.max_kb:
                    break
            print(f"{out} · {a.theme} · {im.size[0]}×{im.size[1]} · qualità {q} · {kb:.0f} KB")
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
