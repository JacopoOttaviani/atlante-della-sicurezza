#!/usr/bin/env python3
"""Atlante della Sicurezza — gli uffici giudiziari competenti per ogni comune.

Scrive scripts/comuni_uffici.json: per ogni comune dell'elenco ISTAT (codice alfanumerico di oggi) il tribunale, la Corte
d'appello, l'ufficio di sorveglianza e il giudice di pace competenti. Li chiede, un comune alla volta, alla «Giustizia
Map» del Ministero della Giustizia (giustizia.it, ricerca per comune con risultato in XML), che non pubblica l'elenco in
un file solo. La competenza è quella fissata dal d.lgs. 14/2014 e non cambia quando i comuni si fondono: la mappa conosce
i comuni del 2014, con il codice ISTAT a 110 province (colonna «dal 2010 al 2016» dell'elenco ISTAT) preceduto dalla
regione. Un comune nato dopo da una fusione non c'è: prende gli uffici dei comuni da cui è nato, dall'elenco ISTAT dei
comuni soppressi (o da PREDECESSORI, a mano, se l'elenco non li ha), che devono avere tutti lo stesso tribunale,
altrimenti lo script si ferma.

Uso:  python3 scripts/build_competenze.py      (dalla cartella atlante-della-sicurezza/, dopo build_data.py)
Le risposte restano in scripts/.cache/giustizia_map/, una per comune: rilanciato, lo script chiede solo quelle che
mancano. Ci vuole circa un'ora la prima volta (circa 8.000 richieste, una alla volta, con una pausa). Va rilanciato solo
se cambia la geografia giudiziaria, cioè per legge.
"""
import csv
import html
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import CACHE, log  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
MAP_URL = "https://www.giustizia.it/giustizia/it/mg_form_submit.page"
UA = "Mozilla/5.0 (atlantedellasicurezza.it; dati pubblici)"
MAP_CACHE = os.path.join(CACHE, "giustizia_map")
SOPPRESSI = "https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-soppressi.zip"
PAUSE = 0.25

# Comuni che la Giustizia Map non conosce con il codice di oggi e che l'elenco ISTAT dei comuni soppressi non collega
# ad altri: codice ISTAT di oggi -> i comuni di cui prendono gli uffici, per nome (un comune dell'elenco di oggi, nella
# stessa regione) o come (regione + codice a 110 province, nome). Si riempie guardando i comuni che lo script elenca.
PREDECESSORI = {
    "001316": ["Caselle Torinese", "Borgaro Torinese", "Leini", "Settimo Torinese"],  # Mappano, nato nel 2017 da parti di quattro comuni
    "081025": ["Trapani"],  # Misiliscemi, nato nel 2021 da una parte di Trapani
    # passati a un'altra regione dopo il 2014: la mappa li conosce con la regione e il codice di prima
    "030189": [("05025052", "Sappada")],  # dal Veneto al Friuli-Venezia Giulia (2017): tribunale di Belluno
    "099030": [("11041033", "Montecopiolo")],  # dalle Marche all'Emilia-Romagna (2021): tribunale di Urbino
    "099031": [("11041060", "Sassofeltrio")],
}
# Comuni nati dalla fusione di comuni con tribunali diversi: per la legge il territorio resta diviso tra i due tribunali,
# ma i residenti si conoscono solo per il comune nuovo. Vanno tutti con il comune d'origine indicato qui, il più popoloso.
DIVISI = {
    "006193": "Lu",  # Lu e Cuccaro Monferrato (2019): Lu (Alessandria) era più popoloso di Cuccaro Monferrato (Vercelli)
    "001316": "Settimo Torinese",  # Mappano: Ivrea, il tribunale di tre dei quattro comuni da cui è nato (Caselle è con Torino)
}

