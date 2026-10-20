#!/usr/bin/env python3
"""Atlante della Sicurezza — approfondimento sugli autori ignoti.

Di quanti delitti denunciati si conosce l'autore: l'ISTAT pubblica, sui dati delle forze di polizia (SDI/SSD),
i delitti commessi nell'anno di cui l'autore è noto al momento della denuncia o è stato scoperto entro l'anno.
Scrive data/autori.json con:

  italia     quota con autore noto per tipo di delitto, 2014-2024 (DCCV_DELITTIPS_6, percentuali)
  citta      i 12 grandi comuni: delitti commessi nell'anno e quanti con autore noto, per tipo (DCCV_DELITTIPS_2, conteggi)
  province   quota con autore noto sul totale dei delitti, per provincia (DCCV_DELITTIPS_7, percentuali), e quanti
             dei delitti denunciati sono furti (dai tassi di data/province.json, DCCV_DELITTIPS_9)

Uso:  python3 scripts/build_autori.py         (dalla cartella atlante-della-sicurezza/, dopo build_data.py e build_comuni.py)
Riusa la cache e le funzioni di scripts/build_data.py; i nomi delle province vengono da data/province.json.
Controlla che le quote calcolate dai conteggi delle città riproducano quelle pubblicate (DCCV_DELITTIPS_5).
"""
import json
import os
import sys
from collections import defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import OUT, TYPE_IDS, log, sdmx  # noqa: E402

YEARS = list(range(2014, 2025))
KEY = "all?startPeriod=2014"
NOTO, TOTALE = "1", "9"  # Y_KNOWN_OFFENDER_IDEN: 1 autore noto, 9 tutti i delitti


def num(r):
    return float(r["OBS_VALUE"]) if r["OBS_VALUE"] not in ("", "NaN") else None


def series(d, *key):
    return [d.get(key + (y,)) for y in YEARS]


