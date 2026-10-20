#!/usr/bin/env python3
"""Atlante della Sicurezza — tutti i comuni italiani, con i dati della loro provincia.

L'ISTAT pubblica i delitti denunciati comune per comune solo per i capoluoghi.
Per ogni altro comune il dato ufficiale più vicino è quello della provincia.
Questo script scrive:

  data/comuni.json    tutti i comuni (elenco ufficiale ISTAT) con la provincia
                      di cui l'ISTAT pubblica i delitti e, se è un capoluogo,
                      il codice usato in data/vc.json
  data/province.json  tassi ufficiali di delittuosità per provincia, tipo di
                      delitto e anno (DCCV_DELITTIPS_9), percezione del rischio
                      di criminalità per provincia (2022-2024) e, quando l'API
                      li restituisce, i conteggi (DCCV_DELITTIPS_1)

Uso:  python3 scripts/build_comuni.py        (dopo build_data.py, dalla cartella atlante-della-sicurezza/)
Solo libreria standard.
"""
import csv
import io
import json
import os
import re
import sys
import unicodedata
import urllib.request
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import CACHE, OUT, TYPE_IDS, YEARS, RENAME, MACRO, GEO, fetch, log, sdmx, load_perception, perception_households, topo_features, centroid  # noqa: E402

ELENCO = "https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv"

# Per la Sardegna l'ISTAT pubblica i delitti secondo le quattro province storiche
# (Sassari, Nuoro, Cagliari, Oristano). Ogni comune sardo va nella provincia del suo
# codice comunale 1995-2005 (colonna 18 dell'elenco ISTAT), cioè quella in cui si trovava
# quando le province erano quattro: la corrispondenza viene dal codelist CL_ITTER107.
SARDINIA = "Sardegna"
# La percezione del rischio (DF_DCSS_BEST_PPC_1_GC) segue invece le province di oggi: per ogni sigla, il codice
# dell'area nel dataflow. Nella scheda di un comune sardo la percezione è quella della sua provincia di oggi;
# per la provincia storica (il grafico della percezione) si sommano le famiglie delle province di oggi i cui
# comuni stanno per lo più in quella storica: Cagliari storica = Cagliari più Sud Sardegna.
SARD_PERC = {"SS": "ITG25", "NU": "ITG26", "CA": "ITG27", "OR": "ITG28", "SU": "IT111"}

PROV_RENAME = {"Bolzano / Bozen": "Bolzano", "Valle d'Aosta / Vallée d'Aoste": "Aosta", "Reggio nell'Emilia": "Reggio Emilia", "Reggio di Calabria": "Reggio Calabria"}


def region_name(raw):
    r = raw.split("/")[0].strip()
    for k in ("Trentino", "Valle", "Friuli", "Emilia"):
        if r.startswith(k):
            return {"Trentino": "Trentino-Alto Adige", "Valle": "Valle d'Aosta", "Friuli": "Friuli-Venezia Giulia", "Emilia": "Emilia-Romagna"}[k]
    return r


def csv_complete(text):
    """Un CSV troncato (l'API ISTAT a volte si ferma a metà) non è un dato valido."""
    if not text.endswith("\n"):
        return False
    lines = text.rstrip("\n").split("\n")
    if len(lines) < 2:
        return False
    n = len(next(csv.reader([lines[0]])))
    return len(next(csv.reader([lines[-1]]))) == n


