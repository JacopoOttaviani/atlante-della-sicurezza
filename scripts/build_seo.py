"""Pagine statiche per i motori di ricerca e gli assistenti AI.

Scrive, dai dati di data/vc.json (più carceri.json e rimpatri.json per llms.txt):

- citta/<nome>.html: una pagina per ognuno dei 108 capoluoghi, con i numeri principali in chiaro
  nell'HTML (i crawler degli assistenti AI non eseguono JavaScript, e Google ignora i #frammenti
  con cui la home apre le schede). Ogni pagina carica ../vc.js come gli approfondimenti, quindi il
  pulsante «Apri la scheda» apre la scheda interattiva sul posto; senza JavaScript porta alla home.
- citta/index.html: la classifica dei 108 capoluoghi, con un link a ogni pagina.
- sitemap.xml e llms.txt alla radice.

Testata, piè di pagina, scheda della città e numeri ?v= di vc.css e vc.js vengono copiati da
approfondimenti/index.html a ogni esecuzione: dopo aver cambiato il menu o alzato ?v=, basta
rilanciare lo script. I tassi si calcolano come in vc.js (denunce / popolazione dell'anno * 100.000).

    python3 scripts/build_seo.py
"""
import html
import json
import math
import re
import subprocess
import unicodedata
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://atlantedellasicurezza.it/"
IMG = SITE + "img/og-image.jpg"
IMG_ALT = "Atlante della Sicurezza: mappa dei 108 capoluoghi con una guglia per città, alta quanto le denunce per abitante."
REF = 2019  # anno di confronto, come REF in vc.js
TOURIST = ["Milano", "Firenze", "Bologna", "Rimini", "Venezia", "Roma", "Torino"]  # come in vc.js
MIN_N = 20  # sotto le 20 denunce una variazione percentuale non dice molto: non la si scrive

esc = html.escape


# ------------------------------------------------------------------ numeri all'italiana, come vc.js

def js_round(x):
    """Math.round di JavaScript: le metà salgono (2,5 → 3, −2,5 → −2)."""
    return math.floor(x + 0.5)


def fixed(x, places):
    """Come Intl.NumberFormat: le metà si arrotondano lontano da zero."""
    return Decimal(x).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)


def nf0(x):
    return f"{fixed(x, 0):,}".replace(",", ".")


def nf1(x):
    return f"{fixed(x, 1):,}".replace(",", "X").replace(".", ",").replace("X", ".")


def nf2(x):
    return f"{fixed(x, 2):,}".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_rate(v):
    """Come fmtRate in vc.js: niente decimali sopra 100, uno sopra 10, due sotto."""
    if v is None:
        return "n.d."
    return nf0(v) if v >= 100 else nf1(v) if v >= 10 else nf2(v)


def fmt_pct(p):
    if p is None:
        return "–"
    v = js_round(p * 100)
    if v == 0:
        return "0%"
    return ("+" if v > 0 else "−") + nf0(abs(v)) + "%"


def vowel_num(n):
    return n in (1, 11) or str(n).startswith("8")


def del_pct(p):
    n = js_round(abs(p) * 100)
    return ("dell’" if vowel_num(n) else "del ") + nf0(n) + "%"


def moved(p, up, down, same):
    return same if js_round(p * 100) == 0 else f"{up if p > 0 else down} {del_pct(p)}"


def al_posto(rank):
    # 1° si legge «primo»: «al 1° posto»; 8° e 11° invece «all’8°», «all’11°»
    return ("all’" if rank == 11 or str(rank).startswith("8") else "al ") + f"{rank}°"


def a_city(name):
    return ("ad " if re.match(r"[Aa]", name) else "a ") + name


def slug(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if not ("̀" <= ch <= "ͯ")).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def short_label(t):
    s = re.sub(r" \(.*\)$", "", t["label"])
    return s[0].lower() + s[1:]


def and_list(a):
    return ", ".join(a[:-1]) + " e " + a[-1] if len(a) > 1 else (a[0] if a else "")


# ------------------------------------------------------------------ dati

D = json.loads((ROOT / "data/vc.json").read_text(encoding="utf-8"))
Y = D["meta"]["years"]
L = len(Y) - 1
LAST = Y[L]
IB = Y.index(REF)
TYPES = D["types"]
ITALY = D["italy"]
CITIES = D["cities"]
BUILT = D["meta"]["built"]


def rate(c, t, i):
    n, p = c["n"][t][i], c["pop"][i]
    return None if n is None or not p else n / p * 1e5


def change(c, t, i0, i1=L):
    a, b = rate(c, t, i0), rate(c, t, i1)
    return None if a is None or b is None or a == 0 else b / a - 1


def rr_test(n1, p1, n0, p0):
    """Come rrTest in vc.js: rapporto tra due tassi di Poisson e z sul logaritmo, con lo stesso pavimento a 0,5."""
    if n1 is None or n0 is None or not p1 or not p0:
        return None
    a, b = max(n1, 0.5), max(n0, 0.5)
    rr = (a / p1) / (b / p0)
    return {"rr": rr, "z": math.log(rr) / math.sqrt(1 / a + 1 / b), "pct": (n1 / p1) / (n0 / p0) - 1 if n0 > 0 else None}


def city_sig(c, t, i0, i1=L):
    """Come sig in vc.js: "up" o "down", oppure "flat" quando il caso da solo può spiegare la differenza (|z| < 2).
    La scheda interattiva colora di grigio le stesse variazioni: pagina statica e scheda dicono la stessa cosa."""
    r = rr_test(c["n"][t][i1], c["pop"][i1], c["n"][t][i0], c["pop"][i0])
    if not r or r["pct"] is None:
        return None
    few = min(c["n"][t][i1], c["n"][t][i0]) < MIN_N  # come few() in vc.js: sotto i 20 casi la variazione dice poco
    return "flat" if abs(r["z"]) < 2 or few else "up" if r["pct"] > 0 else "down"


FLAT = "una differenza che può dipendere dal caso"


def first_year(c):
    return next(i for i in range(len(Y)) if rate(c, "TOT", i) is not None)


# classifica di tutti i delitti nell'ultimo anno, con i pari merito come in vc.js
RANKED = sorted((c for c in CITIES if rate(c, "TOT", L) is not None), key=lambda c: -rate(c, "TOT", L))
RANK = {}
for i, c in enumerate(RANKED):
    prev = RANKED[i - 1] if i else None
    RANK[c["id"]] = RANK[prev["id"]] if prev and rate(prev, "TOT", L) == rate(c, "TOT", L) else i + 1
N_CITIES = len(RANKED)
IT_TOT = ITALY["rate"]["TOT"]


def page_name(c):
    return slug(c["name"]) + ".html"


# ------------------------------------------------------------------ pezzi copiati dagli approfondimenti

SRC = (ROOT / "approfondimenti/index.html").read_text(encoding="utf-8")


def grab(pattern, flags=re.S):
    m = re.search(pattern, SRC, flags)
    if not m:
        raise SystemExit(f"approfondimenti/index.html: non trovo {pattern[:50]!r}")
    return m.group(0)


MASTHEAD = grab(r'<header class="masthead">.*?</header>')
if MASTHEAD.count('<a href="./" aria-current="page">') != 1:
    raise SystemExit("approfondimenti/index.html: la voce Approfondimenti del menu è cambiata")
MASTHEAD = MASTHEAD.replace('<a href="./" aria-current="page">', '<a href="../approfondimenti/">')
# le pagine delle città esistono solo in italiano: il tasto EN porta alla home inglese
MASTHEAD, n_lang = re.subn(r'(<a class="bar-lang" href=")[^"]*(")', r"\1../en/\2", MASTHEAD)
if n_lang != 1:
    raise SystemExit("approfondimenti/index.html: non trovo il tasto della lingua (bar-lang)")
