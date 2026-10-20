#!/usr/bin/env python3
"""Atlante della Sicurezza — approfondimento «Carcere per carcere» (affollamento e morti negli istituti per adulti).

Scrive data/istituti.json mettendo insieme quattro fonti:

  ministero   le tabelle mensili «Detenuti italiani e stranieri presenti e capienze per istituto» del Ministero della
              Giustizia (giustizia.it, una pagina HTML al mese da gennaio 2019): per ogni carcere regione, tipo, capienza
              regolamentare, persone presenti, donne e stranieri. Scaricate una volta e tenute in scripts/.cache/giustizia
  eventi      la serie «Eventi critici negli istituti penitenziari» dello stesso Ministero (suicidi e morti per cause
              naturali dal 1992, con i tassi), anche questa una pagina HTML
  trascritte  le tabelle dei PDF del Garante nazionale (posti davvero disponibili per istituto, morti e suicidi per
              istituto, serie dei decessi) e i conteggi di Ristretti Orizzonti e Antigone, copiati in
              scripts/istituti_tabelle.json con la pagina di ognuno
  regioni     data/cautelari.json (build_cautelari.py), per confrontare il tipo di carceri di ogni regione con la quota
              di persone senza condanna definitiva: va lanciato dopo build_cautelari.py

Gli istituti si riconoscono da un mese all'altro per regione e nome; i nomi cambiano (fino ad agosto 2019 i nomi propri
per esteso, poi le iniziali; intitolazioni aggiunte; «SAN REMO» diventato «SANREMO»): ALIAS lega i nomi vecchi a quelli
di oggi. Il punto sulla carta è il baricentro del comune in data/comuni.json.

Uso:  python3 scripts/build_istituti.py      (dalla cartella atlante-della-sicurezza/)
Si ferma se le somme non tornano: in ogni mese gli istituti con la riga del totale (capienza, presenti, donne, stranieri);
le due edizioni dello stesso mese tra loro; gli istituti del Garante con quelli del Ministero dello stesso giorno (capienza
uguale, presenti quasi uguali) e i posti con il totale pubblicato; i morti per istituto con i totali; i tassi degli eventi
critici con i conteggi; le regioni del Ministero a fine 2025 con quelle dell'ISTAT. Si ferma anche se un istituto non
trova il suo comune o un nome del Garante non trova il suo istituto.
"""
import html
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.request
from collections import Counter, defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import CACHE, OUT, log  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "Mozilla/5.0 (atlantedellasicurezza.it; dati pubblici)"}
LISTING = "https://www.giustizia.it/giustizia/page/it/statistiche?all=true"
PAGE = "https://www.giustizia.it/giustizia/it/mg_1_14_1.page?contentId={id}"
EVENTI = "SST241783"  # Eventi critici negli istituti penitenziari, serie storica
MESI = {"gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4, "maggio": 5, "giugno": 6, "luglio": 7, "agosto": 8,
        "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12}

# Le regioni come le scrive il Ministero, con il codice NUTS di data/comuni.json e il nome di data/cautelari.json.
REG = {
    "ABRUZZO": ("ITF1", "Abruzzo"), "BASILICATA": ("ITF5", "Basilicata"), "CALABRIA": ("ITF6", "Calabria"),
    "CAMPANIA": ("ITF3", "Campania"), "EMILIA ROMAGNA": ("ITD5", "Emilia-Romagna"), "FRIULI VENEZIA GIULIA": ("ITD4", "Friuli-Venezia Giulia"),
    "LAZIO": ("ITE4", "Lazio"), "LIGURIA": ("ITC3", "Liguria"), "LOMBARDIA": ("ITC4", "Lombardia"), "MARCHE": ("ITE3", "Marche"),
    "MOLISE": ("ITF2", "Molise"), "PIEMONTE": ("ITC1", "Piemonte"), "PUGLIA": ("ITF4", "Puglia"), "SARDEGNA": ("ITG2", "Sardegna"),
    "SICILIA": ("ITG1", "Sicilia"), "TOSCANA": ("ITE1", "Toscana"), "TRENTINO ALTO ADIGE": ("ITD1", "Trentino-Alto Adige"),
    "UMBRIA": ("ITE2", "Umbria"), "VALLE D'AOSTA": ("ITC2", "Valle d'Aosta"), "VENETO": ("ITD3", "Veneto"),
}
# Le nuove province (Monza, Fermo, Barletta-Andria-Trani) hanno codici NUTS che non dicono la regione.
NUTS_REG = {"IT108": "ITC4", "IT109": "ITE3", "IT110": "ITF4", "ITD10": "ITD1", "ITD20": "ITD1"}

# Nomi vecchi (dopo la normalizzazione di key()) -> nome di oggi, quando non basta togliere i nomi propri per esteso.
ALIAS = {
    "BERGAMO": 'BERGAMO "DON FAUSTO RESMINI"',
    "BENEVENTO": 'BENEVENTO "M. GAGLIONE"',
    "VALLO DELLA LUCANIA": 'VALLO DELLA LUCANIA "A. PARAGANO"',
    "VELLETRI": 'VELLETRI "A. CAROTENUTO"',
    'VITERBO "N.C."': 'VITERBO "N. IZZO"',
    "ARIENZO": 'ARIENZO "G. DE ANGELIS"',
    'SAN REMO "N.C."': "SANREMO",  # casa di reclusione fino a marzo 2022, poi casa circondariale: lo stesso istituto
}
# Il comune, quando il nome dell'istituto non è quello di data/comuni.json.
COMUNE = {"REGGIO CALABRIA": "Reggio di Calabria", "REGGIO EMILIA": "Reggio nell'Emilia", "ROSSANO": "Corigliano-Rossano",
          "SAN REMO": "Sanremo", "BOLZANO": "Bolzano"}
ESTERO = {'ROMA "GJADER ALBANIA"'}  # il centro di Gjadër, in Albania, conta tra gli istituti di Roma: niente punto sulla carta

# Nomi brevi per la pagina, quando la regola di short() non basta (chiave: il nome di oggi dopo key()).
SHORT = {
    'ROMA "R. CINOTTI" REBIBBIA N.C.1': "Roma Rebibbia Nuovo complesso",
    'ROMA "G. STEFANINI" REBIBBIA FEMMINILE': "Roma Rebibbia femminile",
    'ROMA "REBIBBIA"': "Roma Rebibbia Reclusione",
    'ROMA "REBIBBIA TERZA CASA"': "Roma Rebibbia Terza casa",
    'ROMA "GJADER ALBANIA"': "Gjadër (Albania)",
    'REGGIO CALABRIA "G. PANZERA"': "Reggio Calabria Panzera",
    'PERUGIA "NUOVO COMPLESSO PENITENZIARIO CAPANNE"': "Perugia Capanne",
    'BRISSOGNE "AOSTA"': "Aosta (Brissogne)",
    'BERGAMO "DON FAUSTO RESMINI"': "Bergamo",
    'FIRENZE "MARIO GOZZINI"': "Firenze Gozzini",
    'TORINO "G. LORUSSO L. CUTUGNO" LE VALLETTE': "Torino Lorusso e Cutugno",
    'REGGIO EMILIA "C.C. E C.R."': "Reggio Emilia",
    'ONANI "MAMONE"': "Mamone (Onanì)",
    'ARBUS "IS ARENAS"': "Is Arenas (Arbus)",
    'LIVORNO "GORGONA"': "Gorgona (Livorno)",
    # due carceri nello stesso comune: il nome ufficiale le distingue
    'PADOVA "N.C."': "Padova Nuovo complesso",
    'CIVITAVECCHIA "N.C."': "Civitavecchia Nuovo complesso",
    'CIVITAVECCHIA "G. PASSERINI"': "Civitavecchia Passerini",
}
SHORT_K = {}  # SHORT con le chiavi passate per key(), riempito sotto
TIPI = {"CC": "cc", "CCF": "cc", "CR": "cr", "CRF": "cr", "CL": "altro", "IP": "altro", "ICAM": "altro"}

# Nomi del Garante che la regola di match() non riconosce da sola -> nome di oggi dell'istituto, dopo key().
GARANTE = {
    "CC ROMA “REBIBBIA” N.C.1": 'ROMA "R. CINOTTI" REBIBBIA N.C.1',
    "CC ROMA “REBIBBIA TERZA CASA”": 'ROMA "REBIBBIA TERZA CASA"',
    "CC REGGIO CALABRIA \"ARGHILLA'\"": "REGGIO CALABRIA \"ARGHILLA'\"",
    "CC REGGIO CALABRIA “PANZERA”": 'REGGIO CALABRIA "G. PANZERA"',
    # Roma «Rebibbia» casa circondariale è il Nuovo complesso: la capienza della tabella 18 del report 2025 (1.171) è la sua
    "Roma “Rebibbia” – C.C.": 'ROMA "R. CINOTTI" REBIBBIA N.C.1',
    "Roma “Rebibbia – Casa circondariale": 'ROMA "R. CINOTTI" REBIBBIA N.C.1',
    "Roma “Rebibbia” - Casa circondariale": 'ROMA "R. CINOTTI" REBIBBIA N.C.1',
    "Roma \"Rebibbia\" – C.C.F.": 'ROMA "G. STEFANINI" REBIBBIA FEMMINILE',
    "Roma “Rebibbia” – Casa circondariale femminile": 'ROMA "G. STEFANINI" REBIBBIA FEMMINILE',
    "Roma “Rebibbia” – C.R.": 'ROMA "REBIBBIA"',
    "Roma “Rebibbia” – Casa di reclusione": 'ROMA "REBIBBIA"',
    "Parma - II.PP.": "PARMA", "Parma -II.PP.": "PARMA", "Parma - II.PP": "PARMA",
    "Gorgona – Casa reclusione": 'LIVORNO "GORGONA"',
    "Caltanisetta – C.C.": "CALTANISSETTA", "Caltanisetta - Casa circondariale": "CALTANISSETTA",
}


def get(url, cache_name, refresh=False):
    """Scarica una pagina di giustizia.it con cache su disco (le pagine dei mesi passati non cambiano)."""
    path = os.path.join(CACHE, "giustizia", cache_name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not refresh and os.path.exists(path) and os.path.getsize(path) > 0:
        return open(path, encoding="utf-8").read()
    last = None
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                body = r.read().decode("utf-8", errors="replace")
            if "<table" not in body and "contentId" not in body:
                raise RuntimeError("pagina senza tabelle né elenco")
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)
            time.sleep(1)  # una pagina al secondo: il sito è del Ministero, non va sovraccaricato
            return body
        except Exception as e:  # noqa: BLE001
            last = e
            log(f"  tentativo {i + 1} fallito per {cache_name}: {e}")
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"download non riuscito: {url}\n{last}")


