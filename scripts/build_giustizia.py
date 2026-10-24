#!/usr/bin/env python3
"""Atlante della Sicurezza — approfondimento «Dal reato alla sentenza» e il tribunale nelle schede dei comuni.

Scrive data/giustizia.json con i dati della Direzione generale di statistica del Ministero della Giustizia
(datiestatistiche.giustizia.it):

  flussi      procedimenti penali con autore noto sopravvenuti, definiti e pendenti a fine anno, 2014-2025, per ufficio e
              sezione (procura, GIP/GUP, dibattimento monocratico, collegiale e di assise, Corte d'appello, Cassazione),
              per i 140 tribunali e le 29 Corti d'appello e sezioni distaccate: PenaleFlussi20142025.csv
  indicatori  clearance rate e disposition time pubblicati dal Ministero, solo per il controllo: Indicatori_Penali.csv
  durate      durata media in giorni dei procedimenti definiti (Durate_medie_penali_20142025.csv) e quanti durano più di
              due o tre anni (Durate_penali_per_classi_20142025.csv), per ufficio, distretto e sede
  prescrizione procedimenti definiti per prescrizione nelle Corti d'appello, nei tribunali (dibattimento) e dal GIP/GUP,
              per distretto e circondario, 2014-2025, e la serie nazionale: i report del Ministero su
              reportistica.dgstat.giustizia.it, esportati in CSV un anno alla volta
  residenti   popolazione al 1° gennaio per comune (ISTAT, demo.istat.it), sommata per circondario con l'elenco dei comuni
              di ogni tribunale in scripts/comuni_uffici.json (build_competenze.py); per distretto da data/cautelari.json

Uso:  python3 scripts/build_giustizia.py      (dalla cartella atlante-della-sicurezza/, dopo build_cautelari.py e
      build_competenze.py)
Si ferma se: un tribunale dei dati non si trova nell'elenco dei comuni o viceversa; clearance rate e disposition time
ricalcolati dai flussi non tornano con quelli pubblicati (oltre il 3%); i comuni di un tribunale stanno in due distretti;
i residenti dei circondari non sommano l'Italia; nelle prescrizioni i circondari non tornano con il loro distretto o i
distretti con la serie nazionale.
"""
import csv
import html
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.parse
import zipfile
from collections import defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import CACHE, OUT, log  # noqa: E402
from build_carceri import fetch_bytes  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = list(range(2014, 2026))
POP_YEAR = 2025
GCACHE = os.path.join(CACHE, "giustizia_dgstat")
DOCS = "https://datiestatistiche.giustizia.it/cmsresources/cms/documents/"
POSAS_COM = "https://demo.istat.it/data/posas/POSAS_{year}_it_Comuni.zip"
UA = "Mozilla/5.0 (atlantedellasicurezza.it; dati pubblici)"
SSRS = "https://reportistica.dgstat.giustizia.it"
MODALITA = "/Pubblica/Statistiche della DGSTAT/Materia Penale/2. Modalita di definizione/"
REPORTS = {
    # i procedimenti definiti per prescrizione
    "naz": "3. definiti per prescrizione/1. dati nazionali/1. tutti gli uffici in serie storica",
    "ca": "3. definiti per prescrizione/2. dati distrettuali/2. corte di appello",
    "trib": "3. definiti per prescrizione/3. dati circondariali/2. tribunale ordinario",
    "gip": "3. definiti per prescrizione/3. dati circondariali/3. tribunale ordinario gip gup",
    # come si chiudono i procedimenti davanti al GIP e al GUP, per circondario
    "gip_mod": "2. dati circondariali/3. tribunale ordinario gip gup",
}
PAUSE = 0.5

PROCURA = "Procura della Repubblica presso il Tribunale ordinario"
GIP = "Giudice per le indagini e per l'udienza preliminare"
# le fasi del procedimento per adulti: (ufficio, sezioni) dei flussi
STAGES = {
    "procura": (PROCURA, ["Attività per reati ordinari", "Attività per reati di competenza del giudice di pace",
                          "Attività per reati di competenza della direzione distrettuale antimafia"]),
    "gip": ("Tribunale", [GIP]),
    "mono": ("Tribunale", ["Dibattimento monocratico"]),
    "coll": ("Tribunale", ["Dibattimento collegiale"]),
    "assise": ("Tribunale", ["Dibattimento assise"]),
    "appgdp": ("Tribunale", ["Dibattimento monocratico appello g.d.p"]),
    "appello": ("Corte di Appello", ["Ordinaria"]),
    "app_assise": ("Corte di Appello", ["Assise"]),
    "app_min": ("Corte di Appello", ["Minorenni"]),
    "cass": ("Corte Suprema di Cassazione", ["Corte Suprema di Cassazione"]),
    "gdp": ("Giudice di pace", ["Giudice per le indagini preliminari (g.d.p.)", "Dibattimento monocratico (g.d.p.)"]),
}
# I circondari delle tre sezioni distaccate di Corte d'appello, che i flussi mettono nel distretto della sede principale.
# Li conferma l'elenco dei comuni (la Corte d'appello competente di ogni comune, in comuni_uffici.json).
SEZIONI = {"sassari": ["sassari", "nuoro", "tempio pausania"], "taranto": ["taranto"], "bolzano": ["bolzano"]}


