#!/usr/bin/env python3
"""Atlante della Sicurezza — Milano quartiere per quartiere (prototipo).

Il Comune di Milano pubblica i confini e i residenti dei suoi 88 quartieri (NIL, Nuclei
di identità locale, PGT 2030), ma nessuna fonte ufficiale pubblica i reati denunciati
sotto il livello comunale: ISTAT e Ministero dell'Interno si fermano al comune.
Questo script scrive due file in data/quartieri/ (più l'indice delle città che li hanno):

  015146.json       dati per quartiere, dal portale open data del Comune di Milano:
                    residenti, stranieri, 65 e più, famiglie, famiglie unipersonali
                    (2011-2024), superficie, pendolari in entrata (censimento 2011),
                    edifici degradati censiti nel 2014-2017, municipio
  015146.topo.json  confini dei quartieri (TopoJSON scritto qui, senza dipendenze)

Se un giorno una fonte ufficiale pubblicherà i reati per quartiere, basterà aggiungere a ogni
quartiere un blocco "n" (conteggi per tipo di reato e anno, come in data/vc.json): la pagina
mostrerà da sola lo strato dei reati.

Uso:  python3 scripts/build_quartieri_milano.py     (dopo build_data.py, dalla cartella atlante-della-sicurezza/)
Solo libreria standard. I download restano in scripts/.cache/.
"""
import csv
import io
import json
import math
import os
import re
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import CACHE, OUT, TYPE_IDS, YEARS, fetch, log  # noqa: E402

CITY = "015146"
QYEARS = [y for y in YEARS if y >= 2011]  # i dati per quartiere del Comune partono dal 2011
PORTAL = "https://dati.comune.milano.it/dataset/"
SOURCES = {
    "nil": (PORTAL + "e8e765fc-d882-40b8-95d8-16ff3d39eb7c/resource/9c4e0776-56fc-4f3d-8a90-f4992a3be426/download/ds964_nil_wm.geojson",
            "ds964", "Comune di Milano, Nuclei d'Identità Locale (NIL) vigenti, PGT 2030 (CC BY 4.0)"),
    "mun": (PORTAL + "36ba21c2-8b48-43ce-bbe1-e236a8a49ff6/resource/99ecd085-0b04-4fb2-a66e-9795694d4fc4/download/ds379_municipi_label.geojson",
            "ds379", "Comune di Milano, superficie dei Municipi (CC BY 4.0)"),
    "dem": (PORTAL + "fcddb7d2-b106-48f5-9a2a-64d3136621dc/resource/084457a7-ec4b-4a6b-b463-d8ab53c64fbb/download/ds205_dati_quartieri_2011_2024_.csv",
            "ds205", "Comune di Milano, caratteristiche demografiche e territoriali dei quartieri, 2011-2024 (fonte anagrafica, CC BY 4.0)"),
    "degr": (PORTAL + "ffda4609-cd29-48f7-b501-e8bf1426dcf9/resource/4a47b39d-e64b-4a85-8115-c5f37fd94410/download/ds503_aree_edifici_degradati_abbandonati_0_final.geojson",
             "ds503", "Comune di Milano, edifici degradati, abbandonati o dismessi 2014-2017 (CC BY 4.0)"),
    "com": (PORTAL + "df8bf7d0-a106-4328-9ae6-dfd025b23ca1/resource/58a2a927-0904-4a9c-ba65-a53a547cbba6/download/ds392_popolazione_pendolari_in_entrata_sezione_censimento_origine_destinazione_2011c.zip",
            "ds392", "Comune di Milano su dati ISTAT, Censimento 2011: pendolari in entrata a Milano per sezione di destinazione (CC BY 4.0)"),
}

# Nomi dei quartieri come li scrive il Comune (ds205), con qualche aggiustamento tipografico.
RENAME = {"Citta' Studi": "Città Studi", "Monlue' - Ponte Lambro": "Monluè - Ponte Lambro", "Parco Bosco in citta'": "Parco Bosco in città",
          "Pta Romana": "Porta Romana", "Giardini P.ta Venezia": "Giardini Porta Venezia", "QT 8": "QT8", "Magenta - S.Vittore": "Magenta - San Vittore"}
RENAME_CI = {k.lower(): v for k, v in RENAME.items()}



def fetch_bytes(url, cache_name):
    path = os.path.join(CACHE, cache_name)
    if not (os.path.exists(path) and os.path.getsize(path) > 0):
        log(f"download {cache_name}")
        with urllib.request.urlopen(url, timeout=300) as r:
            data = r.read()
        with open(path, "wb") as f:
            f.write(data)
    return open(path, "rb").read()


