#!/usr/bin/env python3
"""Atlante della sicurezza — sezione carceri.

Scarica da ISTAT (API SDMX) i dati sui detenuti adulti presenti nelle carceri
italiane (fonte originaria: Ministero della Giustizia, DAP) e, quando il server
risponde, la serie degli stranieri residenti per il confronto. Scrive data/carceri.json.

Uso:  python3 scripts/build_carceri.py        (dalla cartella atlante-della-sicurezza/)
Riusa la cache e le funzioni di scripts/build_data.py.
"""
import csv
import io
import json
import os
import re
import sys
import time
import urllib.request
import zipfile
from collections import defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import CACHE, OUT, fetch, log, sdmx  # noqa: E402

YEARS = list(range(2010, 2026))

# Albero della treemap: continente -> foglie (codici CL_ISO di DCCV_DETENUTI_4).
# "Europa" nel dataset include l'Italia: gli altri europei si ricavano per differenza.
TREE = [
    ("Africa", "AFR", [("MA", "Marocco"), ("TN", "Tunisia"), ("NG", "Nigeria"), ("DZ", "Algeria"), ("AFR_OTH", "Altri paesi africani")]),
    ("Europa", "EUR", [("RO", "Romania"), ("AL", "Albania"), ("EUR_OTH", "Altri paesi europei")]),
    ("Asia", "ASI", [("X1023", "Medio Oriente"), ("ASI_OTH", "Altri paesi asiatici")]),
    ("America", "AME", [("AME_S", "Sud America"), ("AME_C", "America centrale"), ("AME_N", "America settentrionale")]),
    ("Altri", "OTH", [("OTH", "Altri e apolidi")]),
]

# Reati mostrati nel confronto italiani/stranieri (codici CL_GIUST_REATO).
OFFENCES = ["STU", "RA", "FU", "LPV", "RIC", "VIR", "AFS", "ES", "VPV_MIN", "OMV", "CA", "MAL", "VS", "TR", "ISFF"]

LEGAL = {"AWFJ": "attesa di primo giudizio", "APP": "appellanti", "REC": "ricorrenti", "MWOD": "misti senza definitivo",
         "CONVFJ": "condannati definitivi", "MWD": "misti con definitivo", "SUBSM": "misure di sicurezza"}
AGES = ["Y18-20", "Y21-24", "Y25-29", "Y30-34", "Y35-39", "Y40-44", "Y45-49", "Y50-59", "Y60-69", "Y_GE70"]
REGIONS = {"ITC1": "Piemonte", "ITC2": "Valle d'Aosta", "ITC3": "Liguria", "ITC4": "Lombardia", "ITDA": "Trentino-Alto Adige",
           "ITD3": "Veneto", "ITD4": "Friuli-Venezia Giulia", "ITD5": "Emilia-Romagna", "ITE1": "Toscana", "ITE2": "Umbria",
           "ITE3": "Marche", "ITE4": "Lazio", "ITF1": "Abruzzo", "ITF2": "Molise", "ITF3": "Campania", "ITF4": "Puglia",
           "ITF5": "Basilicata", "ITF6": "Calabria", "ITG1": "Sicilia", "ITG2": "Sardegna"}


def rows(flow_suffix, cache_name):
    data = sdmx(f"73_173_DF_DCCV_DETENUTI_{flow_suffix}", "all", cache_name)
    return [r for r in data if r["OBS_VALUE"] != ""]


def val(rs, **where):
    out = [float(r["OBS_VALUE"]) for r in rs if all(r[k] == v for k, v in where.items())]
    return out[0] if out else None


def offence_names():
    # I nomi dei reati vengono dalla struttura del dataflow (codelist CL_GIUST_REATO), salvata in cache.
    cache = os.path.join(os.path.dirname(OUT), "scripts", ".cache", "codelists_det.json")
    if os.path.exists(cache):
        return json.load(open(cache, encoding="utf-8")).get("CL_GIUST_REATO", {})
    text = fetch("https://esploradati.istat.it/SDMXWS/rest/dataflow/IT1/73_173_DF_DCCV_DETENUTI_1/1.0?references=all&detail=full", "dsd_detenuti.xml")
    m = re.search(r'<structure:Codelist id="CL_GIUST_REATO".*?</structure:Codelist>', text, re.S)
    names = {}
    for c in re.finditer(r'<structure:Code id="([^"]+)"[^>]*>(.*?)</structure:Code>', m.group(0), re.S):
        it = re.search(r'<common:Name xml:lang="it">([^<]*)</common:Name>', c.group(2))
        if it:
            names[c.group(1)] = it.group(1)
    return names


