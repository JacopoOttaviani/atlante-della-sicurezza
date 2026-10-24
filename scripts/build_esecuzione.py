#!/usr/bin/env python3
"""Atlante della Sicurezza — approfondimento «Fuori dal carcere» (pene e misure eseguite fuori dal carcere).

Scrive data/esecuzione.json mettendo insieme:

  uepe          persone in carico agli Uffici di esecuzione penale esterna (UEPE) al 31 dicembre, per misura, in Italia e
                per regione, 2014-2025: Ministero della Giustizia, Dipartimento per la giustizia minorile e di comunità,
                «Adulti in area penale esterna - Dati territoriali per regione» (solo PDF). Le tabelle sono estratte dal PDF
                una volta, con `--estrai` (serve pypdf), in scripts/esecuzione_tabelle.json, e ricontrollate qui
  affidamento   le persone in affidamento in prova al 31 dicembre 2025 secondo da dove arrivano (libertà, carcere,
                domiciliari): «Adulti in area penale esterna, 31 dicembre 2025, dati convalidati», tabella 2, copiata a mano
                nello stesso file con la pagina
  ingressi      ingressi in carcere dalla libertà, 1991-2025 (giustizia.it, tabella HTML)
  sorveglianza  provvedimenti dei tribunali e degli uffici di sorveglianza (misure concesse, revocate, cessate), 2020-2025,
                per tipo e sede (datiestatistiche.giustizia.it, Sorveglianza_misure_dati.csv)
  carcere       persone detenute a fine anno in Italia e per regione (data/cautelari.json, ISTAT su dati DAP)
  residenti     per regione e per distretto (POSAS per comune, la stessa cache di build_giustizia.py; data/cautelari.json)

Uso:  python3 scripts/build_esecuzione.py            (dopo build_cautelari.py e build_giustizia.py)
      python3 scripts/build_esecuzione.py --estrai   (quando esce un PDF nuovo: riestrae le tabelle UEPE)
Si ferma se: in una riga UEPE le misure non sommano il totale; italiani e stranieri, uomini e donne non tornano con gli
ingressi totali; primo e secondo semestre della sorveglianza non sommano l'anno; una sede di sorveglianza non trova il
suo distretto; le parti della tabella dell'affidamento non tornano con il totale UEPE dello stesso giorno.
"""
import csv
import html
import io
import json
import os
import re
import sys
from collections import defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import CACHE, OUT, log  # noqa: E402
from build_giustizia import GCACHE, comune_pop, curl, districts, doc, norm, num  # noqa: E402
from build_istituti import get  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
TAB = os.path.join(HERE, "esecuzione_tabelle.json")
UEPE_PDF = "https://www.giustizia.it/cmsresources/cms/documents/UEPE_SERIE_STORICHE_2025_G.pdf"
INGRESSI = "https://www.giustizia.it/giustizia/it/mg_1_14_1.page?contentId=SST165653"
# le colonne delle tabelle UEPE, nell'ordine del PDF; «affidamento_td» è un «di cui» dell'affidamento (persone
# tossicodipendenti o alcoldipendenti) e non entra nel totale
COLS = ["affidamento", "affidamento_td", "domiciliare", "semiliberta", "semidetenzione", "liberta_controllata",
        "domiciliare_sost", "semiliberta_sost", "lpu_sost", "liberta_vigilata", "lpu_droga", "lpu_strada",
        "sospensione", "map", "totale"]
REG = {"PIEMONTE": "ITC1", "VALLE D'AOSTA": "ITC2", "LIGURIA": "ITC3", "LOMBARDIA": "ITC4", "TRENTINO ALTO ADIGE": "ITDA",
       "VENETO": "ITD3", "FRIULI VENEZIA GIULIA": "ITD4", "EMILIA ROMAGNA": "ITD5", "TOSCANA": "ITE1", "UMBRIA": "ITE2",
       "MARCHE": "ITE3", "LAZIO": "ITE4", "ABRUZZO": "ITF1", "MOLISE": "ITF2", "CAMPANIA": "ITF3", "PUGLIA": "ITF4",
       "BASILICATA": "ITF5", "CALABRIA": "ITF6", "SICILIA": "ITG1", "SARDEGNA": "ITG2"}