def title_case(s):
    """'BUENOS AIRES - PORTA VENEZIA' -> 'Buenos Aires - Porta Venezia' (solo come ripiego: i nomi vengono da ds205)."""
    small = {"di", "del", "della", "dei", "delle", "in", "sul", "a", "e"}
    out = []
    for w in s.lower().split(" "):
        out.append(w if w in small and out else w[:1].upper() + w[1:])
    return " ".join(out)


def short_name(name):
    """Etichetta corta per la mappa: il primo pezzo del nome composto."""
    first = name.split(" - ")[0].strip()
    first = first.replace("Q.re ", "").replace("Q.RE ", "")
    return first


# ---------------------------------------------------------------- geometria

def polygons(geom):
    """Lista di poligoni, ognuno lista di anelli [(lon, lat), ...], dal GeoJSON."""
    if geom["type"] == "Polygon":
        return [[[tuple(p) for p in ring] for ring in geom["coordinates"]]]
    if geom["type"] == "MultiPolygon":
        return [[[tuple(p) for p in ring] for ring in poly] for poly in geom["coordinates"]]
    return []


def signed_area(ring):
    a = 0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        a += x0 * y1 - x1 * y0
    return a / 2


def centroid(polys):
    best, best_a = None, 0
    for p in polys:
        ring = p[0]
        a = cx = cy = 0
        for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
            k = x0 * y1 - x1 * y0
            a += k
            cx += (x0 + x1) * k
            cy += (y0 + y1) * k
        if a and abs(a) > best_a:
            best_a = abs(a)
            best = (cx / (3 * a), cy / (3 * a))
    return best


def inside(pt, polys):
    """Punto dentro un poligono (anello esterno meno i buchi), con il metodo del raggio."""
    x, y = pt

    def in_ring(ring):
        hit = False
        n = len(ring)
        for i in range(n):
            x0, y0 = ring[i]
            x1, y1 = ring[(i + 1) % n]
            if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
                hit = not hit
        return hit

    for p in polys:
        if in_ring(p[0]) and not any(in_ring(h) for h in p[1:]):
            return True
    return False


def simplify(pts, tol):
    """Douglas-Peucker su un arco (estremi fissi), in coordinate quantizzate."""
    if len(pts) < 3:
        return pts
    (ax, ay), (bx, by) = pts[0], pts[-1]
    dx, dy = bx - ax, by - ay
    ln = math.hypot(dx, dy)
    best, bi = -1, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs(dy * px - dx * py + bx * ay - by * ax) / ln if ln else math.hypot(px - ax, py - ay)
        if d > best:
            best, bi = d, i
    if best <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[:bi + 1], tol)[:-1] + simplify(pts[bi:], tol)


def topojson(layers, q=5000, tol=1.2):
    """TopoJSON minimo: quantizzazione, archi condivisi tra anelli, semplificazione, codifica delta.

    layers: {nome: [(proprietà, poligoni)]}; anelli esterni in senso orario (convenzione d3), buchi al contrario."""
    xs, ys = [], []
    for feats in layers.values():
        for _, polys in feats:
            for poly in polys:
                for ring in poly:
                    xs.extend(p[0] for p in ring)
                    ys.extend(p[1] for p in ring)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    kx, ky = (q - 1) / (x1 - x0), (q - 1) / (y1 - y0)

    def quant(ring):
        out = []
        for lon, lat in ring:
            p = (round((lon - x0) * kx), round((lat - y0) * ky))
            if not out or p != out[-1]:
                out.append(p)
        if len(out) > 1 and out[0] == out[-1]:
            out.pop()
        return out

    # anelli quantizzati, con l'orientamento richiesto da d3
    qlayers = {}
    for name, feats in layers.items():
        qf = []
        for props, polys in feats:
            qp = []
            for poly in polys:
                rings = []
                for k, ring in enumerate(poly):
                    cw = signed_area(ring) < 0
                    r = quant(ring)
                    if len(r) < 3:
                        continue
                    if (k == 0 and not cw) or (k > 0 and cw):
                        r = r[::-1]
                    rings.append(r)
                if rings:
                    qp.append(rings)
            qf.append((props, qp))
        qlayers[name] = qf

    # giunzioni: punti in cui i vicini cambiano da un anello all'altro
    neigh = defaultdict(set)
    for feats in qlayers.values():
        for _, polys in feats:
            for poly in polys:
                for ring in poly:
                    n = len(ring)
                    for i, p in enumerate(ring):
                        neigh[p].add(frozenset((ring[i - 1], ring[(i + 1) % n])))
    junction = {p for p, s in neigh.items() if len(s) > 1}

    arcs, index = [], {}

    def add_arc(pts):
        key = tuple(pts)
        if key in index:
            return index[key]
        rkey = key[::-1]
        if rkey in index:
            return ~index[rkey]
        index[key] = len(arcs)
        arcs.append(simplify(list(key), tol))
        return len(arcs) - 1

    def ring_arcs(ring):
        n = len(ring)
        js = [i for i, p in enumerate(ring) if p in junction]
        if not js:
            return [add_arc(ring + [ring[0]])]
        s = js[0]
        ring = ring[s:] + ring[:s]
        js = sorted((j - s) % n for j in js)
        out = []
        for k, i0 in enumerate(js):
            i1 = js[k + 1] if k + 1 < len(js) else n
            seg = ring[i0:i1 + 1] if i1 < n else ring[i0:] + [ring[0]]
            out.append(add_arc(seg))
        return out

    objects = {}
    for name, feats in qlayers.items():
        geoms = []
        for props, polys in feats:
            pa = [[ring_arcs(r) for r in poly] for poly in polys]
            if len(pa) == 1:
                geoms.append({"type": "Polygon", "arcs": pa[0], "properties": props})
            else:
                geoms.append({"type": "MultiPolygon", "arcs": pa, "properties": props})
        objects[name] = {"type": "GeometryCollection", "geometries": geoms}

    enc = []
    for arc in arcs:
        px = py = 0
        out = []
        for x, y in arc:
            out.append([x - px, y - py])
            px, py = x, y
        enc.append(out)
    return {
        "type": "Topology",
        "bbox": [x0, y0, x1, y1],
        "transform": {"scale": [1 / kx, 1 / ky], "translate": [x0, y0]},
        "objects": objects,
        "arcs": enc,
    }