def build():
    vc = json.load(open(os.path.join(OUT, "vc.json"), encoding="utf-8"))
    names = {c["id"]: c["name"] for c in vc["cities"]}
    prov_all = json.load(open(os.path.join(OUT, "province.json"), encoding="utf-8"))
    prov_meta, prov_years = prov_all["prov"], prov_all["meta"]["years"]

    # --- Italia: quote pubblicate, per tipo
    d6 = {}
    for r in sdmx("73_67_DF_DCCV_DELITTIPS_6", KEY, "autori_6.csv"):
        if r["REF_AREA"] == "IT" and r["DATA_TYPE"] == "CRIMEP" and r["REFERENCE_PERIOD_CRIME"] == "YRDUR":
            d6[(r["TYPE_CRIME"], int(r["TIME_PERIOD"]))] = num(r)
    types = [t for t in TYPE_IDS if any(d6.get((t, y)) is not None for y in YEARS)]
    missing = [t for t in TYPE_IDS if t not in types]
    if missing:
        log(f"  tipi senza quota nazionale: {missing}")
    italia = {t: series(d6, t) for t in types}

    # --- grandi comuni: conteggi, con il controllo sulle quote pubblicate
    d2 = defaultdict(dict)
    for r in sdmx("73_67_DF_DCCV_DELITTIPS_2", KEY, "autori_2.csv"):
        if r["DATA_TYPE"] == "CRIMEN" and r["REFERENCE_PERIOD_CRIME"] == "YRDUR" and r["TYPE_CRIME"] in types:
            d2[r["REF_AREA"]][(r["TYPE_CRIME"], r["Y_KNOWN_OFFENDER_IDEN"], int(r["TIME_PERIOD"]))] = num(r)
    d5 = {}
    for r in sdmx("73_67_DF_DCCV_DELITTIPS_5", KEY, "autori_5.csv"):
        if r["DATA_TYPE"] == "CRIMEP" and r["REFERENCE_PERIOD_CRIME"] == "YRDUR":
            d5[(r["REF_AREA"], r["TYPE_CRIME"], int(r["TIME_PERIOD"]))] = num(r)
    citta, worst, checked = [], 0.0, 0
    for cid in sorted(d2, key=lambda c: -max((v for k, v in d2[c].items() if k[:2] == ("TOT", TOTALE) and v), default=0)):
        if cid not in names:
            raise SystemExit(f"grande comune {cid} assente da vc.json")
        noto = {t: [None if v is None else int(v) for v in series(d2[cid], t, NOTO)] for t in types}
        tot = {t: [None if v is None else int(v) for v in series(d2[cid], t, TOTALE)] for t in types}
        for t in types:
            for i, y in enumerate(YEARS):
                n, k, pub = tot[t][i], noto[t][i], d5.get((cid, t, y))
                if n and k is not None and pub is not None:
                    if k > n:
                        raise SystemExit(f"{names[cid]} {t} {y}: autori noti ({k}) più dei delitti ({n})")
                    worst = max(worst, abs(100 * k / n - pub))
                    checked += 1
        citta.append({"id": cid, "name": names[cid], "noto": noto, "tot": tot})
    # le quote pubblicate hanno un decimale: lo scarto massimo atteso è 0,05 punti
    if worst > 0.051:
        raise SystemExit(f"le quote delle città non tornano con DCCV_DELITTIPS_5: scarto massimo {worst:.3f} punti")
    log(f"  città: {len(citta)}, {checked} quote controllate, scarto massimo {worst:.3f} punti")

    # --- province: quota sul totale dei delitti
    province = {}
    for r in sdmx("73_67_DF_DCCV_DELITTIPS_7", KEY, "autori_7.csv"):
        a = r["REF_AREA"]
        if a in prov_meta and r["TYPE_CRIME"] == "TOT" and r["DATA_TYPE"] == "CRIMEP" and r["REFERENCE_PERIOD_CRIME"] == "YRDUR":
            p = province.setdefault(a, {"name": prov_meta[a]["name"], "region": prov_meta[a]["region"], "cap": prov_meta[a]["caps"][0], "pct": [None] * len(YEARS)})
            y = int(r["TIME_PERIOD"])
            if y in YEARS:
                p["pct"][YEARS.index(y)] = num(r)
    # furti ogni 100 delitti denunciati nella provincia: dove pesano di più, l'autore si conosce meno
    for a, p in province.items():
        r = prov_meta[a]["rate"]
        p["furti"] = [round(100 * r["THEFT"][prov_years.index(y)] / r["TOT"][prov_years.index(y)], 1)
                      if y in prov_years and r["THEFT"][prov_years.index(y)] is not None and r["TOT"][prov_years.index(y)] else None for y in YEARS]
    lost = sorted(set(prov_meta) - set(province))
    if lost:
        raise SystemExit(f"province senza dati: {lost}")
    log(f"  province: {len(province)}")

    last = max(y for y in YEARS if italia["TOT"][YEARS.index(y)] is not None)
    data = {
        "meta": {
            "years": YEARS, "last": last, "built": date.today().isoformat(),
            "nota": "Delitti commessi nell'anno e denunciati dalle forze di polizia all'autorità giudiziaria, di cui l'autore è noto al momento della denuncia o è stato scoperto entro l'anno. Fonte: Ministero dell'Interno, banca dati SDI/SSD; elaborazione ISTAT.",
            "sources": [
                {"id": "73_67_DF_DCCV_DELITTIPS_6", "label": "ISTAT, Delitti denunciati di cui si è scoperto l'autore, per tipo di delitto — Italia (fonte: Ministero dell'Interno, banca dati SDI/SSD)"},
                {"id": "73_67_DF_DCCV_DELITTIPS_2", "label": "ISTAT, Delitti denunciati per tipo, identità dell'autore, commessi durante l'anno — grandi comuni"},
                {"id": "73_67_DF_DCCV_DELITTIPS_5", "label": "ISTAT, Delitti di cui si è scoperto l'autore, per tipo — grandi comuni (per il controllo)"},
                {"id": "73_67_DF_DCCV_DELITTIPS_7", "label": "ISTAT, Delitti di cui si è scoperto l'autore — province"},
                {"id": "73_67_DF_DCCV_DELITTIPS_9", "label": "ISTAT, Delitti denunciati — tasso di delittuosità per provincia (per la quota di furti)"},
            ],
        },
        "types": types,
        "italia": italia,
        "citta": citta,
        "province": province,
    }
    path = os.path.join(OUT, "autori.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    log(f"scritto data/autori.json ({os.path.getsize(path) // 1024} KB), ultimo anno {last}")


if __name__ == "__main__":
    build()
