#!/usr/bin/env python3
"""Atlante della Sicurezza — sezione rimpatri.

Scarica da Eurostat (API di diffusione, formato JSON-stat) i cittadini di paesi terzi
a cui l'Italia ha ordinato di lasciare il territorio e quelli effettivamente rimpatriati
dopo l'ordine, per cittadinanza, dal 2008. Scrive data/rimpatri.json e la carta del mondo
data/mondo.topo.json (confini GISCO della Commissione europea, senza attributi).

Uso:  python3 scripts/build_rimpatri.py        (dalla cartella atlante-della-sicurezza/)
Riusa la cache e le funzioni di scripts/build_data.py. I nomi italiani dei paesi vengono da
scripts/paesi_it.json, copia della codelist ISTAT CL_ISO: l'API ISTAT è spesso irraggiungibile.
"""
import json
import os
import re
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import OUT, fetch, log  # noqa: E402

EUROSTAT = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{flow}?{query}&lang=EN"
GISCO = "https://gisco-services.ec.europa.eu/distribution/v2/countries/{path}"

# Nomi più brevi di quelli della codelist ISTAT, per grafici e tabelle.
NAMES = {
    "XK": "Kosovo", "RS": "Serbia", "MK": "Macedonia del Nord", "DO": "Repubblica Dominicana", "LK": "Sri Lanka",
    "UK": "Regno Unito", "EL": "Grecia", "BA": "Bosnia ed Erzegovina", "CD": "Congo (Rep. Dem.)", "CG": "Congo",
    "KR": "Corea del Sud", "KP": "Corea del Nord", "IR": "Iran", "SY": "Siria", "LA": "Laos", "VN": "Vietnam",
    "RU": "Russia", "MD": "Moldova", "TZ": "Tanzania", "BO": "Bolivia", "VE": "Venezuela", "PS": "Palestina",
    "US": "Stati Uniti", "CI": "Costa d'Avorio", "GM": "Gambia", "TW": "Taiwan", "CV": "Capo Verde",
}
# Kosovo e Taiwan non hanno un punto di etichetta nei file GISCO.
POINTS_EXTRA = {"XK": [20.9, 42.6], "TW": [121.0, 23.7]}


def jsonstat(flow, query, cache_name):
    """Valori di un dataset Eurostat filtrato fino a lasciare libere solo cittadinanza e anno: {(cittadinanza, anno): valore}."""
    log(f"Eurostat {flow} [{query}]")
    d = json.loads(fetch(EUROSTAT.format(flow=flow, query=query), cache_name))
    ids, size = d["id"], d["size"]
    cats = {k: sorted(d["dimension"][k]["category"]["index"], key=d["dimension"][k]["category"]["index"].get) for k in ids}
    loose = [k for k in ids if len(cats[k]) > 1 and k not in ("citizen", "time")]
    if loose:
        raise SystemExit(f"{flow}: il filtro lascia più valori per {loose}")
    out = {}
    for i, v in d["value"].items():
        i, key = int(i), {}
        for k, s in zip(reversed(ids), reversed(size)):
            key[k] = cats[k][i % s]
            i //= s
        out[(key["citizen"], key["time"])] = v
    return cats, out, d["dimension"]["citizen"]["category"]["label"]


def italian_names():
    """Nomi italiani dei paesi: copia della codelist ISTAT CL_ISO (stessi codici a due lettere di Eurostat), senza gli "(ex …)"."""
    raw = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "paesi_it.json"), encoding="utf-8"))
    return {k: re.sub(r"\s*\(ex [^)]*\)", "", v) for k, v in raw.items()}