def read_cache_csv(name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        return None
    text = open(path, encoding="utf-8").read()
    if not csv_complete(text):
        log(f"  {name} è incompleto: lo ignoro")
        return None
    return list(csv.DictReader(io.StringIO(text)))


def load_elenco():
    """Elenco ufficiale ISTAT dei comuni: latin-1, separato da punto e virgola, intestazione su più righe."""
    path = os.path.join(CACHE, "elenco_comuni.csv")
    if not (os.path.exists(path) and os.path.getsize(path) > 0):
        log("ISTAT elenco comuni")
        with urllib.request.urlopen(ELENCO, timeout=120) as r:
            data = r.read()
        with open(path, "wb") as f:
            f.write(data)
    text = open(path, "rb").read().decode("latin-1")
    rows = list(csv.reader(io.StringIO(text), delimiter=";"))
    head, rows = rows[0], [r for r in rows[1:] if len(r) >= 20 and r[4].strip()]
    if len(rows) < 7800:
        raise SystemExit(f"elenco comuni troppo corto: {len(rows)} righe")
    return head, rows


def load_codelist():
    """CL_ITTER107: nomi dei territori e, per ogni comune, il codice della provincia (Parent)."""
    url = "https://esploradati.istat.it/SDMXWS/rest/codelist/IT1/CL_ITTER107"
    text = fetch(url, "cl_itter107.xml")
    if not text.rstrip().endswith(">"):
        raise SystemExit("cl_itter107.xml incompleto: cancellarlo da scripts/.cache e rilanciare")
    names, parent = {}, {}
    for m in re.finditer(r'<structure:Code id="([^"]+)"[^>]*>(.*?)</structure:Code>', text, re.S):
        it = re.search(r'<common:Name xml:lang="it">([^<]*)</common:Name>', m.group(2))
        if it:
            names[m.group(1)] = it.group(1)
        p = re.search(r'<structure:Parent>\s*<Ref id="([^"]+)"', m.group(2))
        if p:
            parent[m.group(1)] = p.group(1)
    return names, parent


def load_rates():
    """Tassi ufficiali per 100.000 abitanti, per provincia (DCCV_DELITTIPS_9).

    È lo stesso file che build_data.py scarica per l'Italia: l'API restituisce anche
    ripartizioni, regioni e province. Se mancano le province, riscarica tutto."""
    rows = read_cache_csv("delittips_9_it.csv")
    if rows is None or not any(len(r["REF_AREA"]) == 5 for r in rows):
        rows = sdmx("73_67_DF_DCCV_DELITTIPS_9", "A.....", "delittips_9.csv")
    rate = defaultdict(lambda: defaultdict(dict))
    for r in rows:
        a = r["REF_AREA"]
        if len(a) == 5 and r["TYPE_CRIME"] in TYPE_IDS and r["OBS_VALUE"] and r.get("DATA_TYPE", "CRIMET") == "CRIMET":
            rate[a][r["TYPE_CRIME"]][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    return rate


def load_counts(codes):
    """Conteggi per provincia (DCCV_DELITTIPS_1). Facoltativi: l'API ISTAT è spesso irraggiungibile.

    Con i conteggi lo strumento distingue le variazioni significative da quelle dovute al caso;
    senza, mostra i tassi e lo dice."""
    rows = read_cache_csv("delittips_1_prov.csv")
    if rows is None:
        key = "A." + "+".join(sorted(codes)) + ".CRIMEN." + "+".join(TYPE_IDS) + ".9.YRDUR"
        try:
            rows = sdmx("73_67_DF_DCCV_DELITTIPS_1", key, "delittips_1_prov.csv", tries=1, timeout=90)
        except Exception as e:  # noqa: BLE001
            log(f"  conteggi provinciali non disponibili ({str(e).splitlines()[0]}): uso solo i tassi")
            return None
    n = defaultdict(lambda: defaultdict(dict))
    for r in rows:
        if r["REF_AREA"] in codes and r["TYPE_CRIME"] in TYPE_IDS and r["OBS_VALUE"]:
            n[r["REF_AREA"]][r["TYPE_CRIME"]][int(r["TIME_PERIOD"])] = int(float(r["OBS_VALUE"]))
    missing = [c for c in codes if "TOT" not in n.get(c, {})]
    if missing:
        log(f"  conteggi incompleti per {len(missing)} province: uso solo i tassi")
        return None
    return n


def norm(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def load_points():
    """Un punto per comune, per la mappa di posizione della scheda: il baricentro del confine
    ISTAT (rielaborato da openpolis, lo stesso file usato da build_data.py)."""
    mun = json.loads(fetch(GEO.format(name="limits_IT_municipalities.topo.json"), "limits_IT_municipalities.topo.json"))
    by_code, by_name = {}, defaultdict(list)
    for props, polys in topo_features(mun, next(iter(mun["objects"]))):
        c = centroid(polys)
        if not c:
            continue
        by_code[props["com_istat_code"]] = c
        by_name[(norm(props["name"]), region_name(props["reg_name"]))].append(c)
    return by_code, by_name


def sardinia_perception(sard):
    """Percezione del rischio in Sardegna: per provincia di oggi (le schede) e per provincia storica (il grafico).

    Ogni provincia di oggi va nella provincia storica che contiene la maggior parte dei suoi comuni; la quota
    della provincia storica si ricalcola sommando le famiglie, non facendo la media delle quote."""
    hh = perception_households()
    unknown = sorted({c["sigla"] for c in sard} - set(SARD_PERC))
    if unknown or any(a not in hh for a in SARD_PERC.values()):
        raise SystemExit(f"percezione sarda: sigle senza area {unknown}, aree mancanti "
                         f"{[a for a in SARD_PERC.values() if a not in hh]}: aggiornare SARD_PERC")
    by_sigla = defaultdict(Counter)
    unit = {}
    for c in sard:
        by_sigla[c["sigla"]][c["prov"]] += 1
        unit[c["sigla"]] = c["unit"]
    perc_sigla, groups = {}, defaultdict(list)
    for s, area in SARD_PERC.items():
        perc_sigla[s] = {"name": unit[s], "perc": {str(y): round(100 * r / t, 1) for y, (r, t) in sorted(hh[area].items())}}
        groups[by_sigla[s].most_common(1)[0][0]].append(s)
    perc_hist = {}
    for p, sigle in groups.items():
        years = sorted(set.intersection(*(set(hh[SARD_PERC[s]]) for s in sigle)))
        perc_hist[p] = {
            "perc": {y: round(100 * sum(hh[SARD_PERC[s]][y][0] for s in sigle) / sum(hh[SARD_PERC[s]][y][1] for s in sigle), 1) for y in years},
            "da": sorted(unit[s] for s in sigle),
        }
    log("percezione sarda per provincia storica: " + "; ".join(f"{p} = {' + '.join(v['da'])}" for p, v in sorted(perc_hist.items())))
    return perc_sigla, perc_hist


def build():
    head, rows = load_elenco()
    names, parent = load_codelist()
    rate = load_rates()
    prov_codes = sorted(rate)
    log(f"{len(prov_codes)} province con tassi ufficiali")
    vc = json.load(open(os.path.join(OUT, "vc.json"), encoding="utf-8"))
    cities = {c["id"]: c for c in vc["cities"]}

    def resolve(code):
        p = parent.get(code)
        return p if p in rate else None

    # colonne dell'elenco: 4 codice attuale, 6 nome italiano, 7 nome in altra lingua, 10 regione,
    # 11 unità sovracomunale, 13 capoluogo, 14 sigla, 16/17/18 codici comunali 2010-16, 2006-09, 1995-2005
    comuni, prov_of = [], {}
    by_code = {}
    for r in rows:
        code = r[4].strip()
        alt_codes = [c.strip().zfill(6) for c in (r[16], r[17], r[18]) if c.strip()]
        if r[10] == SARDINIA:
            p = resolve(r[18].strip().zfill(6)) if r[18].strip() else None
        else:
            p = resolve(code)
            for c in alt_codes if p is None else []:  # comuni nati da fusioni recenti
                p = resolve(c)
                if p:
                    break
        if p is None:
            raise SystemExit(f"provincia non trovata per {code} {r[6]} ({r[11]})")
        for c in [code] + alt_codes:
            by_code.setdefault(c, (r, p))
        prov_of[code] = p
        comuni.append({"code": code, "name": r[6].strip(), "alt": r[7].strip(), "region": region_name(r[10]),
                       "unit": r[11].strip(), "sigla": r[14].strip(), "prov": p, "full": r[5].strip()})

    # posizione: prima per codice, poi per nome nella stessa regione (i comuni sardi hanno cambiato codice)
    pt_code, pt_name = load_points()
    no_point = []
    for c in comuni:
        pt = pt_code.get(c["code"])
        if pt is None:
            for nm in (c["full"], c["name"]):
                cand = pt_name.get((norm(nm), c["region"]), [])
                if len(cand) == 1:
                    pt = cand[0]
                    break
        c["pt"] = [round(pt[0] * 100), round(pt[1] * 100)] if pt else None
        if pt is None:
            no_point.append(c["name"])
    log(f"posizione trovata per {len(comuni) - len(no_point)} comuni su {len(comuni)}" + (f"; mancano: {', '.join(no_point[:12])}" if no_point else ""))

    # i 108 capoluoghi di vc.json: codice attuale o, per chi l'ha cambiato, uno dei codici storici
    caps = defaultdict(list)
    city_of = {}
    for cid, c in cities.items():
        hit = by_code.get(cid)
        if not hit:
            raise SystemExit(f"capoluogo {cid} {c['name']} assente dall'elenco comuni")
        r, p = hit
        city_of[r[4].strip()] = cid
        caps[p].append(cid)
    if len(city_of) != len(cities):
        raise SystemExit("due capoluoghi corrispondono allo stesso comune")
    missing_cap = [p for p in prov_codes if not caps.get(p)]
    if missing_cap:
        raise SystemExit(f"province senza capoluogo: {missing_cap}")

    # slug unici: nome e sigla, come nell'indirizzo della scheda
    seen = Counter((norm(c["name"]), c["sigla"]) for c in comuni)
    dup = [k for k, v in seen.items() if v > 1]
    if dup:
        raise SystemExit(f"comuni con lo stesso nome nella stessa provincia: {dup}")

    counts = load_counts(prov_codes)
    share, _ = load_perception()
    perc_sigla, perc_hist = sardinia_perception([c for c in comuni if c["region"] == SARDINIA])
    region_by_prov = {}
    for c in comuni:
        region_by_prov.setdefault(c["prov"], Counter())[c["region"]] += 1
    n_comuni = Counter(c["prov"] for c in comuni)

    prov_out = {}
    for p in prov_codes:
        raw = names.get(p, p)
        region = region_by_prov[p].most_common(1)[0][0]
        rec = {
            "name": PROV_RENAME.get(raw, raw),
            "region": region,
            "area": MACRO[region],
            "caps": sorted(caps[p], key=lambda cid: -cities[cid]["pop"][-1]),
            "comuni": n_comuni[p],
            "rate": {t: [rate[p][t].get(y) for y in YEARS] for t in TYPE_IDS},
        }
        if counts:
            rec["n"] = {t: [counts[p][t].get(y) for y in YEARS] for t in TYPE_IDS}
            # popolazione media implicita nel tasso ufficiale: serve ai test sulle variazioni
            rec["pop"] = [round(n / rt * 1e5) if n and rt else None for n, rt in zip(rec["n"]["TOT"], rec["rate"]["TOT"])]
        perc = perc_hist[p]["perc"] if p in perc_hist else share.get(p)
        if perc:
            rec["perc"] = {str(y): v for y, v in sorted(perc.items())}
        if p in perc_hist:
            rec["perc_da"] = perc_hist[p]["da"]
        prov_out[p] = rec

    out_prov = {
        "meta": {
            "years": YEARS,
            "counts": bool(counts),
            "sources": [
                {"id": "73_67_DF_DCCV_DELITTIPS_9", "label": "ISTAT, Delitti denunciati dalle forze di polizia all'autorità giudiziaria — tasso di delittuosità per provincia"},
                {"id": "DF_DCSS_BEST_PPC_1_GC", "label": "ISTAT, Famiglie per percezione del rischio di criminalità nella zona in cui abitano — province"},
            ] + ([{"id": "73_67_DF_DCCV_DELITTIPS_1", "label": "ISTAT, Delitti denunciati — conteggi per provincia"}] if counts else []),
        },
        "prov": prov_out,
        "perc_sigla": perc_sigla,
    }

    # comuni.json: righe compatte [nome, nome in altra lingua, sigla, provincia ISTAT, id capoluogo, lon×100, lat×100]
    units = {}
    for c in comuni:
        units.setdefault(c["sigla"], c["unit"])
    out_com = {
        "meta": {"source": "ISTAT, Elenco dei comuni italiani (codici statistici delle unità amministrative territoriali)", "url": ELENCO, "n": len(comuni)},
        "units": units,
        "comuni": [[c["name"], c["alt"], c["sigla"], c["prov"], city_of.get(c["code"], "")] + (c["pt"] or [None, None]) for c in sorted(comuni, key=lambda c: (norm(c["name"]), c["sigla"]))],
    }

    with open(os.path.join(OUT, "province.json"), "w", encoding="utf-8") as f:
        json.dump(out_prov, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT, "comuni.json"), "w", encoding="utf-8") as f:
        json.dump(out_com, f, ensure_ascii=False, separators=(",", ":"))
    log(f"scritto data/comuni.json ({len(comuni)} comuni, {os.path.getsize(os.path.join(OUT, 'comuni.json')) // 1024} KB)")
    log(f"scritto data/province.json ({len(prov_out)} province, {os.path.getsize(os.path.join(OUT, 'province.json')) // 1024} KB, conteggi: {'sì' if counts else 'no'})")
    check(prov_out, comuni, cities, vc)


def check(prov, comuni, cities, vc):
    """Controlli: ogni comune ha una provincia con dati; la media dei tassi provinciali
    pesata sulla popolazione non può discostarsi troppo dal tasso nazionale."""
    assert all(c["prov"] in prov for c in comuni)
    assert sum(p["comuni"] for p in prov.values()) == len(comuni)
    # il capoluogo ha di norma un tasso più alto della sua provincia: segnalare le eccezioni forti
    i = len(YEARS) - 1
    odd = []
    for code, p in prov.items():
        for cid in p["caps"][:1]:
            c = cities[cid]
            cr = c["n"]["TOT"][i] / c["pop"][i] * 1e5
            pr = p["rate"]["TOT"][i]
            if pr and cr / pr < 0.6:
                odd.append(f"{c['name']} {cr:.0f} vs provincia {pr:.0f}")
    if odd:
        log("  nota: capoluoghi molto sotto la propria provincia:", "; ".join(odd))
    it = vc["italy"]["rate"]["TOT"][i]
    rng = [p["rate"]["TOT"][i] for p in prov.values() if p["rate"]["TOT"][i]]
    log(f"controllo: tasso totale {YEARS[-1]} delle province tra {min(rng):.0f} e {max(rng):.0f}, Italia {it:.0f}")
    if not (min(rng) < it < max(rng)):
        raise SystemExit("il tasso nazionale non cade tra le province: controllare i dati")


if __name__ == "__main__":
    build()