FOOTER = grab(r'<footer class="colophon">.*?</footer>')
DIALOG = grab(r'<dialog class="cityd".*?</dialog>')
TIP = grab(r'<div class="tip"[^>]*></div>')
SCRIPTS = grab(r'(<script src="[^"]+"></script>\n?)+(?=</body>)').strip()
HEAD_LINKS = "\n".join(
    re.findall(r'^(?:<link rel="(?:icon|apple-touch-icon|manifest|preconnect)"[^>]*>|<meta name="theme-color"[^>]*>|'
               r'<link rel="stylesheet"[^>]*>)$', SRC, re.M)
)
if "vc.css" not in HEAD_LINKS or "vc.js" not in SCRIPTS:
    raise SystemExit("approfondimenti/index.html: non trovo vc.css o vc.js")

PERSON_REF = {"@type": "Person", "@id": SITE + "progetto/#autore", "name": "Jacopo Ottaviani", "url": "https://jacopoottaviani.com/"}
WEBSITE_REF = {"@type": "WebSite", "@id": SITE + "#website", "name": "Atlante della Sicurezza", "url": SITE}

# poche regole solo per queste pagine, così vc.css resta com'è
STYLE = """<style>
  .cp-body { display: grid; gap: 14px; max-width: var(--measure); }
  .cp-body p { margin: 0; }
  .cp-open { display: inline-flex; align-items: center; gap: 8px; margin-top: 22px; padding: 10px 16px; border-radius: 6px; background: var(--ink); color: var(--bg); font-weight: 700; text-decoration: none; }
  .cp-open:hover { text-decoration: underline; }
  .cp-facts { margin-top: 26px; }
  .cp-table .tablewrap { max-height: none; }
  .cp-table caption { text-align: left; padding: 10px 10px 6px; font-size: var(--step--1); color: var(--muted); caption-side: bottom; white-space: normal; }
  .cp-links { columns: 14rem; column-gap: 24px; padding: 0; margin: 0; list-style: none; }
  .cp-links li { padding: 3px 0; break-inside: avoid; }
</style>"""


def head(title, description, url, ld):
    ld_json = json.dumps({"@context": "https://schema.org", "@graph": ld}, ensure_ascii=False, indent=2)
    return f"""<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="author" content="Jacopo Ottaviani">
{HEAD_LINKS}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Atlante della Sicurezza">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{IMG}?v=2">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="it_IT">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(description)}">
<meta name="twitter:image" content="{IMG}?v=2">
<meta property="og:image:alt" content="{esc(IMG_ALT)}">
<meta name="twitter:image:alt" content="{esc(IMG_ALT)}">
{STYLE}
<!-- Pagina generata da scripts/build_seo.py: modificare lo script, non questo file. -->
<script type="application/ld+json">
{ld_json}
</script>
</head>
<body>
<a class="skip" href="#app">Vai al contenuto</a>
{MASTHEAD}
"""


def tail():
    return f"""{FOOTER}

{DIALOG}

{TIP}
{SCRIPTS}
</body>
</html>
"""


def crumbs(*items):
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)],
    }


SOURCES = (
    "Fonte: ISTAT, delitti denunciati dalle forze di polizia all’autorità giudiziaria (dati del Ministero dell’Interno) "
    "e popolazione residente; elaborazione dell’Atlante della Sicurezza. "
    '<a href="../progetto/#metodo">Come leggere questi numeri</a>.'
)


# ------------------------------------------------------------------ una pagina per città