def norm(s):
    """Il nome per i confronti: senza accenti, maiuscole, seconda lingua («Bolzano/Bozen») e articolo iniziale, che la
    Giustizia Map perde («Tribunale della SPEZIA», «Corte d'Appello dell'AQUILA») e i flussi tengono («La Spezia»)."""
    s = unicodedata.normalize("NFKD", s.replace("’", "'")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", " ", s.split("/")[0]).strip()
    return re.sub(r"^(?:l|la|lo|le|il|i|gli) ", "", s)


# i nomi dei tribunali nella Giustizia Map che non sono quelli dei flussi
MAP_ALIAS = {"napoli nord in aversa": "napoli nord"}


def tkey(name):
    return MAP_ALIAS.get(norm(name), norm(name))


def num(x):
    x = (x or "").strip()
    if not x or x.lower().startswith("n.d"):
        return None
    return int(x.replace(".", ""))


# ------------------------------------------------------------------ scaricare

def curl(url, data=None, jar=None, timeout=180):
    """reportistica.dgstat.giustizia.it non manda la catena di certificati completa, e urllib la rifiuta: curl no."""
    cmd = ["curl", "-sS", "-L", "--fail", "--max-time", str(timeout), "-A", UA, url]
    if jar:
        cmd[1:1] = ["-c", jar, "-b", jar]
    if data is not None:
        cmd[1:1] = ["--data-binary", "@-", "-H", "Content-Type: application/x-www-form-urlencoded"]
    for i in range(3):
        p = subprocess.run(cmd, input=data, capture_output=True)
        if p.returncode == 0:
            return p.stdout
        time.sleep(5 * (i + 1))
    raise RuntimeError(f"download non riuscito: {url}\n{p.stderr.decode(errors='replace')}")


def doc(name):
    """Un file del catalogo dati del Ministero, in cache. I file si aggiornano allo stesso indirizzo."""
    os.makedirs(GCACHE, exist_ok=True)
    path = os.path.join(GCACHE, name)
    if not os.path.exists(path) or not os.path.getsize(path):
        body = curl(DOCS + name)
        if body.lstrip()[:15].lower().startswith((b"<!doctype", b"<html")):
            raise RuntimeError(f"{name}: il Ministero ha risposto con una pagina, non con il file")
        open(path, "wb").write(body)
    raw = open(path, "rb").read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    rows = list(csv.DictReader(io.StringIO(text), delimiter=";"))
    # le righe vuote (;;;;) in fondo ai file, e lo spazio unificatore in qualche sezione («(g.d.p.)»)
    out = []
    for r in rows:
        if any((v or "").strip() for v in r.values()):
            out.append({k.strip(): " ".join((v or "").replace("\xa0", " ").split()) for k, v in r.items() if k})
    return out


def _fields(page):
    f = {}
    for m in re.finditer(r'<input[^>]*type="hidden"[^>]*>', page):
        n, v = re.search(r'name="([^"]+)"', m.group(0)), re.search(r'value="([^"]*)"', m.group(0))
        if n:
            f[html.unescape(n.group(1))] = html.unescape(v.group(1)) if v else ""
    for m in re.finditer(r'<select[^>]*name="([^"]+)"[^>]*>(.*?)</select>', page, re.S):
        sel = re.search(r'<option[^>]*selected="selected"[^>]*value="([^"]*)"', m.group(2))
        f[html.unescape(m.group(1))] = sel.group(1) if sel else "0"
    return f


def _options(page, name):
    m = re.search(r'<select[^>]*name="' + re.escape(name) + r'"[^>]*>(.*?)</select>', page.replace("&#36;", "$"), re.S)
    return [(v, " ".join(html.unescape(t).replace("\xa0", " ").split())) for v, t in re.findall(r'<option[^>]*value="([^"]*)"[^>]*>([^<]*)', m.group(1))] if m else []


YEAR_PARAM = "ReportViewer1$ctl04$ctl03$ddValue"


def report(key, year=None):
    """Un report della Direzione di statistica in CSV, per l'anno dato (None: quello che il report mostra da solo).
    Il visualizzatore (SQL Server Reporting Services) vuole una sessione: si apre la pagina, si sceglie l'anno, si
    preme «View Report» e si esporta. In cache per report e anno, mai per indirizzo (contiene la sessione)."""
    os.makedirs(GCACHE, exist_ok=True)
    path = os.path.join(GCACHE, f"report_{key}_{year or 'serie'}.csv")
    if os.path.exists(path) and os.path.getsize(path):
        return open(path, encoding="utf-8").read()
    url = SSRS + "/VisualizzatoreReport.Aspx?Report=" + urllib.parse.quote(MODALITA + REPORTS[key])
    jar = tempfile.NamedTemporaryFile(delete=False).name
    try:
        page = curl(url, jar=jar).decode("utf-8")
        action = SSRS + "/" + html.unescape(re.search(r'<form[^>]*action="\./([^"]+)"', page).group(1))
        if year is not None:
            opts = _options(page, YEAR_PARAM)
            val = next((v for v, t in opts if t == f"Anno {year}"), None)
            if val is None:
                raise RuntimeError(f"report {key}: l'anno {year} non c'è tra {[t for _, t in opts][:5]}…")
            f = _fields(page)
            f.update({YEAR_PARAM: val, "__EVENTTARGET": YEAR_PARAM, "__EVENTARGUMENT": ""})
            page = curl(action, data=urllib.parse.urlencode(f).encode(), jar=jar).decode("utf-8")
            f = _fields(page)
            f.update({"ReportViewer1$ctl04$ctl00": "View Report", "__EVENTTARGET": ""})
            page = curl(action, data=urllib.parse.urlencode(f).encode(), jar=jar).decode("utf-8")
        exp = json.loads(re.search(r'"ExportUrlBase":("[^"]*")', page).group(1))
        text = curl(SSRS + exp + "CSV", jar=jar).decode("utf-8-sig")
    finally:
        os.unlink(jar)
    time.sleep(PAUSE)
    if year is not None and f"Anno {year}" not in text[:400]:
        raise RuntimeError(f"report {key}: chiesto il {year}, arrivato «{text[:200]}»")
    open(path, "w", encoding="utf-8").write(text)
    return text


def blocks(text):
    """I blocchi di un CSV dei report: righe separate da righe vuote, ognuno con la sua intestazione."""
    out, cur = [], None
    for row in csv.reader(io.StringIO(text)):
        if not any(c.strip() for c in row):
            cur = None
            continue
        if cur is None:
            if len(row) < 3:
                continue  # titolo
            cur = {"head": row, "rows": []}
            out.append(cur)
        else:
            cur["rows"].append([c.strip() for c in row])
    return out


# ------------------------------------------------------------------ geografia

def districts():
    """I 29 distretti (con le tre sezioni distaccate) di data/cautelari.json: id, nome, province sulla carta, residenti."""
    C = json.load(open(os.path.join(OUT, "cautelari.json"), encoding="utf-8"))
    D = [{"id": d["id"], "name": d["name"], "map": d["map"], "pop": d["pop"]} for d in C["riparazione"]["distretti"]]
    if len(D) != 29:
        raise SystemExit(f"attesi 29 distretti in data/cautelari.json, trovati {len(D)}")
    return D, C["meta"]["pop_year"]


def dist_id(name, D):
    n = norm(name)
    n = {"reggio calabria": "reggio calabria"}.get(n, n)
    for d in D:
        if norm(d["name"]) == n:
            return d["id"]
    raise SystemExit(f"distretto sconosciuto: {name!r}")


def comune_pop():
    body = fetch_bytes(POSAS_COM.format(year=POP_YEAR), f"posas_{POP_YEAR}_comuni.zip")
    with zipfile.ZipFile(io.BytesIO(body)) as z:
        name = next(n for n in z.namelist() if n.endswith(".csv"))
        text = z.read(name).decode("utf-8-sig")
    rd = csv.reader(text.splitlines()[1:], delimiter=";")  # la prima riga è il titolo
    head = next(rd)
    ic, ia, it = head.index("Codice comune"), head.index("Età"), head.index("Totale")
    return {r[ic].zfill(6): int(r[it]) for r in rd if r and r[ia] == "999"}


# ------------------------------------------------------------------ i dati

def flows():
    rows = doc("PenaleFlussi20142025.csv")
    v = defaultdict(lambda: [0, 0, 0])
    seen = set()
    for r in rows:
        k = (r["Ufficio"], r["Sezione"], r["Distretto"], r["Circondario/Sede"], int(r["Anno"]))
        if k in seen:
            raise SystemExit(f"riga doppia nei flussi: {k}")
        seen.add(k)
        a = v[k]
        for i, c in enumerate(("Sopravvenuti", "Definiti", "Pendenti Finali")):
            n = num(r[c])
            if n is None:
                raise SystemExit(f"cella vuota nei flussi: {k} {c}")
            a[i] += n
    years = sorted({k[4] for k in v})
    if years != YEARS:
        raise SystemExit(f"anni dei flussi {years[0]}-{years[-1]}, attesi {YEARS[0]}-{YEARS[-1]}: aggiornare YEARS")
    return v


def stage_series(v, stage, pick):
    """Sopravvenuti, definiti e pendenti di una fase, anno per anno, sommando le righe scelte da pick(distretto, sede)."""
    uff, sezs = STAGES[stage]
    out = {"s": [0] * len(YEARS), "d": [0] * len(YEARS), "p": [0] * len(YEARS)}
    found = False
    for (u, z, dist, sede, y), a in v.items():
        if u == uff and z in sezs and pick(dist, sede):
            i = YEARS.index(y)
            out["s"][i] += a[0]
            out["d"][i] += a[1]
            out["p"][i] += a[2]
            found = True
    return out if found else None


def check_indicators(v):
    """Clearance rate (definiti / sopravvenuti) e disposition time (pendenti / definiti × 365) ricalcolati dai flussi
    devono tornare con quelli pubblicati dal Ministero, sede per sede: è il solo controllo indipendente dei flussi."""
    I = doc("Indicatori_Penali.csv")
    MAP = {  # (tipo ufficio, sezione degli indicatori) -> (ufficio, sezioni dei flussi)
        ("Tribunale", "Dibattimento monocratico"): ("Tribunale", ["Dibattimento monocratico", "Dibattimento monocratico appello g.d.p"]),
        ("Tribunale", "Dibattimento collegiale e assise"): ("Tribunale", ["Dibattimento collegiale", "Dibattimento assise"]),
        ("Tribunale", "GIP GUP"): ("Tribunale", [GIP]),
        ("Corte d'appello", "Dibattimento penale"): ("Corte di Appello", ["Ordinaria"]),
        ("Corte d'appello", "Assise"): ("Corte di Appello", ["Assise"]),
    }
    by = defaultdict(lambda: [0, 0, 0])
    for (u, z, dist, sede, y), a in v.items():
        for i in range(3):
            by[(u, z, sede, y)][i] += a[i]
    n = bad = 0
    worst = (0, None)
    for r in I:
        key = (r["Tipo ufficio"], r["Sezione"])
        if key not in MAP:
            continue
        u, sezs = MAP[key]
        y = int(r["Anno"])
        s = sum(by[(u, z, r["Sede"], y)][0] for z in sezs)
        d = sum(by[(u, z, r["Sede"], y)][1] for z in sezs)
        p = sum(by[(u, z, r["Sede"], y)][2] for z in sezs)
        if not d or not s:
            continue
        dt, pub = p / d * 365, num(r["Disposition time"])
        cr, pcr = d / s, float(r["Clearance rate"].replace(",", "."))
        n += 1
        off = abs(dt - pub) / max(pub, 30)
        if off > worst[0]:
            worst = (off, (key, r["Sede"], y, round(dt), pub))
        if off > 0.03 or abs(cr - pcr) > 0.02:
            bad += 1
            log(f"  non torna: {key} {r['Sede']} {y}: disposition time {dt:.0f} contro {pub}, clearance {cr:.2f} contro {pcr:.2f}")
    if bad:
        raise SystemExit(f"{bad} indicatori su {n} non tornano con i flussi")
    log(f"  indicatori: {n} clearance rate e disposition time ricalcolati dai flussi tornano con quelli pubblicati (scarto massimo {100 * worst[0]:.1f}%)")


def durations(D, tribs, v):
    """Durata media in giorni (pubblicata) per l'Italia, i distretti e i tribunali; per i distretti con una sezione
    distaccata la media dei suoi tribunali pesata con i definiti, controllata sui 26 distretti pubblicati."""
    M = doc("Durate_medie_penali_20142025.csv")
    SZ = {"procura": (PROCURA, "Totale Procura della Repubblica presso il Tribunale ordinario"), "gip": ("Tribunale", GIP),
          "mono": ("Tribunale", "Dibattimento monocratico"), "coll": ("Tribunale", "Dibattimento collegiale"),
          "appello": ("Corte di Appello", "Ordinaria"), "ca": ("Corte di Appello", "Corte di Appello")}
    val = {}
    for r in M:
        if not r["Anno"]:
            continue
        for k, (u, z) in SZ.items():
            if r["Ufficio"] == u and r["Sezione ufficio"] == z:
                val[(r["Dettaglio territoriale"], k, r["Distretto"], r["Circondario/Sede"], int(r["Anno"]))] = num(r["Durata media in giorni"])
    ser = lambda lvl, k, dist="", sede="": [val.get((lvl, k, dist, sede, y)) for y in YEARS]  # noqa: E731
    italia = {k: ser("Nazione", k) for k in SZ}
    # tribunali: la sede
    for t in tribs:
        t["durata"] = {k: ser("Sede", k, t["dist_csv"], t["sede"]) for k in ("procura", "gip", "mono", "coll")}
    # Corti d'appello: la sede (29, con le sezioni distaccate)
    ca_seat = {}
    for (lvl, k, dist, sede, y), x in val.items():
        if lvl == "Sede" and k == "appello":
            ca_seat.setdefault(sede, {})[y] = x
    stage_of = {"procura": "procura", "gip": "gip", "mono": "mono", "coll": "coll"}
    for d in D:
        d["durata"] = {}
        mine = [t for t in tribs if t["dist"] == d["id"]]
        for k, st in stage_of.items():
            out = []
            for i, y in enumerate(YEARS):
                w = [(t["durata"][k][i], t["flussi"][st]["d"][i]) for t in mine if t["durata"][k][i] is not None and t["flussi"].get(st)]
                tw = sum(x for _, x in w)
                out.append(round(sum(a * x for a, x in w) / tw) if tw else None)
            d["durata"][k] = out
        seat = next((s for s in ca_seat if norm(s) == norm(d["name"]) or (d["id"] == "bolzano" and norm(s) == "bolzano")), None)
        d["durata"]["appello"] = [ca_seat.get(seat, {}).get(y) for y in YEARS] if seat else [None] * len(YEARS)
    # controllo: dove il distretto pubblicato coincide con il nostro, la media pesata deve tornare (entro il 3%)
    worst, bad = 0, []
    for d in D:
        if d["id"] in ("cagliari", "sassari", "lecce", "taranto", "trento", "bolzano"):
            continue
        for k in ("mono", "coll", "gip"):
            pub = ser("Distretto", k, next(x for x in {kk[2] for kk in val if kk[0] == "Distretto"} if norm(x) == norm(d["name"])))
            for i, y in enumerate(YEARS):
                if pub[i] and d["durata"][k][i]:
                    off = abs(d["durata"][k][i] - pub[i]) / pub[i]
                    worst = max(worst, off)
                    if off > 0.03:
                        bad.append((d["id"], k, y, d["durata"][k][i], pub[i]))
    if bad:
        raise SystemExit(f"durate dei distretti ricalcolate dai tribunali che non tornano: {bad[:5]}")
    log(f"  durate: medie dei distretti ricalcolate dai tribunali uguali a quelle pubblicate entro il {100 * worst:.1f}%")

    # quanti procedimenti definiti hanno superato due anni (tribunale) o tre anni (appello)
    Cl = doc("Durate_penali_per_classi_20142025.csv")
    LONG = {("Tribunale", "Dibattimento monocratico"): ("mono", {"oltre 2 anni"}), ("Tribunale", "Dibattimento collegiale"): ("coll", {"oltre 2 anni"}),
            ("Corte di Appello", "Ordinaria"): ("appello", {"oltre 3 anni"})}
    lng = defaultdict(lambda: [0, 0])
    for r in Cl:
        if not r["Anno"]:
            continue
        key = (r["Ufficio"], r["Sezione ufficio"])
        if key not in LONG:
            continue
        k, cls = LONG[key]
        n = num(r["Definiti"]) or 0
        for scope in (("it",), ("sede", r["Distretto"], r["Circondario/Sede"])):
            a = lng[(k,) + scope + (int(r["Anno"]),)]
            a[1] += n
            if r["Tempo di definizione"] in cls:
                a[0] += n
    lser = lambda k, *scope: [lng[(k,) + scope + (y,)] if lng[(k,) + scope + (y,)][1] else None for y in YEARS]  # noqa: E731
    italia["lunghi"] = {k: lser(k, "it") for k in ("mono", "coll", "appello")}
    for t in tribs:
        t["lunghi"] = {k: lser(k, "sede", t["dist_csv"], t["sede"]) for k in ("mono", "coll")}
    # la classe di durata somma i definiti dei flussi? (tribunale monocratico, Italia)
    fl = stage_series(v, "mono", lambda dist, sede: True)["d"]
    for i, y in enumerate(YEARS):
        tot = italia["lunghi"]["mono"][i][1] if italia["lunghi"]["mono"][i] else None
        if tot is not None and abs(tot - fl[i]) / fl[i] > 0.02:
            raise SystemExit(f"classi di durata {y}: {tot} definiti nel monocratico contro {fl[i]} dei flussi")
    return italia


def prescriptions(D, tribs):
    """Procedimenti definiti per prescrizione: serie nazionale per ufficio; Corti d'appello per distretto; tribunali
    (dibattimento) e GIP/GUP per circondario, con i totali del distretto. Le somme devono tornare."""
    by_norm = {norm(t["sede"]): t for t in tribs}
    # serie nazionale
    nat = defaultdict(dict)
    for b in blocks(report("naz")):
        rows = b["rows"]
        if b["head"][0] == "Group3":
            for r in rows:
                nat[r[0]][int(r[2].split()[-1])] = num(r[3])
        elif b["head"][0] == "Group4":  # GIP/GUP sentenze: gli anni nello stesso ordine del blocco prima
            for y, r in zip(YEARS, rows):
                nat[r[0]][y] = num(r[2])
    NAT = {"appello": "Corte di Appello", "trib": "Tribunale ordinario", "gdp": "Giudice di pace (solo dibattimento)",
           "gip_arch": "Ufficio GIP (noti)", "gip_sent": "Ufficio GIP/GUP"}
    for k, lab in NAT.items():
        if lab not in nat:
            raise SystemExit(f"prescrizioni: manca la serie «{lab}» nel report nazionale ({sorted(nat)})")
    italia = {k: [nat[lab].get(y) for y in YEARS] for k, lab in NAT.items()}
    italia["def"] = {"appello": [None] * len(YEARS), "trib": [None] * len(YEARS), "gip": [None] * len(YEARS)}
    for d in D:
        d["presc"] = {"appello": [None] * len(YEARS), "appello_def": [None] * len(YEARS)}
    for t in tribs:
        t["presc"] = {"trib": [None] * len(YEARS), "trib_def": [None] * len(YEARS), "gip": [None] * len(YEARS), "gip_def": [None] * len(YEARS)}
    gone = set()
    did = {norm(d["name"]): d for d in D}
    did["reggio calabria"] = next(d for d in D if d["id"] == "reggio")
    for i, y in enumerate(YEARS):
        # Corti d'appello: [distretto, sezione, definiti sezione, definiti distretto, '', '', prescritti distretto, …,
        # definiti Italia, '', prescritti Italia]
        b = blocks(report("ca", y))[0]
        seen, sd, sp = set(), 0, 0
        for r in b["rows"]:
            if not r[0] or r[0] in seen or not r[1]:
                continue
            seen.add(r[0])
            d = did.get(norm(r[0]))
            if d is None:
                raise SystemExit(f"prescrizioni {y}: distretto sconosciuto {r[0]!r}")
            d["presc"]["appello_def"][i], d["presc"]["appello"][i] = num(r[3]), num(r[6])
            sd += num(r[3]) or 0
            sp += num(r[6]) or 0
            italia["def"]["appello"][i] = num(r[8])
            nat_p = num(r[10])
        if nat_p != italia["appello"][i] or sp != nat_p or sd != italia["def"]["appello"][i]:
            raise SystemExit(f"prescrizioni in appello {y}: i distretti sommano {sp} su {sd}, l'Italia {nat_p} su {italia['def']['appello'][i]}, la serie {italia['appello'][i]}")
        # tribunali: [distretto, sezione, def. distretto, proscioglimenti, non doversi procedere, circondario, def., pr., ndp]
        b = blocks(report("trib", y))[0]
        dist_tot, dist_sum, nd = {}, defaultdict(lambda: [0, 0]), set()
        circ = defaultdict(lambda: [0, 0])  # (sede, rito) -> [definiti, prescritti]
        for r in b["rows"]:
            key = (norm(r[0]), norm(r[1]))
            dist_tot[key] = (num(r[2]) or 0, (num(r[3]) or 0) + (num(r[4]) or 0))
            if num(r[6]) is None:
                nd.add(key[0])
                continue
            dd, pp = num(r[6]), (num(r[7]) or 0) + (num(r[8]) or 0)
            dist_sum[key][0] += dd
            dist_sum[key][1] += pp
            c = by_norm.get(norm(r[5]))
            if c is None:
                # un tribunale soppresso che i report elencano ancora (Camerino): conta nel distretto, non tra i 140
                gone.add(r[5])
                continue
            circ[(c["sede"], key[1])][0] += dd
            circ[(c["sede"], key[1])][1] += pp
        for t in tribs:
            mine = [a for (s, _), a in circ.items() if s == t["sede"]]
            if mine:
                t["presc"]["trib_def"][i], t["presc"]["trib"][i] = sum(a[0] for a in mine), sum(a[1] for a in mine)
        # ogni distretto torna con la somma dei suoi circondari, se nessuno è n.d.
        for key, tot in dist_tot.items():
            if key[0] not in nd and tuple(dist_sum[key]) != tot:
                raise SystemExit(f"prescrizioni nei tribunali {y}, {key}: i circondari sommano {dist_sum[key][1]} su {dist_sum[key][0]}, il distretto {tot[1]} su {tot[0]}")
        tp = sum(p for _, p in dist_tot.values())
        italia["def"]["trib"][i] = sum(dd for dd, _ in dist_tot.values())
        if italia["trib"][i] is not None and abs(tp - italia["trib"][i]) > max(5, 0.002 * italia["trib"][i]):
            raise SystemExit(f"prescrizioni nei tribunali {y}: i distretti sommano {tp}, la serie nazionale {italia['trib'][i]}")
        # GIP/GUP: [distretto, circondario, definiti, archiviati per prescrizione, ndp gip, ndp gup, Italia ×4]
        b = blocks(report("gip", y))[0]
        gp = gd = 0
        for r in b["rows"]:
            c = by_norm.get(norm(r[1]))
            if num(r[2]) is None:
                continue
            if c is None:
                gone.add(r[1])
                p = (num(r[3]) or 0) + (num(r[4]) or 0) + (num(r[5]) or 0)
                gp += p
                gd += num(r[2])
                continue
            p = (num(r[3]) or 0) + (num(r[4]) or 0) + (num(r[5]) or 0)
            c["presc"]["gip_def"][i], c["presc"]["gip"][i] = num(r[2]), p
            gp += p
            gd += num(r[2])
            italia["def"]["gip"][i] = num(r[6])
            nat_g = [num(r[7]), num(r[8]), num(r[9])]
        if None not in nat_g and gp != sum(nat_g):
            log(f"  attenzione: prescrizioni GIP/GUP {y}: i circondari sommano {gp}, l'Italia {sum(nat_g)}")
    log(f"  prescrizioni: {len(YEARS)} anni; Corti d'appello e tribunali tornano con i distretti e con la serie nazionale"
        + (f"; nei report anche tribunali soppressi, contati solo nei distretti: {sorted(gone)}" if gone else ""))
    return italia


GIP_MODES = ["arch", "decreti", "riti", "giudizio"]
# Celle del report sulle modalità di definizione che non tornano con i flussi dello stesso Ministero: restano vuote.
# Piacenza 2015: le quattro modalità sommano 4.171, i procedimenti definiti dal GIP nei flussi sono 3.728.
GIP_FUORI = {("piacenza", 2015)}


def gip_modes(tribs):
    """Come si chiudono i procedimenti davanti al GIP e al GUP, per circondario e anno: le quattro modalità principali che
    il Ministero conta (archiviazioni, decreti penali di condanna diventati esecutivi, sentenze con rito alternativo,
    rinvii a giudizio). I circondari devono sommare il loro distretto e le quattro modalità non possono superare i
    procedimenti definiti dal GIP nei flussi."""
    by_norm = {norm(t["sede"]): t for t in tribs}
    for t in tribs:
        t["gip_esiti"] = {k: [None] * len(YEARS) for k in GIP_MODES}
    italia = {k: [None] * len(YEARS) for k in GIP_MODES}
    gone, over = set(), []
    for i, y in enumerate(YEARS):
        # [distretto, circondario, archiviazioni, riti alternativi, decreti di condanna esecutivi, rinviati a giudizio,
        #  le stesse quattro per il distretto]
        b = blocks(report("gip_mod", y))[0]
        dist_tot, dist_sum, nd = {}, defaultdict(lambda: [0, 0, 0, 0]), set()
        for r in b["rows"]:
            d = norm(r[0])
            dist_tot[d] = [num(x) or 0 for x in r[6:10]]
            arch, riti, dec, giu = (num(x) for x in r[2:6])
            c = by_norm.get(norm(r[1]))
            if None in (arch, riti, dec, giu):
                if c is not None:
                    nd.add(d)  # un tribunale aperto senza dati: il distretto non si può controllare
                continue
            dist_sum[d] = [a + v for a, v in zip(dist_sum[d], (arch, riti, dec, giu))]
            if c is None:
                gone.add(r[1])
                continue
            for k, v in zip(("arch", "riti", "decreti", "giudizio"), (arch, riti, dec, giu)):
                c["gip_esiti"][k][i] = v
        for d, tot in dist_tot.items():
            if d not in nd and dist_sum[d] != tot:
                raise SystemExit(f"modalità di definizione GIP {y}, {d}: i circondari sommano {dist_sum[d]}, il distretto {tot}")
        for j, k in enumerate(("arch", "riti", "decreti", "giudizio")):
            italia[k][i] = sum(t[j] for t in dist_tot.values())
        for t in tribs:
            s = sum(t["gip_esiti"][k][i] or 0 for k in GIP_MODES)
            if (norm(t["sede"]), y) in GIP_FUORI:
                for k in GIP_MODES:
                    t["gip_esiti"][k][i] = None
            elif s > t["flussi"]["gip"]["d"][i] * 1.02:
                over.append((t["name"], y, s, t["flussi"]["gip"]["d"][i]))
    if over:
        raise SystemExit(f"modalità di definizione GIP oltre i definiti dei flussi: {over[:5]}")
    L = len(YEARS) - 1
    cov = sum(italia[k][L] for k in GIP_MODES) / sum(t["flussi"]["gip"]["d"][L] for t in tribs)
    log(f"  modalità di definizione GIP: {len(YEARS)} anni, i circondari tornano con i distretti; nel {YEARS[-1]} coprono il "
        f"{100 * cov:.0f}% dei definiti dei flussi" + (f"; tribunali soppressi solo nei distretti: {sorted(gone)}" if gone else ""))
    return italia


def build():
    D, pop_year = districts()
    v = flows()
    check_indicators(v)

    # i 140 tribunali dei flussi, con il loro distretto (29, con le sezioni distaccate)
    seats = sorted({(dist, sede) for (u, z, dist, sede, y) in v if u == "Tribunale"})
    if len(seats) != 140:
        raise SystemExit(f"attesi 140 tribunali nei flussi, trovati {len(seats)}")
    tribs = []
    for dist, sede in seats:
        did = dist_id(dist, D)
        for sid, names in SEZIONI.items():
            if norm(sede) in names:
                did = sid
        # il nome come nell'elenco dei comuni: «Barcellona Pozzo di Gotto», non «Pozzo Di Gotto»
        name = re.sub(r" (Di|Del|Della|Dei|Degli|Delle|In|Sul|Sulla) ", lambda m: " " + m.group(1).lower() + " ", sede.split("/")[0])
        tribs.append({"id": norm(sede).replace(" ", "-"), "sede": sede, "name": name, "dist_csv": dist, "dist": did})

    # i comuni di ogni tribunale (Giustizia Map) e i loro residenti
    CU = json.load(open(os.path.join(HERE, "comuni_uffici.json"), encoding="utf-8"))["comuni"]
    by_norm = {norm(t["sede"]): t for t in tribs}
    mapnames = {tkey(o["trib"]) for o in CU.values()}
    miss_t = sorted(t["sede"] for t in tribs if norm(t["sede"]) not in mapnames)
    miss_m = sorted(n for n in mapnames if n not in by_norm)
    if miss_t or miss_m:
        raise SystemExit(f"tribunali senza comuni: {miss_t}; tribunali dei comuni che i flussi non hanno: {miss_m}")
    pop = comune_pop()
    nocode = sorted(set(CU) - set(pop))
    if nocode:
        raise SystemExit(f"{len(nocode)} comuni senza residenti nel file ISTAT del {POP_YEAR}: {nocode[:10]}")
    extra = sorted(set(pop) - set(CU))
    if extra:
        raise SystemExit(f"{len(extra)} comuni con residenti ma senza tribunale: {extra[:10]}")
    for t in tribs:
        t["pop"], t["comuni"] = 0, 0
    ca_of = defaultdict(set)
    for code, o in CU.items():
        t = by_norm[tkey(o["trib"])]
        t["pop"] += pop[code]
        t["comuni"] += 1
        ca = o.get("ca", "")
        m = re.search(r"Sezione distaccata di (.+)$", ca)
        ca_of[t["sede"]].add(norm(m.group(1)) if m else norm(ca))
    for t in tribs:
        if len(ca_of[t["sede"]]) != 1:
            raise SystemExit(f"i comuni del tribunale di {t['name']} stanno in più distretti: {sorted(ca_of[t['sede']])}")
        ca = next(iter(ca_of[t["sede"]]))
        want = next(d["id"] for d in D if norm(d["name"]) == ca or (ca == "reggio calabria" and d["id"] == "reggio"))
        if want != t["dist"]:
            raise SystemExit(f"tribunale di {t['name']}: distretto {t['dist']} dai flussi, {want} dai comuni")
    if sum(t["pop"] for t in tribs) != sum(pop.values()):
        raise SystemExit("i residenti dei circondari non sommano quelli dell'Italia")
    log(f"  140 tribunali con i loro comuni ({len(CU)}) e {sum(pop.values()):,} residenti al 1° gennaio {POP_YEAR}")

    # flussi: Italia, distretti, tribunali
    italia = {"flussi": {k: stage_series(v, k, lambda dist, sede: True) for k in STAGES}}
    t_of = {(t["dist_csv"], t["sede"]): t for t in tribs}
    for t in tribs:
        t["flussi"] = {k: stage_series(v, k, lambda dist, sede, t=t: (dist, sede) == (t["dist_csv"], t["sede"])) for k in ("procura", "gip", "mono", "coll", "assise")}
    ca_seats = {sede for (u, z, dist, sede, y) in v if u == "Corte di Appello"}
    for d in D:
        mine = {(t["dist_csv"], t["sede"]) for t in tribs if t["dist"] == d["id"]}
        d["flussi"] = {k: stage_series(v, k, lambda dist, sede, mine=mine: (dist, sede) in mine) for k in ("procura", "gip", "mono", "coll")}
        seat = next((s for s in ca_seats if norm(s) == norm(d["name"])), None)
        d["flussi"]["appello"] = stage_series(v, "appello", lambda dist, sede, seat=seat: sede == seat) if seat else None
        if d["flussi"]["appello"] is None:
            raise SystemExit(f"nessuna Corte d'appello per il distretto {d['name']}")
    # le parti tornano con l'Italia
    for k in ("procura", "gip", "mono", "coll"):
        for j in "sdp":
            if [sum(d["flussi"][k][j][i] for d in D) for i in range(len(YEARS))] != italia["flussi"][k][j]:
                raise SystemExit(f"flussi {k}/{j}: i distretti non sommano l'Italia")
    if [sum(d["flussi"]["appello"]["p"][i] for d in D) for i in range(len(YEARS))] != italia["flussi"]["appello"]["p"]:
        raise SystemExit("flussi in appello: le 29 sedi non sommano l'Italia")

    italia["durata"] = durations(D, tribs, v)
    italia["presc"] = prescriptions(D, tribs)
    italia["gip_esiti"] = gip_modes(tribs)

    # il tribunale di ogni comune, nell'ordine di data/comuni.json (la ricerca della scheda)
    order = [t["id"] for t in tribs]
    names = json.load(open(os.path.join(OUT, "comuni.json"), encoding="utf-8"))["comuni"]
    istat = {}
    text = open(os.path.join(CACHE, "elenco_comuni.csv"), encoding="latin-1").read()
    for r in list(csv.reader(io.StringIO(text), delimiter=";"))[1:]:
        if len(r) > 14:
            istat[(norm(r[5]), r[14].strip())] = r[4].strip()
            istat.setdefault((norm(r[6]), r[14].strip()), r[4].strip())
    trib_of, capoluoghi = [], {}
    for c in names:
        code = istat.get((norm(c[0]), c[2]))
        if code is None or code not in CU:
            raise SystemExit(f"comune di data/comuni.json senza tribunale: {c[0]} ({c[2]})")
        trib_of.append(order.index(by_norm[tkey(CU[code]["trib"])]["id"]))
        if c[4]:
            capoluoghi[c[4]] = trib_of[-1]
    vc = json.load(open(os.path.join(OUT, "vc.json"), encoding="utf-8"))
    lost = [c["name"] for c in vc["cities"] if c["id"] not in capoluoghi]
    if lost:
        raise SystemExit(f"capoluoghi di data/vc.json senza tribunale: {lost}")

    strip = lambda t: {k: t[k] for k in t if k not in ("dist_csv", "sede")}  # noqa: E731
    data = {
        "meta": {
            "years": YEARS, "last": YEARS[-1], "pop_year": POP_YEAR, "dist_pop_year": pop_year, "built": date.today().isoformat(),
            "nota": "Procedimenti penali con autore noto (Ministero della Giustizia, Direzione generale di statistica e analisi organizzativa). Uso non commerciale con citazione della fonte (note legali di datiestatistiche.giustizia.it).",
            "sources": [
                {"id": "PenaleFlussi20142025", "label": "Ministero della Giustizia, DG Statistica: procedimenti penali sopravvenuti, definiti e pendenti per ufficio, sezione e circondario, 2014-2025",
                 "en": "Ministry of Justice, Statistics Directorate: criminal proceedings opened, closed and pending, by office, section and court district, 2014-2025"},
                {"id": "Durate_medie_penali", "label": "Ministero della Giustizia, DG Statistica: durata media dei procedimenti penali definiti e definiti per classi di durata, 2014-2025",
                 "en": "Ministry of Justice, Statistics Directorate: average length of closed criminal proceedings, and closed proceedings by length, 2014-2025"},
                {"id": "Indicatori_Penali", "label": "Ministero della Giustizia, DG Statistica: clearance rate e disposition time per sede (per il controllo)",
                 "en": "Ministry of Justice, Statistics Directorate: clearance rate and disposition time by court (as a cross-check)"},
                {"id": "reportistica.dgstat", "label": "Ministero della Giustizia, DG Statistica: procedimenti penali definiti per prescrizione, per ufficio, distretto e circondario, e modalità di definizione davanti al GIP e al GUP per circondario (report su reportistica.dgstat.giustizia.it)",
                 "en": "Ministry of Justice, Statistics Directorate: criminal proceedings closed because of the statute of limitations, by office, district and court, and how preliminary judges close proceedings, by court (reports on reportistica.dgstat.giustizia.it)"},
                {"id": "Giustizia Map", "label": "Ministero della Giustizia, Giustizia Map: uffici giudiziari competenti per ogni comune (d.lgs. 14/2014)",
                 "en": "Ministry of Justice, Giustizia Map: the courts with jurisdiction over each municipality (Legislative Decree 14/2014)"},
                {"id": f"POSAS_{POP_YEAR}", "label": f"ISTAT, Demografia in cifre: popolazione residente al 1° gennaio {POP_YEAR} per comune (residenti dei circondari)",
                 "en": f"ISTAT, Demografia in cifre: resident population on 1 January {POP_YEAR} by municipality (residents of each court's area)"},
            ],
        },
        "italia": italia,
        "distretti": D,
        "tribunali": [strip(t) for t in tribs],
        "comuni_trib": trib_of,
        "capoluoghi": capoluoghi,
    }
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "giustizia.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    L = len(YEARS) - 1
    F = italia["flussi"]
    log(f"scritto data/giustizia.json ({os.path.getsize(path) // 1024} KB): {YEARS[-1]}, pendenti in procura {F['procura']['p'][L]:,}, "
        f"in tribunale {F['mono']['p'][L] + F['coll']['p'][L]:,}, in appello {F['appello']['p'][L]:,}")


if __name__ == "__main__":
    build()