# Fonte degli stranieri residenti: l'API SDMX (29_7) è la prima scelta; se non risponde, lo stesso dato dal sito
# ISTAT "Demografia in cifre" (demo.istat.it), che pubblica i file dal 2019 in poi. Nel JSON la provenienza è in residenti.fonte.
SRC_SDMX = {"id": "29_7", "label": "ISTAT, Stranieri residenti al 1° gennaio"}
SRC_DEMO = {"id": "demo.istat.it", "label": "ISTAT, Demografia in cifre: popolazione straniera residente al 1° gennaio"}
DEMO_ZIP = "https://demo.istat.it/data/strasa/STRASA_{year}_it_Ripartizioni.zip"
DEMO_YEARS = [y for y in YEARS if y >= 2019]


def fetch_bytes(url, cache_name, tries=3, timeout=60):
    """Come fetch() di build_data.py, ma per file binari (zip)."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, cache_name)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return open(path, "rb").read()
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url), timeout=timeout) as r:
                body = r.read()
            if not body.startswith(b"PK"):
                raise RuntimeError("risposta non valida (non è uno zip)")
            with open(path, "wb") as f:
                f.write(body)
            return body
        except Exception as e:  # noqa: BLE001
            last = e
            log(f"  tentativo {i + 1} fallito per {cache_name}: {e}")
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"download non riuscito: {url}\n{last}")


def population():
    """Popolazione residente totale al 1° gennaio: 22_289 dal 2019, ricostruzione intercensuaria prima."""
    pop = {}
    for flow, key, name in (("22_289", "A.IT.JAN.9.TOTAL.99", "pop_it_new.csv"), ("164_164_DF_DCIS_RICPOPRES2011_1", "A.IT.JAN.TOTAL.9.TOTAL", "pop_it_old.csv")):
        try:
            for r in sdmx(flow, key, name, tries=1, timeout=25):
                if r["OBS_VALUE"]:
                    pop.setdefault(int(r["TIME_PERIOD"]), int(float(r["OBS_VALUE"])))
        except Exception as e:  # noqa: BLE001
            log(f"  popolazione {flow} non disponibile: {e}")
    return pop


def residents_sdmx(pop):
    """Stranieri residenti al 1° gennaio dal dataflow 29_7 (sesso 9 = totale, età totale)."""
    s = sdmx("29_7", "A.IT...", "str_it.csv", tries=1, timeout=25)
    strn = {}
    for r in s:
        if r["SEX"] == "9" and r["AGE"] in ("TOTAL", "Y_GE0", "ALL") and r["OBS_VALUE"]:
            strn.setdefault(int(r["TIME_PERIOD"]), {})[r["DATA_TYPE"]] = float(r["OBS_VALUE"])
    series = {}
    for y, d in strn.items():
        v = d.get("JAN") or d.get("STRRES") or (list(d.values())[0] if len(d) == 1 else None)
        if v and y in pop:
            series[y] = {"stranieri": int(v), "pop": pop[y], "quota": round(100 * v / pop[y], 1)}
    if not series:
        raise RuntimeError("struttura inattesa, DATA_TYPE = " + str(sorted({k for d in strn.values() for k in d})))
    return series


def residents_demo(pop):
    """Ripiego: la stessa serie ISTAT dal sito Demografia in cifre (demo.istat.it), un csv per anno con le cinque
    ripartizioni per età e sesso; la riga con età 999 è il totale, l'Italia è la somma delle ripartizioni."""
    series = {}
    for y in DEMO_YEARS:
        if y not in pop:
            continue
        try:
            raw = fetch_bytes(DEMO_ZIP.format(year=y), f"strasa_{y}.zip", tries=1, timeout=60)
        except Exception as e:  # noqa: BLE001
            log(f"  demo.istat.it {y}: {e}")
            continue
        zf = zipfile.ZipFile(io.BytesIO(raw))
        lines = zf.read(zf.infolist()[0]).decode("utf-8-sig").splitlines()
        rows = list(csv.reader(io.StringIO("\n".join(lines[1:])), delimiter=";"))
        hdr = rows[0]
        if hdr[:5] != ["Codice ripartizione", "Ripartizione", "Età", "Maschi", "Femmine"]:
            raise SystemExit(f"demo.istat.it {y}: intestazione inattesa {hdr}")
        tot = [int(r[3]) + int(r[4]) for r in rows[1:] if r[2] == "999"]
        if len(tot) != 5 or sum(tot) != sum(int(r[3]) + int(r[4]) for r in rows[1:] if r[2] != "999"):
            raise SystemExit(f"demo.istat.it {y}: le ripartizioni o le età non tornano")
        if "(stima)" in lines[0]:
            log(f"  demo.istat.it {y}: dato segnato come stima, non usato")
            continue
        series[y] = {"stranieri": sum(tot), "pop": pop[y], "quota": round(100 * sum(tot) / pop[y], 1)}
    return series