def city_page(c):
    name, cid = c["name"], c["id"]
    url = SITE + "citta/" + page_name(c)
    n_last, r_last, rank = c["n"]["TOT"][L], rate(c, "TOT", L), RANK[cid]
    i0 = first_year(c)
    ch_ref, ch_first = change(c, "TOT", IB), change(c, "TOT", i0)
    it_ref, it_first = IT_TOT[L] / IT_TOT[IB] - 1, IT_TOT[L] / IT_TOT[i0] - 1
    where = a_city(name)

    # cosa sale e cosa scende dal 2019, solo dove le denunce bastano per una percentuale
    moves = []
    for t in TYPES:
        if t["id"] == "TOT":
            continue
        a, b = c["n"][t["id"]][IB], c["n"][t["id"]][L]
        p = change(c, t["id"], IB)
        if p is not None and a is not None and b is not None and min(a, b) >= MIN_N and city_sig(c, t["id"], IB) in ("up", "down"):
            moves.append((t, p))
    ups = sorted((m for m in moves if m[1] > 0.03), key=lambda m: -m[1])[:3]
    downs = sorted((m for m in moves if m[1] < -0.03), key=lambda m: m[1])[:3]
    lst = lambda ms: and_list([f"{short_label(t)} ({fmt_pct(p)})" for t, p in ms])

    perc = (c.get("perc") or {}).get(str(LAST))
    it_perc = ITALY.get("perc", {}).get(str(LAST))

    lead = (
        f"Nel {LAST} {where} le forze di polizia hanno denunciato all’autorità giudiziaria {nf0(n_last)} delitti: "
        f"{nf0(r_last)} ogni 100.000 abitanti, contro {nf0(IT_TOT[L])} in Italia. "
        f"Tra i {N_CITIES} comuni capoluogo, {name} è {al_posto(rank)} posto per delitti denunciati in rapporto agli abitanti."
    )
    paras = [
        f"Rispetto al {REF}, l’ultimo anno prima del Covid, il tasso è {moved(ch_ref, 'salito', 'sceso', 'rimasto uguale')} "
        f"(in Italia {fmt_pct(it_ref)}); rispetto al {Y[i0]} è {moved(ch_first, 'salito', 'sceso', 'rimasto uguale')} "
        f"(in Italia {fmt_pct(it_first)})."
        + (f" Quella dal {REF} è {FLAT}." if city_sig(c, "TOT", IB) == "flat" else "")
    ]
    # le note di vc.json (meta.note), come nella scheda: dati ISTAT lasciati vuoti, confini cambiati
    note = (D["meta"].get("note") or {}).get(cid)
    if note:
        paras.insert(0, esc(note["it"]))
    if ups or downs:
        s = f"Dal {REF} al {LAST} "
        if ups:
            s += f"sono cresciute soprattutto le denunce per {esc(lst(ups))}"
        if downs:
            s += ("; sono calate quelle per " if ups else "sono calate soprattutto le denunce per ") + esc(lst(downs))
        paras.append(s + ". Le variazioni sono calcolate sui delitti per abitante.")
    if perc is not None:
        paras.append(
            f"Nel {LAST} il {nf1(perc)}% delle famiglie di {name} sente a rischio di criminalità la zona in cui vive"
            + (f" (in Italia il {nf1(it_perc)}%)" if it_perc is not None else "")
            + ", secondo l’indagine ISTAT Aspetti della vita quotidiana."
        )
    paras.append(
        "Sono denunce, non tutti i reati commessi: molti reati non vengono mai denunciati, e quanto si denuncia cambia "
        "da reato a reato e da luogo a luogo. Il tasso è calcolato sui residenti"
        + (
            f": {where} ogni giorno arrivano pendolari, studenti e turisti, e i reati che subiscono, o commettono, si contano qui, mentre loro tra i residenti non ci sono."
            if name in TOURIST else
            ": dove arrivano ogni giorno pendolari, studenti e turisti, i reati che subiscono o commettono si contano lì, ma loro tra i residenti non ci sono, e il tasso sale."
        )
    )

    facts = [
        (nf0(r_last), f"delitti denunciati ogni 100.000 abitanti nel {LAST} · Italia {nf0(IT_TOT[L])}"),
        (f"{rank}° su {N_CITIES}", f"tra i comuni capoluogo, per delitti denunciati in rapporto agli abitanti nel {LAST}"),
        (fmt_pct(ch_ref), f"variazione del tasso dal {REF} al {LAST}"
         + (" · può dipendere dal caso" if city_sig(c, "TOT", IB) == "flat" else "")
         + f" · Italia {fmt_pct(it_ref)}"),
    ]
    if perc is not None:
        facts.append((f"{nf1(perc)}%", f"famiglie che sentono a rischio di criminalità la propria zona nel {LAST}"))

    # reato per reato
    rows = []
    for t in TYPES:
        tid = t["id"]
        n, r = c["n"][tid][L], rate(c, tid, L)
        a = c["n"][tid][IB]
        p = change(c, tid, IB) if a is not None and n is not None and min(a, n) >= MIN_N else None
        ns = p is not None and city_sig(c, tid, IB) == "flat"
        label = f"<strong>{esc(t['label'])}</strong>" if tid == "TOT" else esc(t["label"])
        rows.append(
            f"<tr><td>{label}</td><td class=\"num\">{nf0(n) if n is not None else 'n.d.'}</td>"
            f"<td class=\"num\">{fmt_rate(r)}</td>"
            f"<td class=\"num\">{fmt_rate(ITALY['rate'][tid][L])}</td>"
            + (f"<td class=\"num ns\" title=\"{FLAT}\">{fmt_pct(p)}</td></tr>" if ns else f"<td class=\"num\">{fmt_pct(p)}</td></tr>")
        )
    # anno per anno
    years = []
    for i, y in enumerate(Y):
        if i < i0:
            continue
        n, r = c["n"]["TOT"][i], rate(c, "TOT", i)
        years.append(
            f"<tr><td>{y}</td><td class=\"num\">{nf0(n) if n is not None else 'n.d.'}</td>"
            f"<td class=\"num\">{nf0(r) if r is not None else 'n.d.'}</td><td class=\"num\">{nf0(IT_TOT[i])}</td></tr>"
        )

    same_region = sorted((x for x in CITIES if x["region"] == c["region"] and x["id"] != cid), key=lambda x: x["name"])

    title = f"Reati denunciati {where}, {Y[i0]}–{LAST} · Atlante della Sicurezza"
    description = (
        f"{name}, {LAST}: {nf0(r_last)} delitti denunciati ogni 100.000 residenti (Italia {nf0(IT_TOT[L])}), "
        f"{rank}° su {N_CITIES} capoluoghi per tasso. Misura le denunce, non il rischio: pesano pendolari e turisti. Dati ISTAT dal {Y[i0]}."
    )
    ld = [
        {
            "@type": "WebPage",
            "@id": url + "#pagina",
            "url": url,
            "name": title,
            "description": description,
            "inLanguage": "it",
            "isPartOf": WEBSITE_REF,
            "author": PERSON_REF,
            "dateModified": BUILT,
            "isBasedOn": {"@id": SITE + "#dati"},
            "about": {
                "@type": "City",
                "name": name,
                "containedInPlace": {"@type": "AdministrativeArea", "name": c["region"]},
                "geo": {"@type": "GeoCoordinates", "latitude": c["lat"], "longitude": c["lon"]},
            },
        },
        crumbs(("Atlante della Sicurezza", SITE), ("Le città", SITE + "citta/"), (name, url)),
    ]

    region_links = ""
    if same_region:
        region_links = f"""
  <section class="block" aria-labelledby="cp-region">
    <div class="wrap">
      <header>
        <div class="kicker">{esc(c['region'])}</div>
        <h2 id="cp-region">Gli altri capoluoghi della regione</h2>
      </header>
      <ul class="cp-links">
        {''.join(f'<li><a href="{page_name(x)}">{esc(x["name"])}</a> · {nf0(rate(x, "TOT", L))} ogni 100.000 ab.</li>' for x in same_region)}
      </ul>
      <p class="small"><a href="./">Tutti i {N_CITIES} capoluoghi, in classifica</a></p>
    </div>
  </section>"""
    else:
        region_links = f"""
  <section class="block" aria-label="Le altre città">
    <div class="wrap"><p class="small"><a href="./">Tutti i {N_CITIES} capoluoghi, in classifica</a></p></div>
  </section>"""

    body = f"""
<main id="app">
  <section class="dd-head" aria-labelledby="cp-title">
    <div class="wrap">
      <p class="dd-crumb"><a href="../">Atlante della Sicurezza</a> · <a href="./">Le città</a> · {esc(c['region'])}</p>
      <h1 id="cp-title">Reati denunciati {esc(where)}, dal {Y[i0]} al {LAST}</h1>
      <p class="dek">{esc(lead)}</p>
      <a class="cp-open" href="../#{slug(name)}" data-city="{cid}">Apri la scheda interattiva di {esc(name)} <span aria-hidden="true">→</span></a>
      <div class="facts cp-facts">
        {''.join(f'<div class="fact"><div class="fv">{esc(v)}</div><div class="fl">{esc(l)}</div></div>' for v, l in facts)}
      </div>
    </div>
  </section>

  <section class="block" aria-labelledby="cp-trend">
    <div class="wrap">
      <header>
        <div class="kicker">In breve</div>
        <h2 id="cp-trend">Com’è andata {esc(where)}</h2>
      </header>
      <div class="cp-body note">
        {''.join(f'<p>{p}</p>' for p in paras)}
      </div>
    </div>
  </section>

  <section class="block cp-table" aria-labelledby="cp-types">
    <div class="wrap">
      <header>
        <div class="kicker">Reato per reato</div>
        <h2 id="cp-types">I delitti denunciati {esc(where)} nel {LAST}</h2>
      </header>
      <div class="tablewrap">
        <table>
          <caption>Tassi ogni 100.000 abitanti. La variazione è quella del tasso dal {REF} al {LAST}, indicata solo con almeno {MIN_N} denunce in entrambi gli anni; in grigio quando può dipendere dal caso. n.d.: dato non disponibile. {SOURCES}</caption>
          <thead><tr><th scope="col">Reato</th><th scope="col" class="num">Denunce {LAST}</th><th scope="col" class="num">Ogni 100.000 ab.</th><th scope="col" class="num">Italia</th><th scope="col" class="num">Dal {REF}</th></tr></thead>
          <tbody>
            {''.join(rows)}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="block cp-table" aria-labelledby="cp-years">
    <div class="wrap">
      <header>
        <div class="kicker">Anno per anno</div>
        <h2 id="cp-years">Tutti i delitti {esc(where)}, dal {Y[i0]} al {LAST}</h2>
      </header>
      <div class="tablewrap">
        <table>
          <caption>Delitti denunciati e tasso ogni 100.000 abitanti, accanto al tasso nazionale. {SOURCES}</caption>
          <thead><tr><th scope="col">Anno</th><th scope="col" class="num">Denunce</th><th scope="col" class="num">Ogni 100.000 ab.</th><th scope="col" class="num">Italia</th></tr></thead>
          <tbody>
            {''.join(years)}
          </tbody>
        </table>
      </div>
    </div>
  </section>
{region_links}
</main>

"""
    return head(title, description, url, ld) + body + tail()


# ------------------------------------------------------------------ la classifica