# ---------------------------------------------------------------- dati

def load_nil():
    g = json.loads(fetch(SOURCES["nil"][0], "milano_nil.geojson"))
    out = {}
    for f in g["features"]:
        p = f["properties"]
        out[int(p["ID_NIL"])] = {"name_raw": p["NIL"], "polys": polygons(f["geometry"])}
    if len(out) != 88:
        raise SystemExit(f"attesi 88 NIL, trovati {len(out)}")
    return out


def load_municipi():
    g = json.loads(fetch(SOURCES["mun"][0], "milano_municipi.geojson"))
    return {int(f["properties"]["MUNICIPIO"]): polygons(f["geometry"]) for f in g["features"]}


def num(s):
    s = (s or "").strip().replace(".", "").replace(",", ".")
    if s in ("", "N.D."):
        return None
    return float(s)


def load_demography():
    """ds205: per quartiere e anno, residenti, stranieri, 65 e più, famiglie, famiglie unipersonali, superficie."""
    text = fetch(SOURCES["dem"][0], "milano_ds205.csv").lstrip("﻿")
    rows = list(csv.DictReader(io.StringIO(text), delimiter=";"))
    by = defaultdict(dict)
    for r in rows:
        if not r["NIL"].strip():
            continue  # righe "N.D.": residenti senza quartiere
        by[int(r["NIL"])][int(r["Anno"])] = r
    if len(by) != 88 or any(len(v) != len(QYEARS) for v in by.values()):
        raise SystemExit("ds205 incompleto")
    cols = {"pop": "Totale", "str": "Stranieri", "old": "65 e +", "fam": "Famiglie registrate in anagrafe", "single": "Famiglie unipersonali registrate in anagrafe"}
    out = {}
    for nil, years in by.items():
        rec = {k: [int(num(years[y][c]) or 0) for y in QYEARS] for k, c in cols.items()}
        rec["km2"] = round(num(years[QYEARS[-1]]["Area (metri quadrati)"]) / 1e6, 3)
        name = years[QYEARS[-1]]["Quartiere"].strip()
        name = re.sub(r"Ca\W{1,2}Granda", "Ca’ Granda", name)
        rec["name"] = RENAME_CI.get(name.lower(), name)
        out[nil] = rec
    return out


def load_degraded():
    g = json.loads(fetch(SOURCES["degr"][0], "milano_ds503.geojson"))
    c = Counter()
    for f in g["features"]:
        nil = f["properties"].get("ID_NIL")
        if nil:
            c[int(nil)] += 1
    return c


def load_commuters():
    """ds392: pendolari in entrata a Milano per sezione di censimento 2011, con il NIL di destinazione '(n)'."""
    raw = fetch_bytes(SOURCES["com"][0], "milano_ds392.zip")
    z = zipfile.ZipFile(io.BytesIO(raw))
    name = [n for n in z.namelist() if n.lower().endswith(".csv")][0]
    text = z.read(name).decode("utf-8", "replace").lstrip("﻿")
    rows = list(csv.DictReader(io.StringIO(text), delimiter=";"))
    c, mun = Counter(), defaultdict(Counter)
    vcol = [k for k in rows[0] if k.startswith("Numerosit")][0]
    for r in rows:
        dest = r["NIL di destinazione"]
        if "(" not in dest:
            continue
        nil = int(dest.rsplit("(", 1)[1].rstrip(")"))
        n = int(num(r[vcol]) or 0)
        c[nil] += n
        if r["Municipio di destinazione"].strip():
            mun[nil][int(r["Municipio di destinazione"])] += n
    return c, mun


