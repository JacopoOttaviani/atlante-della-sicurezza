#!/usr/bin/env python3
"""Atlante della sicurezza — approfondimento «Prima della condanna» (custodia cautelare e ingiusta detenzione).

Scrive data/cautelari.json mettendo insieme tre fonti:

  detenuti    persone detenute a fine anno per posizione giuridica (in attesa di primo giudizio, appellanti, ricorrenti,
              posizioni miste, condannati definitivi), Italia e regioni di detenzione, per cittadinanza e sesso, dal 2010:
              ISTAT 73_173_DF_DCCV_DETENUTI_5 (fonte DAP), la stessa cache di build_carceri.py
  relazione   le tabelle della Relazione al Parlamento sulle misure cautelari personali e sulla riparazione per ingiusta
              detenzione (legge 47/2015, art. 15), trascritte a mano dal PDF in scripts/cautelari_relazione.json, con la
              pagina di ogni tabella: misure emesse, esiti dei procedimenti, domande di riparazione, ordinanze e importi
              pagati per distretto di Corte d'appello (dati MEF), procedimenti disciplinari
  residenti   popolazione residente al 1° gennaio per provincia (ISTAT, demo.istat.it), sommata per distretto

Uso:  python3 scripts/build_cautelari.py      (dalla cartella atlante-della-sicurezza/)
Si ferma se le somme non tornano: posizioni giuridiche con il totale, regioni con l'Italia, misure per tipo con il totale,
ordinanze e importi dei distretti con i totali nazionali, importi diviso ordinanze con le medie pubblicate, esiti per misura
con i totali per esito, procedimenti disciplinari con i loro esiti.
"""
import csv
import io
import json
import os
import sys
import zipfile
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import OUT, log, sdmx  # noqa: E402
from build_carceri import REGIONS, fetch_bytes  # noqa: E402
from build_minori import REG_ISTAT  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = list(range(2010, 2026))
POS = ["AWFJ", "APP", "REC", "MWOD", "CONVFJ", "MWD", "SUBSM"]  # DISPAUTH = le prime quattro, CONV = CONVFJ + MWD
POP_YEAR = 2025
POSAS = "https://demo.istat.it/data/posas/POSAS_{year}_it_Province.zip"

# Le province di ogni distretto di Corte d'appello (e delle tre sezioni distaccate, che la relazione conta a parte).
# Codici ISTAT delle province come nei file demo.istat.it del 2025: la Sardegna ha ancora le cinque province del 2016.
# Pochi tribunali hanno comuni di due province (Lagonegro, Lanusei): lì il distretto è approssimato alla provincia.
# Massa-Carrara è nel distretto di Genova. La provincia di Nuoro comprende l'Ogliastra (tribunale di Lanusei, distretto
# di Cagliari): per i residenti va tutta con Sassari, sulla carta l'Ogliastra (116) è con Cagliari.
DIST_PROV = {
    "torino": ["001", "002", "003", "004", "005", "006", "096", "103", "007"],
    "milano": ["012", "013", "014", "015", "018", "097", "098", "108"],
    "brescia": ["016", "017", "019", "020"],
    "trento": ["022"],
    "bolzano": ["021"],
    "venezia": ["023", "024", "025", "026", "027", "028", "029"],
    "trieste": ["030", "031", "032", "093"],
    "genova": ["008", "009", "010", "011", "045"],
    "bologna": ["033", "034", "035", "036", "037", "038", "039", "040", "099"],
    "firenze": ["046", "047", "048", "049", "050", "051", "052", "053", "100"],
    "perugia": ["054", "055"],
    "ancona": ["041", "042", "043", "044", "109"],
    "roma": ["056", "057", "058", "059", "060"],
    "laquila": ["066", "067", "068", "069"],
    "campobasso": ["070", "094"],
    "napoli": ["061", "062", "063", "064"],
    "salerno": ["065"],
    "bari": ["071", "072", "110"],
    "lecce": ["074", "075"],
    "taranto": ["073"],
    "potenza": ["076", "077"],
    "catanzaro": ["078", "079", "101", "102"],
    "reggio": ["080"],
    "palermo": ["081", "082", "084"],
    "caltanissetta": ["085", "086"],
    "catania": ["087", "088", "089"],
    "messina": ["083"],
    "cagliari": ["092", "095", "111"],
    "sassari": ["090", "091"],
}
# Sulla carta (data/italia.topo.json) la Sardegna ha le otto province del 2025.
SARD_MAP = {"cagliari": ["115", "116", "117", "118", "119"], "sassari": ["112", "113", "114"]}


