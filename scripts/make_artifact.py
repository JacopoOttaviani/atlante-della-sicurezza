#!/usr/bin/env python3
"""Crea la versione "artifact" della pagina: solo il contenuto del <body>, senza
doctype né <html>/<head>, con titolo, font e fogli di stile in testa.
Gli altri file (vc.css, vc.js, data/*) si pubblicano accanto con gli stessi percorsi.

Uso:  python3 scripts/make_artifact.py <file di uscita>
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
keep = [l for l in head.splitlines() if re.search(r"<title>|name=\"description\"|fonts\.g|vc\.css", l)]
body = re.search(r"<!-- vc:content -->(.*?)<!-- /vc:content -->", html, re.S).group(1)
scripts = re.findall(r"<script[^>]*></script>", html)
out = "\n".join(['<meta name="claude:viewport-fit-sides" content="cover">'] + keep) + "\n" + body.strip() + "\n" + "\n".join(scripts) + "\n"
# il parametro di versione serve solo al server locale: i file pubblicati accanto alla pagina sono sempre gli ultimi
out = re.sub(r'\?v=\d+', "", out)
open(sys.argv[1], "w", encoding="utf-8").write(out)
print(f"scritto {sys.argv[1]} ({len(out) // 1024} KB)")