# i provvedimenti di sorveglianza che contano: misure alternative alla detenzione, per tipo, e l'espulsione come
# sanzione alternativa. Lavoro all'esterno, differimenti della pena e sanzioni sostitutive restano fuori.
SORV = {
    "affidamento": ["Affidamento al Servizio Sociale", "Affidamento Servizio Sociale ex art. 94 DPR 309/90", "Affidamento art. 47 quater O.P."],
    "domiciliare": ["Detenzione Domiciliare art. 47 ter O.P.", "Detenzione Domiciliare art. 47 ter 1 bis", "Detenzione Domiciliare Speciale",
                    "Detenzione domiciliare per ultrasettantenni", "Detenzione domiciliare art. 16 nonies D.L. 8/1991",
                    "Detenzione Domiciliare art. 47 quater o.p.", "Detenzione domiciliare per recidivi"],
    "semiliberta": ["Semilibertà"],
    "condizionale": ["Concessione Liberazione Condizionale"],
    "espulsione": ["Espulsione straniero a titolo di sanzione alternativa (art. 16 comma 5 D.Lvo 286/1998 e succ.mod.)"],
}
# le revoche hanno i loro nomi; la revoca degli arresti domiciliari non riguarda una misura alternativa e resta fuori
SORV_REV = {
    "affidamento": ["Revoca Affidamento in Prova all' UEPE", "Revoca Affidamento in casi particolari", "Revoca Affidamento in prova art. 47 quater o.p."],
    "domiciliare": ["Revoca Detenzione Domiciliare", "Revoca Detenzione Domiciliare Art. 47 Ter 1 Bis O.P.", "Revoca Detenzione Domiciliare Speciale Art. 47 Quinquies",
                    "Revoca Detenzione Domiciliare art. 47 quater o.p."],
    "semiliberta": ["Revoca Semiliberta'"],
    "condizionale": ["Revoca Liberazione Condizionale (Art. 177 C.P.)"],
    "espulsione": ["Revoca Espulsione"],
}


def estrai():
    """Le tabelle «situazione alla data» del PDF UEPE, nazionale e regione per regione, in esecuzione_tabelle.json."""
    import pypdf  # solo qui: il resto dello script usa la libreria standard
    path = os.path.join(GCACHE, os.path.basename(UEPE_PDF))
    if not os.path.exists(path):
        os.makedirs(GCACHE, exist_ok=True)
        open(path, "wb").write(curl(UEPE_PDF))
    pages = [p.extract_text() for p in pypdf.PdfReader(path).pages]
    out, cur = {}, None
    for pi, text in enumerate(pages, 1):
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("SITUAZIONE NAZIONALE"):
                cur = "IT"
            elif line.startswith("REGIONE "):
                cur = REG[line[8:].strip()]
            m = re.match(r"^31/12/(\d{4})\s+(.*)$", line)
            if m and cur:
                # «-» in qualche cella regionale: nessuna persona (le somme di riga tornano solo così)
                vals = [0 if x == "-" else int(x.replace(".", "")) for x in m.group(2).split()]
                if len(vals) != len(COLS):
                    raise SystemExit(f"pagina {pi}, {cur} {m.group(1)}: {len(vals)} colonne invece di {len(COLS)}")
                out.setdefault(cur, {"pagina": pi, "anni": {}})["anni"][m.group(1)] = vals
    T = json.load(open(TAB, encoding="utf-8")) if os.path.exists(TAB) else {}
    T["uepe"] = {"_fonte": "Ministero della Giustizia, DGMC: Adulti in area penale esterna - Dati territoriali per regione - Anni 2014-2025 (UEPE_SERIE_STORICHE_2025_G.pdf), situazione al 31 dicembre",
                 "_colonne": COLS, "aree": out}
    with open(TAB, "w", encoding="utf-8") as f:
        json.dump(T, f, ensure_ascii=False, indent=1)
    log(f"estratte {sum(len(a['anni']) for a in out.values())} righe UEPE ({len(out)} aree) in scripts/esecuzione_tabelle.json")


