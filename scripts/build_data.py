#!/usr/bin/env python3
"""Atlante della Sicurezza — costruzione del dataset.

Scarica i dati ufficiali ISTAT (API SDMX di esploradati.istat.it) e i confini
amministrativi (openpolis/geojson-italy, derivati da ISTAT), e scrive:

  data/vc.json                    serie per comune capoluogo, Italia, percezione
  data/italia.topo.json           confini provinciali per la mappa

Uso:  python3 scripts/build_data.py          (dalla cartella atlante-della-sicurezza/)
I download grezzi restano in scripts/.cache/ così le esecuzioni successive
sono veloci; cancellare la cartella per riscaricare tutto.

Solo libreria standard: nessuna dipendenza da installare.
"""
import csv
import io
import json
import math
import os
import sys
import time
import urllib.request
from collections import defaultdict
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
OUT = os.path.join(ROOT, "data")

SDMX = "https://esploradati.istat.it/SDMXWS/rest/data/IT1,{flow},1.0/{key}"
GEO = "https://raw.githubusercontent.com/openpolis/geojson-italy/master/topojson/{name}"

YEARS = list(range(2006, 2025))  # ultimo anno disponibile dei delitti denunciati: 2024

# Reati mostrati nello strumento: codice ISTAT (CL_REATI_PS) -> etichetta, gruppo.
# "rare": pochi casi l'anno, per le classifiche si usa la media triennale.
TYPES = [
    ("TOT", "Tutti i delitti", "Totale", False),
    ("THEFT", "Furti (tutti)", "Furti", False),
    ("BURGTHEF", "Furti in abitazione", "Furti", False),
    ("PICKTHEF", "Borseggi (furti con destrezza)", "Furti", False),
    ("BAGTHEF", "Scippi (furti con strappo)", "Furti", False),
    ("SHOPTHEF", "Furti nei negozi", "Furti", False),
    ("CARTHEF", "Furti di automobili", "Furti", False),
    ("VEHITHEF", "Furti su auto in sosta", "Furti", False),
    ("ROBBER", "Rapine (tutte)", "Rapine", False),
    ("STREETROB", "Rapine in strada", "Rapine", False),
    ("HOUSEROB", "Rapine in abitazione", "Rapine", True),
    ("SHOPROB", "Rapine nei negozi", "Rapine", True),
    ("INTENHOM", "Omicidi volontari", "Contro la persona", True),
    ("ATTEMPHOM", "Tentati omicidi", "Contro la persona", True),
    ("CULPINJU", "Lesioni dolose", "Contro la persona", False),
    ("BLOWS", "Percosse", "Contro la persona", False),
    ("MENACE", "Minacce", "Contro la persona", False),
    ("RAPE", "Violenze sessuali", "Contro la persona", True),
    ("SWINCYB", "Truffe e frodi informatiche", "Patrimonio ed economia", False),
    ("CYBERCRIM", "Delitti informatici", "Patrimonio ed economia", False),
    ("EXTORT", "Estorsioni", "Patrimonio ed economia", False),
    ("USURY", "Usura", "Patrimonio ed economia", True),
    ("RECEIV", "Ricettazione", "Patrimonio ed economia", False),
    ("DAMAGE", "Danneggiamenti", "Altro", False),
    ("DRUG", "Stupefacenti", "Altro", False),
]
TYPE_IDS = [t[0] for t in TYPES]