def editions():
    """Le edizioni mensili «Detenuti italiani e stranieri presenti e capienze per istituto», dall'elenco delle statistiche.
    L'elenco si riscarica ogni volta (c'è un mese nuovo), le pagine dei mesi restano in cache."""
    text = get(LISTING, "statistiche_all.html", refresh=os.environ.get("ISTITUTI_OFFLINE") != "1")
    out = defaultdict(list)
    for cid, title in re.findall(r'<a[^>]+href="[^"]*contentId=(SST\d+)[^"]*"[^>]*>(.*?)</a>', text, re.S):
        t = re.sub(r"\s+", " ", html.unescape(re.sub("<[^>]+>", "", title))).strip()
        if not t.lower().startswith("detenuti italiani e stranieri presenti e capienze per istituto"):
            continue
        m = re.search(r"(\d{1,2})\s+([a-z]+)\s+(\d{4})", t.lower())
        k = f"{m.group(3)}-{MESI[m.group(2)]:02d}"
        if cid not in out[k]:
            out[k].append(cid)
    return out


def cells(row):
    return [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip()
            for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]


def num(s):
    s = s.replace(".", "").replace("\xa0", "").strip()
    return int(s) if s else 0


def dec(s):
    return float(s.replace(".", "").replace(",", "."))


