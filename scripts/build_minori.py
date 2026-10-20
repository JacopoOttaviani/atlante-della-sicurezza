#!/usr/bin/env python3
"""Atlante della Sicurezza — approfondimento sui minorenni denunciati e arrestati.

L'ISTAT pubblica, sui dati delle forze di polizia (SDI/SSD), le segnalazioni di persone denunciate e arrestate o fermate:
una segnalazione per persona e per delitto, quindi chi è denunciato per tre delitti conta tre volte. Scrive data/minori.json con:

  italia    segnalazioni di minorenni per tipo di delitto, dal 2004 (DCCV_SEGNALAZPS_2), e di tutte le persone, dal 2014 (DCCV_SEGNALAZPS_1)
  regioni   le stesse due serie per regione, dal 2014

Uso:  python3 scripts/build_minori.py         (dalla cartella atlante-della-sicurezza/)
Riusa la cache e le funzioni di scripts/build_data.py. Si ferma se in qualche cella i minorenni sono più di tutte le persone.
"""
import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import OUT, TYPE_IDS, log, sdmx  # noqa: E402
from build_carceri import REGIONS  # noqa: E402

YEARS = list(range(2004, 2025))
SHARE_FROM = 2014  # le segnalazioni di tutte le persone si scaricano da qui
# codice ISTAT della regione, per la carta (data/italia.topo.json ha reg_istat_code)
REG_ISTAT = {"ITC1": "01", "ITC2": "02", "ITC4": "03", "ITDA": "04", "ITD3": "05", "ITD4": "06", "ITC3": "07", "ITD5": "08", "ITE1": "09", "ITE2": "10",
             "ITE3": "11", "ITE4": "12", "ITF1": "13", "ITF2": "14", "ITF3": "15", "ITF4": "16", "ITF5": "17", "ITF6": "18", "ITG1": "19", "ITG2": "20"}


def load(flow, key, cache, data_type):
    out = {}
    for r in sdmx(flow, key, cache):
        if r["DATA_TYPE"] == data_type and r["OBS_VALUE"] not in ("", "NaN"):
            out[(r["REF_AREA"], r["TYPE_CRIME"], int(r["TIME_PERIOD"]))] = int(float(r["OBS_VALUE"]))
    return out


def build():
    mins = load("73_342_DF_DCCV_SEGNALAZPS_2", "all", "minori_segn2.csv", "REPUN18")
    alls = load("73_342_DF_DCCV_SEGNALAZPS_1", f"all?startPeriod={SHARE_FROM}", "minori_segn1.csv", "REPN")

    bad = [(k, v, alls[k]) for k, v in mins.items() if k in alls and v > alls[k]]
    if bad:
        raise SystemExit(f"minorenni più di tutte le persone in {len(bad)} celle, per esempio {bad[:3]}")
    checked = sum(1 for k in mins if k in alls)
    log(f"  {checked} celle controllate: i minorenni non superano mai il totale")

    types = [t for t in TYPE_IDS if any(("IT", t, y) in mins for y in YEARS)]
    missing = [t for t in TYPE_IDS if t not in types]
    if missing:
        log(f"  tipi senza dati sui minorenni: {missing}")

    def block(area, years):
        return {
            "min": {t: [mins.get((area, t, y)) for y in years] for t in types},
            "tot": {t: [alls.get((area, t, y)) for y in years] for t in types},
        }

    italia = block("IT", YEARS)
    ry = [y for y in YEARS if y >= SHARE_FROM]
    regioni = []
    for code, name in REGIONS.items():
        if not any((code, "TOT", y) in mins for y in ry):
            raise SystemExit(f"regione senza dati: {name} ({code})")
        regioni.append({"id": code, "istat": REG_ISTAT[code], "name": name, **block(code, ry)})

    last = max(y for y in YEARS if italia["min"]["TOT"][YEARS.index(y)] is not None)
    data = {
        "meta": {
            "years": YEARS, "region_years": ry, "share_from": SHARE_FROM, "last": last, "built": date.today().isoformat(),
            "nota": "Segnalazioni di persone denunciate e arrestate o fermate dalle forze di polizia: una per persona e per delitto. Fonte: Ministero dell'Interno, banca dati SDI/SSD; elaborazione ISTAT.",
            "sources": [
                {"id": "73_342_DF_DCCV_SEGNALAZPS_2", "label": "ISTAT, Segnalazioni relative a minori denunciati e arrestati o fermati dalle forze di polizia, per tipo di delitto (fonte: Ministero dell'Interno, banca dati SDI/SSD)"},
                {"id": "73_342_DF_DCCV_SEGNALAZPS_1", "label": "ISTAT, Segnalazioni relative a persone denunciate e arrestate o fermate dalle forze di polizia, in totale"},
            ],
        },
        "types": types,
        "italia": italia,
        "regioni": regioni,
    }
    path = os.path.join(OUT, "minori.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    log(f"scritto data/minori.json ({os.path.getsize(path) // 1024} KB), ultimo anno {last}")


if __name__ == "__main__":
    build()