def hub_page():
    url = SITE + "citta/"
    top = RANKED[:3]
    title = f"Classifica dei reati denunciati nei {N_CITIES} capoluoghi italiani, {LAST} · Atlante della Sicurezza"
    description = (
        f"Delitti denunciati ogni 100.000 residenti nei {N_CITIES} capoluoghi, {LAST}: "
        + ", ".join(f"{c['name']} {nf0(rate(c, 'TOT', L))}" for c in top)
        + f" (Italia {nf0(IT_TOT[L])}). Misura le denunce, non il rischio: pesano pendolari e turisti."
    )
    rows = "".join(
        f"<tr><td class=\"num\">{RANK[c['id']]}</td><td><a href=\"{page_name(c)}\">{esc(c['name'])}</a></td><td>{esc(c['region'])}</td>"
        f"<td class=\"num\">{nf0(c['n']['TOT'][L])}</td><td class=\"num\">{nf0(rate(c, 'TOT', L))}</td>"
        + (f"<td class=\"num ns\" title=\"{FLAT}\">" if city_sig(c, "TOT", IB) == "flat" else "<td class=\"num\">")
        + f"{fmt_pct(change(c, 'TOT', IB))}</td></tr>"
        for c in RANKED
    )
    ld = [
        {
            "@type": "CollectionPage",
            "@id": url + "#pagina",
            "url": url,
            "name": title,
            "description": description,
            "inLanguage": "it",
            "isPartOf": WEBSITE_REF,
            "author": PERSON_REF,
            "dateModified": BUILT,
            "mainEntity": {
                "@type": "ItemList",
                "name": f"Comuni capoluogo per delitti denunciati ogni 100.000 abitanti, {LAST}",
                "numberOfItems": N_CITIES,
                "itemListOrder": "https://schema.org/ItemListOrderDescending",
                "itemListElement": [
                    {"@type": "ListItem", "position": i + 1, "name": c["name"], "url": SITE + "citta/" + page_name(c)}
                    for i, c in enumerate(RANKED)
                ],
            },
        },
        crumbs(("Atlante della Sicurezza", SITE), ("Le città", url)),
    ]
    body = f"""
<main id="app">
  <section class="dd-head" aria-labelledby="cp-title">
    <div class="wrap">
      <p class="dd-crumb"><a href="../">Atlante della Sicurezza</a> · Le città</p>
      <h1 id="cp-title">I reati denunciati nei {N_CITIES} capoluoghi, città per città</h1>
      <p class="dek">Nel {LAST} in Italia sono stati denunciati {nf0(ITALY['n']['TOT'][L])} delitti, {nf0(IT_TOT[L])} ogni 100.000 abitanti. Qui sotto i {N_CITIES} comuni capoluogo in ordine di delitti denunciati per abitante: ogni nome apre la pagina della città, reato per reato e anno per anno dal {Y[0]}.</p>
    </div>
  </section>

  <section class="block cp-table" aria-labelledby="cp-rank">
    <div class="wrap">
      <header>
        <div class="kicker">Classifica {LAST}</div>
        <h2 id="cp-rank">Dove si denuncia di più, e dove di meno</h2>
        <p class="dek">Il tasso dice quanto si denuncia in una città, non quanto rischia chi ci abita: nelle città con molti pendolari e turisti i reati si contano lì, ma chi li subisce non è tra i residenti.</p>
      </header>
      <div class="tablewrap">
        <table>
          <caption>Delitti denunciati nel {LAST} e tasso ogni 100.000 abitanti; la variazione è quella del tasso dal {REF}, in grigio quando può dipendere dal caso. {SOURCES}</caption>
          <thead><tr><th scope="col" class="num">Pos.</th><th scope="col">Città</th><th scope="col">Regione</th><th scope="col" class="num">Denunce {LAST}</th><th scope="col" class="num">Ogni 100.000 ab.</th><th scope="col" class="num">Dal {REF}</th></tr></thead>
          <tbody>
            {rows}
          </tbody>
        </table>
      </div>
    </div>
  </section>
</main>

"""
    return head(title, description, url, ld) + body + tail()


# ------------------------------------------------------------------ gli approfondimenti

def deep_pages():
    """Gli approfondimenti linkati da approfondimenti/index.html, nel suo ordine, con titolo e descrizione
    presi dalla pagina: uno nuovo entra in sitemap e llms.txt quando compare nell'indice."""
    out = []
    for name in dict.fromkeys(re.findall(r'href="([a-z0-9-]+\.html)"', SRC)):
        f = ROOT / "approfondimenti" / name
        if not f.exists():
            continue
        s = f.read_text(encoding="utf-8")
        title = re.search(r"<title>(.*?)</title>", s).group(1).replace(" · Atlante della Sicurezza", "")
        desc = re.search(r'<meta name="description" content="([^"]*)"', s).group(1)
        out.append(("approfondimenti/" + name, html.unescape(title), html.unescape(desc)))
    return out


# ------------------------------------------------------------------ sitemap.xml

def lastmod(rel):
    """Data dell'ultimo commit che ha cambiato il contenuto del file; oggi se il file è nuovo o modificato e non ancora
    salvato. I commit che toccano solo i ?v= di vc.css e vc.js (cambiano tutte le pagine insieme) non contano."""
    git = lambda *a: subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True).stdout  # noqa: E731
    try:
        if git("status", "--porcelain", "--", rel).strip():
            return date.today().isoformat()
        log = [ln.split() for ln in git("log", "-20", "--format=%H %cs", "--", rel).splitlines() if ln.strip()]
    except OSError:
        return date.today().isoformat()
    for h, day in log:
        diff = [ln for ln in git("show", "-U0", "--format=", h, "--", rel).splitlines()
                if ln[:1] in "+-" and not ln.startswith(("+++", "---"))]
        if any(re.sub(r"\?v=\d+", "", ln[1:]) not in {re.sub(r"\?v=\d+", "", o[1:]) for o in diff if o[0] != ln[0]} for ln in diff):
            return day
    return log[-1][1] if log else date.today().isoformat()


def en_pages():
    """Le pagine in inglese (en/), con la gemella italiana: (indirizzo inglese, file, indirizzo italiano)."""
    out = []
    for loc, f in [("", "index.html"), ("approfondimenti/", "approfondimenti/index.html")] + [(f, f) for f, _, _ in deep_pages()] + [
        ("progetto/", "progetto/index.html"),
    ]:
        if (ROOT / "en" / f).exists():
            out.append(("en/" + loc, "en/" + f, loc))
    return out


def sitemap():
    pages = [
        ("", "index.html", "1.0"),
        ("citta/", "citta/index.html", "0.9"),
        ("approfondimenti/", "approfondimenti/index.html", "0.7"),
    ] + [(f, f, "0.7") for f, _, _ in deep_pages()] + [
        ("progetto/", "progetto/index.html", "0.5"),
    ] + [("citta/" + page_name(c), "citta/" + page_name(c), "0.6") for c in sorted(CITIES, key=lambda c: c["name"])]
    # le pagine che esistono in due lingue portano entrambe le versioni (hreflang), come nelle loro <head>
    twin = {}
    for en_loc, en_f, it_loc in en_pages():
        twin[it_loc] = twin[en_loc] = (it_loc, en_loc)
    prio = {loc: p for loc, _, p in pages}
    pages += [(en_loc, en_f, prio.get(it_loc, "0.5")) for en_loc, en_f, it_loc in en_pages()]

    def alt(loc):
        if loc not in twin:
            return ""
        it, en = twin[loc]
        return (f'    <xhtml:link rel="alternate" hreflang="it" href="{SITE}{it}"/>\n'
                f'    <xhtml:link rel="alternate" hreflang="en" href="{SITE}{en}"/>\n'
                f'    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}{it}"/>\n')

    urls = "".join(
        f"  <url>\n    <loc>{SITE}{loc}</loc>\n{alt(loc)}    <lastmod>{lastmod(f)}</lastmod>\n    <priority>{p}</priority>\n  </url>\n"
        for loc, f, p in pages
    )
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            f'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n{urls}</urlset>\n')


# ------------------------------------------------------------------ llms.txt

def nat_change(tid, i0, i1=L):
    """Variazione nazionale dai conteggi e dalla popolazione, come natCh in vc.js: i tassi di vc.json sono
    arrotondati a un decimale e per i reati rari (omicidi, usura) il rapporto tra tassi arrotondati la falsa."""
    n, nt, rt = ITALY["n"].get(tid), ITALY["n"]["TOT"], ITALY["rate"]["TOT"]
    if n and n[i0] and n[i1] is not None and nt[i0] and nt[i1] and rt[i0] and rt[i1]:
        return (n[i1] / n[i0]) / ((nt[i1] / rt[i1]) / (nt[i0] / rt[i0])) - 1
    a, b = ITALY["rate"][tid][i0], ITALY["rate"][tid][i1]
    return b / a - 1 if a and b is not None else None


def it_pop(i):
    n, rt = ITALY["n"]["TOT"][i], ITALY["rate"]["TOT"][i]
    return n / rt * 1e5 if n and rt else None