def try_residents():
    """Stranieri residenti e popolazione totale (1° gennaio): (residenti, per cittadinanza, fonti).
    residenti = {"fonte": "sdmx" | "demo.istat.it", "fonte_label": ..., "anni": {anno: {stranieri, pop, quota} | None}};
    None se nessuna delle due fonti risponde. Gli anni senza dato restano null, non si stimano."""
    pop = population()
    sources = []
    series = None
    fonte = None
    if pop:
        try:
            series = residents_sdmx(pop)
            fonte, src = "sdmx", SRC_SDMX
        except Exception as e:  # noqa: BLE001
            log(f"  stranieri residenti (SDMX 29_7) non disponibili: {e}")
            series = residents_demo(pop) or None
            fonte, src = "demo.istat.it", SRC_DEMO
            if series:
                log(f"  stranieri residenti presi da demo.istat.it per gli anni {min(series)}–{max(series)}")
    if not series:
        return None, None, sources
    sources.append(src)
    residenti = {"fonte": fonte, "fonte_label": src["label"].split(":")[0], "anni": {str(y): series.get(y) for y in YEARS}}
    cit = None
    try:
        c = sdmx("29_317", "A.IT..9.", "str_cit.csv", tries=1, timeout=25)
        last = max(int(r["TIME_PERIOD"]) for r in c if r["OBS_VALUE"])
        cit = {"anno": last, "paesi": {r["CITIZENSHIP"]: int(float(r["OBS_VALUE"])) for r in c if r["OBS_VALUE"] and int(r["TIME_PERIOD"]) == last}}
    except Exception as e:  # noqa: BLE001
        log(f"  stranieri residenti per cittadinanza non disponibili: {e}")
    return residenti, cit, sources