def build_world():
    topo = json.loads(fetch(GISCO.format(path="topojson/CNTR_RG_60M_2020_4326.json"), "gisco_cntr_60m.json"))
    name = next(iter(topo["objects"]))
    geoms = [g for g in topo["objects"][name]["geometries"] if g["properties"]["CNTR_ID"] != "AQ"]
    for g in geoms:
        g["id"] = g.pop("properties")["CNTR_ID"]
    topo["objects"] = {"paesi": {"type": "GeometryCollection", "geometries": geoms}}
    with open(os.path.join(OUT, "mondo.topo.json"), "w", encoding="utf-8") as f:
        json.dump(topo, f, separators=(",", ":"))
    log(f"scritto data/mondo.topo.json ({os.path.getsize(os.path.join(OUT, 'mondo.topo.json')) // 1024} KB)")
    labels = json.loads(fetch(GISCO.format(path="geojson/CNTR_LB_2020_4326.geojson"), "gisco_cntr_lb.geojson"))
    pts = {f["properties"]["CNTR_ID"]: [round(c, 2) for c in f["geometry"]["coordinates"]] for f in labels["features"]}
    pts.update(POINTS_EXTRA)
    return pts


def build():
    cr, R, en = jsonstat("migr_eirtn", "geo=IT&age=TOTAL&sex=T&c_dest=TOTAL&unit=PER", "eurostat_eirtn_it.json")
    co, O, _ = jsonstat("migr_eiord", "geo=IT&age=TOTAL&sex=T&unit=PER", "eurostat_eiord_it.json")
    years = sorted(set(cr["time"]) & set(co["time"]))

    tot_r = [R.get(("TOTAL", y)) for y in years]
    tot_o = [O.get(("TOTAL", y)) for y in years]
    if None in tot_r or None in tot_o:
        raise SystemExit(f"totali mancanti: rimpatri {tot_r}, ordini {tot_o}")

    it_names = italian_names()
    pts = build_world()
    paesi = []
    for c in cr["citizen"]:
        if len(c) != 2:
            continue  # aggregati, apolidi, sconosciuti
        r = [R.get((c, y)) for y in years]
        o = [O.get((c, y)) for y in years]
        if not any(r):
            continue
        name = NAMES.get(c) or it_names.get(c)
        if not name:
            name = en.get(c, c)
            log(f"  {c}: nessun nome italiano, uso '{name}' (aggiungerlo a NAMES)")
        if c not in pts:
            log(f"  {c} ({name}): nessun punto sulla carta")
        paesi.append({"id": c, "name": name, "ll": pts.get(c), "r": [int(v) if v is not None else None for v in r],
                      "o": [int(v) if v is not None else None for v in o]})
    paesi.sort(key=lambda p: -sum(v or 0 for v in p["r"]))

    # Controllo: i paesi devono quasi tornare con il totale (Eurostat arrotonda ogni cella a 5).
    for i, y in enumerate(years):
        s = sum(p["r"][i] or 0 for p in paesi)
        slack = max(50, 0.03 * tot_r[i])
        if abs(s - tot_r[i]) > slack:
            raise SystemExit(f"{y}: la somma per paese ({s}) non torna con il totale dei rimpatri ({tot_r[i]})")

    data = {
        "meta": {
            "years": [int(y) for y in years], "last": int(years[-1]), "built": date.today().isoformat(),
            "origine": pts["IT"],
            "nota": "Cittadini di paesi terzi (non UE) che hanno lasciato l'Italia dopo un ordine di allontanamento, per cittadinanza. Valori arrotondati a 5. Fonte: Eurostat, statistiche sull'applicazione della normativa sull'immigrazione, su dati del Ministero dell'Interno.",
            "sources": [
                {"id": "migr_eirtn", "label": "Eurostat, Cittadini di paesi terzi rimpatriati dopo un ordine di lasciare il territorio (dati annuali, arrotondati)"},
                {"id": "migr_eiord", "label": "Eurostat, Cittadini di paesi terzi a cui è stato ordinato di lasciare il territorio (dati annuali, arrotondati)"},
                {"id": "CNTR_RG_60M_2020", "label": "Commissione europea, GISCO: confini dei paesi del mondo (© EuroGeographics per i confini amministrativi)"},
            ],
        },
        "totale": {"rimpatri": [int(v) for v in tot_r], "ordini": [int(v) for v in tot_o]},
        "paesi": paesi,
    }
    with open(os.path.join(OUT, "rimpatri.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    log(f"scritto data/rimpatri.json ({os.path.getsize(os.path.join(OUT, 'rimpatri.json')) // 1024} KB), {len(paesi)} paesi, {years[0]}–{years[-1]}")


if __name__ == "__main__":
    build()