# ---------------------------------------------------------------- scrittura

def build():
    vc = json.load(open(os.path.join(OUT, "vc.json"), encoding="utf-8"))
    city = next(c for c in vc["cities"] if c["id"] == CITY)
    nil = load_nil()
    dem = load_demography()
    mun_polys = load_municipi()
    degr = load_degraded()
    com, com_mun = load_commuters()
    log(f"{len(nil)} quartieri, {sum(com.values())} pendolari in entrata nel 2011, {sum(degr.values())} edifici degradati")

    areas = {}
    disagree = []
    for i in sorted(nil):
        c = centroid(nil[i]["polys"])
        m = next((k for k, polys in mun_polys.items() if inside(c, polys)), None)
        if m is None:
            raise SystemExit(f"municipio non trovato per il NIL {i}")
        m2 = com_mun[i].most_common(1)[0][0] if com_mun.get(i) else None
        if m2 and m2 != m:
            disagree.append(f"{dem[i]['name']} ({i}): municipio {m} dai confini, {m2} dal censimento 2011")
        d = dem[i]
        areas[i] = {"id": i, "name": d["name"], "short": short_name(d["name"]), "mun": m, "km2": d["km2"],
                    "pop": d["pop"], "str": d["str"], "old": d["old"], "fam": d["fam"], "single": d["single"],
                    "com": com.get(i, 0), "degr": degr.get(i, 0), "lon": round(c[0], 4), "lat": round(c[1], 4)}
    if disagree:
        log("  nota, municipio diverso tra confini e censimento 2011 (vale il confine):", "; ".join(disagree))
    tot = sum(a["pop"][-1] for a in areas.values())
    log(f"residenti {QYEARS[-1]} nei quartieri: {tot} (ISTAT, media annua del comune: {city['pop'][YEARS.index(QYEARS[-1])]})")

    out_dir = os.path.join(OUT, "quartieri")
    os.makedirs(out_dir, exist_ok=True)
    data = {
        "meta": {
            "city": CITY, "name": city["name"], "built": date.today().isoformat(),
            "unit": {"code": "NIL", "one": "quartiere", "many": "quartieri", "long": "Nuclei di identità locale (NIL), i quartieri del Piano di governo del territorio Milano 2030"},
            "years": QYEARS,
            "fields": {"pop": "residenti al 31 dicembre", "str": "residenti stranieri", "old": "residenti di 65 anni e più", "fam": "famiglie anagrafiche",
                       "single": "famiglie di una sola persona", "com": "pendolari in entrata per lavoro o studio (censimento 2011)",
                       "degr": "edifici degradati, abbandonati o dismessi censiti nel 2014-2017", "km2": "superficie in km²"},
            "sources": [{"id": s[1], "label": s[2], "url": s[0]} for s in SOURCES.values()],
            "gap": "L'ISTAT e il Ministero dell'Interno pubblicano i delitti denunciati solo per l'intero comune: nessuna fonte ufficiale li pubblica per quartiere.",
        },
        "areas": [areas[i] for i in sorted(areas)],
    }
    with open(os.path.join(out_dir, f"{CITY}.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    topo = topojson({"nil": [({"id": i}, nil[i]["polys"]) for i in sorted(nil)]})
    with open(os.path.join(out_dir, f"{CITY}.topo.json"), "w", encoding="utf-8") as f:
        json.dump(topo, f, separators=(",", ":"))

    # indice delle città con i quartieri: la pagina lo legge all'avvio e carica i file solo per queste
    ids = sorted(n[:-len(".topo.json")] for n in os.listdir(out_dir) if n.endswith(".topo.json"))
    with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as f:
        json.dump(ids, f)
    for name in (f"{CITY}.json", f"{CITY}.topo.json", "index.json"):
        log(f"scritto data/quartieri/{name} ({os.path.getsize(os.path.join(out_dir, name)) // 1024} KB)")
    check(data, topo)


def check(data, topo):
    assert len(data["areas"]) == 88 and len(topo["objects"]["nil"]["geometries"]) == 88
    assert {a["id"] for a in data["areas"]} == {g["properties"]["id"] for g in topo["objects"]["nil"]["geometries"]}
    log(f"controllo: {len(topo['arcs'])} archi, {sum(len(a) for a in topo['arcs'])} vertici")


if __name__ == "__main__":
    build()