# I quattro tribunali abruzzesi soppressi dal d.lgs. 155/2012 e ancora aperti, perché la soppressione è stata rinviata:
# la Giustizia Map dà già i loro comuni all'Aquila (Avezzano, Sulmona) e a Chieti (Lanciano, Vasto), mentre il Ministero
# ne pubblica ancora i dati a parte. I comuni di ognuno vengono dalla pagina «Competenza territoriale» del suo sito
# (tribunale-<nome>.giustizia.it/it/competenza_territoriale.page, ottobre 2026): (tribunale della mappa, provincia, comuni).
RINVIATI = {
    "AVEZZANO": ("AQUILA", "AQ", ["Aielli", "Avezzano", "Balsorano", "Bisegna", "Canistro", "Capistrello", "Cappadocia", "Carsoli", "Castellafiume", "Celano", "Cerchio", "Civita d'Antino", "Civitella Roveto", "Cocullo", "Collarmele", "Gioia dei Marsi", "Lecce nei Marsi", "Luco dei Marsi", "Magliano de' Marsi", "Massa d'Albe", "Morino", "Oricola", "Ortona dei Marsi", "Ortucchio", "Ovindoli", "Pereto", "Pescina", "Rocca di Botte", "San Benedetto dei Marsi", "San Vincenzo Valle Roveto", "Sante Marie", "Scurcola Marsicana", "Tagliacozzo", "Trasacco", "Villavallelonga"]),
    "SULMONA": ("AQUILA", "AQ", ["Acciano", "Alfedena", "Anversa degli Abruzzi", "Ateleta", "Barrea", "Bugnara", "Campo di Giove", "Cansano", "Castel di Ieri", "Castel di Sangro", "Castelvecchio Subequo", "Civitella Alfedena", "Corfinio", "Gagliano Aterno", "Goriano Sicoli", "Introdacqua", "Molina Aterno", "Opi", "Pacentro", "Pescasseroli", "Pescocostanzo", "Pettorano sul Gizio", "Pratola Peligna", "Prezza", "Raiano", "Rivisondoli", "Rocca Pia", "Roccacasale", "Roccaraso", "Scanno", "Scontrone", "Secinaro", "Sulmona", "Villalago", "Villetta Barrea", "Vittorito"]),
    "LANCIANO": ("CHIETI", "CH", ["Altino", "Archi", "Atessa", "Bomba", "Borrello", "Casalanguida", "Casoli", "Castel Frentano", "Civitaluparella", "Colledimacine", "Colledimezzo", "Fallo", "Fossacesia", "Frisa", "Gamberale", "Gessopalena", "Lanciano", "Montazzoli", "Montebello sul Sangro", "Monteferrante", "Montelapiano", "Montenerodomo", "Mozzagrogna", "Paglieta", "Palombaro", "Pennadomo", "Perano", "Pietraferrazzana", "Pizzoferrato", "Quadri", "Rocca San Giovanni", "Roccascalegna", "Roio del Sangro", "Rosello", "San Vito Chietino", "Sant'Eusanio del Sangro", "Santa Maria Imbaro", "Tornareccio", "Torricella Peligna", "Treglio", "Villa Santa Maria"]),
    "VASTO": ("CHIETI", "CH", ["Carpineto Sinello", "Carunchio", "Casalbordino", "Castelguidone", "Castiglione Messer Marino", "Celenza sul Trigno", "Cupello", "Dogliola", "Fraine", "Fresagrandinaria", "Furci", "Gissi", "Guilmi", "Lentella", "Liscia", "Monteodorisio", "Palmoli", "Pollutri", "Roccaspinalveti", "San Buono", "San Giovanni Lipioni", "San Salvo", "Scerni", "Schiavi di Abruzzo", "Torino di Sangro", "Torrebruna", "Tufillo", "Vasto", "Villalfonsina"]),
}


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def comuni():
    """L'elenco ISTAT dei comuni (la stessa cache di build_data.py e build_comuni.py)."""
    text = open(os.path.join(CACHE, "elenco_comuni.csv"), encoding="latin-1").read()
    rows = list(csv.reader(io.StringIO(text), delimiter=";"))[1:]
    out = []
    for r in rows:
        if len(r) < 17 or not r[4].strip():
            continue
        out.append({"code": r[4].strip(), "name": r[6].strip(), "reg": r[0].strip().zfill(2), "sigla": r[14].strip(),
                    "c110": r[16].strip().zfill(6)})
    if len(out) < 7800:
        raise SystemExit(f"elenco comuni troppo corto: {len(out)}")
    return out


def multipart(fields):
    b = uuid.uuid4().hex
    body = b"".join(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode("utf-8") for k, v in fields.items())
    return body + f"--{b}--\r\n".encode(), f"multipart/form-data; boundary={b}"