MACRO = {
    "Piemonte": "Nord-ovest", "Valle d'Aosta": "Nord-ovest", "Liguria": "Nord-ovest", "Lombardia": "Nord-ovest",
    "Trentino-Alto Adige": "Nord-est", "Veneto": "Nord-est", "Friuli-Venezia Giulia": "Nord-est", "Emilia-Romagna": "Nord-est",
    "Toscana": "Centro", "Umbria": "Centro", "Marche": "Centro", "Lazio": "Centro",
    "Abruzzo": "Sud", "Molise": "Sud", "Campania": "Sud", "Puglia": "Sud", "Basilicata": "Sud", "Calabria": "Sud",
    "Sicilia": "Isole", "Sardegna": "Isole",
}
# I quattro capoluoghi sardi: dal 2026 ISTAT ha ricodificato i comuni sardi,
# quindi per i confini li cerchiamo per nome.
SARDINIA = {"090064": "Sassari", "091051": "Nuoro", "092009": "Cagliari", "095038": "Oristano"}
# Nomi più leggibili per alcuni capoluoghi.
RENAME = {"Bolzano/Bozen": "Bolzano", "Reggio nell'Emilia": "Reggio Emilia", "Reggio di Calabria": "Reggio Calabria"}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def fetch(url, cache_name, accept=None, tries=4, timeout=300, csv_expected=False):
    """Scarica con cache su disco e qualche tentativo: l'API ISTAT è lenta e a volte non risponde."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, cache_name)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return open(path, encoding="utf-8").read()
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"Accept": accept} if accept else {})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read().decode("utf-8")
            if not body.strip() or (csv_expected and body.lstrip().startswith("<")):
                raise RuntimeError("risposta vuota o non valida")
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)
            return body
        except Exception as e:  # noqa: BLE001 — riprova su qualsiasi errore di rete
            last = e
            log(f"  tentativo {i + 1} fallito per {cache_name}: {e}")
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"download non riuscito: {url}\n{last}")


def sdmx(flow, key, cache_name, **kw):
    log(f"ISTAT {flow} [{key[:60]}]")
    text = fetch(SDMX.format(flow=flow, key=key), cache_name, accept="application/vnd.sdmx.data+csv;version=1.0.0", csv_expected=True, **kw)
    return list(csv.DictReader(io.StringIO(text)))


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


# ---------------------------------------------------------------- delitti

def load_crimes():
    # DCCV_DELITTIPS_1: delitti denunciati dalle forze di polizia, per tipo, territorio e anno.
    # Contiene Italia, ripartizioni, regioni, province e i comuni capoluogo (codice a 6 cifre).
    rows = sdmx("73_67_DF_DCCV_DELITTIPS_1", "A.....", "delittips_1.csv")
    counts = defaultdict(lambda: defaultdict(dict))  # area -> tipo -> anno -> n
    for r in rows:
        if r["TYPE_CRIME"] not in TYPE_IDS or not r["OBS_VALUE"]:
            continue
        counts[r["REF_AREA"]][r["TYPE_CRIME"]][int(r["TIME_PERIOD"])] = int(float(r["OBS_VALUE"]))
    # DCCV_DELITTIPS_9: tassi ufficiali per 100.000 abitanti (Italia e province).
    rows9 = sdmx("73_67_DF_DCCV_DELITTIPS_9", "A.IT....", "delittips_9_it.csv")
    it_rate = defaultdict(dict)
    for r in rows9:
        if r["REF_AREA"] == "IT" and r["TYPE_CRIME"] in TYPE_IDS and r["OBS_VALUE"]:
            it_rate[r["TYPE_CRIME"]][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    return counts, it_rate


def area_names():
    # Nomi dei territori dal codelist CL_ITTER107, letti dai dati stessi (colonna REF_AREA)
    # tramite la struttura del dataflow.
    url = "https://esploradati.istat.it/SDMXWS/rest/codelist/IT1/CL_ITTER107"
    text = fetch(url, "cl_itter107.xml")
    import re
    names = {}
    for m in re.finditer(r'<structure:Code id="([^"]+)"[^>]*>(.*?)</structure:Code>', text, re.S):
        it = re.search(r'<common:Name xml:lang="it">([^<]*)</common:Name>', m.group(2))
        if it:
            names[m.group(1)] = it.group(1)
    return names


# ---------------------------------------------------------------- popolazione

def load_population(codes):
    """Popolazione residente al 1° gennaio per comune.

    2001-2019: ricostruzione intercensuaria ISTAT (DCIS_RICPOPRES2011, tutti i comuni);
    2019-2026: popolazione residente (DCIS_POPRES1). Il 2019 coincide nelle due fonti.
    """
    jan = defaultdict(dict)
    for i, grp in enumerate(chunks(codes, 14)):
        key = "A." + "+".join(grp) + ".JAN.TOTAL.9.TOTAL"
        for r in sdmx("164_164_DF_DCIS_RICPOPRES2011_24", key, f"pop_ric_{i}.csv"):
            y = int(r["TIME_PERIOD"])
            if y <= 2019:
                jan[r["REF_AREA"]][y] = int(float(r["OBS_VALUE"]))
    for i, grp in enumerate(chunks(codes, 14)):
        key = "A." + "+".join(grp) + ".JAN.9.TOTAL.99"
        for r in sdmx("22_289", key, f"pop_new_{i}.csv"):
            y = int(r["TIME_PERIOD"])
            if y >= 2019:
                if y == 2019 and y in jan[r["REF_AREA"]] and jan[r["REF_AREA"]][y] != int(float(r["OBS_VALUE"])):
                    log(f"  nota: popolazione 2019 diversa tra le fonti per {r['REF_AREA']}")
                jan[r["REF_AREA"]][y] = int(float(r["OBS_VALUE"]))
    # Popolazione media dell'anno t = media tra 1° gennaio t e 1° gennaio t+1.
    # È la convenzione ISTAT: riproduce i tassi pubblicati in DCCV_DELITTIPS_8.
    avg = {}
    for c in codes:
        j = jan.get(c, {})
        avg[c] = [round((j[y] + j[y + 1]) / 2) if y in j and y + 1 in j else None for y in YEARS]
    return avg


# ---------------------------------------------------------------- percezione

def load_perception():
    # Famiglie per percezione del rischio di criminalità nella zona in cui abitano
    # (Indagine Aspetti della vita quotidiana) — province e grandi comuni, 2022-2024.
    rows = sdmx("DF_DCSS_BEST_PPC_1_GC", "all", "best_ppc_1.csv")
    hh = defaultdict(lambda: defaultdict(dict))
    for r in rows:
        if r["GENDER"] != "T" or r["LIFE_SATISF"] != "ALL" or r["PERC_SAF_WAD"] != "ALL":
            continue
        hh[r["REF_AREA"]][int(r["TIME_PERIOD"])][r["PERC_CRIME_RISK"]] = float(r["OBS_VALUE"])
    share = {}
    for area, by_year in hh.items():
        share[area] = {}
        for y, d in by_year.items():
            if d.get("ALL"):
                share[area][y] = round(100 * (d.get("CR_V_MUCH", 0) + d.get("CR_QUITE_BIT", 0)) / d["ALL"], 1)
    # EU-SILC: famiglie che dichiarano problemi di criminalità, violenza o vandalismo
    # nella zona in cui abitano (% famiglie), Italia, 2004-2025.
    rows = sdmx("33_291", "all", "silc_33_291.csv")
    silc = {}
    for r in rows:
        if (r["REF_AREA"] == "IT" and r["PROBL_DWELLING_PLACE"] == "3"
                and all(r[k] in ("99", "9", "TOTAL") for k in (
                    "TENURE_STATUS", "NUMBER_COMPONENTS", "HOUSEHOLD_TYPOLOGY", "NUMBER_OF_MIN_CHILDREN",
                    "NUMB_OF_ELDERLY", "FIFTH_EQUIV_HOUSE_INC", "SEX_MAIN_PERCEPTOR", "AGE_MAIN_EARNIER",
                    "EDU_LEV_MAIN_EARN", "LABPROF_STATUS_C_MAIN_EARNER"))):
            silc[int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    return share, dict(sorted(silc.items()))


# ---------------------------------------------------------------- geografia

def topo_features(topo, obj):
    """Decodifica minima di TopoJSON (anelli in coordinate lon/lat) senza dipendenze."""
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(idx):
        pts = []
        for a in idx:
            seg = arcs[a] if a >= 0 else arcs[~a][::-1]
            pts.extend(seg if not pts else seg[1:])
        return pts

    for g in topo["objects"][obj]["geometries"]:
        if g["type"] == "Polygon":
            polys = [g["arcs"]]
        elif g["type"] == "MultiPolygon":
            polys = g["arcs"]
        else:
            continue
        yield g["properties"], [[ring(r) for r in p] for p in polys]


def centroid(polys):
    """Baricentro del poligono esterno più grande (basta per posizionare un punto)."""
    best, best_a = None, 0
    for p in polys:
        pts = p[0]
        a = cx = cy = 0
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
            k = x0 * y1 - x1 * y0
            a += k
            cx += (x0 + x1) * k
            cy += (y0 + y1) * k
        if a and abs(a) > best_a:
            best_a = abs(a)
            best = (cx / (3 * a), cy / (3 * a))
    return best


def load_geo():
    log("openpolis confini")
    prov_text = fetch(GEO.format(name="limits_IT_provinces.topo.json"), "limits_IT_provinces.topo.json")
    mun = json.loads(fetch(GEO.format(name="limits_IT_municipalities.topo.json"), "limits_IT_municipalities.topo.json"))
    by_code, by_name, prov_region = {}, {}, {}
    for props, polys in topo_features(mun, next(iter(mun["objects"]))):
        c = centroid(polys)
        by_code[props["com_istat_code"]] = (c, props)
        by_name.setdefault(props["name"], (c, props))
        prov_region[props["prov_istat_code"]] = props["reg_name"]
    return prov_text, by_code, by_name


# ---------------------------------------------------------------- calcoli

def rate(c, p):
    return None if c is None or not p else c / p * 1e5


def build():
    counts, it_rate = load_crimes()
    names = area_names()
    city_codes = sorted(a for a in counts if a.isdigit())
    log(f"{len(city_codes)} comuni capoluogo")
    pop = load_population(city_codes)
    share, silc = load_perception()
    prov_topo, geo_code, geo_name = load_geo()

    cities = []
    for code in city_codes:
        raw = names.get(code, code)
        name = RENAME.get(raw, raw)
        hit = geo_code.get(code)
        if code in SARDINIA:
            hit = geo_name.get(SARDINIA[code])
        if not hit:
            hit = geo_name.get(raw) or geo_name.get(name)
        if not hit:
            raise SystemExit(f"coordinate mancanti per {code} {raw}")
        (lon, lat), props = hit
        region = props["reg_name"].split("/")[0].strip()
        region = {"Valle d'Aosta": "Valle d'Aosta", "Trentino-Alto Adige": "Trentino-Alto Adige"}.get(region, region)
        if region.startswith("Trentino"):
            region = "Trentino-Alto Adige"
        if region.startswith("Valle"):
            region = "Valle d'Aosta"
        if region.startswith("Friuli"):
            region = "Friuli-Venezia Giulia"
        if region.startswith("Emilia"):
            region = "Emilia-Romagna"
        series = {}
        for t in TYPE_IDS:
            d = counts[code].get(t, {})
            series[t] = [d.get(y) for y in YEARS]
        p = pop[code]
        if p[-1] is None:
            raise SystemExit(f"popolazione mancante per {code} {name}: {p}")
        perc = share.get(code)
        cities.append({
            "id": code, "name": name, "region": region, "area": MACRO[region],
            "lon": round(lon, 4), "lat": round(lat, 4),
            "pop": p, "n": series,
            "perc": {str(y): v for y, v in sorted(perc.items())} if perc else None,
        })

    italy = {
        "rate": {t: [round(it_rate[t].get(y), 2) if it_rate[t].get(y) is not None else None for y in YEARS] for t in TYPE_IDS},
        "n": {t: [counts["IT"][t].get(y) for y in YEARS] for t in TYPE_IDS},
        "perc": {str(y): v for y, v in sorted(share.get("IT", {}).items())},
        "silc": {str(y): v for y, v in silc.items()},
    }

    data = {
        "meta": {
            "title": "Atlante della Sicurezza",
            "years": YEARS,
            "built": date.today().isoformat(),
            "sources": [
                {"id": "73_67_DF_DCCV_DELITTIPS_1", "label": "ISTAT, Delitti denunciati dalle forze di polizia all'autorità giudiziaria — per tipo di delitto (fonte: Ministero dell'Interno, banca dati SDI/SSD)"},
                {"id": "73_67_DF_DCCV_DELITTIPS_9", "label": "ISTAT, Delitti denunciati — tasso di delittuosità (Italia)"},
                {"id": "164_164_DF_DCIS_RICPOPRES2011_24", "label": "ISTAT, Popolazione residente ricostruita 2002-2019, tutti i comuni"},
                {"id": "22_289", "label": "ISTAT, Popolazione residente al 1° gennaio (2019-2026)"},
                {"id": "DF_DCSS_BEST_PPC_1_GC", "label": "ISTAT, Famiglie per percezione del rischio di criminalità nella zona in cui abitano — province e grandi comuni"},
                {"id": "33_291", "label": "ISTAT, Inquinamento, criminalità e rumore nella zona in cui si vive (EU-SILC)"},
                {"id": "openpolis/geojson-italy", "label": "Confini amministrativi ISTAT, rielaborati da openpolis (CC BY 4.0)"},
            ],
        },
        "types": [{"id": t, "label": l, "group": g, "rare": r} for t, l, g, r in TYPES],
        "italy": italy,
        "cities": cities,
    }
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "vc.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT, "italia.topo.json"), "w", encoding="utf-8") as f:
        f.write(prov_topo)
    log(f"scritto data/vc.json ({os.path.getsize(os.path.join(OUT, 'vc.json')) // 1024} KB)")
    check(data)


# ---------------------------------------------------------------- controlli

def check(data):
    """Controlli di coerenza: i tassi calcolati devono riprodurre quelli ISTAT."""
    rows8 = sdmx("73_67_DF_DCCV_DELITTIPS_8", "A.....", "delittips_8.csv")
    official = {(r["REF_AREA"], int(r["TIME_PERIOD"])): float(r["OBS_VALUE"])
                for r in rows8 if r["TYPE_CRIME"] == "TOT" and r["OBS_VALUE"]}
    worst = 0
    for c in data["cities"]:
        for i, y in enumerate(YEARS):
            o = official.get((c["id"], y))
            mine = rate(c["n"]["TOT"][i], c["pop"][i])
            if o and mine:
                worst = max(worst, abs(mine / o - 1))
    log(f"controllo tassi grandi comuni vs ISTAT: scarto massimo {worst:.2%}")
    if worst > 0.01:
        raise SystemExit("scarto superiore all'1%: verificare la popolazione")
    missing = [c["name"] for c in data["cities"] if any(p is None for p in c["pop"][5:])]
    if missing:
        log("popolazione incompleta dal 2011 per:", missing)


if __name__ == "__main__":
    build()