def nat_sig(tid, i0, i1=L):
    """Come natSig in vc.js: aumento o calo solo oltre il 3% e con |z| ≥ 2 sui conteggi nazionali."""
    ch, n = nat_change(tid, i0, i1), ITALY["n"].get(tid)
    r = rr_test(n[i1], it_pop(i1), n[i0], it_pop(i0)) if n else None
    if ch is None:
        return None
    if abs(ch) <= 0.03 or (r and abs(r["z"]) < 2):
        return "flat"
    return "up" if ch > 0 else "down"


def llms():
    ups_downs = []
    for t in TYPES:
        if t["id"] == "TOT":
            continue
        ch = nat_change(t["id"], IB)
        if ch is not None:
            ups_downs.append((t, ch, nat_sig(t["id"], IB)))
    ups = [(t, p) for t, p, s in sorted((d for d in ups_downs if d[2] == "up"), key=lambda d: -d[1])[:3]]
    downs = [(t, p) for t, p, s in sorted((d for d in ups_downs if d[2] == "down"), key=lambda d: d[1])[:3]]
    lst = lambda ms: and_list([f"{short_label(t)} ({fmt_pct(p)})" for t, p in ms])
    top, bottom = RANKED[:3], RANKED[-3:][::-1]
    facts = [
        f"- Nel {LAST} in Italia sono stati denunciati {nf0(ITALY['n']['TOT'][L])} delitti, {nf0(IT_TOT[L])} ogni 100.000 abitanti: "
        f"{fmt_pct(IT_TOT[L] / IT_TOT[0] - 1)} rispetto al {Y[0]} ({nf0(IT_TOT[0])}), {fmt_pct(IT_TOT[L] / IT_TOT[IB] - 1)} rispetto al {REF} ({nf0(IT_TOT[IB])}).",
        f"- I capoluoghi con più delitti denunciati per abitante nel {LAST}: "
        + ", ".join(f"{c['name']} ({nf0(rate(c, 'TOT', L))} ogni 100.000)" for c in top)
        + ". Con meno: " + ", ".join(f"{c['name']} ({nf0(rate(c, 'TOT', L))})" for c in bottom) + ".",
        f"- Dal {REF} al {LAST}, in Italia, sono cresciute soprattutto le denunce per {lst(ups)}; sono calate quelle per {lst(downs)}.",
    ]
    # un fatto per approfondimento, con la sua cautela (gli stessi delle sintesi <noscript> delle pagine)
    facts += [f"- {it}" for it, _ in deep_facts().values()]

    deep = "\n".join(f"- [{t}]({SITE}{f}): {d}" for f, t, d in deep_pages())
    # l'edizione inglese: titolo e descrizione presi da ogni pagina in en/
    en = []
    for loc, f, _ in en_pages():
        s = (ROOT / f).read_text(encoding="utf-8")
        title = re.search(r"<title>(.*?)</title>", s).group(1).replace(" · Atlante della Sicurezza", "")
        desc = re.search(r'<meta name="description" content="([^"]*)"', s).group(1)
        en.append(f"- [{html.unescape(title)}]({SITE}{loc}): {html.unescape(desc)}")
    en = "\n".join(en) or "- (none yet)"
    cities = "\n".join(
        f"- [{c['name']}]({SITE}citta/{page_name(c)}): {nf0(rate(c, 'TOT', L))} delitti denunciati ogni 100.000 abitanti nel {LAST}, {RANK[c['id']]}° su {N_CITIES}"
        for c in sorted(CITIES, key=lambda c: c["name"])
    )

    return f"""# Atlante della Sicurezza

> Strumento civico gratuito sui reati denunciati in Italia, con dati pubblici: ISTAT {Y[0]}–{LAST} per i {N_CITIES} comuni capoluogo e la scheda di ogni comune italiano (per i non capoluoghi, i dati della provincia), Eurostat per i rimpatri, Ministero della Giustizia e Garante nazionale per la custodia cautelare e le carceri istituto per istituto. Mostra dove si denuncia di più e di meno, quali reati salgono e quali scendono, le impennate improvvise e quanto le persone si sentono a rischio. Di Jacopo Ottaviani, data journalist.

Numeri principali (calcolati dai dati del sito, aggiornati al {BUILT}):

{chr(10).join(facts)}

Come leggere questi numeri: sono delitti denunciati dalle forze di polizia all’autorità giudiziaria, non tutti i reati commessi; molti reati non vengono denunciati e la propensione a denunciare cambia da reato a reato. I tassi sono ogni 100.000 residenti, quindi pesano di più dove arrivano ogni giorno pendolari, studenti e turisti. Il tasso dice quanto si denuncia in una città, non quanto rischia chi ci abita. Le variazioni contano come aumenti o cali solo se il caso da solo non le spiega e poggiano su almeno 20 casi in tutti e due gli anni; le altre sono «non significative».

## Domande frequenti

- Le città in cima alla classifica sono le più pericolose? Non per forza: vi arrivano ogni giorno pendolari, studenti e turisti, e i reati che subiscono o commettono si contano lì, mentre loro tra i residenti non ci sono. Il tasso dice quanto si denuncia, non quanto rischia chi ci abita.
- Gli stranieri commettono più reati degli italiani? Questi dati non bastano per dirlo: tra i detenuti c’è anche chi in Italia non risiede, gli stranieri sono in media più giovani e restano più spesso in carcere in attesa di giudizio.
- Più denunce vuol dire più reati? Non sempre: per alcuni reati, come le violenze sessuali, più denunce possono voler dire anche più fiducia nel denunciare.
- Ci sentiamo in pericolo quanto lo siamo? Nel tempo la paura si muove molto più dei reati denunciati; da un luogo all’altro le due cose vanno più d’accordo, con eccezioni vistose.

## Pagine

- [Home]({SITE}): mappa e classifica dei {N_CITIES} capoluoghi, reati che salgono e scendono, impennate, piccoli grafici città per città, ricerca di ogni comune italiano.
- [Le città]({SITE}citta/): classifica dei {N_CITIES} capoluoghi per delitti denunciati ogni 100.000 abitanti nel {LAST}, con una pagina per città.
- [Approfondimenti]({SITE}approfondimenti/): i temi che le denunce da sole non chiariscono.
{deep}
- [Il progetto]({SITE}progetto/): perché esiste l’atlante, l’autore, le domande frequenti, metodologia e fonti.

## In English

{en}

## Le città

Delitti denunciati ogni 100.000 residenti e posizione tra i capoluoghi: misurano le denunce, non il rischio, e pesano di più dove arrivano pendolari e turisti.

{cities}

## Dati aperti

- [data/vc.json]({SITE}data/vc.json): delitti denunciati per capoluogo, tipo di reato e anno; popolazione; tassi nazionali; percezione del rischio.
- [data/province.json]({SITE}data/province.json): tassi di delittuosità per provincia, tipo di reato e anno.
- [data/carceri.json]({SITE}data/carceri.json): detenuti adulti presenti a fine anno, per cittadinanza, regione, reato, età e posizione giuridica.
- [data/rimpatri.json]({SITE}data/rimpatri.json): ordini di lasciare il territorio e rimpatri eseguiti, per cittadinanza.
- [data/autori.json]({SITE}data/autori.json): delitti commessi nell’anno e denunciati, e quanti con autore noto, per tipo (Italia e dodici grandi comuni) e per provincia.
- [data/minori.json]({SITE}data/minori.json): segnalazioni di minorenni e di tutte le persone denunciate e arrestate, per tipo di delitto, in Italia e nelle regioni.
- [data/cautelari.json]({SITE}data/cautelari.json): persone detenute a fine anno per posizione giuridica (Italia e regioni, per cittadinanza e sesso), misure cautelari disposte ed esiti, domande e ordinanze di riparazione per ingiusta detenzione per distretto di Corte d’appello, procedimenti disciplinari.
- [data/istituti.json]({SITE}data/istituti.json): persone presenti e capienza regolamentare per istituto penitenziario a fine mese dal 2019, posti regolarmente disponibili per istituto, morti in carcere per causa (dal 1992) e per istituto (2025), con i conteggi dei suicidi di Ministero, Garante nazionale, Ristretti Orizzonti e Antigone.
- [Codice e script dei dati su GitHub](https://github.com/JacopoOttaviani/atlante-della-sicurezza): chiunque può rifare i conti.

## Fonti

- ISTAT, Delitti denunciati dalle forze di polizia all’autorità giudiziaria (73_67_DF_DCCV_DELITTIPS_1 e _9), su dati del Ministero dell’Interno (banca dati SDI/SSD)
- ISTAT, popolazione residente (164_164_DF_DCIS_RICPOPRES2011_24, 22_289)
- ISTAT, Aspetti della vita quotidiana: famiglie per percezione del rischio di criminalità (DF_DCSS_BEST_PPC_1_GC); EU-SILC (33_291)
- ISTAT, detenuti adulti presenti nelle carceri (73_173_DF_DCCV_DETENUTI_1…6), su dati del Ministero della Giustizia
- ISTAT, delitti di cui si è scoperto l’autore (73_67_DF_DCCV_DELITTIPS_2, _5, _6, _7), su dati del Ministero dell’Interno
- ISTAT, segnalazioni di persone e di minorenni denunciati e arrestati (73_342_DF_DCCV_SEGNALAZPS_1 e _2), su dati del Ministero dell’Interno
- Eurostat, migr_eiord e migr_eirtn, su dati del Ministero dell’Interno
- Ministero della Giustizia, Relazione al Parlamento sulle misure cautelari personali e sulla riparazione per ingiusta detenzione (legge 47/2015, art. 15), dati 2024; importi delle riparazioni di fonte Ministero dell’Economia
- ISTAT, Demografia in cifre: popolazione residente per provincia (demo.istat.it)
- Ministero della Giustizia, Detenuti italiani e stranieri presenti e capienze per istituto (tabelle mensili dal 2019) ed Eventi critici negli istituti penitenziari (1992-2025), su dati del DAP
- Garante nazionale dei diritti delle persone private della libertà personale, report analitici sui posti disponibili e report sui decessi in carcere, su dati del DAP; Ristretti Orizzonti, dossier «Morire di carcere»; Antigone, rapporti sulle condizioni di detenzione

## Autore

- [Jacopo Ottaviani](https://jacopoottaviani.com/): data journalist e informatico, ICFJ Knight Fellow. [LinkedIn](https://www.linkedin.com/in/jacopo-ottaviani/)
"""