def ask(key, name):
    """La risposta della Giustizia Map per il comune RR+codice a 110 province: il blocco XML, o "" se non lo conosce."""
    os.makedirs(MAP_CACHE, exist_ok=True)
    path = os.path.join(MAP_CACHE, key + ".xml")
    if os.path.exists(path):
        return open(path, encoding="utf-8").read()
    body, ctype = multipart({"uid": "G_MAP", "_pagina_": "3", "comune": f"{key}#{name}", "_xml_": "xml", "Submit": "cerca"})
    last = None
    for i in range(4):
        try:
            req = urllib.request.Request(MAP_URL, data=body, headers={"Content-Type": ctype, "User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                page = html.unescape(r.read().decode("utf-8", "replace"))
            break
        except Exception as e:  # noqa: BLE001 — riprova su qualsiasi errore di rete
            last = e
            time.sleep(5 * (i + 1))
    else:
        raise RuntimeError(f"Giustizia Map non risponde per {name} ({key}): {last}")
    time.sleep(PAUSE)
    i = page.find("<?xml")
    xml = page[i:page.find("</root>", i) + 7] if i >= 0 and "</root>" in page[i:] else ""
    if not xml and "non restituisce nessun comune" not in page and "nessun" not in page.lower():
        raise RuntimeError(f"risposta inattesa della Giustizia Map per {name} ({key})")
    with open(path, "w", encoding="utf-8") as f:
        f.write(xml)
    return xml


# gli uffici che servono, dal nome dell'ufficio: «Tribunale di MONZA», «Ufficio di Sorveglianza di MILANO»…
# «di», ma anche «della SPEZIA», «dell'AQUILA», «del VASTO»: l'articolo si perde, e i nomi si confrontano senza (norm_sede)
DI = r"(?:(?:della|dello|delle|degli|dei|del|di)\s+|dell['’]\s*)"
KINDS = [
    ("trib", re.compile(r"^Tribunale " + DI + r"(?!Sorveglianza)(.+)$", re.I)),
    ("ca", re.compile(r"^Corte d'Appello " + DI + r"(.+)$", re.I)),
    ("sorv", re.compile(r"^Ufficio di Sorveglianza " + DI + r"(.+)$", re.I)),
    ("gdp", re.compile(r"^Giudice di Pace " + DI + r"(.+)$", re.I)),
]


def offices(xml):
    names = re.findall(r'nomeufficio="([^"]+)"', xml)
    out = {}
    for n in names:
        n = " ".join(n.split())
        for k, rx in KINDS:
            m = rx.match(n)
            if m and k not in out:
                out[k] = m.group(1).strip()
    return out, names


def known(xml, name):
    """Gli uffici, se la Giustizia Map conosce il comune con quel nome; altrimenti None.
    Il codice a 110 province può essere passato a un altro comune: il nome nella risposta deve essere lo stesso."""
    # i comuni nati dopo il 2014 a volte ci sono, ma senza uffici («Nessuna struttura da visualizzare»)
    if "nomeufficio" not in xml:
        return None
    head = re.search(r"<!--Uffici giudiziari competenti per il comune di (.+?)-->", xml)
    if not head or norm(head.group(1).split("/")[0]) != norm(name.split("/")[0]):
        return None
    o, names = offices(xml)
    if "trib" not in o:
        raise SystemExit(f"nessun tribunale per {name}: {names}")
    return o


def soppressi():
    """I comuni soppressi (ISTAT), per codice del comune in cui sono confluiti: [(codice, nome, anno)]."""
    from build_carceri import fetch_bytes  # noqa: E402
    import zipfile
    body = fetch_bytes(SOPPRESSI, "comuni_soppressi.zip")
    with zipfile.ZipFile(io.BytesIO(body)) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
        text = z.read(name).decode("latin-1")
    by = {}
    for r in list(csv.reader(io.StringIO(text), delimiter=";"))[1:]:
        if len(r) > 8 and r[3].strip() and r[7].strip() and r[3].strip() != r[7].strip():
            by.setdefault(r[7].strip(), []).append((r[3].strip(), r[4].strip(), int(r[0])))
    return by


def build():
    C = comuni()
    log(f"comuni ISTAT: {len(C)}; risposte già in cache: {len(os.listdir(MAP_CACHE)) if os.path.isdir(MAP_CACHE) else 0}")
    res, missing = {}, []
    for j, c in enumerate(C):
        o = known(ask(c["reg"] + c["c110"], c["name"]), c["name"])
        if (j + 1) % 250 == 0:
            log(f"  {j + 1}/{len(C)}")
        if o is None:
            missing.append(c)
        else:
            res[c["code"]] = o
    # i comuni nati dopo il 2014: gli uffici dei comuni da cui sono nati (ISTAT, comuni soppressi), risalendo le fusioni
    # successive; a mano (PREDECESSORI) solo quelli che l'elenco ISTAT non copre
    by = soppressi()

    def roots(code, reg, depth=0):
        out = []
        for pc, pn, _ in by.get(code, []):
            o = known(ask(reg + pc, pn), pn)
            if o is not None:
                out.append((pn, o))
            elif depth < 3:
                out += roots(pc, reg, depth + 1)
        return out

    left, split = [], []
    for c in missing:
        if c["code"] in PREDECESSORI:
            pre = [x if isinstance(x, tuple) else next((d["reg"] + d["c110"], d["name"]) for d in C if d["name"] == x and d["reg"] == c["reg"])
                   for x in PREDECESSORI[c["code"]]]
            got = [(name, known(ask(key, name), name)) for key, name in pre]
        else:
            got = roots(c["code"], c["reg"])
        if not got or any(o is None for _, o in got):
            left.append(c)
            continue
        tribs = {o["trib"] for _, o in got}
        if len(tribs) > 1 and c["code"] not in DIVISI:
            split.append(f"{c['code']} {c['name']}: " + ", ".join(f"{n} → {o['trib']}" for n, o in got))
            continue
        pick = next((o for n, o in got if norm(n) == norm(DIVISI[c["code"]])), None) if c["code"] in DIVISI else got[0][1]
        if pick is None:
            raise SystemExit(f"{c['name']}: DIVISI indica {DIVISI[c['code']]!r}, che non è tra i comuni da cui è nato")
        res[c["code"]] = dict(pick, da=[n for n, _ in got])
    if split:
        raise SystemExit("comuni nati da comuni con tribunali diversi: aggiungerli a DIVISI\n  " + "\n  ".join(split))
    if left:
        for c in left:
            log(f"  manca: {c['code']} {c['name']} ({c['sigla']}), codice 2010-2016 {c['c110']}, confluiti: {by.get(c['code'])}")
        raise SystemExit(f"{len(left)} comuni che la Giustizia Map non conosce: aggiungerli a PREDECESSORI")
    log(f"  {len(missing)} comuni nati da fusioni dopo il 2014, con gli uffici dei comuni da cui sono nati")
    # i tribunali abruzzesi ancora aperti: i loro comuni, che la mappa dà già al tribunale che li assorbirà
    by_name = {(norm(c["name"]), c["sigla"]): c["code"] for c in C}
    for trib, (into, sigla, names) in RINVIATI.items():
        for n in names:
            code = by_name.get((norm(n), sigla))
            if code is None:
                raise SystemExit(f"tribunale di {trib}: il comune {n} ({sigla}) non è nell'elenco ISTAT")
            if res[code]["trib"] != into:
                raise SystemExit(f"tribunale di {trib}: per la mappa {n} è del tribunale di {res[code]['trib']}, non di {into}")
            res[code] = dict(res[code], trib=trib)
    log(f"  tribunali abruzzesi ancora aperti: {', '.join(f'{t} ({len(v[2])} comuni)' for t, v in RINVIATI.items())}")
    path = os.path.join(HERE, "comuni_uffici.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"_fonte": "Ministero della Giustizia, Giustizia Map (giustizia.it), ricerca per comune; competenza del d.lgs. 14/2014",
                   "comuni": dict(sorted(res.items()))}, f, ensure_ascii=False, separators=(",", ":"))
    log(f"scritto scripts/comuni_uffici.json: {len(res)} comuni, {len({o['trib'] for o in res.values()})} tribunali")


if __name__ == "__main__":
    build()