def uepe(T):
    U = T["uepe"]["aree"]
    years = sorted(int(y) for y in U["IT"]["anni"])
    bad = []
    for area, a in U.items():
        for y, vals in a["anni"].items():
            row = dict(zip(COLS, vals))
            parts = sum(v for k, v in row.items() if k not in ("affidamento_td", "totale"))
            if parts != row["totale"]:
                bad.append((area, y, parts, row["totale"]))
            if row["affidamento_td"] > row["affidamento"]:
                bad.append((area, y, "di cui", row["affidamento_td"], row["affidamento"]))
    if bad:
        raise SystemExit(f"righe UEPE che non tornano: {bad[:5]}")
    ser = lambda area: {k: [dict(zip(COLS, U[area]["anni"][str(y)]))[k] if str(y) in U[area]["anni"] else None for y in years] for k in COLS}  # noqa: E731
    italia = ser("IT")
    # le regioni sommano più dell'Italia: chi è in carico a più UEPE conta in ognuna; lo scarto si registra, non si corregge
    gap = [sum(U[r]["anni"][str(y)][-1] for r in U if r != "IT" and str(y) in U[r]["anni"]) - italia["totale"][i] for i, y in enumerate(years)]
    regioni = {r: ser(r) for r in U if r != "IT"}
    log(f"  UEPE: {len(years)} anni, {len(regioni)} regioni; le regioni sommano l'Italia più {min(gap)}-{max(gap)} persone (in carico a più uffici)")
    return years, italia, regioni, gap


def stato(T, italia, years):
    """Da dove arrivano le persone in misura alternativa al 31 dicembre 2025: le righe copiate devono tornare con i totali
    stampati nella tabella e con la serie UEPE dello stesso giorno."""
    A, P, i = T["stato_2025"], T["stato_2025"]["_totali_pubblicati"], years.index(2025)
    out = {}
    for m in ("affidamento", "domiciliare", "semiliberta"):
        out[m] = {k: sum(v.values()) for k, v in A[m].items()}
        for k, n in out[m].items():
            if n != P[m][k]:
                raise SystemExit(f"stato al 31 dicembre 2025, {m} {k}: le righe sommano {n}, la tabella stampa {P[m][k]}")
        if sum(out[m].values()) != P[m]["totale"] or P[m]["totale"] != italia[m][i]:
            raise SystemExit(f"stato al 31 dicembre 2025, {m}: {sum(out[m].values())} nella tabella 2, {italia[m][i]} nella serie UEPE")
    td = sum(v.get("tossico/alcoldipendenti", 0) for v in A["affidamento"].values())
    if td != italia["affidamento_td"][i]:
        raise SystemExit(f"affidamento per persone tossicodipendenti: {td} nella tabella 2, {italia['affidamento_td'][i]} nella serie")
    return out


def ingressi():
    page = get(INGRESSI, "ingressi_dalla_liberta.html", refresh=os.environ.get("ISTITUTI_OFFLINE") != "1")
    table = re.search(r"<table.*?</table>", page, re.S).group(0)
    out = {}
    for tr in re.findall(r"<tr.*?</tr>", table, re.S):
        c = [" ".join(html.unescape(re.sub(r"<[^>]+>", " ", x)).split()) for x in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)]
        if c and re.fullmatch(r"\d{4}", c[0]):
            v = [int(x.replace(".", "")) for x in c[1:10]]
            itm, itf, itt, sm, sf, st, tm, tf, tt = v
            if itm + itf != itt or sm + sf != st or tm + tf != tt or itt + st != tt or itm + sm != tm:
                raise SystemExit(f"ingressi {c[0]}: le parti non tornano con i totali ({v})")
            out[int(c[0])] = {"tot": tt, "str": st, "donne": tf}
    years = sorted(out)
    if years[0] > 1991 or len(years) != years[-1] - years[0] + 1:
        raise SystemExit(f"ingressi dalla libertà: anni {years[0]}-{years[-1]} con buchi")
    log(f"  ingressi in carcere dalla libertà: {years[0]}-{years[-1]}, {out[years[-1]]['tot']:,} nel {years[-1]}")
    return {"years": years, "tot": [out[y]["tot"] for y in years], "str": [out[y]["str"] for y in years], "donne": [out[y]["donne"] for y in years]}