# ------------------------------------------------------------------ scrittura

# ------------------------------------------------------------------ sintesi per chi legge senza JavaScript

def en0(x):
    return f"{fixed(x, 0):,}"


def en1(x):
    return f"{fixed(x, 1):,}"


def load_json(name):
    try:
        return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def deep_facts():
    """Per ogni approfondimento una o due frasi, in italiano e in inglese, con i numeri principali e la cautela che li
    accompagna. Le usano llms.txt e i <noscript> delle pagine: motori di ricerca e assistenti che non eseguono vc.js
    trovano i numeri insieme al loro contesto, invece di contenitori vuoti."""
    out = {}
    C = load_json("carceri.json")
    if C:
        Lc, last = len(C["meta"]["years"]) - 1, C["meta"]["last"]
        q = 100 * C["serie"]["str"][Lc] / C["serie"]["tot"][Lc]
        ra = (C.get("residenti") or {}).get("anni") or {}
        rk = next((y for y in (last, last - 1) if str(y) in ra), None)
        res_it = f"; al 1° gennaio {rk} erano il {nf1(ra[str(rk)]['quota'])}% dei residenti" if rk else ""
        res_en = f"; on 1 January {rk} they were {en1(ra[str(rk)]['quota'])}% of residents" if rk else ""
        out["carceri"] = (
            f"A fine {last} gli stranieri erano il {nf1(q)}% delle persone detenute{res_it}. Il confronto non misura la propensione a delinquere: tra i detenuti c’è anche chi in Italia non risiede, gli stranieri sono in media più giovani e restano più spesso in carcere in attesa di giudizio.",
            f"At the end of {last} foreign nationals were {en1(q)}% of people in prison{res_en}. The comparison does not measure a propensity to commit crime: prisoners include people who do not live in Italy, foreign nationals are younger on average and are more often held awaiting trial.",
        )
    R = load_json("rimpatri.json")
    if R:
        Lr = len(R["meta"]["years"]) - 1
        o, r = R["totale"]["ordini"][Lr], R["totale"]["rimpatri"][Lr]
        out["rimpatri"] = (
            f"Nel {R['meta']['last']} l’Italia ha ordinato a {nf0(o)} cittadini di paesi non UE di lasciare il territorio e ne ha rimpatriati {nf0(r)}: circa {js_round(100 * r / o)} ogni 100. Ordini e rimpatri dello stesso anno non riguardano sempre le stesse persone.",
            f"In {R['meta']['last']} Italy ordered {en0(o)} citizens of non-EU countries to leave and returned {en0(r)}: about {js_round(100 * r / o)} in every 100. Orders and returns in the same year do not always concern the same people.",
        )
    perc, silc = ITALY.get("perc", {}), {int(k): v for k, v in ITALY.get("silc", {}).items()}
    if perc and silc:
        py = sorted(perc)[-1]
        sy = [y for y in sorted(silc) if y in Y]
        a, b = max(sy, key=lambda y: silc[y]), min(sy, key=lambda y: silc[y])
        cr = IT_TOT[Y.index(b)] / IT_TOT[Y.index(a)] - 1
        out["percezione"] = (
            f"Nel {py} il {nf1(perc[py])}% delle famiglie sente molto o abbastanza a rischio di criminalità la propria zona. Tra il {a} e il {b} le famiglie che segnalano criminalità o vandalismo nella zona sono passate dal {nf1(silc[a])}% al {nf1(silc[b])}%, mentre i delitti denunciati per abitante cambiavano di {fmt_pct(cr)}: nel tempo la paura si muove molto più dei reati.",
            f"In {py}, {en1(perc[py])}% of households felt their area was very or fairly at risk of crime. Between {a} and {b} the share of households reporting crime or vandalism in their area went from {en1(silc[a])}% to {en1(silc[b])}%, while reported crimes per resident changed by {fmt_pct(cr)}: over time, fear moves much more than crime does.",
        )
    A = load_json("autori.json")
    if A:
        i = A["meta"]["years"].index(A["meta"]["last"])
        t, f = A["italia"]["TOT"][i], A["italia"]["THEFT"][i]
        out["autori-ignoti"] = (
            f"Dei delitti commessi e denunciati nel {A['meta']['last']}, entro l’anno l’autore era noto per il {nf1(t)}%; tra i furti per il {nf1(f)}%. Autore noto non vuol dire condannato.",
            f"Of the crimes committed and reported in {A['meta']['last']}, the offender was known by the end of the year for {en1(t)}%; among thefts, {en1(f)}%. A known offender is not a convicted one.",
        )
    M = load_json("minori.json")
    if M:
        Ym, last, y0 = M["meta"]["years"], M["meta"]["last"], M["meta"]["share_from"]
        sh = lambda t, y: 100 * M["italia"]["min"][t][Ym.index(y)] / M["italia"]["tot"][t][Ym.index(y)]  # noqa: E731
        out["minori"] = (
            f"Nel {last} i minorenni erano il {nf1(sh('TOT', last))}% delle segnalazioni di persone denunciate o arrestate ({nf1(sh('TOT', y0))}% nel {y0}); per le rapine in strada il {nf1(sh('STREETROB', last))}%. Sono segnalazioni, non persone, e denunciato non vuol dire colpevole.",
            f"In {last} minors accounted for {en1(sh('TOT', last))}% of records of people reported or arrested ({en1(sh('TOT', y0))}% in {y0}); for street robbery, {en1(sh('STREETROB', last))}%. These are records, not people, and being reported does not mean being guilty.",
        )
    K = load_json("cautelari.json")
    if K:
        d, last = K["detenuti"]["italia"], K["meta"]["last"]
        i = K["meta"]["years"].index(last)
        out["custodia-cautelare"] = (
            f"A fine {last} erano senza una condanna definitiva {nf0(d['DISPAUTH'][i])} delle {nf0(d['ALL'][i])} persone detenute: il {nf1(100 * d['DISPAUTH'][i] / d['ALL'][i])}%. Per la Costituzione non sono considerate colpevoli fino alla condanna definitiva, e la riparazione per ingiusta detenzione non vuol dire errore del giudice.",
            f"At the end of {last}, {en0(d['DISPAUTH'][i])} of the {en0(d['ALL'][i])} people in prison had no final conviction: {en1(100 * d['DISPAUTH'][i] / d['ALL'][i])}%. Under the Constitution they are not considered guilty until the final judgment, and compensation for unjust detention does not mean that a judge made a mistake.",
        )
    S = load_json("istituti.json")
    if S:
        it, last = S["italia"], S["meta"]["last"]
        p, c = it["pres"][-1], it["cap"][-1]
        g = S["garante"]
        mesi = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]
        m_it, m_en = f"{mesi[int(last[5:]) - 1]} {last[:4]}", date(int(last[:4]), int(last[5:]), 1).strftime("%B %Y")
        out["carcere-per-carcere"] = (
            f"A fine {m_it} nelle carceri per adulti c’erano {nf0(p)} persone per {nf0(c)} posti regolamentari: {js_round(100 * p / c)} ogni 100 posti. Nel {g['anni'][-1]} il Garante nazionale conta {g['totale'][-1]} morti, di cui {g['suicidi'][-1]} suicidi; le serie partono dal 2015, e i conteggi cambiano a seconda di chi li fa.",
            f"At the end of {m_en} adult prisons held {en0(p)} people for {en0(c)} official places: {js_round(100 * p / c)} per 100 places. In {g['anni'][-1]} the national Guarantor counted {g['totale'][-1]} deaths, {g['suicidi'][-1]} of them suicides; its series starts in 2015, and the counts differ depending on who does them.",
        )
    return out