def legal_positions():
    rows = sdmx("73_173_DF_DCCV_DETENUTI_5", "all", "detenuti_5.csv")
    v = {}
    for r in rows:
        if r["OBS_VALUE"] != "":
            v[(r["REF_AREA"], r["SEX"], r["CITIZENSHIP"], r["LEGAL_POSITION"], int(r["TIME_PERIOD"]))] = int(float(r["OBS_VALUE"]))
    # i totali pubblicati devono tornare con le parti, in ogni cella
    bad = []
    for (a, s, c, lp, y), n in v.items():
        if lp != "ALL":
            continue
        g = lambda k: v.get((a, s, c, k, y), 0)  # noqa: E731
        if g("DISPAUTH") != g("AWFJ") + g("APP") + g("REC") + g("MWOD") or g("CONV") != g("CONVFJ") + g("MWD") or n != g("DISPAUTH") + g("CONV") + g("SUBSM"):
            bad.append((a, s, c, y))
    if bad:
        raise SystemExit(f"posizioni giuridiche che non tornano con il totale in {len(bad)} celle, per esempio {bad[:3]}")
    for y in YEARS:
        regs = sum(v[(a, "9", "WORLD", "ALL", y)] for a in REGIONS)
        if regs != v[("IT", "9", "WORLD", "ALL", y)]:
            raise SystemExit(f"le regioni non tornano con l'Italia nel {y}: {regs} contro {v[('IT', '9', 'WORLD', 'ALL', y)]}")
    log(f"  posizioni giuridiche: {sum(1 for k in v if k[3] == 'ALL')} totali controllati, regioni uguali all'Italia in ogni anno")

    def ser(area="IT", sex="9", cit="WORLD", lp="ALL"):
        return [v.get((area, sex, cit, lp, y)) for y in YEARS]

    italia = {k: ser(lp=k) for k in ["ALL", "DISPAUTH"] + POS}
    cit = {key: {k: ser(cit=c, lp=k) for k in ("ALL", "DISPAUTH", "AWFJ")} for key, c in (("it", "IT"), ("str", "WRL_X_ITA"))}
    sex = {key: {k: ser(sex=s, lp=k) for k in ("ALL", "DISPAUTH", "AWFJ")} for key, s in (("uomini", "1"), ("donne", "2"))}
    regioni = [{"id": a, "istat": REG_ISTAT[a], "name": name, "all": ser(area=a), "disp": ser(area=a, lp="DISPAUTH"), "awfj": ser(area=a, lp="AWFJ")}
               for a, name in REGIONS.items()]
    return italia, cit, sex, regioni


def residents():
    body = fetch_bytes(POSAS.format(year=POP_YEAR), f"posas_{POP_YEAR}_province.zip")
    with zipfile.ZipFile(io.BytesIO(body)) as z:
        name = next(n for n in z.namelist() if n.endswith(".csv"))
        text = z.read(name).decode("utf-8-sig")
    lines = text.splitlines()
    rd = csv.reader(lines[1:], delimiter=";")  # la prima riga è il titolo
    head = next(rd)
    ic, ia, it = head.index("Codice provincia"), head.index("Età"), head.index("Totale")
    pop = {}
    for r in rd:
        if r and r[ia] == "999":  # la riga del totale per tutte le età
            pop[r[ic]] = int(r[it])
    if len(pop) != 107:
        raise SystemExit(f"attese 107 province nel file dei residenti, trovate {len(pop)}")
    used = [p for ps in DIST_PROV.values() for p in ps]
    if sorted(used) != sorted(pop) or len(used) != len(set(used)):
        raise SystemExit(f"le province dei distretti non coprono l'Italia una volta sola: mancano {sorted(set(pop) - set(used))}, in più {sorted(set(used) - set(pop))}")
    log(f"  residenti al 1° gennaio {POP_YEAR}: {sum(pop.values()):,} in 107 province")
    return pop