def sorveglianza(D):
    rows = doc("Sorveglianza_misure_dati.csv")
    agg = defaultdict(lambda: [0, 0, 0])
    for r in rows:
        k = (int(r["Anno"]), r["Tipo ufficio"], r["Distretto"], r["Sede"], r["Misura"], r["Oggetto"])
        agg[k][{"Primo semestre": 0, "Secondo semestre": 1, "Anno": 2}[r["Semestre"]]] += num(r["Provvedimenti"]) or 0
    bad = [(k, a) for k, a in agg.items() if a[0] + a[1] != a[2]]
    if bad:
        raise SystemExit(f"sorveglianza: primo e secondo semestre non sommano l'anno in {len(bad)} casi, per esempio {bad[:2]}")
    years = sorted({k[0] for k in agg})
    objs = {k[5] for k in agg}
    missing = [o for G in (SORV, SORV_REV) for v in G.values() for o in v if o not in objs]
    if missing:
        raise SystemExit(f"sorveglianza: tipi di misura che il file non ha più: {missing}")
    # le sedi dei tribunali di sorveglianza sono una per distretto, con le tre sezioni distaccate; gli uffici di
    # sorveglianza vanno nel distretto dei comuni di cui sono competenti (Giustizia Map, scripts/comuni_uffici.json)
    did_of = lambda name: next((d["id"] for d in D if norm(d["name"]) == norm(name) or (d["id"] == "reggio" and norm(name) == "reggio calabria")), None)  # noqa: E731
    CU = json.load(open(os.path.join(HERE, "comuni_uffici.json"), encoding="utf-8"))["comuni"]
    uff = defaultdict(set)
    for o in CU.values():
        m = re.search(r"Sezione distaccata di (.+)$", o.get("ca", ""))
        uff[norm(o["sorv"])].add(did_of(m.group(1) if m else o["ca"]))
    seat_of = {}
    for (y, tu, dist, sede, mis, obj) in agg:
        if sede in seat_of:
            continue
        if tu.startswith("Tribunale"):
            seat_of[sede] = did_of(sede)
        else:
            ds = uff.get(norm(sede), set())
            seat_of[sede] = next(iter(ds)) if len(ds) == 1 else None
        if seat_of[sede] is None:
            raise SystemExit(f"sorveglianza: la sede {sede!r} ({tu}) non trova il suo distretto ({sorted(uff.get(norm(sede), []))})")
    if len({seat_of[k[3]] for k in agg if k[1].startswith("Tribunale")}) != 29:
        raise SystemExit("sorveglianza: non ci sono 29 tribunali di sorveglianza")

    def series(pick, mis):
        groups = SORV if mis == "Concesse" else SORV_REV
        return {g: [sum(a[2] for k, a in agg.items() if k[0] == y and k[4] == mis and k[5] in objs_g and pick(k)) for y in years]
                for g, objs_g in groups.items()}
    italia = {"concesse": series(lambda k: True, "Concesse"), "revocate": series(lambda k: True, "Revocate")}
    dist = {}
    for did in sorted(set(seat_of.values())):
        pick = lambda k, did=did: seat_of[k[3]] == did  # noqa: E731
        dist[did] = {"concesse": series(pick, "Concesse"), "revocate": series(pick, "Revocate")}
    for g in SORV:
        for m in ("concesse", "revocate"):
            tot = [sum(dist[d][m][g][i] for d in dist) for i in range(len(years))]
            if tot != italia[m][g]:
                raise SystemExit(f"sorveglianza: i distretti non sommano l'Italia ({m}, {g}): {tot} contro {italia[m][g]}")
    c = italia["concesse"]
    log(f"  sorveglianza: {years[0]}-{years[-1]}, {sum(c[g][-1] for g in SORV):,} misure concesse nel {years[-1]}; i 29 distretti sommano l'Italia")
    return years, italia, dist