def home_facts():
    """Le frasi della sintesi della home, in italiano e in inglese."""
    top, bottom = RANKED[:3], RANKED[-3:][::-1]
    it = (
        f"Nel {LAST} in Italia sono stati denunciati {nf0(ITALY['n']['TOT'][L])} delitti, {nf0(IT_TOT[L])} ogni 100.000 abitanti: "
        f"{fmt_pct(IT_TOT[L] / IT_TOT[0] - 1)} rispetto al {Y[0]}, {fmt_pct(IT_TOT[L] / IT_TOT[IB] - 1)} rispetto al {REF}. "
        "Più denunce per abitante: " + ", ".join(f"{c['name']} ({nf0(rate(c, 'TOT', L))})" for c in top)
        + "; meno: " + ", ".join(f"{c['name']} ({nf0(rate(c, 'TOT', L))})" for c in bottom) + ". "
        "Sono denunce, non tutti i reati commessi, e il tasso sui residenti pesa di più dove arrivano pendolari e turisti: "
        "la classifica dice quanto si denuncia, non quanto rischia chi ci abita."
    )
    en = (
        f"In {LAST}, {en0(ITALY['n']['TOT'][L])} crimes were reported in Italy, {en0(IT_TOT[L])} per 100,000 residents: "
        f"{fmt_pct(IT_TOT[L] / IT_TOT[0] - 1)} on {Y[0]}, {fmt_pct(IT_TOT[L] / IT_TOT[IB] - 1)} on {REF}. "
        "Most reports per resident: " + ", ".join(f"{c['name']} ({en0(rate(c, 'TOT', L))})" for c in top)
        + "; fewest: " + ", ".join(f"{c['name']} ({en0(rate(c, 'TOT', L))})" for c in bottom) + ". "
        "These are reports, not all crimes committed, and a rate on residents weighs more where commuters and tourists arrive: "
        "the ranking tells you how much is reported, not how much risk residents face."
    )
    return it, en


SINTESI = re.compile(r'<noscript class="sintesi">.*?</noscript>\n?', re.S)


def put_summary(rel, paragraphs, en):
    """Scrive (o riscrive) la sintesi <noscript> subito dopo <main id="app"> di una pagina scritta a mano."""
    f = ROOT / rel
    s = f.read_text(encoding="utf-8")
    head = "Senza JavaScript i grafici non si vedono. In breve:" if not en else "Without JavaScript the charts do not show. In short:"
    more = ('<a href="/citta/">I 108 capoluoghi, città per città</a> · <a href="/llms.txt">i numeri principali</a>' if not en
            else '<a href="/citta/">The 108 provincial capitals (in Italian)</a> · <a href="/llms.txt">the main figures</a>')
    block = ('<noscript class="sintesi"><div class="wrap"><p><strong>' + head + "</strong></p>"
             + "".join(f"<p>{esc(p)}</p>" for p in paragraphs) + f"<p>{more}</p></div></noscript>\n")
    t = SINTESI.sub("", s)
    if '<main id="app">\n' not in t:
        raise SystemExit(f"{rel}: non trovo <main id=\"app\">")
    t = t.replace('<main id="app">\n', '<main id="app">\n' + block, 1)
    if t != s:
        f.write_text(t, encoding="utf-8")
    # dateModified dei dati strutturati: la data dell'ultimo cambio vero della pagina, come lastmod nella sitemap
    d = lastmod(rel)
    u = f.read_text(encoding="utf-8")
    v = re.sub(r'("dateModified": ")\d{4}-\d{2}-\d{2}(")', rf"\g<1>{d}\g<2>", u)
    if v != u:
        f.write_text(v, encoding="utf-8")


def summaries():
    facts = deep_facts()
    hi, he = home_facts()
    put_summary("index.html", [hi], False)
    put_summary("en/index.html", [he], True)
    put_summary("progetto/index.html", [hi], False)
    put_summary("en/progetto/index.html", [he], True)
    for key, (fi, fe) in facts.items():
        put_summary(f"approfondimenti/{key}.html", [fi], False)
        put_summary(f"en/approfondimenti/{key}.html", [fe], True)
    return facts


# ------------------------------------------------------------------ 404.html

def absolute(fragment, base):
    """GitHub Pages serve 404.html a qualsiasi profondità: ogni href e src relativo diventa assoluto dalla radice."""
    def fix(m):
        u = m.group(2)
        if re.match(r"(?:[a-z]+:|/|#)", u):
            return m.group(0)
        return f'{m.group(1)}="{urljoin(base, u)}"'
    return re.sub(r'\b(href|src)="([^"]*)"', fix, fragment).replace(' aria-current="page"', "")