# Le colonne si leggono dall'intestazione, non dalla posizione: fino a qualche anno fa c'era anche la sigla della provincia.
COLS = [("regione", "reg"), ("sigla", "prov"), ("tipo", "tipo"), ("istituto", "nome"), ("capienza", "cap"),
        ("detenuti presenti", "pres"), ("stranieri", "str")]  # «tipo istituto» prima di «istituto»


def parse(text):
    """Le righe degli istituti e la riga del totale di un'edizione mensile."""
    tb = text[text.find("<table"):text.find("</table>")]
    trs = [cells(r) for r in re.findall(r"<tr[^>]*>(.*?)</tr>", tb, re.S)]
    cols = []
    for h in trs[0]:
        k = next(v for n, v in COLS if n in h.lower())
        cols += ["pres", "donne"] if k == "pres" else [k]  # «detenuti presenti» ha due colonne: totale e donne
    rows, total = [], None
    for c in trs[2:]:
        if c and c[0].lower().startswith("totale"):
            total = dict(zip(["cap", "pres", "donne", "str"], [num(x) for x in c[1:]]))
        elif len(c) == len(cols):
            r = dict(zip(cols, c))
            for k in ("cap", "pres", "donne", "str"):
                r[k] = num(r[k])
            rows.append(r)
        elif any(c):
            raise SystemExit(f"riga che non si legge: {c}")
    if not rows or total is None:
        raise SystemExit("edizione senza istituti o senza la riga del totale")
    return rows, total