def build():
    T = json.load(open(TAB, encoding="utf-8"))
    D, pop_year = districts()
    years, italia, regioni, gap = uepe(T)
    aff = stato(T, italia, years)
    ing = ingressi()
    sy, sorv_it, sorv_d = sorveglianza(D)

    C = json.load(open(os.path.join(OUT, "cautelari.json"), encoding="utf-8"))
    Yc = C["meta"]["years"]
    carcere = {"italia": [C["detenuti"]["italia"]["ALL"][Yc.index(y)] if y in Yc else None for y in years],
               "regioni": {r["id"]: [r["all"][Yc.index(y)] if y in Yc else None for y in years] for r in C["detenuti"]["regioni"]}}
    # residenti per regione: i comuni con il codice della regione dell'elenco ISTAT
    pop = comune_pop()
    reg_of = {}
    text = open(os.path.join(CACHE, "elenco_comuni.csv"), encoding="latin-1").read()
    code2id = {r["istat"]: r["id"] for r in C["detenuti"]["regioni"]}
    for r in list(csv.reader(io.StringIO(text), delimiter=";"))[1:]:
        if len(r) > 4 and r[4].strip():
            reg_of[r[4].strip()] = code2id[r[0].strip().zfill(2)]
    rpop = defaultdict(int)
    for code, n in pop.items():
        rpop[reg_of[code]] += n
    if sum(rpop.values()) != sum(pop.values()):
        raise SystemExit("residenti per regione: non sommano l'Italia")
    names = {r["id"]: r["name"] for r in C["detenuti"]["regioni"]}

    data = {
        "meta": {
            "years": years, "last": years[-1], "sorv_years": sy, "pop_year": 2025, "dist_pop_year": pop_year, "built": date.today().isoformat(),
            "nota": "Persone in carico agli UEPE al 31 dicembre (Ministero della Giustizia, DGMC); provvedimenti di sorveglianza (DG Statistica); persone detenute (ISTAT su dati DAP).",
            "sources": [
                {"id": "UEPE_SERIE_STORICHE_2025", "label": "Ministero della Giustizia, Dipartimento per la giustizia minorile e di comunità: adulti in area penale esterna, persone in carico agli UEPE al 31 dicembre per misura e regione, 2014-2025",
                 "en": "Ministry of Justice, Department for Juvenile and Community Justice: adults under probation services, people supervised by the UEPE offices on 31 December by measure and region, 2014-2025"},
                {"id": "Area penale esterna 31.12.2025", "label": "Ministero della Giustizia, DGMC: adulti in area penale esterna al 31 dicembre 2025, dati convalidati (tabella 2: affidamento in prova secondo lo stato della persona)",
                 "en": "Ministry of Justice, DGMC: adults under probation services on 31 December 2025, validated data (table 2: probation by the person's status)"},
                {"id": "SST165653", "label": "Ministero della Giustizia, DAP: ingressi in carcere dalla libertà, 1991-2025",
                 "en": "Ministry of Justice, Prison Administration: entries into prison from freedom, 1991-2025"},
                {"id": "Sorveglianza_misure_dati", "label": "Ministero della Giustizia, DG Statistica: provvedimenti dei tribunali e degli uffici di sorveglianza per tipo di misura e sede, 2020-2025",
                 "en": "Ministry of Justice, Statistics Directorate: decisions of the supervision courts and offices by type of measure and court, 2020-2025"},
                {"id": "73_173_DF_DCCV_DETENUTI_5", "label": "ISTAT, Detenuti adulti presenti al 31 dicembre, Italia e regioni (fonte: DAP)",
                 "en": "ISTAT, Adult prisoners held on 31 December, Italy and regions (source: DAP)"},
            ],
        },
        "uepe": {"italia": italia, "regioni": regioni, "gap": gap},
        "stato_2025": aff,
        "ingressi": ing,
        "sorveglianza": {"italia": sorv_it, "distretti": sorv_d},
        "carcere": carcere,
        "regioni": [{"id": r, "name": names[r], "istat": next(x["istat"] for x in C["detenuti"]["regioni"] if x["id"] == r), "pop": rpop[r]} for r in names],
        "distretti": [{"id": d["id"], "name": d["name"], "map": d["map"], "pop": d["pop"]} for d in D],
    }
    path = os.path.join(OUT, "esecuzione.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    L = len(years) - 1
    alt = italia["affidamento"][L] + italia["domiciliare"][L] + italia["semiliberta"][L]
    log(f"scritto data/esecuzione.json ({os.path.getsize(path) // 1024} KB): fine {years[-1]}, {alt:,} persone in misura alternativa, "
        f"{italia['map'][L]:,} in messa alla prova, {carcere['italia'][L]:,} in carcere")


if __name__ == "__main__":
    estrai() if "--estrai" in sys.argv else build()