def check_relazione(R):
    Y = R["anni"]
    M = R["misure"]
    for i, y in enumerate(Y):
        s = sum(t["n"][i] for t in M["tipi"])
        if s != M["totale"][i]:
            raise SystemExit(f"misure {y}: la somma dei tipi ({s}) non torna con il totale ({M['totale'][i]})")
    E = R["esiti"]
    parts = ["condanna_def", "condanna_def_sosp", "condanna_nondef", "condanna_nondef_sosp", "assoluzione_def", "assoluzione_nondef", "altro"]
    for i, y in enumerate(Y):
        s = sum(E[k][i] for k in parts)
        if s != E["definiti"][i]:
            raise SystemExit(f"esiti {y}: la somma ({s}) non torna con le misure nei procedimenti definiti ({E['definiti'][i]})")
    P = R["esiti_per_misura_2024"]["righe"]
    if sum(P["totale"]) != E["definiti"][-1]:
        raise SystemExit("esiti per misura 2024: il totale non torna con lo schema 8")
    tot24 = E["definiti"][-1]
    if [P["totale"][0], P["totale"][1], P["totale"][2], P["totale"][3], P["totale"][4], P["totale"][5]] != [
            E["condanna_def"][-1], E["condanna_def_sosp"][-1], E["condanna_nondef"][-1], E["condanna_nondef_sosp"][-1],
            E["assoluzione_def"][-1] + E["assoluzione_nondef"][-1], E["altro"][-1]]:
        raise SystemExit("esiti per misura 2024: le colonne non tornano con lo schema 8")
    D = R["riparazione"]["definite_2024"]
    if D["accolte"] + D["respinte"] + D["inammissibili"] != D["totale"]:
        raise SystemExit("domande di riparazione definite nel 2024: le parti non tornano con il totale")
    pay = R["riparazione"]["pagamenti"]
    for i, y in enumerate(Y):
        o = sum(d["ordinanze"][i] for d in pay["distretti"])
        e = sum(d["importi"][i] for d in pay["distretti"])
        if o != pay["totale_ordinanze"][i]:
            raise SystemExit(f"ordinanze {y}: i distretti sommano {o}, il totale pubblicato è {pay['totale_ordinanze'][i]}")
        if abs(e / 1e6 - pay["totale_milioni"][i]) > 0.051:
            raise SystemExit(f"importi {y}: i distretti sommano {e / 1e6:.2f} milioni, il totale pubblicato è {pay['totale_milioni'][i]}")
        if abs(e / o - pay["media_nazionale"][i]) > 2:
            raise SystemExit(f"importi {y}: la media per ordinanza ({e / o:.0f}) non torna con quella pubblicata ({pay['media_nazionale'][i]})")
        for d in pay["distretti"]:
            n, a, m = d["ordinanze"][i], d["importi"][i], d["media"][i]
            if (n == 0 and a != 0) or (n and abs(a / n - m) > 2):
                raise SystemExit(f"{d['nome']} {y}: {a} euro su {n} ordinanze non danno la media pubblicata di {m}")
    G = R["disciplinari"]
    for i, y in enumerate(G["anni"]):
        s = G["assoluzioni"][i] + G["non_doversi_procedere"][i] + G["sanzioni"][i] + G["in_corso"][i]
        if s != G["azioni"][i]:
            raise SystemExit(f"procedimenti disciplinari {y}: gli esiti ({s}) non tornano con le azioni ({G['azioni'][i]})")
    log(f"  relazione: misure, esiti ({tot24} misure nel 2024), {len(pay['distretti'])} distretti per {len(Y)} anni e procedimenti disciplinari tornano con i totali")