def not_found_page():
    """La pagina per gli indirizzi che non esistono, in italiano e, sotto /en/, in inglese.

    Testata, ricerca, scheda e piè di pagina vengono dagli indici degli approfondimenti nelle due lingue, con i link
    resi assoluti; uno script in testa mette lang="en" prima di vc.js, un altro scambia i blocchi italiani con
    quelli inglesi. Per un indirizzo /citta/… sbagliato propone la città col nome più vicino."""
    src_en = (ROOT / "en/approfondimenti/index.html").read_text(encoding="utf-8")
    home_it = (ROOT / "index.html").read_text(encoding="utf-8")
    home_en = (ROOT / "en/index.html").read_text(encoding="utf-8")

    def pick(pat, s, name):
        m = re.search(pat, s, re.S)
        if not m:
            raise SystemExit(f"404.html: non trovo {name}")
        return m.group(0)

    it_base, en_base = "/approfondimenti/index.html", "/en/approfondimenti/index.html"
    mast_it = absolute(pick(r'<header class="masthead">.*?</header>', SRC, "la testata"), it_base)
    mast_en = absolute(pick(r'<header class="masthead">.*?</header>', src_en, "la testata inglese"), en_base)
    mast_it = re.sub(r'(<a class="bar-lang" href=")[^"]*(")', r"\1/en/\2", mast_it)
    mast_en = re.sub(r'(<a class="bar-lang" href=")[^"]*(")', r"\1/\2", mast_en)
    finder_it = absolute(pick(r'<section class="finder".*?</section>', home_it, "la ricerca"), "/index.html")
    finder_en = absolute(pick(r'<section class="finder".*?</section>', home_en, "la ricerca inglese"), "/en/index.html")
    foot_it = absolute(FOOTER, it_base)
    foot_en = absolute(pick(r'<footer class="colophon">.*?</footer>', src_en, "il piè di pagina inglese"), en_base)
    dialog_en = pick(r'<dialog class="cityd".*?</dialog>', src_en, "la scheda inglese")
    links = absolute(HEAD_LINKS, it_base)
    scripts = absolute(SCRIPTS, it_base)
    slugs = json.dumps([[page_name(c)[:-5], c["name"]] for c in sorted(CITIES, key=lambda c: c["name"])], ensure_ascii=False, separators=(",", ":"))
    return f"""<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Pagina non trovata · Atlante della Sicurezza</title>
<meta name="robots" content="noindex">
<!-- Pagina generata da scripts/build_seo.py: modificare lo script, non questo file. GitHub Pages la mostra per ogni
     indirizzo che non esiste, a qualsiasi profondità: per questo tutti i link partono dalla radice. -->
<script>if (location.pathname.indexOf("/en/") === 0) {{ document.documentElement.lang = "en"; document.title = "Page not found · Atlante della Sicurezza"; }}</script>
{links}
<style>
  html[lang="en"] .nf-it, html:not([lang="en"]) .nf-en {{ display: none; }}
  .nf-links {{ display: flex; flex-wrap: wrap; gap: 10px 22px; padding: 0; margin: 18px 0 0; list-style: none; font-weight: 600; }}
  .nf-guess {{ margin-top: 16px; font-size: var(--step-1); }}
</style>
</head>
<body>
<a class="skip" href="#app"><span class="nf-it">Vai al contenuto</span><span class="nf-en">Skip to content</span></a>
{mast_it}
<template id="nf-mast-en">{mast_en}</template>

<main id="app">
  <section class="dd-head" aria-labelledby="nf-title">
    <div class="wrap">
      <div class="kicker"><span class="nf-it">Errore 404</span><span class="nf-en">Error 404</span></div>
      <h1 id="nf-title"><span class="nf-it">Questa pagina non c’è</span><span class="nf-en">This page does not exist</span></h1>
      <p class="dek"><span class="nf-it">L’indirizzo è sbagliato, o la pagina è stata spostata. Cerca il tuo comune qui sotto, oppure riparti da una di queste pagine.</span><span class="nf-en">The address is wrong, or the page has moved. Look up your town below, or start again from one of these pages.</span></p>
      <p class="nf-guess" id="nf-guess" hidden></p>
      <ul class="nf-links nf-it">
        <li><a href="/">La pagina principale</a></li>
        <li><a href="/citta/">I 108 capoluoghi</a></li>
        <li><a href="/approfondimenti/">Gli approfondimenti</a></li>
        <li><a href="/progetto/">Il progetto e il metodo</a></li>
      </ul>
      <ul class="nf-links nf-en">
        <li><a href="/en/">The home page</a></li>
        <li><a href="/citta/">The 108 provincial capitals (in Italian)</a></li>
        <li><a href="/en/approfondimenti/">The deep dives</a></li>
        <li><a href="/en/progetto/">About and method</a></li>
      </ul>
    </div>
  </section>
{finder_it}
  <template id="nf-finder-en">{finder_en}</template>
</main>

{foot_it}
<template id="nf-foot-en">{foot_en}</template>

{DIALOG}
<template id="nf-dialog-en">{dialog_en}</template>

{TIP}
<script>
  // in inglese: testata, ricerca, piè di pagina e scheda dalla pagina inglese, prima che vc.js li legga
  if (document.documentElement.lang === "en") {{
    [["header.masthead", "nf-mast-en"], ["section.finder", "nf-finder-en"], ["footer.colophon", "nf-foot-en"], ["dialog.cityd", "nf-dialog-en"]].forEach(([sel, id]) => {{
      const el = document.querySelector(sel), t = document.getElementById(id);
      if (el && t) el.replaceWith(t.content.cloneNode(true));
    }});
  }}
  document.querySelectorAll("template").forEach((t) => t.remove());
  // un indirizzo /citta/… sbagliato: la città col nome più vicino
  (function () {{
    const m = location.pathname.match(/^\\/(?:en\\/)?citta\\/([^\\/]+?)(?:\\.html)?\\/?$/);
    if (!m) return;
    let raw = m[1];
    try {{ raw = decodeURIComponent(raw); }} catch (e) {{ /* indirizzo con un % sbagliato: si usa com'è */ }}
    const q = raw.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (q.length < 3) return;
    const cities = {slugs};
    const dist = (a, b) => {{
      const d = Array.from({{ length: b.length + 1 }}, (_, j) => j);
      for (let i = 1; i <= a.length; i++) {{
        let prev = d[0]; d[0] = i;
        for (let j = 1; j <= b.length; j++) {{ const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }}
      }}
      return d[b.length];
    }};
    let best = null;
    cities.forEach(([s, name]) => {{ const k = s.startsWith(q) || q.startsWith(s) ? 0.5 : dist(q, s); if (!best || k < best.k) best = {{ s, name, k }}; }});
    if (!best || best.k > Math.max(2, q.length / 3)) return;
    const en = document.documentElement.lang === "en", p = document.getElementById("nf-guess");
    p.innerHTML = (en ? "Were you looking for " : "Forse cercavi ") + `<a href="/citta/${{best.s}}.html">${{best.name}}</a>?`;
    p.hidden = false;
  }})();
</script>
{scripts}
</body>
</html>
"""


def main():
    out = ROOT / "citta"
    out.mkdir(exist_ok=True)
    keep = {"index.html"}
    for c in CITIES:
        (out / page_name(c)).write_text(city_page(c), encoding="utf-8")
        keep.add(page_name(c))
    (out / "index.html").write_text(hub_page(), encoding="utf-8")
    for f in out.glob("*.html"):
        if f.name not in keep:  # una città che non c'è più
            f.unlink()
    # le pagine in inglese (en/) caricano gli stessi vc.css e vc.js: prendono gli stessi ?v= degli approfondimenti
    vers = dict(re.findall(r'(vc\.(?:css|js))\?v=(\d+)', SRC))
    n_en = 0
    for f in sorted((ROOT / "en").rglob("*.html")):
        s = f.read_text(encoding="utf-8")
        t = re.sub(r'(vc\.(css|js))\?v=\d+', lambda m: f"{m.group(1)}?v={vers[m.group(1)]}", s)
        if t != s:
            f.write_text(t, encoding="utf-8")
        n_en += 1
    summaries()  # le sintesi <noscript> delle pagine scritte a mano, prima di sitemap e llms.txt
    (ROOT / "sitemap.xml").write_text(sitemap(), encoding="utf-8")
    (ROOT / "llms.txt").write_text(llms(), encoding="utf-8")
    nf = not_found_page()
    rel = re.findall(r'\b(?:href|src)="(?![a-z]+:|/|#)[^"]*"', nf)
    if rel:
        raise SystemExit(f"404.html: link relativi rimasti {rel[:5]}")
    (ROOT / "404.html").write_text(nf, encoding="utf-8")
    print(f"citta/: {len(CITIES)} pagine e la classifica; en/: ?v= su {n_en} pagine; sitemap.xml; llms.txt; 404.html")


if __name__ == "__main__":
    main()
