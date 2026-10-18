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

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://atlantedellasicurezza.it/"
IMG = SITE + "img/og-image.jpg"
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
    return ("all’" if vowel_num(rank) else "al ") + f"{rank}°"


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
WEBSITE_REF = {"@type": "WebSite", "@id": SITE + "#website", "name": "Atlante della sicurezza", "url": SITE}

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
<meta property="og:site_name" content="Atlante della sicurezza">
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
{STYLE}
<!-- Pagina generata da scripts/build_seo.py: modificare lo script, non questo file. -->
<script type="application/ld+json">
{ld_json}
</script>
</head>
<body>
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
    "e popolazione residente; elaborazione dell’Atlante della sicurezza. "
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
        if p is not None and a is not None and b is not None and min(a, b) >= MIN_N:
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
    ]
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
            if name in TOURIST else "."
        )
    )

    facts = [
        (nf0(r_last), f"delitti denunciati ogni 100.000 abitanti nel {LAST} · Italia {nf0(IT_TOT[L])}"),
        (f"{rank}° su {N_CITIES}", f"tra i comuni capoluogo, per delitti denunciati in rapporto agli abitanti nel {LAST}"),
        (fmt_pct(ch_ref), f"variazione del tasso dal {REF} al {LAST} · Italia {fmt_pct(it_ref)}"),
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
        label = f"<strong>{esc(t['label'])}</strong>" if tid == "TOT" else esc(t["label"])
        rows.append(
            f"<tr><td>{label}</td><td class=\"num\">{nf0(n) if n is not None else 'n.d.'}</td>"
            f"<td class=\"num\">{fmt_rate(r)}</td>"
            f"<td class=\"num\">{fmt_rate(ITALY['rate'][tid][L])}</td><td class=\"num\">{fmt_pct(p)}</td></tr>"
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

    title = f"Reati denunciati {where}, {Y[i0]}–{LAST} · Atlante della sicurezza"
    description = (
        f"{name}, {LAST}: {nf0(n_last)} delitti denunciati, {nf0(r_last)} ogni 100.000 abitanti (Italia {nf0(IT_TOT[L])}), "
        f"{rank}° tra i {N_CITIES} capoluoghi. Reato per reato e anno per anno dal {Y[i0]}, con dati ufficiali ISTAT."
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
            "isBasedOn": {"@type": "Dataset", "@id": SITE + "#dati", "name": "Reati denunciati nei 108 comuni capoluogo italiani, 2006–2024", "url": SITE},
            "about": {
                "@type": "City",
                "name": name,
                "containedInPlace": {"@type": "AdministrativeArea", "name": c["region"]},
                "geo": {"@type": "GeoCoordinates", "latitude": c["lat"], "longitude": c["lon"]},
            },
        },
        crumbs(("Atlante della sicurezza", SITE), ("Le città", SITE + "citta/"), (name, url)),
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
      <p class="dd-crumb"><a href="../">Atlante della sicurezza</a> · <a href="./">Le città</a> · {esc(c['region'])}</p>
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
          <caption>Tassi ogni 100.000 abitanti. La variazione è quella del tasso dal {REF} al {LAST}, indicata solo con almeno {MIN_N} denunce in entrambi gli anni. n.d.: dato non disponibile. {SOURCES}</caption>
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
    title = f"Classifica dei reati denunciati nei {N_CITIES} capoluoghi italiani, {LAST} · Atlante della sicurezza"
    description = (
        f"I {N_CITIES} comuni capoluogo per delitti denunciati ogni 100.000 abitanti nel {LAST}: "
        + ", ".join(f"{c['name']} {nf0(rate(c, 'TOT', L))}" for c in top)
        + f", Italia {nf0(IT_TOT[L])}. Una pagina per ogni città, con i dati ufficiali ISTAT dal {Y[0]}."
    )
    rows = "".join(
        f"<tr><td class=\"num\">{RANK[c['id']]}</td><td><a href=\"{page_name(c)}\">{esc(c['name'])}</a></td><td>{esc(c['region'])}</td>"
        f"<td class=\"num\">{nf0(c['n']['TOT'][L])}</td><td class=\"num\">{nf0(rate(c, 'TOT', L))}</td>"
        f"<td class=\"num\">{fmt_pct(change(c, 'TOT', IB))}</td></tr>"
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
        crumbs(("Atlante della sicurezza", SITE), ("Le città", url)),
    ]
    body = f"""
<main id="app">
  <section class="dd-head" aria-labelledby="cp-title">
    <div class="wrap">
      <p class="dd-crumb"><a href="../">Atlante della sicurezza</a> · Le città</p>
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
          <caption>Delitti denunciati nel {LAST} e tasso ogni 100.000 abitanti; la variazione è quella del tasso dal {REF}. {SOURCES}</caption>
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
        title = re.search(r"<title>(.*?)</title>", s).group(1).replace(" · Atlante della sicurezza", "")
        desc = re.search(r'<meta name="description" content="([^"]*)"', s).group(1)
        out.append(("approfondimenti/" + name, html.unescape(title), html.unescape(desc)))
    return out


# ------------------------------------------------------------------ sitemap.xml

def lastmod(rel):
    """Data dell'ultimo commit del file; oggi se il file è nuovo o modificato e non ancora salvato."""
    try:
        dirty = subprocess.run(["git", "status", "--porcelain", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        last = subprocess.run(["git", "log", "-1", "--format=%cs", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    except OSError:
        return date.today().isoformat()
    return date.today().isoformat() if dirty or not last else last


def sitemap():
    pages = [
        ("", "index.html", "1.0"),
        ("citta/", "citta/index.html", "0.9"),
        ("approfondimenti/", "approfondimenti/index.html", "0.7"),
    ] + [(f, f, "0.7") for f, _, _ in deep_pages()] + [
        ("progetto/", "progetto/index.html", "0.5"),
    ] + [("citta/" + page_name(c), "citta/" + page_name(c), "0.6") for c in sorted(CITIES, key=lambda c: c["name"])]
    urls = "".join(
        f"  <url>\n    <loc>{SITE}{loc}</loc>\n    <lastmod>{lastmod(f)}</lastmod>\n    <priority>{p}</priority>\n  </url>\n"
        for loc, f, p in pages
    )
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n'


# ------------------------------------------------------------------ llms.txt

def llms():
    ups_downs = []
    for t in TYPES:
        if t["id"] == "TOT":
            continue
        a, b = ITALY["rate"][t["id"]][IB], ITALY["rate"][t["id"]][L]
        if a:
            ups_downs.append((t, b / a - 1))
    ups = sorted((d for d in ups_downs if d[1] > 0.03), key=lambda d: -d[1])[:3]
    downs = sorted((d for d in ups_downs if d[1] < -0.03), key=lambda d: d[1])[:3]
    lst = lambda ms: and_list([f"{short_label(t)} ({fmt_pct(p)})" for t, p in ms])
    top, bottom = RANKED[:3], RANKED[-3:][::-1]
    perc = ITALY.get("perc", {})
    py = sorted(perc)

    facts = [
        f"- Nel {LAST} in Italia sono stati denunciati {nf0(ITALY['n']['TOT'][L])} delitti, {nf0(IT_TOT[L])} ogni 100.000 abitanti: "
        f"{fmt_pct(IT_TOT[L] / IT_TOT[0] - 1)} rispetto al {Y[0]} ({nf0(IT_TOT[0])}), {fmt_pct(IT_TOT[L] / IT_TOT[IB] - 1)} rispetto al {REF} ({nf0(IT_TOT[IB])}).",
        f"- I capoluoghi con più delitti denunciati per abitante nel {LAST}: "
        + ", ".join(f"{c['name']} ({nf0(rate(c, 'TOT', L))} ogni 100.000)" for c in top)
        + ". Con meno: " + ", ".join(f"{c['name']} ({nf0(rate(c, 'TOT', L))})" for c in bottom) + ".",
        f"- Dal {REF} al {LAST}, in Italia, sono cresciute soprattutto le denunce per {lst(ups)}; sono calate quelle per {lst(downs)}.",
    ]
    if py:
        facts.append(f"- Nel {py[-1]} il {nf1(perc[py[-1]])}% delle famiglie italiane sente a rischio di criminalità la zona in cui vive (nel {py[0]} il {nf1(perc[py[0]])}%).")
    try:
        C = json.loads((ROOT / "data/carceri.json").read_text(encoding="utf-8"))
        Lc, last = len(C["meta"]["years"]) - 1, C["meta"]["last"]
        ra = (C.get("residenti") or {}).get("anni") or {}
        rk = next((y for y in (last, last - 1) if str(y) in ra), None)
        facts.append(
            f"- A fine {last} gli stranieri erano il {nf1(100 * C['serie']['str'][Lc] / C['serie']['tot'][Lc])}% dei detenuti nelle carceri italiane"
            + (f" e il {nf1(ra[str(rk)]['quota'])}% dei residenti" if rk else "")
            + "; il confronto non misura la propensione a delinquere (vedi l’approfondimento sulle carceri)."
        )
    except (OSError, KeyError, ValueError):
        pass
    try:
        R = json.loads((ROOT / "data/rimpatri.json").read_text(encoding="utf-8"))
        Lr = len(R["meta"]["years"]) - 1
        o, r = R["totale"]["ordini"][Lr], R["totale"]["rimpatri"][Lr]
        facts.append(
            f"- Nel {R['meta']['last']} l’Italia ha ordinato a {nf0(o)} cittadini di paesi non UE di lasciare il territorio e ne ha rimpatriati {nf0(r)}: "
            f"circa {js_round(100 * r / o)} ogni 100."
        )
    except (OSError, KeyError, ValueError, ZeroDivisionError):
        pass

    deep = "\n".join(f"- [{t}]({SITE}{f}): {d}" for f, t, d in deep_pages())
    cities = "\n".join(
        f"- [{c['name']}]({SITE}citta/{page_name(c)}): {nf0(rate(c, 'TOT', L))} delitti denunciati ogni 100.000 abitanti nel {LAST}, {RANK[c['id']]}° su {N_CITIES}"
        for c in sorted(CITIES, key=lambda c: c["name"])
    )

    return f"""# Atlante della sicurezza

> Strumento civico gratuito sui reati denunciati in Italia, con soli dati ufficiali: ISTAT {Y[0]}–{LAST} per i {N_CITIES} comuni capoluogo e la scheda di ogni comune italiano (per i non capoluoghi, i dati della provincia), più Eurostat per i rimpatri. Mostra dove si denuncia di più e di meno, quali reati salgono e quali scendono, le impennate improvvise e quanto le persone si sentono a rischio. Di Jacopo Ottaviani, data journalist.

Numeri principali (calcolati dai dati del sito, aggiornati al {BUILT}):

{chr(10).join(facts)}

Come leggere questi numeri: sono delitti denunciati dalle forze di polizia all’autorità giudiziaria, non tutti i reati commessi; molti reati non vengono denunciati e la propensione a denunciare cambia da reato a reato. I tassi sono ogni 100.000 residenti, quindi pesano di più dove arrivano ogni giorno pendolari, studenti e turisti. Il tasso dice quanto si denuncia in una città, non quanto rischia chi ci abita.

## Pagine

- [Home]({SITE}): mappa e classifica dei {N_CITIES} capoluoghi, reati che salgono e scendono, impennate, piccoli grafici città per città, ricerca di ogni comune italiano.
- [Le città]({SITE}citta/): classifica dei {N_CITIES} capoluoghi per delitti denunciati ogni 100.000 abitanti nel {LAST}, con una pagina per città.
- [Approfondimenti]({SITE}approfondimenti/): i temi che le denunce da sole non chiariscono.
{deep}
- [Il progetto]({SITE}progetto/): perché esiste l’atlante, l’autore, le domande frequenti, metodologia e fonti.

## Le città

{cities}

## Dati aperti

- [data/vc.json]({SITE}data/vc.json): delitti denunciati per capoluogo, tipo di reato e anno; popolazione; tassi nazionali; percezione del rischio.
- [data/province.json]({SITE}data/province.json): tassi di delittuosità per provincia, tipo di reato e anno.
- [data/carceri.json]({SITE}data/carceri.json): detenuti adulti presenti a fine anno, per cittadinanza, regione, reato, età e posizione giuridica.
- [data/rimpatri.json]({SITE}data/rimpatri.json): ordini di lasciare il territorio e rimpatri eseguiti, per cittadinanza.
- [data/autori.json]({SITE}data/autori.json): delitti commessi nell’anno e denunciati, e quanti con autore noto, per tipo (Italia e dodici grandi comuni) e per provincia.
- [data/minori.json]({SITE}data/minori.json): segnalazioni di minorenni e di tutte le persone denunciate e arrestate, per tipo di delitto, in Italia e nelle regioni.
- [Codice e script dei dati su GitHub](https://github.com/JacopoOttaviani/atlante-della-sicurezza): chiunque può rifare i conti.

## Fonti

- ISTAT, Delitti denunciati dalle forze di polizia all’autorità giudiziaria (73_67_DF_DCCV_DELITTIPS_1 e _9), su dati del Ministero dell’Interno (banca dati SDI/SSD)
- ISTAT, popolazione residente (164_164_DF_DCIS_RICPOPRES2011_24, 22_289)
- ISTAT, Aspetti della vita quotidiana: famiglie per percezione del rischio di criminalità (DF_DCSS_BEST_PPC_1_GC); EU-SILC (33_291)
- ISTAT, detenuti adulti presenti nelle carceri (73_173_DF_DCCV_DETENUTI_1…6), su dati del Ministero della Giustizia
- ISTAT, delitti di cui si è scoperto l’autore (73_67_DF_DCCV_DELITTIPS_2, _5, _6, _7), su dati del Ministero dell’Interno
- ISTAT, segnalazioni di persone e di minorenni denunciati e arrestati (73_342_DF_DCCV_SEGNALAZPS_1 e _2), su dati del Ministero dell’Interno
- Eurostat, migr_eiord e migr_eirtn, su dati del Ministero dell’Interno

## Autore

- [Jacopo Ottaviani](https://jacopoottaviani.com/): data journalist e informatico, ICFJ Knight Fellow. [LinkedIn](https://www.linkedin.com/in/jacopo-ottaviani/)
"""


# ------------------------------------------------------------------ scrittura

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
    (ROOT / "sitemap.xml").write_text(sitemap(), encoding="utf-8")
    (ROOT / "llms.txt").write_text(llms(), encoding="utf-8")
    print(f"citta/: {len(CITIES)} pagine e la classifica; sitemap.xml; llms.txt")


if __name__ == "__main__":
    main()