def plain(s):
    """Maiuscole senza accenti, virgolette uniformi."""
    s = unicodedata.normalize("NFD", s.upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("“", '"').replace("”", '"').replace("’", "'").replace("‘", "'")


def norm(name):
    """Il nome di un istituto senza il trattino finale, con i trattini interni come spazi e senza l'apostrofo finale
    (l'accento: «ONANI'» e «ONANI» sono lo stesso istituto)."""
    n = plain(name).strip()
    n = re.sub(r"\s*-\s*$", "", n)
    n = re.sub(r"\s*-\s*", " ", n)
    n = re.sub(r"(\w)'(?=\W|$)", r"\1", n)
    n = re.sub(r"\b([A-Z])\.(?=[A-Z]{2})", r"\1. ", n)  # «E.SCALAS» come «E. SCALAS»
    return re.sub(r"\s+", " ", n).strip()


def key(name):
    """L'identità di un istituto: norm() con le parole tra virgolette ridotte all'iniziale tranne l'ultima, così il nome
    per esteso dei primi mesi del 2019 («ANTONIO SANTORO») e le iniziali di dopo («A. SANTORO») coincidono."""
    def initials(m):
        w = m.group(1).split()
        if len(w) > 1 and not any(x in ("N.C.", "C.R.", "C.C.", "E") for x in w) and all(re.fullmatch(r"[A-Z']+|[A-Z]\.", x) for x in w):
            w = [x if x.endswith(".") or i == len(w) - 1 else x[0] + "." for i, x in enumerate(w)]
        return '"' + " ".join(w) + '"'
    return re.sub(r'"([^"]*)"', initials, norm(name))


def town(k):
    """Il comune nel nome normalizzato: quello che viene prima delle virgolette."""
    return k.split('"')[0].strip()


def title(s):
    """«SANT'ANGELO DEI LOMBARDI» -> «Sant'Angelo dei Lombardi», «FORLI'» -> «Forlì»."""
    acc = {"A": "à", "E": "è", "I": "ì", "O": "ò", "U": "ù"}
    s = re.sub(r"([AEIOU])'(?=\W|$)", lambda m: acc[m.group(1)], s.upper())
    out = []
    for i, w in enumerate(s.split()):
        lw = w.lower()
        if i and lw in ("di", "dei", "del", "della", "delle", "e", "in"):
            out.append(lw)
        else:
            out.append("'".join(p[:1].upper() + p[1:] for p in lw.split("'")))
    return " ".join(out)


def short(k, raw):
    """Un nome breve per la pagina, dal nome di oggi: il comune e quello che distingue l'istituto, senza le intitolazioni
    a persone (scritte con le iniziali) e le sigle del complesso."""
    if k in SHORT_K:
        return SHORT_K[k]
    p = plain(raw).strip()
    q = re.findall(r'"([^"]*)"', p)
    tail = p.split('"')[-1].strip(" -") if q else ""
    label = [x for x in q if x not in ("N.C.", "I C.R.", "II C.R.") and not re.search(r"\b[A-Z]\.", x)]
    if tail:
        label.append(tail)
    return " ".join(title(x) for x in [p.split('"')[0].strip(" -")] + label)


SHORT_K.update({key(k): v for k, v in SHORT.items()})
ESTERO = {key(k) for k in ESTERO}


def comuni_index():
    d = json.load(open(os.path.join(OUT, "comuni.json"), encoding="utf-8"))
    idx = defaultdict(list)
    for c in d["comuni"]:
        for n in (c[0], c[1]):
            if n:
                idx[plain(n).replace("'", "")].append(c)
    return idx


def locate(k, reg, idx):
    if k in ESTERO:
        return None, None
    t = town(k)
    name = COMUNE.get(t, t)
    hits = idx.get(plain(name).replace("'", ""), [])
    nuts = REG[reg][0]
    hits = [c for c in hits if NUTS_REG.get(c[3], c[3][:4]) == nuts]
    if len(hits) != 1:
        raise SystemExit(f"il comune di {k} ({reg}) non si trova una volta sola in data/comuni.json: {len(hits)}")
    c = hits[0]
    return c[0], [c[5] / 100, c[6] / 100]


def ministry():
    eds = editions()
    months = sorted(eds)
    first = date(int(months[0][:4]), int(months[0][5:]), 1)
    # nessun mese manca tra il primo e l'ultimo
    want = [f"{y}-{m:02d}" for y in range(first.year, int(months[-1][:4]) + 1) for m in range(1, 13)]
    want = [x for x in want if months[0] <= x <= months[-1]]
    if want != months:
        raise SystemExit(f"mancano dei mesi: {sorted(set(want) - set(months))}")
    data = {}
    for k in months:
        parsed = [parse(get(PAGE.format(id=cid), f"{cid}.html")) for cid in sorted(eds[k], key=lambda c: int(c[3:]))]
        if len(parsed) > 1 and any(p != parsed[0] for p in parsed[1:]):
            raise SystemExit(f"{k}: le {len(parsed)} edizioni dello stesso mese non sono uguali")
        rows, total = parsed[-1]
        for c in ("cap", "pres", "donne", "str"):
            s = sum(r[c] for r in rows)
            if s != total[c]:
                raise SystemExit(f"{k}: gli istituti sommano {s} per «{c}», la riga del totale dice {total[c]}")
        data[k] = (rows, total)
    log(f"  Ministero: {len(months)} mesi da {months[0]} a {months[-1]}, {sum(len(v) for v in eds.values())} edizioni; in ogni mese gli istituti tornano con il totale")
    return months, data


def institutes(months, data, idx):
    """Ogni istituto con la sua serie mensile. L'identità è regione + nome normalizzato, con gli alias."""
    alias = {key(a): key(b) for a, b in ALIAS.items()}
    inst = {}
    for i, k in enumerate(months):
        rows, _ = data[k]
        seen = set()
        for r in rows:
            nk = key(r["nome"])
            nk = alias.get(nk, nk)
            ident = (r["reg"], nk, r["tipo"] in ("CCF", "CRF"))  # a Trani la casa circondariale e la femminile hanno lo stesso nome
            if ident in seen:
                raise SystemExit(f"{k}: due righe per lo stesso istituto {ident}")
            seen.add(ident)
            if ident not in inst:
                inst[ident] = {"pres": [None] * len(months), "cap": [None] * len(months), "tipi": {}, "raw": r["nome"], "row": r}
            o = inst[ident]
            o["pres"][i], o["cap"][i] = r["pres"], r["cap"]
            o["tipi"][k] = r["tipo"]
            o["raw"], o["row"] = r["nome"], r
    out = []
    for (reg, nk, fem), o in sorted(inst.items(), key=lambda x: x[0]):
        comune, pt = locate(nk, reg, idx)
        tipo = o["tipi"][max(o["tipi"])]
        changes = sorted({(k, t) for k, t in o["tipi"].items()})
        prev, moves = None, []
        for k, t in changes:
            if t != prev:
                moves.append([months.index(k), t])
                prev = t
        caps, last = [], None
        for i, c in enumerate(o["cap"]):
            if c is not None and c != last:
                caps.append([i, c])
                last = c
        out.append({
            "id": re.sub(r"[^a-z0-9]+", "-", plain(nk).lower()).strip("-") + ("-f" if fem else ""),
            "key": nk, "reg": REG[reg][1], "nuts": REG[reg][0], "ufficiale": o["raw"].rstrip(" -"),
            # le femminili lo dicono nel nome, anche quando il nome ufficiale non lo scrive (a Trani ce ne sono due con lo stesso)
            "nome": short(nk, o["raw"]) + (" femminile" if fem and "femminile" not in short(nk, o["raw"]).lower() else ""),
            "tipo": tipo, "tipi": moves if len(moves) > 1 else None, "comune": comune, "pt": pt,
            "pres": o["pres"], "cap": caps, "donne": o["row"]["donne"] if o["pres"][-1] is not None else None,
            "str": o["row"]["str"] if o["pres"][-1] is not None else None,
        })
    ids = Counter(x["id"] for x in out)
    if any(n > 1 for n in ids.values()):
        raise SystemExit(f"id ripetuti: {[k for k, n in ids.items() if n > 1]}")
    gone = [f"{x['nome']} (fino a {months[max(i for i, v in enumerate(x['pres']) if v is not None)]})" for x in out if x["pres"][-1] is None]
    new = [f"{x['nome']} (da {months[min(i for i, v in enumerate(x['pres']) if v is not None)]})" for x in out if x["pres"][0] is None]
    log(f"  {len(out)} istituti in tutto; chiusi o spariti: {', '.join(gone) or 'nessuno'}; nuovi: {', '.join(new) or 'nessuno'}")
    return out


def words(s):
    s = plain(s)
    s = re.sub(r"[\"'()\-–.,]", " ", s)
    return s.split()


TYPE_WORDS = {"CC": "CC", "CR": "CR", "CCF": "CCF", "CRF": "CRF", "CL": "CL", "IP": "IP"}


def gtype(name):
    p = plain(name)
    if re.search(r"C\.?\s?C\.?\s?F\b|CIRCONDARIALE FEMMINILE|^CCF\b", p):
        return "CCF"
    if re.search(r"C\.?\s?R\.?\s?F\b|^CRF\b", p):
        return "CRF"
    if re.search(r"\bC\.?\s?L\b|CASA LAVORO|^CL\b", p):
        return "CL"
    if re.search(r"C\.\s?R\b|CASA DI RECLUSIONE|CASA RECLUSIONE|^CR\b", p):
        return "CR"
    if re.search(r"C\.\s?C\b|CIRCONDARIALE|^CC\b", p):
        return "CC"
    return None


def gwords(name):
    """Le parole del nome di un istituto come lo scrive il Garante, senza il tipo («– C.C.», «CC …») e la sigla della provincia."""
    p = plain(name)
    p = re.sub(r"^(CCF|CRF|CC|CR|CL|IP|ICAM)\s+", "", p)
    p = re.split(r"\s*[–-]\s*(?=C\.|C\s|CASA|II\.)", p)[0]
    p = re.sub(r"\((MI|ME|PV|CS|PZ)\)", " ", p)
    return words(p)


def match(name, pool):
    """L'istituto di un nome del Garante, tra quelli di pool (lista di istituti con 'key'): stesso comune, poi le parole
    che distinguono, poi il tipo. Si ferma se il nome non porta a un istituto solo."""
    if name in GARANTE:
        hit = [x for x in pool if x["key"] == key(GARANTE[name])]
        if len(hit) != 1:
            raise SystemExit(f"alias del Garante senza istituto: {name}")
        return hit[0]
    w = gwords(name)
    cands = []
    for x in pool:
        tw = words(town(x["key"]))
        if w[:len(tw)] == tw:
            cands.append((x, w[len(tw):]))
    if not cands:  # «Barcellona P.G.», «Santa Maria C. Vetere»: basta la prima parola, se il comune è uno solo
        cands = [(x, w[1:]) for x in pool if words(town(x["key"]))[0] == w[0]]
    t = gtype(name)
    if len(cands) > 1:
        rest = set(cands[0][1])
        by = [(x, r) for x, r in cands if rest & (set(words(x["key"])) - set(words(town(x["key"]))))]
        if by:
            cands = by
    if len(cands) > 1 and t:
        cands = [(x, r) for x, r in cands if x["tipo"] == t] or cands
    if len(cands) > 1:  # resta il complesso senza etichetta: quello il cui nome non ha parole oltre il comune
        bare = [(x, r) for x, r in cands if not (set(words(x["key"])) - set(words(town(x["key"]))) - {"N", "C"})]
        if len(bare) == 1:
            cands = bare
    if len(cands) != 1:
        raise SystemExit(f"il nome del Garante «{name}» porta a {len(cands)} istituti: {[x['nome'] for x, _ in cands]}")
    return cands[0][0]


def garante_posti(T, months, data, inst):
    """I posti regolarmente disponibili per istituto (Garante, 31 luglio 2026), legati agli istituti del Ministero."""
    P = T["posti_istituti"]
    k = P["data"][:7]
    i = months.index(k)
    pool = [x for x in inst if x["pres"][i] is not None]
    tot = P["totale"]
    rows, fixed = [], []
    for n, name, cap, posti, pers, tasso, pg in P["righe"]:
        bad = abs(100 * pers / posti - tasso) > 0.06
        if bad:
            new = round(100 * pers / tasso)
            fixed.append(f"{name} {posti}->{new}")
            posti = new
        rows.append((name, cap, posti, pers, bad))
    if sum(r[2] for r in rows) != tot["posti"]:
        raise SystemExit(f"posti del Garante: gli istituti sommano {sum(r[2] for r in rows)}, il totale pubblicato è {tot['posti']}")
    if abs(sum(r[3] for r in rows) - tot["persone"]) > 5:
        raise SystemExit("persone del Garante: gli istituti non tornano con il totale pubblicato")
    got = defaultdict(lambda: [0, 0, 0])
    rebuilt = set()
    for name, cap, posti, pers, bad in rows:
        x = match(name, pool)
        g = got[x["id"]]
        g[0] += cap
        g[1] += posti
        g[2] += pers
        if bad:
            rebuilt.add(x["id"])
    worst = 0
    for x in pool:
        if x["id"] not in got:
            continue
        cap_m = next(c for j, c in reversed(x["cap"]) if j <= i)
        g = got[x["id"]]
        if g[0] != cap_m:
            raise SystemExit(f"{x['nome']}: capienza {g[0]} per il Garante, {cap_m} per il Ministero a {k}")
        d = abs(g[2] - x["pres"][i])
        worst = max(worst, d)
        if d > 15:
            raise SystemExit(f"{x['nome']}: {g[2]} persone per il Garante, {x['pres'][i]} per il Ministero a {k}")
        x["posti"], x["pres_g"] = g[1], g[2]
        if x["id"] in rebuilt:
            x["posti_dal_tasso"] = True  # posti ricavati dal tasso: nel PDF la colonna ripete le persone
    miss = [x["nome"] for x in pool if x["id"] not in got]
    log(f"  Garante, posti disponibili al {P['data']}: {len(rows)} righe, {len(got)} istituti; ricavati dal tasso {len(fixed)} posti ({', '.join(fixed)}); "
        f"totale {tot['posti']:,} come pubblicato; capienza uguale al Ministero in ogni istituto, persone al massimo {worst} di scarto; senza il dato: {', '.join(miss)}")
    return P["data"]


def garante_morti(T, months, inst):
    pool25 = [x for x in inst if any(x["pres"][months.index(f"2025-{m:02d}")] is not None for m in range(1, 13))]
    pool24 = [x for x in inst if any(x["pres"][months.index(f"2024-{m:02d}")] is not None for m in range(1, 13))]
    M = T["morti_2025"]
    cols = [0] * 5
    for name, s, a, n, x_, tot, pg in M["righe"]:
        if s + a + n + x_ != tot:
            raise SystemExit(f"morti 2025, {name} (pag. {pg}): le cause non tornano con il totale")
        for j, v in enumerate((s, a, n, x_, tot)):
            cols[j] += v
        x = match(name, pool25)
        if "m25" in x:
            raise SystemExit(f"morti 2025: due righe per {x['nome']}")
        x["m25"] = [s, a, n, x_]
    # le righe tornano con il testo del report (50 da accertare, 125 naturali), non con la riga del totale (51 e 124)
    if cols != M["totale_testo"] or len(M["righe"]) != M["istituti_coinvolti"]:
        raise SystemExit(f"morti 2025: le righe sommano {cols}, il testo dice {M['totale_testo']}")
    S = T["suicidi_2025"]
    for name, n, pg in S["righe"]:
        x = match(name, pool25)
        if x.get("m25", [0])[0] != n:
            raise SystemExit(f"suicidi 2025, {name}: {n} nella tabella 9, {x.get('m25')} nella tabella 28")
    if sum(r[1] for r in S["righe"]) != S["totale"] or len(S["righe"]) != S["istituti"]:
        raise SystemExit("suicidi 2025: le righe non tornano con il totale")
    S4 = T["suicidi_2024"]
    for name, n, pg in S4["righe"]:
        x = match(name, pool24)
        if "s24" in x:
            raise SystemExit(f"suicidi 2024: due righe per {x['nome']}")
        x["s24"] = n
    if sum(r[1] for r in S4["righe"]) != S4["totale"] or len(S4["righe"]) != S4["istituti"]:
        raise SystemExit("suicidi 2024: le righe non tornano con il totale")
    log(f"  Garante, morti 2025: {len(M['righe'])} istituti, {cols[4]} morti ({cols[0]} suicidi), uguali al testo del report (la riga del totale stampa {M['totale_tabella']}); "
        f"suicidi per istituto uguali nelle tabelle 9 e 28; suicidi 2024: {S4['totale']} in {S4['istituti']} istituti")


def eventi_critici():
    text = get(PAGE.format(id=EVENTI), f"{EVENTI}.html")
    tb = text[text.find("<table"):text.find("</table>")]
    rows = [cells(r) for r in re.findall(r"<tr[^>]*>(.*?)</tr>", tb, re.S)]
    E = defaultdict(list)
    for c in rows:
        if c and re.fullmatch(r"\d{4}", c[0]):
            y, media, cust, s, s_m, s_c, n, n_m, n_c = c[0], *c[1:]
            E["anni"].append(int(y))
            E["media"].append(num(media))
            E["custodia"].append(num(cust))
            E["suicidi"].append(num(s))
            E["naturali"].append(num(n))
            for v, base, pub in ((num(s), num(media), dec(s_m)), (num(s), num(cust), dec(s_c)), (num(n), num(media), dec(n_m)), (num(n), num(cust), dec(n_c))):
                if abs(1e4 * v / base - pub) > 0.051:
                    raise SystemExit(f"eventi critici {y}: {v} su {base} non dà il tasso pubblicato {pub}")
    if E["anni"] != list(range(E["anni"][0], E["anni"][-1] + 1)):
        raise SystemExit("eventi critici: anni mancanti")
    log(f"  eventi critici {E['anni'][0]}-{E['anni'][-1]}: i tassi ogni 10.000 persone tornano con i conteggi in ogni anno")
    return dict(E)


def check_counts(T):
    G = T["garante_serie"]
    for j, y in enumerate(G["anni"]):
        parts = G["suicidi"][j] + G["naturali"][j] + G["accertare"][j] + G["accidentali"][j] + G["omicidi"][j]
        if parts != G["totale"][j]:
            if y == 2024 and parts == 243 and G["totale"][j] == 246:
                continue  # la tabella 1 del report 2025 stampa 246, le cause sommano 243: lo dice la pagina
            raise SystemExit(f"Garante {y}: le cause sommano {parts}, il totale è {G['totale'][j]}")
    R = T["ristretti"]
    if [sum(R["suicidi"]), sum(R["altre"]), sum(R["suicidi"]) + sum(R["altre"])] != R["totale_righe"]:
        raise SystemExit("Ristretti: gli anni non tornano con la riga del totale")
    if R["anni"] != list(range(1992, R["anni"][-1] + 1)):
        raise SystemExit("Ristretti: anni mancanti")
    A = T["antigone"]
    for y, n in zip(A["anni"], A["suicidi"]):
        if n < R["suicidi"][R["anni"].index(y)] or n < G["suicidi"][G["anni"].index(y)]:
            raise SystemExit(f"Antigone {y}: il conteggio più largo non può essere il più basso")
    log("  conteggi del Garante, di Ristretti e di Antigone: righe e totali controllati (2024 del Garante: 243 nelle cause, 246 nel totale)")


def regions(months, data):
    """Fine 2025: il peso delle case circondariali in ogni regione accanto alla quota di persone senza condanna definitiva
    (data/cautelari.json). Le persone presenti per regione devono essere le stesse dell'ISTAT."""
    C = json.load(open(os.path.join(OUT, "cautelari.json"), encoding="utf-8"))
    Y = C["meta"]["years"]
    yi = Y.index(2025)
    rows, _ = data["2025-12"]
    by = defaultdict(Counter)
    for r in rows:
        b = by[REG[r["reg"]][1]]
        b["all"] += r["pres"]
        b[TIPI[r["tipo"]]] += r["pres"]
        b["str"] += r["str"]
    cr = {x["name"]: x for x in C["detenuti"]["regioni"]}
    out = []
    for name, b in sorted(by.items()):
        x = cr[name]
        if x["all"][yi] != b["all"]:
            raise SystemExit(f"{name}: {b['all']} persone a fine 2025 per il Ministero, {x['all'][yi]} per l'ISTAT")
        out.append({"name": name, "istat": x["istat"], "all": b["all"], "cc": b["cc"], "cr": b["cr"], "altro": b["altro"], "str": b["str"],
                    "disp": x["disp"][yi], "disp_serie": [round(100 * d / a, 1) for d, a in zip(x["disp"], x["all"])]})
    xs = [100 * o["cc"] / o["all"] for o in out]
    ys = [100 * o["disp"] / o["all"] for o in out]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    r = sum((a - mx) * (b - my) for a, b in zip(xs, ys)) / math.sqrt(sum((a - mx) ** 2 for a in xs) * sum((b - my) ** 2 for b in ys))
    I = C["detenuti"]["italia"]
    log(f"  regioni a fine 2025: le persone presenti tornano con l'ISTAT in tutte e 20; correlazione tra quota nelle case circondariali e quota senza condanna definitiva r = {r:.2f}")
    return {"anno": 2025, "r": round(r, 3), "righe": out, "anni": Y, "italia_serie": [round(100 * d / a, 1) for d, a in zip(I["DISPAUTH"], I["ALL"])]}


def build():
    T = json.load(open(os.path.join(HERE, "istituti_tabelle.json"), encoding="utf-8"))
    check_counts(T)
    months, data = ministry()
    inst = institutes(months, data, comuni_index())
    gdate = garante_posti(T, months, data, inst)
    garante_morti(T, months, inst)
    E = eventi_critici()
    reg = regions(months, data)

    tot = {c: [data[k][1][c] for k in months] for c in ("cap", "pres", "donne", "str")}
    for x in inst:
        del x["key"]
    F = T["fonti"]
    src = lambda k: F[k]["url"]  # noqa: E731
    G, R, A = T["garante_serie"], T["ristretti"], T["antigone"]
    PI = T["posti_italia"]
    mese = {v: k for k, v in MESI.items()}
    last_it = f"{mese[int(months[-1][5:])]} {months[-1][:4]}"
    last_en = date(int(months[-1][:4]), int(months[-1][5:]), 1).strftime("%B %Y")
    out = {
        "meta": {
            "months": months, "last": months[-1], "garante": gdate, "built": date.today().isoformat(),
            "nota": "Persone presenti e capienza regolamentare per istituto, a fine mese (Ministero della Giustizia, DAP); posti regolarmente disponibili per istituto (Garante nazionale, dati DAP); morti in carcere secondo il Ministero, il Garante, Ristretti Orizzonti e Antigone.",
            "sources": [
                {"id": "giustizia.it", "label": f"Ministero della Giustizia, Detenuti italiani e stranieri presenti e capienze per istituto, tabelle mensili da gennaio 2019 a {last_it} (fonte DAP)",
                 "en": f"Ministry of Justice, Italian and foreign prisoners present and capacity by institution, monthly tables from January 2019 to {last_en} (source: DAP)", "url": LISTING},
                {"id": EVENTI, "label": f"Ministero della Giustizia, Eventi critici negli istituti penitenziari, serie storica {E['anni'][0]}-{E['anni'][-1]} (suicidi e decessi per cause naturali)",
                 "en": f"Ministry of Justice, Critical events in prisons, {E['anni'][0]}–{E['anni'][-1]} (suicides and deaths from natural causes)", "url": PAGE.format(id=EVENTI)},
                {"id": "GNPL", "label": "Garante nazionale dei diritti delle persone private della libertà personale, report analitici (posti disponibili per istituto, 31 luglio 2026, e serie nazionale dal 2019) e report sui decessi in carcere 2024, 2025 e 2026 (dati DAP)",
                 "en": "National Guarantor for the rights of persons deprived of liberty, analytical reports (available places by institution, 31 July 2026, and national series since 2019) and reports on deaths in prison for 2024, 2025 and 2026 (DAP data)", "url": src("gnpl_lug2026")},
                {"id": "Ristretti Orizzonti", "label": f"Ristretti Orizzonti, dossier «Morire di carcere», aggiornamento al {R['aggiornamento'][8:]}/{R['aggiornamento'][5:7]}/{R['aggiornamento'][:4]}",
                 "en": f"Ristretti Orizzonti, “Morire di carcere” (Dying in prison) dossier, updated {date.fromisoformat(R['aggiornamento']).day} {date.fromisoformat(R['aggiornamento']).strftime('%B %Y')}", "url": src("ristretti")},
                {"id": "Antigone", "label": "Antigone, XXI e XXII Rapporto sulle condizioni di detenzione (conteggio dei suicidi 2024 e 2025)",
                 "en": "Antigone, 21st and 22nd reports on prison conditions (suicide counts for 2024 and 2025)", "url": src("antigone2026")},
                {"id": "73_173_DF_DCCV_DETENUTI_5", "label": "ISTAT, Detenuti presenti per posizione giuridica (quota senza condanna definitiva per regione, fine 2025: data/cautelari.json)",
                 "en": "ISTAT, Prisoners by legal status (share without a final conviction by region, end of 2025: data/cautelari.json)"},
                {"id": "4/06085", "label": "Camera dei deputati, interrogazione a risposta scritta 4/06085 del 7 ottobre 2025 (posti effettivi al 30 settembre 2025)",
                 "en": "Chamber of Deputies, written question 4/06085 of 7 October 2025 (effective places at 30 September 2025)", "url": src("interrogazione")},
            ],
            "urls": {k: v["url"] for k, v in F.items()},
        },
        "italia": tot,
        "posti": [[d, p, q] for d, p, q, _, _ in PI["righe"]],
        "interrogazione": {k: v for k, v in PI["interrogazione"].items() if not k.startswith("_")},
        "istituti": inst,
        "eventi": E,
        "garante": {k: v for k, v in G.items() if not k.startswith("_")},
        "ristretti": {"anni": R["anni"], "suicidi": R["suicidi"], "altre": R["altre"], "aggiornamento": R["aggiornamento"]},
        "antigone": {"anni": A["anni"], "suicidi": A["suicidi"]},
        "morti_totale_testo": T["morti_2025"]["totale_testo"],
        "regioni": reg,
    }
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "istituti.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    L = len(months) - 1
    log(f"scritto data/istituti.json ({os.path.getsize(path) // 1024} KB): {months[-1]}, {tot['pres'][L]:,} persone per {tot['cap'][L]:,} posti regolamentari in {sum(1 for x in inst if x['pres'][L] is not None)} istituti")


if __name__ == "__main__":
    build()