def build():
    d1, d2, d4, d5, d6 = (rows(i, f"detenuti_{i}.csv") for i in (1, 2, 4, 5, 6))
    names = offence_names()
    it = lambda rs, **w: [val(rs, REF_AREA="IT", SEX="9", TIME_PERIOD=str(y), **w) for y in YEARS]  # noqa: E731

    # --- totali e quota stranieri, Italia e regioni
    tot = it(d4, CITIZENSHIP="WORLD")
    forn = it(d4, CITIZENSHIP="WRL_X_ITA")
    ita = it(d4, CITIZENSHIP="IT")
    donne = [val(d4, REF_AREA="IT", SEX="2", TIME_PERIOD=str(y), CITIZENSHIP="WORLD") for y in YEARS]
    donne_str = [val(d4, REF_AREA="IT", SEX="2", TIME_PERIOD=str(y), CITIZENSHIP="WRL_X_ITA") for y in YEARS]
    last = YEARS[-1]
    regioni = []
    for code, name in REGIONS.items():
        w = val(d4, REF_AREA=code, SEX="9", TIME_PERIOD=str(last), CITIZENSHIP="WORLD")
        f = val(d4, REF_AREA=code, SEX="9", TIME_PERIOD=str(last), CITIZENSHIP="WRL_X_ITA")
        if w:
            regioni.append({"id": code, "name": name, "tot": int(w), "str": int(f), "quota": round(100 * f / w, 1)})
    regioni.sort(key=lambda r: -r["quota"])

    # --- albero per cittadinanza, ogni anno, con controllo di quadratura
    tree = {}
    for y in YEARS:
        g = lambda c: val(d4, REF_AREA="IT", SEX="9", TIME_PERIOD=str(y), CITIZENSHIP=c)  # noqa: E731
        groups = []
        leaves_sum = 0
        for cont, ccode, leaves in TREE:
            kids = []
            for lc, lname in leaves:
                v = g("EUR") - g("IT") - g("RO") - g("AL") if lc == "EUR_OTH" else g(lc)
                kids.append({"id": lc, "name": lname, "n": int(v)})
            cont_total = (g(ccode) - g("IT")) if ccode == "EUR" else g(ccode)
            if abs(sum(k["n"] for k in kids) - cont_total) > 0.5:
                raise SystemExit(f"{y} {cont}: le foglie ({sum(k['n'] for k in kids)}) non tornano con il totale del continente ({cont_total})")
            leaves_sum += cont_total
            groups.append({"name": cont, "n": int(cont_total), "children": kids})
        if abs(leaves_sum - g("WRL_X_ITA")) > 0.5:
            raise SystemExit(f"{y}: i continenti ({leaves_sum}) non tornano con il totale stranieri ({g('WRL_X_ITA')})")
        tree[str(y)] = groups

    # --- reati: detenuti con almeno un reato di questo tipo ogni 100 detenuti (italiani vs stranieri)
    reati = []
    for code in OFFENCES:
        a = val(d1, SEX="9", TIME_PERIOD=str(last), DATA_TYPE="PRISONERT", TYPE_OFFENCE=code, CITIZENSHIP="IT")
        b = val(d1, SEX="9", TIME_PERIOD=str(last), DATA_TYPE="PRISONERT", TYPE_OFFENCE=code, CITIZENSHIP="WRL_X_ITA")
        n = val(d1, SEX="9", TIME_PERIOD=str(last), DATA_TYPE="PRISONER", TYPE_OFFENCE=code, CITIZENSHIP="WORLD")
        reati.append({"id": code, "name": names.get(code, code), "it": a, "str": b, "n": int(n) if n else None})

    # --- posizione giuridica
    def legal(c):
        return {k: int(val(d5, REF_AREA="IT", SEX="9", TIME_PERIOD=str(last), LEGAL_POSITION=k, CITIZENSHIP=c) or 0) for k in LEGAL}
    posizione = {"it": legal("IT"), "str": legal("WRL_X_ITA"), "labels": LEGAL}

    # --- età
    def age(c):
        return [int(val(d2, REF_AREA="IT", SEX="9", TIME_PERIOD=str(last), AGE=a, CITIZENSHIP=c) or 0) for a in AGES]
    eta = {"classi": AGES, "it": age("IT"), "str": age("WRL_X_ITA")}

    # --- capienza
    capienza = [val(d6, REF_AREA="IT", SEX="9", TIME_PERIOD=str(y), DATA_TYPE="CAPACITY") for y in YEARS]
    affoll = [val(d6, REF_AREA="IT", SEX="9", TIME_PERIOD=str(y), DATA_TYPE="PRISONERP") for y in YEARS]

    residenti, residenti_cit, res_sources = try_residents()

    data = {
        "meta": {
            "years": YEARS, "last": last, "built": date.today().isoformat(),
            "nota": "Detenuti adulti presenti negli istituti penitenziari a fine anno. Fonte: Ministero della Giustizia, Dipartimento dell'amministrazione penitenziaria; elaborazione ISTAT.",
            "sources": [
                {"id": "73_173_DF_DCCV_DETENUTI_4", "label": "ISTAT, Detenuti adulti presenti nelle carceri italiane — provenienza geografica"},
                {"id": "73_173_DF_DCCV_DETENUTI_1", "label": "ISTAT, Detenuti adulti — reati"},
                {"id": "73_173_DF_DCCV_DETENUTI_2", "label": "ISTAT, Detenuti adulti — età"},
                {"id": "73_173_DF_DCCV_DETENUTI_5", "label": "ISTAT, Detenuti adulti — posizione giuridica"},
                {"id": "73_173_DF_DCCV_DETENUTI_6", "label": "ISTAT, Capienza delle strutture e detenuti ogni 100 posti"},
            ] + res_sources,
        },
        "serie": {"tot": tot, "str": forn, "it": ita, "donne": donne, "donne_str": donne_str, "capienza": capienza, "affollamento": affoll},
        "regioni": regioni,
        "albero": tree,
        "reati": reati,
        "posizione": posizione,
        "eta": eta,
        "residenti": residenti,
        "residenti_cittadinanza": residenti_cit,
    }
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "carceri.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    log(f"scritto data/carceri.json ({os.path.getsize(os.path.join(OUT, 'carceri.json')) // 1024} KB); stranieri residenti: {residenti['fonte'] if residenti else 'non disponibili'}")


if __name__ == "__main__":
    build()