def build():
    R = json.load(open(os.path.join(HERE, "cautelari_relazione.json"), encoding="utf-8"))
    check_relazione(R)
    italia, cit, sex, regioni = legal_positions()
    pop = residents()

    pay = R["riparazione"]["pagamenti"]
    distretti = []
    for d in pay["distretti"]:
        provs = DIST_PROV[d["id"]]
        distretti.append({
            "id": d["id"], "name": d["nome"],
            "map": SARD_MAP.get(d["id"], provs),
            "pop": sum(pop[p] for p in provs),
            "ordinanze": d["ordinanze"], "importi": d["importi"],
        })
    strip = lambda o: {k: v for k, v in o.items() if not k.startswith("_")}  # noqa: E731

    data = {
        "meta": {
            "years": YEARS, "last": YEARS[-1], "rel_years": R["anni"], "rel_last": R["anni"][-1], "pop_year": POP_YEAR,
            "built": date.today().isoformat(),
            "nota": "Persone detenute a fine anno per posizione giuridica (ISTAT su dati DAP); misure cautelari, riparazioni per ingiusta detenzione e procedimenti disciplinari dalla Relazione al Parlamento del Ministero della Giustizia (legge 47/2015), dati 2024.",
            "sources": [
                {"id": "73_173_DF_DCCV_DETENUTI_5", "label": "ISTAT, Detenuti adulti presenti — posizione giuridica, per regione di detenzione, cittadinanza e sesso (fonte: Ministero della Giustizia, DAP)",
                 "en": "ISTAT, Adult prisoners held — legal status, by region of detention, citizenship and sex (source: Ministry of Justice, DAP)"},
                {"id": "L. 47/2015, art. 15", "label": "Ministero della Giustizia, Misure cautelari personali e riparazione per ingiusta detenzione: dati anno 2024, Relazione al Parlamento (edizione gennaio 2025); ordinanze e importi delle riparazioni di fonte MEF",
                 "en": "Ministry of Justice, Personal precautionary measures and compensation for wrongful detention: 2024 data, report to Parliament (January 2025 edition); compensation orders and amounts from the Ministry of Economy and Finance"},
                {"id": "Doc. XCIV n. 4", "label": "Camera dei deputati, la stessa relazione per il 2025 (gennaio-ottobre): procedimenti disciplinari aggiornati a novembre 2025",
                 "en": "Chamber of Deputies, the same report for 2025 (January to October): disciplinary proceedings updated to November 2025"},
                {"id": f"POSAS_{POP_YEAR}", "label": f"ISTAT, Demografia in cifre: popolazione residente al 1° gennaio {POP_YEAR} per provincia (residenti dei distretti)",
                 "en": f"ISTAT, Demografia in cifre: resident population on 1 January {POP_YEAR} by province (residents of the court districts)"},
            ],
        },
        "detenuti": {"italia": italia, "cit": cit, "sex": sex, "regioni": regioni},
        "misure": {"tipi": R["misure"]["tipi"], "totale": R["misure"]["totale"], "stimati": R["misure"]["stimati"]},
        "esiti": strip(R["esiti"]),
        "esiti_misura": {"colonne": R["esiti_per_misura_2024"]["colonne"], "righe": R["esiti_per_misura_2024"]["righe"]},
        "riparazione": {
            "domande": R["riparazione"]["domande"]["n"],
            "accolte_pct": R["riparazione"]["accolte_pct"]["v"],
            "definite": strip(R["riparazione"]["definite_2024"]),
            "motivi": strip(R["riparazione"]["motivi"]),
            "ordinanze": pay["totale_ordinanze"],
            "importi": [sum(d["importi"][i] for d in distretti) for i in range(len(R["anni"]))],
            "distretti": distretti,
        },
        "disciplinari": strip(R["disciplinari"]),
    }
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "cautelari.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    L = len(YEARS) - 1
    log(f"scritto data/cautelari.json ({os.path.getsize(path) // 1024} KB): fine {YEARS[-1]}, {italia['DISPAUTH'][L]:,} persone senza condanna definitiva su {italia['ALL'][L]:,}")


if __name__ == "__main__":
    build()
