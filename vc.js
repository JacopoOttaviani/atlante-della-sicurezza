/* Atlante della sicurezza — interfaccia.
   Legge data/vc.json (generato da scripts/build_data.py) e data/italia.topo.json.
   Tutti i calcoli (tassi, variazioni, impennate) avvengono qui a partire dai conteggi ISTAT. */
(function () {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  // La lingua della pagina: le pagine in en/ hanno <html lang="en"> e caricano questo stesso file.
  // L(it, en) sceglie il testo; i numeri si scrivono all'inglese (1,234.5) e le etichette dei dati si traducono qui sotto.
  const EN = /^en\b/i.test(document.documentElement.lang);
  const L = (it, en) => (EN ? en : it);
  const LOCALE = EN ? "en-GB" : "it-IT";
  const nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0, useGrouping: "always" });
  const nf1 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: "always" });
  const nf2 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const COVID = new Set([2020, 2021]);
  const AREAS = ["Nord-ovest", "Nord-est", "Centro", "Sud", "Isole"];
  // nei dati le aree restano in italiano (servono da chiave): areaName() le scrive nella lingua della pagina
  const AREA_EN = { "Nord-ovest": "North-west", "Nord-est": "North-east", Centro: "Centre", Sud: "South", Isole: "Islands" };
  const areaName = (a) => (EN ? AREA_EN[a] || a : a);
  // i nomi dei reati in inglese, per id: start() li mette al posto di quelli di data/vc.json sulle pagine in en/
  const TYPE_EN = {
    TOT: "All crimes", THEFT: "Thefts (all)", BURGTHEF: "Home burglaries", PICKTHEF: "Pickpocketing", BAGTHEF: "Bag snatching",
    SHOPTHEF: "Shoplifting", CARTHEF: "Car thefts", VEHITHEF: "Thefts from parked cars", ROBBER: "Robberies (all)",
    STREETROB: "Street robberies", HOUSEROB: "Home robberies", SHOPROB: "Shop robberies", INTENHOM: "Intentional homicides",
    ATTEMPHOM: "Attempted homicides", CULPINJU: "Assaults causing injury", BLOWS: "Assaults without injury", MENACE: "Threats",
    RAPE: "Sexual violence", SWINCYB: "Fraud and online fraud", CYBERCRIM: "Cybercrime", EXTORT: "Extortion",
    USURY: "Loan sharking", RECEIV: "Handling stolen goods", DAMAGE: "Criminal damage", DRUG: "Drug offences",
  };
  // sottotipi: quando città e anno coincidono, l'impennata del sottotipo vale più di quella della voce madre
  const PARENT = { BURGTHEF: "THEFT", PICKTHEF: "THEFT", BAGTHEF: "THEFT", SHOPTHEF: "THEFT", CARTHEF: "THEFT", VEHITHEF: "THEFT", STREETROB: "ROBBER", HOUSEROB: "ROBBER", SHOPROB: "ROBBER" };
  // Icone dei reati, monocromatiche, dal set Lucide 1.49.0 (licenza ISC, lucide.dev): solo le forme, colore dal testo.
  // Per i reati contro la persona simboli sobri: una persona barrata, un battito, una mano aperta.
  const ICONS = {
    THEFT: '<path d="M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4"/> <path d="M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/> <path d="M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5"/> <path d="M6 14a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/> <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0"/>',
    BURGTHEF: '<path d="M10 21H2"/> <path d="M10 3H7a2 2 0 00-2 2v16"/> <path d="M14 12h.01"/> <path d="M19 21V5a2 2 0 00-1.675-1.974l-6.163-1.013A1 1 0 0010 3v18a1 1 0 001.124.992z"/> <path d="M22 21h-3"/>',
    PICKTHEF: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/> <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    BAGTHEF: '<path d="M2.048 18.566A2 2 0 0 0 4 21h16a2 2 0 0 0 1.952-2.434l-2-9A2 2 0 0 0 18 8H6a2 2 0 0 0-1.952 1.566z"/> <path d="M8 11V6a4 4 0 0 1 8 0v5"/>',
    SHOPTHEF: '<path d="m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18"/> <path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25"/> <circle cx="18" cy="20" r="2"/> <circle cx="8" cy="20" r="2"/>',
    CARTHEF: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/> <circle cx="7" cy="17" r="2"/> <path d="M9 17h6"/> <circle cx="17" cy="17" r="2"/>',
    VEHITHEF: '<circle cx="12" cy="12" r="10"/> <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
    ROBBER: '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/> <path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/> <path d="M21 12h1"/> <path d="M18.5 4.5 18 5"/> <path d="M2 12h1"/> <path d="M12 2v1"/> <path d="m4.929 4.929.707.707"/> <path d="M12 12v6"/>',
    STREETROB: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/> <circle cx="12" cy="10" r="3"/>',
    HOUSEROB: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/> <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    SHOPROB: '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/> <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/> <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>',
    INTENHOM: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/> <circle cx="9" cy="7" r="4"/> <line x1="17" x2="22" y1="8" y2="13"/> <line x1="22" x2="17" y1="8" y2="13"/>',
    ATTEMPHOM: '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/> <path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
    CULPINJU: '<path d="M10 10.01h.01"/> <path d="M10 14.01h.01"/> <path d="M14 10.01h.01"/> <path d="M14 14.01h.01"/> <path d="M18 6v12"/> <path d="M6 6v12"/> <rect x="2" y="6" width="20" height="12" rx="2"/>',
    BLOWS: '<path d="M12.035 17.012a3 3 0 0 0-3-3l-.311-.002a.72.72 0 0 1-.505-1.229l1.195-1.195A2 2 0 0 1 10.828 11H12a2 2 0 0 0 0-4H9.243a3 3 0 0 0-2.122.879l-2.707 2.707A4.83 4.83 0 0 0 3 14a8 8 0 0 0 8 8h2a8 8 0 0 0 8-8V7a2 2 0 1 0-4 0v2a2 2 0 1 0 4 0"/> <path d="M13.888 9.662A2 2 0 0 0 17 8V5A2 2 0 1 0 13 5"/> <path d="M9 5A2 2 0 1 0 5 5V10"/> <path d="M9 7V4A2 2 0 1 1 13 4V7.268"/>',
    MENACE: '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/> <path d="M12 15h.01"/> <path d="M12 7v4"/>',
    RAPE: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/> <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/> <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/> <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    SWINCYB: '<rect width="20" height="14" x="2" y="5" rx="2"/> <line x1="2" x2="22" y1="10" y2="10"/> <path d="M6 14h2"/>',
    CYBERCRIM: '<path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z"/> <path d="M20.054 15.987H3.946"/>',
    EXTORT: '<path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/> <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/> <path d="m2 16 6 6"/> <circle cx="16" cy="9" r="2.9"/> <circle cx="6" cy="5" r="3"/>',
    USURY: '<line x1="19" x2="5" y1="5" y2="19"/> <circle cx="6.5" cy="6.5" r="2.5"/> <circle cx="17.5" cy="17.5" r="2.5"/>',
    RECEIV: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/> <path d="M12 22V12"/> <polyline points="3.29 7 12 12 20.71 7"/> <path d="m7.5 4.27 9 5.15"/>',
    DAMAGE: '<path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/> <path d="m18 15 4-4"/> <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
    DRUG: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/> <path d="m8.5 8.5 7 7"/>',
  };
  const iconSVG = (id) => (ICONS[id] ? `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[id]}</svg>` : "");
  // Che cosa conta ogni voce, in parole semplici: il fatto, non la definizione del codice penale.
  const GLOSS = {
    THEFT: "prendere una cosa che appartiene ad altri, senza violenza sulle persone",
    BURGTHEF: "furti dentro una casa, anche quando non c’è nessuno",
    PICKTHEF: "furti dalla tasca o dalla borsa, senza che la vittima se ne accorga",
    BAGTHEF: "strappare di mano o di dosso una borsa, una collana, un telefono",
    SHOPTHEF: "merce presa in un negozio senza pagarla",
    CARTHEF: "furto dell’intera automobile",
    VEHITHEF: "furto di oggetti lasciati in un’auto parcheggiata, o di sue parti",
    ROBBER: "prendere qualcosa a qualcuno con la violenza o con la minaccia",
    STREETROB: "rapine per strada o in altri luoghi pubblici",
    HOUSEROB: "rapine dentro casa, con le persone presenti",
    SHOPROB: "rapine in negozi, bar e altri esercizi commerciali",
    INTENHOM: "uccidere una persona volontariamente",
    ATTEMPHOM: "cercare di uccidere una persona, senza riuscirci",
    CULPINJU: "ferire volontariamente una persona, causandole una lesione o una malattia",
    BLOWS: "colpire una persona senza causarle lesioni",
    MENACE: "minacciare a qualcuno un danno ingiusto",
    RAPE: "atti sessuali imposti con la violenza, la minaccia o l’abuso di autorità; sono tra i reati che si denunciano meno",
    SWINCYB: "ottenere soldi o beni con l’inganno: di persona, al telefono o online",
    CYBERCRIM: "entrare senza permesso in computer, telefoni o account, danneggiarli o spiarne le comunicazioni",
    EXTORT: "costringere qualcuno a pagare o a dare qualcosa con la violenza o la minaccia, compreso il pizzo",
    USURY: "prestare denaro a interessi illegalmente alti",
    RECEIV: "comprare, ricevere o nascondere soldi o oggetti di provenienza illecita, per esempio rubati",
    DAMAGE: "distruggere o rovinare cose di altri, per esempio beni pubblici",
    DRUG: "produzione, spaccio e traffico di droga; i numeri dipendono molto da quanti controlli fanno le forze dell’ordine",
  };
  if (EN) Object.assign(GLOSS, {
    THEFT: "taking something that belongs to someone else, without violence against people",
    BURGTHEF: "thefts inside a home, even when nobody is in",
    PICKTHEF: "thefts from a pocket or a bag, without the victim noticing",
    BAGTHEF: "snatching a bag, a necklace or a phone out of someone’s hand or off their body",
    SHOPTHEF: "goods taken from a shop without paying",
    CARTHEF: "theft of the whole car",
    VEHITHEF: "theft of things left in a parked car, or of its parts",
    ROBBER: "taking something from someone with violence or threats",
    STREETROB: "robberies in the street or in other public places",
    HOUSEROB: "robberies inside a home, with people present",
    SHOPROB: "robberies in shops, bars and other businesses",
    INTENHOM: "killing a person on purpose",
    ATTEMPHOM: "trying to kill a person, without succeeding",
    CULPINJU: "deliberately hurting a person, causing an injury or an illness",
    BLOWS: "hitting a person without causing an injury",
    MENACE: "threatening someone with unjust harm",
    RAPE: "sexual acts imposed through violence, threats or abuse of authority; among the least reported crimes",
    SWINCYB: "getting money or goods through deception: in person, on the phone or online",
    CYBERCRIM: "breaking into computers, phones or accounts without permission, damaging them or spying on their communications",
    EXTORT: "forcing someone to pay or hand something over through violence or threats, including protection money (pizzo)",
    USURY: "lending money at illegally high interest",
    RECEIV: "buying, receiving or hiding money or goods of illegal origin, stolen goods for example",
    DAMAGE: "destroying or damaging other people’s property, public property for example",
    DRUG: "producing, dealing and trafficking drugs; the numbers depend heavily on how many checks the police carry out",
  });
  // città dove ogni giorno arrivano molti pendolari e turisti: il tasso sui residenti le fa sembrare più a rischio di quanto siano
  const TOURIST = ["Milano", "Firenze", "Bologna", "Rimini", "Venezia", "Roma", "Torino"];
  const TOURIST_GROUPS = ["Totale", "Furti", "Rapine"];
  const TOURIST_NOT = ["BURGTHEF", "HOUSEROB"]; // furti e rapine in casa: le vittime sono i residenti
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // Gli approfondimenti stanno una cartella più in basso e usano questo stesso file: i dati si cercano accanto a vc.js,
  // non accanto alla pagina. Ogni pagina ha solo alcune sezioni, e has() dice se una c'è.
  const ROOT = (() => { try { return new URL(".", document.currentScript.src).href; } catch (e) { return ""; } })();
  // le pagine nella lingua del lettore: i link a una pagina del sito si scrivono su PAGES, i dati si leggono da ROOT
  const PAGES = ROOT + (EN ? "en/" : "");
  const has = (id) => !!document.getElementById(id);

  let Y, LAST, TYPES, TYPE, CITIES, ITALY, TOPO, META;
  // Ogni sezione ha il suo stato e cambia solo sé stessa: reato e anno di confronto della mappa, reato della griglia,
  // reato e anno della scheda aperta, periodo di «Cosa sale e cosa scende» (dal 2014 o dal 2019). L'apertura e le
  // domande frequenti guardano sempre tutti i delitti confrontati con il 2019 (REF).
  const REF = 2019;
  const state = { mapType: "TOT", mapBase: REF, gridType: "TOT", cardType: "TOT", cardBase: REF, mixBase: REF, sort: "level", scale: "shared", spikeYear: 2024, spikeSort: "rel", spikeShown: 8, gridShown: 12, city: null, place: null, treeYear: null, rimpYear: null, qLayer: "pop", qSel: null, autoriType: "TOT", minoriType: "TOT" };
  let CARCERI = null;
  let PROVP = null; // province con percezione e tassi (data/province.json), solo per l'approfondimento sulla percezione
  let RIMP = null, WORLD = null;
  let AUTORI = null; // delitti con autore noto (data/autori.json), per il suo approfondimento e la sua scheda
  let MINORI = null; // minorenni denunciati e arrestati (data/minori.json), idem
  // tutti i comuni (data/comuni.json) e le province (data/province.json): caricati alla prima ricerca
  let PROV = null, PROV_META = null, UNITS = null, INDEX = [], CITY_PROV = {}, placesPromise = null, placesFailed = false;

  // ------------------------------------------------------------------ formati

  function fmtRate(v) {
    if (v == null || !isFinite(v)) return "–";
    if (v >= 100) return nf0.format(v);
    if (v >= 10) return nf1.format(v);
    return nf2.format(v);
  }
  function fmtPct(p) {
    if (p == null || !isFinite(p)) return "–";
    const v = Math.round(p * 100);
    if (v === 0) return "0%";
    return (v > 0 ? "+" : "−") + nf0.format(Math.abs(v)) + "%";
  }
  const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]);

  // ------------------------------------------------------------------ statistica

  // Confronto tra due tassi di Poisson: rapporto tra tassi, z sul logaritmo e intervallo al 95%.
  function rrTest(n1, p1, n0, p0) {
    if (n1 == null || n0 == null || !p1 || !p0) return null;
    const a = Math.max(n1, 0.5), b = Math.max(n0, 0.5);
    const rr = (a / p1) / (b / p0);
    const se = Math.sqrt(1 / a + 1 / b);
    const lr = Math.log(rr);
    return {
      rr, z: lr / se,
      pct: n0 > 0 ? (n1 / p1) / (n0 / p0) - 1 : null,
      low: Math.exp(lr - 1.96 * se), high: Math.exp(lr + 1.96 * se),
    };
  }

  // Per ogni anno: confronto con i (fino a) tre anni precedenti, esclusi 2020 e 2021.
  // Vale per qualsiasi serie di conteggi e popolazione sugli anni dati (città, province, quartieri).
  function anomaliesSeries(n, p, years) {
    const out = [];
    for (let i = 0; i < years.length; i++) {
      const y = years[i];
      if (COVID.has(y) || n[i] == null || !p[i]) { out.push(null); continue; }
      const base = [];
      for (let j = i - 1; j >= 0 && base.length < 3; j--) if (!COVID.has(years[j]) && n[j] != null && p[j]) base.push(j);
      if (base.length < 2) { out.push(null); continue; }
      const bc = d3.sum(base, (j) => n[j]), bp = d3.sum(base, (j) => p[j]);
      const r = rrTest(n[i], p[i], bc, bp);
      const avg = bc / base.length;
      let flag = null;
      if (r.z >= 3 && r.rr >= 1.25 && n[i] >= 20) flag = "spike";
      else if (r.z <= -3 && r.rr <= 0.8 && avg >= 20) flag = "fall";
      out.push({ y, i, flag, rr: r.rr, z: r.z, low: r.low, high: r.high, n: n[i], avg, baseYears: base.map((j) => years[j]).sort() });
    }
    return out;
  }
  const anomalies = (c, t) => anomaliesSeries(c.n[t], c.pop, Y);

  const series = (c, t) => c.n[t].map((n, i) => (n == null || !c.pop[i] ? null : (n / c.pop[i]) * 1e5));

  function windowRateSeries(n, p, i0, i1) {
    let sn = 0, sp = 0;
    for (let i = i0; i <= i1; i++) { if (n[i] == null || !p[i]) return null; sn += n[i]; sp += p[i]; }
    return (sn / sp) * 1e5;
  }
  const windowRate = (c, t, i0, i1) => windowRateSeries(c.n[t], c.pop, i0, i1);

  const cache = new Map();
  function model(t, base = REF) {
    const key = t + "|" + base;
    if (cache.has(key)) return cache.get(key);
    const iB = Y.indexOf(base);
    const rare = TYPE[t].rare;
    const rows = CITIES.map((c) => {
      const s = series(c, t);
      const lvl = rare ? windowRate(c, t, LAST - 2, LAST) : s[LAST];
      const nl = rare ? d3.sum(c.n[t].slice(LAST - 2)) : c.n[t][LAST];
      const cmp = rrTest(c.n[t][LAST], c.pop[LAST], c.n[t][iB], c.pop[iB]);
      const an = anomalies(c, t);
      const spikes = an.filter((a) => a && a.flag === "spike");
      return { c, s, lvl, nl, cmp, an, spikes, lastSpike: spikes.length ? spikes[spikes.length - 1] : null };
    });
    const ranked = rows.filter((r) => r.lvl != null).sort((a, b) => b.lvl - a.lvl);
    // pari merito: stessa posizione (1, 2, 2, 4…)
    ranked.forEach((r, i) => (r.rank = i > 0 && r.lvl === ranked[i - 1].lvl ? ranked[i - 1].rank : i + 1));
    const it = ITALY.rate[t];
    const m = {
      t, base, rows, ranked, it, rare,
      itLvl: rare ? d3.mean(it.slice(LAST - 2)) : it[LAST],
      max: d3.max(rows, (r) => d3.max(r.s)),
      label: TYPE[t].label,
      levelNote: rare ? L("media 2022–2024", "2022–2024 average") : "2024",
    };
    cache.set(key, m);
    return m;
  }

  function sig(cmp) {
    if (!cmp || cmp.pct == null) return "";
    if (cmp.z == null) return "nd"; // tassi provinciali senza conteggi: nessun test possibile
    if (Math.abs(cmp.z) < 2) return "flat";
    return cmp.pct > 0 ? "up" : "down";
  }
  function chgHTML(cmp) {
    const s = sig(cmp) || "nd";
    const ndText = cmp && cmp.pct != null
      ? (EN
        ? `${cmp.win ? "Rare crime: " + cmp.win + ", " : ""}change calculated from the official rates, without a statistical test`
        : `${cmp.win ? "Reato raro: " + cmp.win + ", " : ""}variazione calcolata sui tassi ufficiali, senza test statistico`)
      : L("Variazione non calcolabile: nessun caso o nessun dato nell’anno di confronto", "Change cannot be calculated: no cases or no data in the comparison year");
    const title = s === "flat" ? L(' title="Variazione non significativa"', ' title="Change not significant"') : s === "nd" ? ` title="${ndText}"` : "";
    return `<span class="chg ${s}"${title}>${fmtPct(cmp && cmp.pct)}</span>`;
  }
  function divColor(cmp) {
    const s = sig(cmp);
    if (!s || s === "flat") return css("--mid");
    const k = Math.min(1, Math.abs(cmp.pct) / 0.6);
    return d3.interpolateLab(css("--mid"), css(s === "up" ? "--rise" : "--fall"))(0.35 + 0.65 * k);
  }

  // ------------------------------------------------------------------ tooltip

  const tip = $("#tip");
  function showTip(html, ev) { tip.innerHTML = html; tip.classList.add("on"); moveTip(ev); }
  function moveTip(ev) {
    const pad = 14;
    const r = tip.getBoundingClientRect();
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }
  function hideTip() { tip.classList.remove("on"); }

  // ------------------------------------------------------------------ ingresso dei grafici

  // Ogni grafico resta nascosto (data-reveal="pending") finché non entra nello schermo, poi si anima una volta
  // (data-reveal="on") e torna statico; le animazioni sono in vc.css. Il contenitore ricorda di essersi già mostrato,
  // così i ridisegni dopo un comando non ripartono da capo. --i è l'ordine tra gli elementi comparsi insieme.
  // Con prefers-reduced-motion o senza IntersectionObserver non succede niente: i grafici compaiono e basta.
  const RV_MS = 3200;
  const stillMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const revealer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    const k = new Map();
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, host = el._rvHost || el;
      revealer.unobserve(el);
      host._rvShown = true;
      const i = k.get(host) || 0;
      k.set(host, i + 1);
      // tetto all'ordine: su uno schermo alto compaiono insieme decine di riquadri, e l'ultimo deve partire comunque entro RV_MS
      el.style.setProperty("--i", Math.min(i, 36));
      el.dataset.reveal = "on";
      setTimeout(() => { if (el.dataset.reveal === "on") { delete el.dataset.reveal; el.style.removeProperty("--i"); } }, RV_MS);
    });
  }, { rootMargin: "0px 0px -8% 0px" }) : null;
  function reveal(host, items) {
    if (!revealer || stillMotion.matches || host._rvShown) return;
    (host._rvItems || []).forEach((el) => revealer.unobserve(el));
    host._rvItems = items ? Array.from(items) : [host];
    host._rvItems.forEach((el) => { el._rvHost = host; el.dataset.reveal = "pending"; revealer.observe(el); });
  }

  // ------------------------------------------------------------------ grafici

  // Sparkline: serie della città, riferimento Italia, banda Covid, impennate in oro.
  function drawSpark(svgNode, o) {
    const w = o.w, h = o.h;
    const pad = o.pad || { t: 6, r: 6, b: 4, l: 2 };
    const svg = d3.select(svgNode).classed("spark", true).attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h);
    svg.selectAll("*").remove();
    const x = d3.scaleLinear([Y[0], Y[LAST]], [pad.l, w - pad.r]);
    const y = d3.scaleLinear([0, o.yMax || 1], [h - pad.b, pad.t]);
    const step = x(Y[1]) - x(Y[0]);
    svg.append("rect").attr("x", x(2020) - step / 2).attr("width", step * 2).attr("y", pad.t - 4).attr("height", h - pad.t - pad.b + 4).style("fill", "var(--covid)");
    svg.append("line").attr("x1", pad.l).attr("x2", w - pad.r).attr("y1", y(0)).attr("y2", y(0)).style("stroke", "var(--rule)");
    const line = d3.line().defined((d) => d != null).x((d, i) => x(Y[i])).y((d) => y(Math.min(d, o.yMax))).curve(d3.curveLinear);
    if (o.italy) svg.append("path").attr("class", "rv-fade").attr("d", line(o.italy)).style("fill", "none").style("stroke", "var(--muted)").style("stroke-width", 1.25);
    svg.append("path").attr("class", "rv-draw").attr("pathLength", 1).attr("d", line(o.values)).style("fill", "none").style("stroke", "var(--ink)").style("stroke-width", 1.75).style("stroke-linejoin", "round").style("stroke-linecap", "round");
    if (o.an) {
      o.an.forEach((a) => {
        if (!a || !a.flag || o.values[a.i] == null) return;
        const g = svg.append("circle").attr("class", "rv-pop").attr("cx", x(a.y)).attr("cy", y(Math.min(o.values[a.i], o.yMax)));
        if (a.flag === "spike") g.attr("r", 4).style("fill", "var(--gold)").style("stroke", "var(--surface)").style("stroke-width", 1.5);
        else g.attr("r", 3).style("fill", "var(--surface)").style("stroke", "var(--fall)").style("stroke-width", 1.5);
      });
    }
    const lv = o.values[LAST];
    if (lv != null && !(o.an && o.an[LAST] && o.an[LAST].flag)) {
      svg.append("circle").attr("class", "rv-pop").attr("cx", x(Y[LAST])).attr("cy", y(Math.min(lv, o.yMax))).attr("r", 2.5).style("fill", "var(--ink)");
    }
    if (o.hover) {
      const dot = svg.append("circle").attr("r", 3.5).style("fill", "var(--ink)").style("stroke", "var(--surface)").style("stroke-width", 1.5).style("display", "none");
      svg.append("rect").attr("width", w).attr("height", h).style("fill", "transparent")
        .on("mousemove", (ev) => {
          const [mx] = d3.pointer(ev);
          const i = Math.max(0, Math.min(LAST, Math.round((x.invert(mx) - Y[0]))));
          const v = o.values[i];
          if (v == null) { dot.style("display", "none"); hideTip(); return; }
          dot.style("display", null).attr("cx", x(Y[i])).attr("cy", y(Math.min(v, o.yMax)));
          showTip(o.hover(i), ev);
        })
        .on("mouseleave", () => { dot.style("display", "none"); hideTip(); });
    }
  }

  // Grafico a linea con assi, per il quadro nazionale e la sezione percezione.
  function lineChart(el, o) {
    const w = Math.max(280, el.clientWidth);
    const h = o.height || 220;
    const m = { t: 14, r: o.mr || 54, b: 24, l: o.ml || 44 };
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h);
    svg.selectAll("*").remove();
    const x = d3.scaleLinear(o.xDomain, [m.l, w - m.r]);
    const y = d3.scaleLinear([o.yMin ?? 0, o.yMax], [h - m.b, m.t]).nice(4);
    if (o.covid) {
      const step = x(2007) - x(2006);
      svg.append("rect").attr("x", x(2020) - step / 2).attr("width", step * 2).attr("y", m.t).attr("height", h - m.t - m.b).style("fill", "var(--covid)");
      svg.append("text").attr("class", "lbl").attr("x", x(2020.5)).attr("y", m.t + 10).attr("text-anchor", "middle").text("Covid");
    }
    const ya = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(-(w - m.l - m.r)).tickFormat((v) => (o.yFmt ? o.yFmt(v) : nf0.format(v))));
    ya.select(".domain").remove();
    ya.selectAll(".tick line").style("stroke", "var(--grid)");
    const xa = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`)
      .call(d3.axisBottom(x).tickValues(o.xTicks).tickFormat(d3.format("d")).tickSize(4));
    xa.select(".domain").style("stroke", "var(--rule)");
    const pts = o.years.map((yr, i) => [yr, o.values[i]]).filter((d) => d[1] != null);
    const line = d3.line().x((d) => x(d[0])).y((d) => y(d[1]));
    if (o.area) {
      const area = d3.area().x((d) => x(d[0])).y0(y.range()[0]).y1((d) => y(d[1]));
      svg.append("path").attr("class", "area rv-fade").attr("d", area(pts)).style("fill", o.color || "var(--ink)").style("fill-opacity", 0.08);
    }
    svg.append("path").attr("class", "rv-draw").attr("pathLength", 1).attr("d", line(pts)).style("fill", "none").style("stroke", o.color || "var(--ink)").style("stroke-width", 2).style("stroke-linejoin", "round").style("stroke-linecap", "round");
    (o.marks || []).forEach((mk) => {
      const v = o.values[o.years.indexOf(mk.year)];
      if (v == null) return;
      svg.append("circle").attr("class", "mark rv-pop").attr("cx", x(mk.year)).attr("cy", y(v)).attr("r", mk.gold ? 5.5 : 4.5)
        .style("fill", mk.hollow ? "var(--surface)" : mk.gold ? "var(--gold)" : "var(--ink)").style("stroke", mk.hollow ? "var(--ink)" : "var(--surface)").style("stroke-width", 2);
      svg.append("text").attr("class", (mk.strong ? "lbl-strong halo" : "lbl halo") + " mark rv-fade")
        .attr("x", x(mk.year) + (mk.dx || 0)).attr("y", y(v) + (mk.dy || -10)).attr("text-anchor", mk.anchor || "middle").text(mk.text);
    });
    if (o.hover) {
      const guide = svg.append("line").attr("y1", m.t).attr("y2", h - m.b).style("stroke", "var(--rule)").style("display", "none");
      const dot = svg.append("circle").attr("r", 4).style("fill", "var(--ink)").style("stroke", "var(--surface)").style("stroke-width", 2).style("display", "none");
      svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", w - m.l - m.r).attr("height", h - m.t - m.b).style("fill", "transparent")
        .on("mousemove", (ev) => {
          const [mx] = d3.pointer(ev);
          const yr = Math.round(x.invert(mx));
          const i = o.years.indexOf(yr);
          if (i < 0 || o.values[i] == null) { guide.style("display", "none"); dot.style("display", "none"); hideTip(); return; }
          guide.style("display", null).attr("x1", x(yr)).attr("x2", x(yr));
          dot.style("display", null).attr("cx", x(yr)).attr("cy", y(o.values[i]));
          showTip(o.hover(i), ev);
        })
        .on("mouseleave", () => { guide.style("display", "none"); dot.style("display", "none"); hideTip(); });
    }
    reveal(el);
    return { x, y, svg };
  }

  // Più linee sullo stesso asse, per la scheda: il territorio cercato in nero, il confronto tratteggiato, l'Italia in grigio.
  function multiLine(el, o) {
    const w = Math.max(280, el.clientWidth);
    const h = o.height || (w < 480 ? 190 : 230);
    const m = { t: 14, r: 14, b: 24, l: 46 };
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", o.label);
    svg.selectAll("*").remove();
    const x = d3.scaleLinear([Y[0], Y[LAST]], [m.l, w - m.r]);
    const all = o.series.flatMap((s) => s.values).filter((v) => v != null);
    const y = d3.scaleLinear([0, (d3.max(all) || 1) * 1.08], [h - m.b, m.t]).nice(4);
    const step = x(Y[1]) - x(Y[0]);
    svg.append("rect").attr("x", x(2020) - step / 2).attr("width", step * 2).attr("y", m.t).attr("height", h - m.t - m.b).style("fill", "var(--covid)");
    svg.append("text").attr("class", "lbl").attr("x", x(2020.5)).attr("y", m.t + 10).attr("text-anchor", "middle").text("Covid");
    const ya = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(-(w - m.l - m.r)).tickFormat((v) => nf0.format(v)));
    ya.select(".domain").remove();
    ya.selectAll(".tick line").style("stroke", "var(--grid)");
    const xa = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`)
      .call(d3.axisBottom(x).tickValues(w < 420 ? [2006, 2012, 2018, 2024] : [2006, 2010, 2015, 2020, 2024]).tickFormat(d3.format("d")).tickSize(4));
    xa.select(".domain").style("stroke", "var(--rule)");
    const line = d3.line().defined((d) => d != null).x((d, i) => x(Y[i])).y((d) => y(d));
    o.series.slice().reverse().forEach((s) => {
      svg.append("path").attr("class", s === o.series[0] && !s.dash ? "rv-draw" : "rv-fade").attr("pathLength", s === o.series[0] && !s.dash ? 1 : null)
        .attr("d", line(s.values)).style("fill", "none").style("stroke", s.color).style("stroke-width", s.width)
        .style("stroke-dasharray", s.dash || null).style("stroke-linejoin", "round").style("stroke-linecap", "round");
    });
    const main = o.series[0].values;
    (o.an || []).forEach((a) => {
      if (!a || !a.flag || main[a.i] == null) return;
      const c = svg.append("circle").attr("class", "mark rv-pop").attr("cx", x(a.y)).attr("cy", y(main[a.i]));
      if (a.flag === "spike") c.attr("r", 4.5).style("fill", "var(--gold)").style("stroke", "var(--surface)").style("stroke-width", 1.5);
      else c.attr("r", 3.5).style("fill", "var(--surface)").style("stroke", "var(--fall)").style("stroke-width", 1.5);
    });
    if (main[LAST] != null) {
      svg.append("circle").attr("class", "mark rv-pop").attr("cx", x(Y[LAST])).attr("cy", y(main[LAST])).attr("r", 3.5).style("fill", "var(--ink)").style("stroke", "var(--surface)").style("stroke-width", 1.5);
      svg.append("text").attr("class", "lbl-strong halo mark rv-fade").attr("x", x(Y[LAST])).attr("y", y(main[LAST]) - 9).attr("text-anchor", "end").text(fmtRate(main[LAST]));
    }
    const guide = svg.append("line").attr("y1", m.t).attr("y2", h - m.b).style("stroke", "var(--rule)").style("display", "none");
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", w - m.l - m.r).attr("height", h - m.t - m.b).style("fill", "transparent")
      .on("mousemove", (ev) => {
        const [mx] = d3.pointer(ev);
        const i = Math.max(0, Math.min(LAST, Math.round(x.invert(mx) - Y[0])));
        if (o.series.every((s) => s.values[i] == null)) { guide.style("display", "none"); hideTip(); return; }
        guide.style("display", null).attr("x1", x(Y[i])).attr("x2", x(Y[i]));
        showTip(`<b>${Y[i]}</b>${COVID.has(Y[i]) ? " · Covid" : ""}<br>` + o.series.map((s) => `${esc(s.name)}: ${fmtRate(s.values[i])}`).join("<br>") + (o.extra ? o.extra(i) : ""), ev);
      })
      .on("mouseleave", () => { guide.style("display", "none"); hideTip(); });
  }

  // ------------------------------------------------------------------ grafici degli approfondimenti

  // Più serie su anni qualsiasi: o.series = [{ name, values, color, width, dash, at, dy, anchor }], allineate a o.years.
  // Il nome di ogni serie sta sopra la sua linea (nel primo anno, o nell'anno at; label: false lo toglie, se c'è una legenda),
  // il valore finale in grassetto accanto all'ultimo punto. Con o.gap lo spazio tra le prime due serie è ombreggiato,
  // con o.ref c'è una linea tratteggiata di riferimento (100 negli indici).
  const yearTicks = (a, b) => [a, ...d3.range(Math.ceil((a + 3) / 5) * 5, b - 2, 5), b];
  function seriesChart(el, o) {
    const yrs = o.years, L = yrs.length - 1, fmt = o.fmt || ((v) => nf0.format(v));
    const w = Math.max(280, el.clientWidth), h = o.height || (w < 480 ? 210 : 250);
    const m = { t: 18, r: o.mr ?? 18, b: 24, l: o.ml || 48 };
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", o.label || "");
    svg.selectAll("*").remove();
    const x = d3.scaleLinear([yrs[0], yrs[L]], [m.l, w - m.r]);
    const all = o.series.flatMap((s) => s.values).filter((v) => v != null);
    const y = d3.scaleLinear([o.yMin ?? 0, o.yMax ?? d3.max(all) * 1.12], [h - m.b, m.t]).nice(4);
    const step = x(yrs[1]) - x(yrs[0]);
    if (o.covid && yrs.includes(2020) && yrs.includes(2021)) {
      svg.append("rect").attr("x", x(2020) - step / 2).attr("width", step * 2).attr("y", m.t).attr("height", h - m.t - m.b).style("fill", "var(--covid)");
      svg.append("text").attr("class", "lbl").attr("x", x(2020.5)).attr("y", m.t + 10).attr("text-anchor", "middle").text("Covid");
    }
    const ya = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(-(w - m.l - m.r)).tickFormat((v) => (o.yFmt ? o.yFmt(v) : nf0.format(v))));
    ya.select(".domain").remove();
    ya.selectAll(".tick line").style("stroke", "var(--grid)");
    const xa = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`)
      .call(d3.axisBottom(x).tickValues(o.xTicks || yearTicks(yrs[0], yrs[L])).tickFormat(d3.format("d")).tickSize(4));
    xa.select(".domain").style("stroke", "var(--rule)");
    if (o.ref != null) svg.append("line").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y(o.ref)).attr("y2", y(o.ref)).style("stroke", "var(--ink-2)").style("stroke-dasharray", "2 3");
    const line = d3.line().defined((v) => v != null).x((_, i) => x(yrs[i])).y((v) => y(v));
    if (o.gap) {
      const [a, b] = o.series;
      svg.append("path").attr("class", "area rv-fade")
        .attr("d", d3.area().defined((_, i) => a.values[i] != null && b.values[i] != null).x((_, i) => x(yrs[i])).y0((_, i) => y(b.values[i])).y1((_, i) => y(a.values[i]))(yrs))
        .style("fill", "var(--muted)").style("fill-opacity", 0.1);
    }
    o.series.forEach((s, k) => {
      svg.append("path").attr("class", s.dash ? "rv-fade" : "rv-draw").attr("pathLength", s.dash ? null : 1).style("--t0", `${k * 0.15}s`).attr("d", line(s.values))
        .style("fill", "none").style("stroke", s.color).style("stroke-width", s.width || 2).style("stroke-dasharray", s.dash || null)
        .style("stroke-linejoin", "round").style("stroke-linecap", "round");
    });
    // etichette dopo tutte le linee, così l'alone le stacca da ognuna
    o.series.forEach((s) => {
      const idx = s.values.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) return;
      const iL = idx[idx.length - 1], iA = s.at != null ? yrs.indexOf(s.at) : -1, iN = iA >= 0 && s.values[iA] != null ? iA : idx[0];
      svg.append("circle").attr("class", "mark rv-pop").attr("cx", x(yrs[iL])).attr("cy", y(s.values[iL])).attr("r", 4).style("fill", s.color).style("stroke", "var(--surface)").style("stroke-width", 2);
      svg.append("text").attr("class", "lbl-strong halo mark rv-fade").attr("x", x(yrs[iL]) - 6).attr("y", y(s.values[iL]) + (s.dyEnd ?? -10)).attr("text-anchor", "end").text(fmt(s.values[iL]));
      if (s.name && s.label !== false) {
        svg.append("text").attr("class", "lbl halo mark rv-fade").attr("x", x(yrs[iN]) + (s.anchor === "middle" ? 0 : 4)).attr("y", y(s.values[iN]) + (s.dy ?? -10))
          .attr("text-anchor", s.anchor || "start").style("fill", s.color).text(s.name);
      }
    });
    const guide = svg.append("line").attr("y1", m.t).attr("y2", h - m.b).style("stroke", "var(--rule)").style("display", "none");
    const dots = o.series.map((s) => svg.append("circle").attr("r", 4).style("fill", s.color).style("stroke", "var(--surface)").style("stroke-width", 2).style("display", "none"));
    const off = () => { guide.style("display", "none"); dots.forEach((d) => d.style("display", "none")); hideTip(); };
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", w - m.l - m.r).attr("height", h - m.t - m.b).style("fill", "transparent")
      .on("mousemove", (ev) => {
        const i = yrs.indexOf(Math.round(x.invert(d3.pointer(ev)[0])));
        if (i < 0 || o.series.every((s) => s.values[i] == null)) { off(); return; }
        guide.style("display", null).attr("x1", x(yrs[i])).attr("x2", x(yrs[i]));
        o.series.forEach((s, k) => { const v = s.values[i]; dots[k].style("display", v == null ? "none" : null).attr("cx", x(yrs[i])).attr("cy", v == null ? 0 : y(v)); });
        showTip(o.tip ? o.tip(i) : `<b>${yrs[i]}</b><br>` + o.series.filter((s) => s.values[i] != null).map((s) => `${esc(s.tipName || s.name)}: ${fmt(s.values[i])}`).join("<br>"), ev);
      })
      .on("mouseleave", off);
    reveal(el);
    return { x, y, svg };
  }

  // Una griglia di piccoli grafici, ognuno con la propria scala: i paesi dei rimpatri, le cittadinanze dei detenuti.
  // o.lines(r) dà le linee di un riquadro, la prima è la principale: sotto ha la sua area o, con o.gap, l'ombra fino alla seconda.
  function sparkGrid(host, rows, o) {
    const yrs = o.years, L = yrs.length - 1;
    host.innerHTML = rows.map((r) => `<div class="sm"><span class="h">${o.head(r)}</span><svg aria-hidden="true"></svg><span class="x">${o.foot(r)}</span></div>`).join("");
    const panels = host.querySelectorAll(".sm");
    if (!panels.length) return;
    const w = panels[0].querySelector("svg").getBoundingClientRect().width || 150, h = 64, pad = { t: 6, r: 6, b: 4, l: 2 };
    const def = (v) => v != null;
    panels.forEach((el, k) => {
      const r = rows[k], lines = o.lines(r), [a, b] = lines;
      const svg = d3.select(el.querySelector("svg")).classed("spark", true).attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h);
      const x = d3.scaleLinear([yrs[0], yrs[L]], [pad.l, w - pad.r]);
      const yy = d3.scaleLinear([0, d3.max(lines.flatMap((l) => l.values), (v) => v || 0) || 1], [h - pad.b, pad.t]);
      const step = x(yrs[1]) - x(yrs[0]);
      if (yrs.includes(2020)) svg.append("rect").attr("x", x(2020) - step / 2).attr("width", step * 2).attr("y", pad.t - 4).attr("height", h - pad.t - pad.b + 4).style("fill", "var(--covid)");
      svg.append("line").attr("x1", pad.l).attr("x2", w - pad.r).attr("y1", yy(0)).attr("y2", yy(0)).style("stroke", "var(--rule)");
      const area = o.gap && b
        ? d3.area().defined((_, i) => def(a.values[i]) && def(b.values[i])).x((_, i) => x(yrs[i])).y0((_, i) => yy(a.values[i])).y1((_, i) => yy(b.values[i]))(yrs)
        : d3.area().defined(def).x((_, i) => x(yrs[i])).y0(yy(0)).y1((v) => yy(v))(a.values);
      svg.append("path").attr("class", "area rv-fade").attr("d", area).style("fill", o.gap ? "var(--muted)" : a.color).style("fill-opacity", o.gap ? 0.16 : 0.12);
      lines.slice().reverse().forEach((l) => {
        svg.append("path").attr("class", "rv-draw").attr("pathLength", 1).attr("d", d3.line().defined(def).x((_, i) => x(yrs[i])).y((v) => yy(v))(l.values))
          .style("fill", "none").style("stroke", l.color).style("stroke-width", l.width || 1.75).style("stroke-linejoin", "round");
      });
      const dots = lines.map((l) => svg.append("circle").attr("r", 3.5).style("fill", l.color).style("stroke", "var(--surface)").style("stroke-width", 1.5).style("display", "none"));
      const off = () => { dots.forEach((d) => d.style("display", "none")); hideTip(); };
      svg.append("rect").attr("width", w).attr("height", h).style("fill", "transparent")
        .on("mousemove", (ev) => {
          const i = Math.max(0, Math.min(L, Math.round(x.invert(d3.pointer(ev)[0]) - yrs[0])));
          if (lines.every((l) => l.values[i] == null)) { off(); return; }
          lines.forEach((l, j) => dots[j].style("display", l.values[i] == null ? "none" : null).attr("cx", x(yrs[i])).attr("cy", l.values[i] == null ? 0 : yy(l.values[i])));
          showTip(o.tip(r, i), ev);
        })
        .on("mouseleave", off);
    });
    reveal(host, panels);
  }

  // Cento quadratini per gruppo: quanti stranieri ogni 100 detenuti e ogni 100 residenti, uno accanto all'altro.
  function renderWaffle(el, groups) {
    el.innerHTML = groups.map((g) => {
      const n = Math.round(g.v);
      const cells = d3.range(100).map((i) => `<rect class="rv-pop${i < n ? " on" : ""}" style="--i:${i}" x="${(i % 10) * 10 + 0.75}" y="${Math.floor(i / 10) * 10 + 0.75}" width="8.5" height="8.5" rx="1.5"/>`).join("");
      return `<figure class="waffle"><svg viewBox="0 0 100 100" role="img" aria-label="${esc(g.aria)}">${cells}</svg><figcaption><span class="wv">${nf1.format(g.v)}<small> ${g.unit || L("stranieri", "foreign nationals")}</small></span><span class="wl">${g.label}</span></figcaption></figure>`;
    }).join("");
    reveal(el, el.querySelectorAll(".waffle"));
  }

  // ------------------------------------------------------------------ apertura

  function renderEyechart() {
    const tot = ITALY.rate.TOT;
    const iPeak = d3.maxIndex(tot);
    const i19 = Y.indexOf(2019);
    const hom = ITALY.n.INTENHOM, fr = ITALY.n.SWINCYB;
    const rows = EN ? [
      [nf0.format(tot[LAST]), `crimes reported per 100,000 residents in Italy in ${Y[LAST]}: about ${nf0.format(Math.round(tot[LAST] / 1000))} for every 100 people in a year`],
      [fmtPct(tot[LAST] / tot[iPeak] - 1), `compared with ${Y[iPeak]}, the year with the most reports per resident`],
      [fmtPct(tot[LAST] / tot[i19] - 1), `compared with 2019: after the collapse of 2020, reports have risen again`],
      [fmtPct(hom[LAST] / hom[0] - 1), `intentional homicides since ${Y[0]}: from ${nf0.format(hom[0])} to ${nf0.format(hom[LAST])} a year`],
      [fmtPct(fr[LAST] / fr[0] - 1), `fraud and online fraud since ${Y[0]}: from ${nf0.format(Math.round(fr[0] / 1000) * 1000)} to ${nf0.format(Math.round(fr[LAST] / 1000) * 1000)} reports`],
    ] : [
      [nf0.format(tot[LAST]), `delitti denunciati ogni 100.000 abitanti in Italia nel ${Y[LAST]}: circa ${nf0.format(Math.round(tot[LAST] / 1000))} ogni 100 persone in un anno`],
      [fmtPct(tot[LAST] / tot[iPeak] - 1), `rispetto al ${Y[iPeak]}, l’anno con più denunce per abitante`],
      [fmtPct(tot[LAST] / tot[i19] - 1), `rispetto al 2019: dopo il crollo del 2020 le denunce sono tornate a salire`],
      [fmtPct(hom[LAST] / hom[0] - 1), `omicidi volontari dal ${Y[0]}: da ${nf0.format(hom[0])} a ${nf0.format(hom[LAST])} l’anno`],
      [fmtPct(fr[LAST] / fr[0] - 1), `truffe e frodi informatiche dal ${Y[0]}: da ${nf0.format(Math.round(fr[0] / 1000))} mila a ${nf0.format(Math.round(fr[LAST] / 1000))} mila denunce`],
    ];
    $("#eyechart").innerHTML = rows.map(([f, c]) => `<li><span class="fig">${f}</span><span class="cap">${c}</span></li>`).join("");
  }

  // ------------------------------------------------------------------ domande frequenti

  // Le domande che chiunque si fa, nella pagina del progetto: una riga per domanda, la risposta in poche righe si apre al tocco. Ogni cifra viene dagli stessi calcoli
  // delle sezioni della home, confrontate con il 2019; carceri e rimpatri compaiono quando i loro dati sono arrivati. I link sono scritti come dalla home e si
  // risolvono sulla radice del sito (ROOT), così portano nello stesso posto da qualunque pagina.
  const shortLabel = (t) => lower(t.label.replace(/ \(.*\)$/, ""));
  // numeri che si leggono con la vocale davanti (uno, otto, undici, ottanta…): "dell’8%", "l’11%", "all’83° posto"
  const vowelNum = (n) => n === 1 || n === 11 || /^8/.test(String(n));
  const delPct = (p) => { const n = Math.round(Math.abs(p) * 100); return EN ? `by ${nf0.format(n)}%` : `${vowelNum(n) ? "dell’" : "del "}${nf0.format(n)}%`; };
  const moved = (p, m, f) => (Math.round(p * 100) === 0 ? L("rimasti uguali", "stayed the same") : `${p > 0 ? m : f} ${delPct(p)}`);
  // in inglese: 1st, 2nd, 3rd, 4th… 11th, 12th, 13th
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");

  function renderBrief() {
    const host = $("#brief");
    if (!host) return;
    const tot = ITALY.rate.TOT, iB = Y.indexOf(REF), tm = model("TOT");
    const cards = [];
    const card = (q, a, href, go) => cards.push(`<details class="faq-q rv-up"><summary><h3>${q}</h3></summary><div class="faq-a"><p>${a}</p><a class="go" href="${PAGES + href}">${go} <span aria-hidden="true">→</span></a></div></details>`);

    // cosa sale e cosa scende, in Italia
    const ch = TYPES.filter((t) => t.id !== "TOT").map((t) => ({ t, ch: ITALY.rate[t.id][LAST] / ITALY.rate[t.id][iB] - 1 })).filter((d) => isFinite(d.ch));
    const ups = ch.filter((d) => d.ch > 0.03).sort((a, b) => b.ch - a.ch).slice(0, 3);
    const downs = ch.filter((d) => d.ch < -0.03).sort((a, b) => a.ch - b.ch).slice(0, 3);
    const list = (l) => andList(l.map((d) => `${esc(shortLabel(d.t))} (${fmtPct(d.ch)})`));
    if (EN) card("Which crimes are rising, and which are falling?",
      `Between ${REF} and ${Y[LAST]}, crimes reported in Italy, taken together, have ${moved(tot[LAST] / tot[iB] - 1, "risen", "fallen")}. ` +
      (ups.length ? `The biggest rises were in reports of ${list(ups)}. ` : "") +
      (downs.length ? `The biggest falls were in reports of ${list(downs)}. ` : "") +
      `More reports do not always mean more crime: sometimes they mean that victims are reporting more${ups.some((d) => d.t.id === "RAPE") ? ", as can happen with sexual violence" : ""}.`,
      "#mix", `All ${TYPES.length - 1} crimes`);
    else card("Quali reati aumentano, e quali calano?",
      `Dal ${REF} al ${Y[LAST]} i delitti denunciati in Italia, tutti insieme, sono ${moved(tot[LAST] / tot[iB] - 1, "aumentati", "diminuiti")}. ` +
      (ups.length ? `Sono cresciute soprattutto le denunce per ${list(ups)}. ` : "") +
      (downs.length ? `Sono calate quelle per ${list(downs)}. ` : "") +
      `Più denunce non vuol dire sempre più reati: a volte vuol dire che le vittime denunciano di più${ups.some((d) => d.t.id === "RAPE") ? ", come può accadere per le violenze sessuali" : ""}.`,
      "#mix", `Tutti i ${TYPES.length - 1} reati`);

    // le città in cima alle classifiche
    const top = tm.ranked.slice(0, 3);
    if (top.length) {
      const tour = top.some((r) => TOURIST.includes(r.c.name));
      if (EN) card("Are the cities at the top of the rankings the most dangerous?",
        `Not necessarily. ${esc(andList(top.map((r) => r.c.name)))} have the most reports per resident: ${nf0.format(top[0].lvl)} per 100,000 in ${esc(top[0].c.name)}, ${nf0.format(tot[LAST])} in Italy as a whole. ` +
        (tour ? "But commuters, students and tourists arrive there every day: the crimes they suffer, or commit, are counted there, while they themselves are not counted among the residents. " : "") +
        "The rate tells you how much is reported in a city, not how much risk the people who live there face.",
        "#mappa", `The ranking of the ${CITIES.length} provincial capitals`);
      else card("Le città in cima alle classifiche sono le più pericolose?",
        `Non per forza. ${esc(andList(top.map((r) => r.c.name)))} hanno più denunce per abitante: ${nf0.format(top[0].lvl)} ogni 100.000 ${/^[Aa]/.test(top[0].c.name) ? "ad" : "a"} ${esc(top[0].c.name)}, ${nf0.format(tot[LAST])} in Italia. ` +
        (tour ? "Ma ogni giorno vi arrivano pendolari, studenti e turisti: i reati che subiscono, o commettono, si contano lì, mentre loro non sono contati tra i residenti. " : "") +
        "Il tasso dice quanto si denuncia in una città, non quanto rischia chi ci abita.",
        "#mappa", `La classifica dei ${CITIES.length} capoluoghi`);
    }

    // percezione e realtà
    const sy = Object.keys(ITALY.silc).map(Number).sort((a, b) => a - b), sv = sy.map((y) => ITALY.silc[y]);
    const ya = sy[d3.maxIndex(sv)], yb = sy[d3.minIndex(sv)], ylast = sy[sy.length - 1];
    if (sy.length && Y.includes(ya) && Y.includes(yb) && ya < yb) {
      const crime = tot[Y.indexOf(yb)] / tot[Y.indexOf(ya)] - 1, after = tot[LAST] / tot[Y.indexOf(yb)] - 1;
      const pts = CITIES.filter((c) => c.perc && c.perc["2024"] != null);
      const most = pts.length ? pts.reduce((p, q) => (q.perc["2024"] > p.perc["2024"] ? q : p)) : null;
      const mr = most && tm.rows.find((r) => r.c.id === most.id);
      if (EN) card("Do we feel as unsafe as we really are?",
        `No: fear moves much more than crime does. Between ${ya} and ${yb} the share of households reporting crime or vandalism in their area fell from ${nf1.format(ITALY.silc[ya])}% to ${nf1.format(ITALY.silc[yb])}%, while reported crimes per resident ${moved(crime, "rose", "fell")}. ` +
        (ylast > yb ? `In ${ylast} the share rose again to ${nf1.format(ITALY.silc[ylast])}%${Math.abs(after) < 0.05 ? ", with reports almost flat" : ""}. ` : "") +
        (mr && mr.rank ? `${esc(most.name)} is the large city where the most households feel their area is at risk of crime (${nf1.format(most.perc["2024"])}%), but for reported crimes it ranks ${ordinal(mr.rank)} of ${tm.ranked.length}.` : ""),
        "approfondimenti/percezione.html", "Perception and reality, the deep dive");
      else card("Ci sentiamo in pericolo quanto lo siamo?",
        `No: la paura si muove molto più dei reati. Tra il ${ya} e il ${yb} le famiglie che segnalano criminalità o vandalismo nella propria zona sono scese dal ${nf1.format(ITALY.silc[ya])}% al ${nf1.format(ITALY.silc[yb])}%, mentre i delitti denunciati per abitante sono ${moved(crime, "cresciuti", "calati")}. ` +
        (ylast > yb ? `Nel ${ylast} la quota è risalita al ${nf1.format(ITALY.silc[ylast])}%${Math.abs(after) < 0.05 ? ", con le denunce quasi ferme" : ""}. ` : "") +
        (mr && mr.rank ? `${esc(most.name)} è la grande città dove più famiglie sentono a rischio la propria zona (${nf1.format(most.perc["2024"])}%), ma per denunce è ${vowelNum(mr.rank) ? "all’" : "al "}${mr.rank}° posto su ${tm.ranked.length}.` : ""),
        "approfondimenti/percezione.html", "Percezione e realtà, l’approfondimento");
    }

    // stranieri in carcere
    if (CARCERI) {
      const C = CARCERI, Yc = C.meta.years, L = Yc.length - 1, last = C.meta.last;
      const share = (i) => (100 * C.serie.str[i]) / C.serie.tot[i];
      const ra = (C.residenti && C.residenti.anni) || {}, rk = [last, last - 1].find((y) => ra[String(y)]), res = rk ? ra[String(rk)] : null;
      const nonDef = (p) => (p.AWFJ + p.APP + p.REC + p.MWOD) / Object.values(p).reduce((a, b) => a + b, 0);
      if (EN) card("Do foreign nationals commit more crimes than Italians?",
        `These figures are not enough to tell. At the end of ${last} foreign nationals made up ${nf1.format(share(L))}% of prisoners (${nf1.format(share(0))}% in ${Yc[0]})${res ? ` and ${nf1.format(res.quota)}% of residents` : ""}. ` +
        "But the comparison is lopsided: prisoners also include people without a residence permit, who do not appear among residents; foreign nationals are younger on average, and young adults end up in prison more often in every country; " +
        `and without a home or a steady job, people are more often kept in a cell awaiting trial: ${nf1.format(nonDef(C.posizione.str) * 100)}% of foreign prisoners have no final conviction, against ${nf1.format(nonDef(C.posizione.it) * 100)}% of Italians.`,
        "approfondimenti/carceri.html", "Foreign nationals in prison, the deep dive");
      else card("Gli stranieri commettono più reati degli italiani?",
        `Questi dati non bastano per dirlo. A fine ${last} gli stranieri erano il ${nf1.format(share(L))}% dei detenuti (nel ${Yc[0]} il ${nf1.format(share(0))}%)${res ? ` e il ${nf1.format(res.quota)}% dei residenti` : ""}. ` +
        "Ma il confronto è sbilanciato: tra i detenuti ci sono anche persone senza permesso di soggiorno, che tra i residenti non compaiono; gli stranieri sono in media più giovani, e i giovani adulti finiscono in carcere più spesso in ogni paese; " +
        `senza casa o lavoro stabile, poi, si resta più spesso in cella in attesa di giudizio: è senza condanna definitiva il ${nf1.format(nonDef(C.posizione.str) * 100)}% dei detenuti stranieri, contro il ${nf1.format(nonDef(C.posizione.it) * 100)}% degli italiani.`,
        "approfondimenti/carceri.html", "Gli stranieri in carcere, l’approfondimento");
    }

    // rimpatri
    if (RIMP) {
      const D = RIMP, L = D.meta.years.length - 1, R = D.totale.rimpatri[L], O = D.totale.ordini[L];
      if (EN) card("How many people are actually returned?",
        `About ${Math.round((100 * R) / O)} in every 100 of those ordered to leave. In ${D.meta.last} Italy ordered ${nf0.format(O)} citizens of non-EU countries to leave its territory, and returned ${nf0.format(R)}. ` +
        "Orders and returns in the same year do not always concern the same people; the gap depends, among other things, on agreements with individual countries and on the places available in detention centres.",
        "approfondimenti/rimpatri.html", "Orders and returns, country by country");
      else card("Quante persone vengono davvero rimpatriate?",
        `Circa ${Math.round((100 * R) / O)} ogni 100 di quelle a cui viene ordinato di andarsene. Nel ${D.meta.last} l’Italia ha ordinato a ${nf0.format(O)} cittadini di paesi fuori dall’Unione europea di lasciare il territorio, e ne ha rimpatriati ${nf0.format(R)}. ` +
        "Ordini e rimpatri dello stesso anno non riguardano sempre le stesse persone; sul divario pesano, tra l’altro, gli accordi con i singoli paesi e i posti nei centri di trattenimento.",
        "approfondimenti/rimpatri.html", "Ordini e rimpatri paese per paese");
    }

    // che cosa contano i numeri
    if (EN) card("Do these numbers count every crime?",
      "No, only those reported to the police. Many crimes are never reported, and how often people report varies from crime to crime: a car theft almost always, for the insurance; violence in the family far less often. " +
      `To compare large and small cities, reports are counted per 100,000 residents: Italy’s ${nf0.format(tot[LAST])} in ${Y[LAST]} come to about ${nf0.format(Math.round(tot[LAST] / 1000))} for every 100 people in a year.`,
      "progetto/#metodo", "How to read these numbers");
    else card("Questi numeri contano tutti i reati?",
      "No, solo quelli denunciati alle forze di polizia. Molti reati non vengono mai denunciati, e quanto si denuncia cambia da reato a reato: un furto d’auto quasi sempre, per l’assicurazione; una violenza in famiglia molto meno. " +
      `Per confrontare città grandi e piccole si contano le denunce ogni 100.000 abitanti: i ${nf0.format(tot[LAST])} dell’Italia nel ${Y[LAST]} sono circa ${nf0.format(Math.round(tot[LAST] / 1000))} ogni 100 persone in un anno.`,
      "progetto/#metodo", "Come leggere questi numeri");

    // si ridisegna quando arrivano carceri e rimpatri o cambia la larghezza: le risposte aperte restano aperte
    const open = new Set(Array.from(host.querySelectorAll("details[open] h3"), (x) => x.textContent));
    host.innerHTML = cards.join("");
    host.querySelectorAll("details").forEach((d) => { if (open.has(d.querySelector("h3").textContent)) d.open = true; });
    reveal(host, host.querySelectorAll(".faq-q"));
  }

  // Le schede degli approfondimenti, nella home e nella pagina che li raccoglie: una cifra per ognuno, appena i suoi dati ci sono.
  function renderDeepCards() {
    const fill = (k, fig, cap) => document.querySelectorAll(`[data-dd="${k}"]`).forEach((el) => {
      const f = el.querySelector(".dd-fig"), c = el.querySelector(".dd-cap");
      if (f) f.textContent = fig;
      if (c) c.textContent = cap;
    });
    if (CARCERI) {
      const C = CARCERI, L = C.meta.years.length - 1, last = C.meta.last, ra = (C.residenti && C.residenti.anni) || {};
      const rk = [last, last - 1].find((y) => ra[String(y)]);
      fill("carceri", `${nf1.format((100 * C.serie.str[L]) / C.serie.tot[L])}%`, EN
        ? `of prisoners at the end of ${last} were foreign nationals${rk ? `; among residents, ${nf1.format(ra[String(rk)].quota)}%` : ""}`
        : `dei detenuti a fine ${last} è straniero${rk ? `; tra i residenti, il ${nf1.format(ra[String(rk)].quota)}%` : ""}`);
    }
    if (RIMP) {
      const D = RIMP, L = D.meta.years.length - 1, R = D.totale.rimpatri[L], O = D.totale.ordini[L];
      fill("rimpatri", EN ? `${nf0.format(Math.round((100 * R) / O))} in 100` : `${nf0.format(Math.round((100 * R) / O))} su 100`, EN
        ? `orders to leave Italy that became returns in ${D.meta.last}: ${nf0.format(R)} of ${nf0.format(O)}`
        : `ordini di lasciare l’Italia diventati rimpatri nel ${D.meta.last}: ${nf0.format(R)} su ${nf0.format(O)}`);
    }
    if (ITALY && ITALY.silc) {
      const sy = Object.keys(ITALY.silc).map(Number).filter((y) => Y.includes(y)), sv = sy.map((y) => ITALY.silc[y]), tot = ITALY.rate.TOT;
      const a = sy[d3.maxIndex(sv)], b = sy[d3.minIndex(sv)];
      if (a < b) fill("percezione", fmtPct(ITALY.silc[b] / ITALY.silc[a] - 1), EN
        ? `households reporting crime in their area, from ${a} to ${b}; reported crimes per resident over the same period: ${fmtPct(tot[Y.indexOf(b)] / tot[Y.indexOf(a)] - 1)}`
        : `famiglie che segnalano criminalità nella propria zona, dal ${a} al ${b}; i delitti denunciati per abitante, nello stesso periodo: ${fmtPct(tot[Y.indexOf(b)] / tot[Y.indexOf(a)] - 1)}`);
    }
    if (AUTORI) {
      const A = AUTORI, L = A.meta.years.length - 1, t = A.italia.TOT[L], f = A.italia.THEFT[L];
      fill("autori", EN ? `${nf0.format(Math.round(100 - t))} in 100` : `${nf0.format(Math.round(100 - t))} su 100`, EN
        ? `crimes reported in ${A.meta.last} still without a known offender by the end of the year; among thefts, ${nf0.format(Math.round(100 - f))} in 100`
        : `delitti denunciati nel ${A.meta.last} rimasti senza un autore noto entro l’anno; tra i furti, ${nf0.format(Math.round(100 - f))} su 100`);
    }
    if (MINORI) {
      const M = MINORI, Ym = M.meta.years, L = Ym.length - 1, i0 = Ym.indexOf(M.meta.share_from);
      fill("minori", `${nf1.format(minShare("STREETROB", L))}%`, EN
        ? `of records of people reported or arrested for street robbery in ${M.meta.last} concern a minor; in ${M.meta.share_from}, ${nf1.format(minShare("STREETROB", i0))}%`
        : `delle segnalazioni per rapina in strada nel ${M.meta.last} riguarda un minorenne; nel ${M.meta.share_from}, ${pctA("il", minShare("STREETROB", i0))}`);
    }
  }

  function renderNational() {
    const m = model("TOT");
    const it = m.it;
    const iB = Y.indexOf(REF);
    const ch = it[LAST] / it[iB] - 1;
    $("#national-title").textContent = EN
      ? `${m.label}: ${fmtRate(it[LAST])} in ${Y[LAST]}, ${fmtPct(ch)} compared with ${REF}`
      : `${m.label}: ${fmtRate(it[LAST])} nel ${Y[LAST]}, ${fmtPct(ch)} rispetto al ${REF}`;
    $("#national-sub").textContent = EN
      ? `${m.t === "TOT" ? "Reported crimes" : "Reports"} per 100,000 residents, Italy`
      : `${m.t === "TOT" ? "Delitti denunciati" : "Denunce"} ogni 100.000 abitanti, Italia`;
    const el = $("#national-chart");
    // il riquadro è alto quanto la colonna dei numeri: il grafico prende tutto lo spazio che gli resta
    const h = Math.min(560, Math.max(240, Math.round(el.getBoundingClientRect().height)));
    lineChart(el, {
      years: Y, values: it, xDomain: [Y[0], Y[LAST]], xTicks: [2006, 2010, 2015, 2020, 2024],
      yMin: d3.min(it) * 0.82, yMax: d3.max(it) * 1.08, covid: true, height: h, mr: 18,
      marks: [
        { year: REF, text: fmtRate(it[iB]), hollow: true, dy: REF >= Y[LAST] - 2 ? 20 : -10 },
        { year: Y[LAST], text: fmtRate(it[LAST]), strong: true, anchor: "end", dx: 0, dy: -12 },
      ],
      hover: (i) => (EN
        ? `<b>${Y[i]}</b>: ${fmtRate(it[i])} per 100,000 res.<br>${nf0.format(ITALY.n.TOT[i])} reported crimes`
        : `<b>${Y[i]}</b>: ${fmtRate(it[i])} ogni 100.000 ab.<br>${nf0.format(ITALY.n.TOT[i])} denunce`),
    });
  }

  // ------------------------------------------------------------------ apertura: le città e i reati sulla striscia

  // Il riquadro a destra dell'apertura fa scorrere tre grafici, uno per ogni pezzo del titolo: l'Italia nel tempo
  // (renderNational), le città (guglie come nella mappa, con i movimenti più netti accanto) e i reati (quali
  // salgono e quali calano). Mostrano sempre tutti i delitti confrontati con il 2019: i comandi delle sezioni sotto non li toccano.
  function renderHeroCities() {
    const el = $("#cities-chart");
    if (!el) return;
    const m = model("TOT");
    const rows = m.rows.filter((r) => r.lvl != null);
    const up = rows.filter((r) => sig(r.cmp) === "up"), down = rows.filter((r) => sig(r.cmp) === "down");
    const flat = rows.length - up.length - down.length;
    if (EN) {
      $("#cities-kicker").textContent = `Not everywhere · ${rows.length} provincial capitals`;
      $("#cities-title").textContent = `${m.label}: since ${REF}, reports have risen in ${up.length} ${up.length === 1 ? "city" : "cities"} and fallen in ${down.length}`;
      $("#cities-sub").textContent = `Each spire is a provincial capital, as tall as its reports per resident (${m.levelNote}); red if they have risen since ${REF}, blue if they have fallen; spikes in gold`;
    } else {
    $("#cities-kicker").textContent = `Non ovunque · ${rows.length} capoluoghi`;
    $("#cities-title").textContent = `${m.label}: dal ${REF} le denunce salgono in ${up.length} città e calano in ${down.length}`;
    $("#cities-sub").textContent = `Ogni guglia un capoluogo, alta quanto le denunce per abitante (${m.levelNote}); rossa se dal ${REF} salgono, blu se calano; in oro le impennate`;
    }
    const r0 = el.getBoundingClientRect();
    const w = Math.max(260, Math.round(r0.width)), h = Math.min(560, Math.max(240, Math.round(r0.height)));
    el.innerHTML = "";
    el.classList.add("cities");
    // la carta è alta quanto il pannello e larga quanto le serve, ma non oltre metà; se resta posto, accanto l'elenco
    const mapW = Math.min(Math.round(w * 0.55), Math.round(h / 1.08));
    const withList = w - mapW >= 150;
    const mw = withList ? mapW : w;
    const mapEl = document.createElement("div");
    mapEl.className = "mapbox cmap";
    mapEl.style.width = mw + "px";
    el.appendChild(mapEl);
    const maxLen = Math.round(mw * 0.17), sky = Math.round(maxLen / 2);
    const obj = TOPO.objects[Object.keys(TOPO.objects)[0]];
    const land = topojson.feature(TOPO, obj);
    const proj = d3.geoConicConformal().parallels([38, 46]).rotate([-12.5, 0]).fitExtent([[4, 4 + sky], [mw - 4, h - 4]], land);
    const path = d3.geoPath(proj);
    const svg = d3.select(mapEl).append("svg").attr("viewBox", `0 0 ${mw} ${h}`).attr("role", "img")
      .attr("aria-label", EN
        ? `Map of provincial capitals: ${m.label}, reports per resident and change compared with ${REF}`
        : `Mappa dei capoluoghi: ${m.label}, denunce per abitante e variazione rispetto al ${REF}`);
    const sameReg = (a, b) => a.properties.reg_istat_code === b.properties.reg_istat_code;
    const base = svg.append("g").attr("class", "base rv-fade");
    base.append("path").attr("class", "land").attr("d", path(land));
    base.append("path").attr("class", "prov").attr("d", path(topojson.mesh(TOPO, obj, (a, b) => a !== b && sameReg(a, b))));
    base.append("path").attr("class", "reg").attr("d", path(topojson.mesh(TOPO, obj, (a, b) => a !== b && !sameReg(a, b))));
    base.append("path").attr("class", "coast").attr("d", path(topojson.mesh(TOPO, obj, (a, b) => a === b)));
    const pts = rows.map((d) => ({ d, xy: proj([d.c.lon, d.c.lat]) }));
    const maxL = d3.max(rows, (r) => r.lvl) || 1;
    const len = d3.scaleLinear([0, maxL], [0, Math.min(maxLen, ...pts.filter((p) => p.d.lvl > 0).map((p) => ((p.xy[1] - 6) * maxL) / p.d.lvl))]);
    const pw = Math.max(4, Math.round(mw / 80));
    const pin = (x, y, l, half) => `M${x - half},${y}L${x},${y - l}L${x + half},${y}Z`;
    const g = svg.append("g").attr("class", "spires");
    pts.sort((a, b) => a.xy[1] - b.xy[1]).forEach(({ d, xy }, k) => {
      const l = Math.max(2, len(d.lvl)), [x, y] = xy;
      const spike = d.an[LAST] && d.an[LAST].flag === "spike";
      const c = g.append("g").attr("class", spike ? "city spike" : "city").attr("data-c", d.c.id).style("color", divColor(d.cmp)).style("--i", k)
        .on("mouseenter", () => hotCity(d.c.id, true))
        .on("mousemove", (ev) => showTip(cityTip(d, m), ev))
        .on("mouseleave", () => { hideTip(); hotCity(d.c.id, false); })
        .on("click", () => openCity(d.c));
      c.append("path").attr("class", "pin rv-rise").attr("d", pin(x, y, l, pw / 2));
      c.append("path").attr("class", "hit").attr("d", pin(x, y + 2, Math.max(l, 8) + 4, pw / 2 + 3));
    });
    // i nomi delle tre città con più denunce per abitante
    const lg = svg.append("g").attr("class", "labels rv-fade");
    pts.slice().sort((a, b) => b.d.lvl - a.d.lvl).slice(0, 3).forEach(({ d, xy }) => {
      lg.append("text").attr("class", "lbl").attr("x", xy[0] + pw / 2 + 3).attr("y", xy[1] + 4).text(d.c.name);
    });
    if (withList) {
      const list = document.createElement("div");
      list.className = "clist";
      const li = (r) => `<li data-c="${r.c.id}"><button type="button" data-city="${r.c.id}">${esc(r.c.name)}</button>` +
        `<span class="v ${sig(r.cmp)}${r.an[LAST] && r.an[LAST].flag === "spike" ? " spike" : ""}">${fmtPct(r.cmp.pct)}</span></li>`;
      const topUp = up.slice().sort((a, b) => b.cmp.pct - a.cmp.pct).slice(0, 3);
      const topDown = down.slice().sort((a, b) => a.cmp.pct - b.cmp.pct).slice(0, 3);
      list.innerHTML = EN
        ? (topUp.length ? `<h4>Biggest rises since ${REF}</h4><ul>${topUp.map(li).join("")}</ul>` : "") +
          (topDown.length ? `<h4>Biggest falls</h4><ul>${topDown.map(li).join("")}</ul>` : "") +
          `<p class="tot">${up.length} ${up.length === 1 ? "city" : "cities"} rising, ${down.length} falling, ${flat} with differences too small to tell</p>`
        : (topUp.length ? `<h4>Salgono di più dal ${REF}</h4><ul>${topUp.map(li).join("")}</ul>` : "") +
        (topDown.length ? `<h4>Calano di più</h4><ul>${topDown.map(li).join("")}</ul>` : "") +
        `<p class="tot">${up.length} città in aumento, ${down.length} in calo, ${flat} con differenze troppo piccole per dirlo</p>`;
      el.appendChild(list);
      // la riga accende la sua guglia, qui e nella mappa grande
      list.addEventListener("mouseover", (ev) => { const r = ev.target.closest("li[data-c]"); if (r) hotCity(r.dataset.c, true); });
      list.addEventListener("mouseout", (ev) => { const r = ev.target.closest("li[data-c]"); if (r && !r.contains(ev.relatedTarget)) hotCity(r.dataset.c, false); });
    }
    reveal(el);
  }

  // Barre divergenti: i cinque reati che salgono di più e i cinque che calano di più rispetto all'anno di confronto;
  // l'etichetta sta dal lato libero della barra, la linea tratteggiata è «tutti i delitti». Un clic porta il reato sulla mappa.
  function renderHeroTypes() {
    const el = $("#types-chart");
    if (!el) return;
    const iB = Y.indexOf(REF);
    const items = TYPES.filter((t) => t.id !== "TOT")
      .map((t) => ({ t, lvl: ITALY.rate[t.id][LAST], ch: ITALY.rate[t.id][LAST] / ITALY.rate[t.id][iB] - 1 }))
      .filter((d) => isFinite(d.ch)).sort((a, b) => b.ch - a.ch);
    if (items.length < 2) return;
    const totCh = ITALY.rate.TOT[LAST] / ITALY.rate.TOT[iB] - 1;
    const rows = items.slice(0, 5).concat(items.slice(-5));
    const short = (t) => t.label.replace(/ \(.*\)$/, "");
    const first = items[0], last = items[items.length - 1];
    if (EN) {
      $("#types-kicker").textContent = `Not all · ${items.length} crimes`;
      $("#types-title").textContent = `${short(first.t)} ${fmtPct(first.ch)}, ${lower(short(last.t))} ${fmtPct(last.ch)}: crimes do not move together`;
      $("#types-sub").textContent = `Change in reports per 100,000 residents in Italy, ${Y[LAST]} compared with ${REF}`;
    } else {
    $("#types-kicker").textContent = `Non tutti · ${items.length} reati`;
    $("#types-title").textContent = `${short(first.t)} ${fmtPct(first.ch)}, ${lower(short(last.t))} ${fmtPct(last.ch)}: i reati non si muovono insieme`;
    $("#types-sub").textContent = `Variazione delle denunce ogni 100.000 abitanti in Italia, ${Y[LAST]} rispetto al ${REF}`;
    }
    const r0 = el.getBoundingClientRect();
    const w = Math.max(260, Math.round(r0.width)), h = Math.min(560, Math.max(240, Math.round(r0.height)));
    const small = w < 420;
    const m = { t: 22, b: 6 };
    const rowH = (h - m.t - m.b) / rows.length;
    const cap = Math.max(0.3, Math.ceil(d3.max(rows, (d) => Math.abs(d.ch)) * 10) / 10);
    const zero = Math.round(w * 0.5), half = Math.min(zero - 46, w - zero - 46);
    const x = d3.scaleLinear([-cap, cap], [zero - half, zero + half]);
    const svg = d3.select(el).classed("types", true).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img")
      .attr("aria-label", EN
        ? `Change in reports by crime in Italy, ${Y[LAST]} compared with ${REF}`
        : `Variazione delle denunce per reato in Italia, ${Y[LAST]} rispetto al ${REF}`);
    svg.selectAll("*").remove();
    svg.append("line").attr("class", "ref").attr("x1", x(totCh)).attr("x2", x(totCh)).attr("y1", m.t - 4).attr("y2", h - m.b);
    svg.append("text").attr("class", "lbl halo").attr("x", x(totCh) + 4).attr("y", m.t - 10).text(EN ? `all crimes ${fmtPct(totCh)}` : `tutti i delitti ${fmtPct(totCh)}`);
    svg.append("line").attr("class", "zero").attr("x1", zero).attr("x2", zero).attr("y1", m.t - 4).attr("y2", h - m.b);
    rows.forEach((d, k) => {
      const cy = m.t + rowH * (k + 0.5), bh = Math.min(18, rowH * 0.62), up = d.ch >= 0;
      const x0 = Math.min(x(0), x(d.ch)), x1 = Math.max(x(0), x(d.ch));
      const color = up ? "var(--rise)" : "var(--fall)";
      const g = svg.append("g").style("--i", k);
      g.append("rect").attr("class", "rv-grow").attr("x", x0).attr("y", cy - bh / 2).attr("width", Math.max(1.5, x1 - x0)).attr("height", bh)
        .style("fill", color).style("transform-origin", up ? "0 50%" : "100% 50%").style("transform-box", "fill-box");
      g.append("text").attr("class", "lab rv-fade" + (PARENT[d.t.id] ? " sub" : "")).attr("x", up ? zero - 8 : zero + 8).attr("y", cy + 4)
        .attr("text-anchor", up ? "end" : "start").style("font-size", small ? "11px" : null).text(short(d.t));
      g.append("text").attr("class", "val rv-fade").attr("x", up ? x1 + 5 : x0 - 5).attr("y", cy + 4)
        .attr("text-anchor", up ? "start" : "end").style("fill", color).style("font-size", small ? "11px" : null).text(fmtPct(d.ch));
      g.append("rect").attr("x", 0).attr("y", cy - rowH / 2).attr("width", w).attr("height", rowH).style("fill", "transparent").style("cursor", "pointer")
        .on("mousemove", (ev) => showTip(EN
          ? `<b>${esc(d.t.label)}</b><br>${fmtRate(d.lvl)} reports per 100,000 res. in ${Y[LAST]}<br>${fmtPct(d.ch)} compared with ${REF}<br><span class="small">Click: this crime on the city map</span>`
          : `<b>${esc(d.t.label)}</b><br>${fmtRate(d.lvl)} denunce ogni 100.000 ab. nel ${Y[LAST]}<br>${fmtPct(d.ch)} rispetto al ${REF}<br><span class="small">Clic: questo reato sulla mappa delle città</span>`, ev))
        .on("mouseleave", hideTip)
        .on("click", () => { hideTip(); showOnMap(d.t.id); });
    });
    reveal(el);
  }

  // La striscia: avanza da sola ogni otto secondi, si ferma finché il mouse o il fuoco sono sul riquadro e quando il
  // riquadro è fuori dallo schermo; si sfoglia con le frecce, i punti, le frecce della tastiera e il dito. Il punto
  // acceso si riempie d'oro col tempo (--p). Con prefers-reduced-motion non si muove da sola.
  function heroCarousel() {
    const box = $("#national");
    if (!box || !box.classList.contains("hero-car")) return;
    const DUR = 8000;
    const dots = [...box.querySelectorAll('.car-dots [role="tab"]')];
    const metas = [...box.querySelectorAll(".car-meta")], panels = [...box.querySelectorAll(".car-panel")];
    let i = 0, p = 0, hover = false, focus = false, seen = true, last = performance.now();
    const show = (k) => {
      i = ((k % 3) + 3) % 3;
      p = 0;
      box.style.setProperty("--i", i);
      box.style.setProperty("--p", "0");
      dots.forEach((b, k2) => b.setAttribute("aria-selected", k2 === i));
      metas.forEach((el) => el.classList.toggle("on", +el.dataset.k === i));
      panels.forEach((el) => el.setAttribute("aria-hidden", +el.dataset.k !== i));
    };
    dots.forEach((b) => b.addEventListener("click", () => show(+b.dataset.k)));
    box.querySelectorAll(".car-nav .arr").forEach((b) => b.addEventListener("click", () => show(i + +b.dataset.dir)));
    box.addEventListener("keydown", (ev) => {
      if (ev.target.matches("input, select, textarea")) return;
      if (ev.key === "ArrowRight") { show(i + 1); ev.preventDefault(); }
      if (ev.key === "ArrowLeft") { show(i - 1); ev.preventDefault(); }
    });
    box.addEventListener("pointerenter", () => { hover = true; });
    box.addEventListener("pointerleave", () => { hover = false; });
    box.addEventListener("focusin", () => { focus = true; });
    box.addEventListener("focusout", (ev) => { if (!box.contains(ev.relatedTarget)) focus = false; });
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => { seen = es[0].isIntersecting; }).observe(box);
    // il dito: uno spostamento netto di lato sfoglia, e il clic che ne seguirebbe non deve aprire una città
    const strip = $(".car-strip", box);
    let x0 = null, swiped = false;
    strip.addEventListener("pointerdown", (ev) => { x0 = ev.clientX; swiped = false; });
    strip.addEventListener("pointerup", (ev) => {
      if (x0 == null) return;
      const dx = ev.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) { swiped = true; show(i + (dx < 0 ? 1 : -1)); }
    });
    strip.addEventListener("pointercancel", () => { x0 = null; });
    strip.addEventListener("click", (ev) => { if (swiped) { swiped = false; ev.stopPropagation(); ev.preventDefault(); } }, true);
    const tick = (now) => {
      const dt = Math.min(100, now - last);
      last = now;
      if (!stillMotion.matches && document.visibilityState === "visible" && !hover && !focus && seen) {
        p += dt / DUR;
        if (p >= 1) show(i + 1);
        else box.style.setProperty("--p", p.toFixed(4));
      }
      requestAnimationFrame(tick);
    };
    show(0);
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------------ quadro nazionale per reato

  function renderMix() {
    const base = state.mixBase, iB = Y.indexOf(base);
    const items = TYPES.filter((t) => t.id !== "TOT").map((t) => {
      const it = ITALY.rate[t.id];
      return { t, it, ch: it[LAST] / it[iB] - 1 };
    }).sort((a, b) => b.ch - a.ch);
    const totCh = ITALY.rate.TOT[LAST] / ITALY.rate.TOT[iB] - 1;
    const up = items.filter((d) => d.ch > 0.03).length, down = items.filter((d) => d.ch < -0.03).length;
    $("#mix-dek").innerHTML = EN
      ? `Between ${base} and ${Y[LAST]}, <strong>${up} of ${items.length} crimes</strong> rose in Italy and <strong>${down}</strong> fell; all crimes combined, ${fmtPct(totCh)}. Crimes do not move together: tap a crime to see it on the map of provincial capitals.`
      : `Tra il ${base} e il ${Y[LAST]}, in Italia <strong>${up} reati su ${items.length}</strong> sono aumentati e <strong>${down}</strong> sono calati; tutti i delitti insieme ${fmtPct(totCh)}. I reati non si muovono insieme: tocca un reato per vederlo sulla mappa dei capoluoghi.`;
    // scala comune con tetto fisso: la barra si ferma, il numero dice il valore vero
    const cap = Math.min(1.5, Math.max(0.3, Math.ceil(d3.max(items, (d) => Math.abs(d.ch)) * 10) / 10));
    const pos = (v) => 50 + 50 * Math.max(-1, Math.min(1, v / cap));
    const grid = $("#mix-grid");
    grid.innerHTML = "";
    items.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mrow" + (PARENT[d.t.id] ? " sub" : "");
      const cls = d.ch > 0.03 ? "up" : d.ch < -0.03 ? "down" : "flat";
      const left = Math.min(50, pos(d.ch)), width = Math.abs(pos(d.ch) - 50);
      b.innerHTML = `<span class="ml">${esc(d.t.label)}</span>` +
        `<span class="mbar" aria-hidden="true"><i class="z"></i><i class="b ${cls} rv-grow" style="left:${left}%;width:${width}%"></i><i class="ref rv-fade" style="left:${pos(totCh)}%"></i></span>` +
        `<span class="mv ${cls}">${fmtPct(d.ch)}</span><svg aria-hidden="true"></svg>`;
      b.setAttribute("aria-label", EN
        ? `${d.t.label}: ${fmtRate(d.it[LAST])} per 100,000 residents in ${Y[LAST]}, ${fmtPct(d.ch)} compared with ${base}. Show it on the map`
        : `${d.t.label}: ${fmtRate(d.it[LAST])} ogni 100.000 abitanti nel ${Y[LAST]}, ${fmtPct(d.ch)} rispetto al ${base}. Mostralo sulla mappa`);
      b.addEventListener("click", () => showOnMap(d.t.id, base));
      grid.appendChild(b);
    });
    const w = grid.querySelector(".mrow svg").getBoundingClientRect().width || 72;
    grid.querySelectorAll(".mrow").forEach((b, k) => {
      const d = items[k];
      drawSpark(b.querySelector("svg"), {
        w, h: 32, pad: { t: 4, r: 3, b: 3, l: 1 }, values: d.it, yMax: d3.max(d.it) * 1.08,
        hover: (i) => `<b>${esc(d.t.label)}</b><br>${Y[i]}: ${fmtRate(d.it[i])} ${L("ogni 100.000 ab.", "per 100,000 res.")}`,
      });
    });
    reveal(grid, grid.querySelectorAll(".mrow"));
  }

  // ------------------------------------------------------------------ mappa

  // Mappa: una guglia in piedi su ogni capoluogo. Altezza = tasso, colore = variazione sul riferimento, bordo d'oro = impennata.
  // Sotto le guglie, tre strati di confini (province, regioni, costa) perché la carta si legga anche nel tema scuro.
  function renderMap() {
    const m = model(state.mapType, state.mapBase);
    const el = $("#map");
    const w = Math.max(280, el.clientWidth);
    // La guglia più alta è un quinto della larghezza; sopra l'Italia resta mezza guglia di cielo, perché le città
    // in cima alla carta (Bolzano, Sondrio) hanno spesso tassi alti e la loro punta deve starci.
    const maxLen = Math.round(w * 0.2), sky = Math.round(maxLen / 2);
    const h = Math.round(w * 1.18) + sky;
    const obj = TOPO.objects[Object.keys(TOPO.objects)[0]];
    const land = topojson.feature(TOPO, obj);
    const proj = d3.geoConicConformal().parallels([38, 46]).rotate([-12.5, 0]).fitExtent([[6, 6 + sky], [w - 6, h - 6]], land);
    const path = d3.geoPath(proj);
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", EN ? `Map of provincial capitals: ${m.label}` : `Mappa dei capoluoghi: ${m.label}`);
    svg.selectAll("*").remove();

    const sameReg = (a, b) => a.properties.reg_istat_code === b.properties.reg_istat_code;
    const base = svg.append("g").attr("class", "base rv-fade");
    base.append("path").attr("class", "land").attr("d", path(land));
    base.append("path").attr("class", "prov").attr("d", path(topojson.mesh(TOPO, obj, (a, b) => a !== b && sameReg(a, b))));
    base.append("path").attr("class", "reg").attr("d", path(topojson.mesh(TOPO, obj, (a, b) => a !== b && !sameReg(a, b))));
    base.append("path").attr("class", "coast").attr("d", path(topojson.mesh(TOPO, obj, (a, b) => a === b)));

    // guglie: altezza lineare col tasso, un po' più basse solo se una punta sforerebbe comunque il bordo in alto.
    // Base di larghezza fissa, triangolo con la punta in su.
    const maxL = d3.max(m.rows, (r) => r.lvl) || 1;
    const rows = m.rows.filter((d) => d.lvl != null);
    rows.forEach((d) => { d._xy = proj([d.c.lon, d.c.lat]); });
    const len = d3.scaleLinear([0, maxL], [0, Math.min(maxLen, ...rows.filter((d) => d.lvl > 0).map((d) => ((d._xy[1] - 8) * maxL) / d.lvl))]);
    const pw = Math.max(5, Math.round(w / 80));
    const pin = (x, y, l, half) => `M${x - half},${y}L${x},${y - l}L${x + half},${y}Z`;
    const g = svg.append("g").attr("class", "cities");
    // da nord a sud, così le guglie più a sud coprono quelle dietro; le impennate per ultime, così l'orlo d'oro resta in vista
    const isSpike = (d) => !!(d.an[LAST] && d.an[LAST].flag === "spike");
    const nSpike = rows.filter(isSpike).length;
    rows.sort((a, b) => (isSpike(a) - isSpike(b)) || (a._xy[1] - b._xy[1])).forEach((d, k) => {
      d._len = Math.max(2, len(d.lvl));
      const [x, y] = d._xy;
      const spike = isSpike(d);
      // data-c e non data-city: il clic lo gestisce la guglia, non il gestore globale della pagina
      const c = g.append("g").attr("class", spike ? "city spike" : "city").attr("data-c", d.c.id).style("color", divColor(d.cmp)).style("--i", k)
        .on("mouseenter", () => hotCity(d.c.id, true))
        .on("mousemove", (ev) => showTip(cityTip(d, m), ev))
        .on("mouseleave", () => { hideTip(); hotCity(d.c.id, false); })
        .on("click", () => openCity(d.c, m.t, m.base));
      c.append("path").attr("class", "pin rv-rise").attr("d", pin(x, y, d._len, pw / 2));
      // zona sensibile più larga della guglia, perché le guglie basse si prendano col mouse
      c.append("path").attr("class", "hit").attr("d", pin(x, y + 2, Math.max(d._len, 8) + 4, pw / 2 + 3));
    });

    // Etichette: le otto città più popolose e le prime tre in classifica. Ogni etichetta parte dalla base della guglia
    // e prova quattro posizioni (destra, sinistra, sotto, sopra la punta), prendendo la prima libera da altre etichette e guglie alte.
    const big = new Set(CITIES.slice().sort((a, b) => b.pop[LAST] - a.pop[LAST]).slice(0, 8).map((c) => c.id));
    m.ranked.slice(0, 3).forEach((d) => big.add(d.c.id));
    const fs = 11, cw = 6.4, pad = 3;
    const taken = rows.filter((d) => d._len > 6).map((d) => ({ id: d.c.id, x: d._xy[0] - pw / 2, y: d._xy[1] - d._len, w: pw, h: d._len }));
    const hits = (b, id) => b.x < 2 || b.y < 2 || b.x + b.w > w - 2 || b.y + b.h > h - 2 ||
      taken.some((t) => t.id !== id && b.x < t.x + t.w && b.x + b.w > t.x && b.y < t.y + t.h && b.y + b.h > t.y);
    const lg = svg.append("g").attr("class", "labels rv-fade");
    rows.filter((d) => big.has(d.c.id)).sort((a, b) => b.c.pop[LAST] - a.c.pop[LAST]).forEach((d) => {
      const [x, y] = d._xy, o = pw / 2 + pad, tw = d.c.name.length * cw;
      const cands = [
        { x: x + o, y: y - fs / 2, anchor: "start", tx: x + o },
        { x: x - o - tw, y: y - fs / 2, anchor: "end", tx: x - o },
        { x: x - tw / 2, y: y + pad, anchor: "middle", tx: x },
        { x: x - tw / 2, y: y - d._len - pad - fs, anchor: "middle", tx: x },
      ];
      const c = cands.find((k) => !hits({ x: k.x, y: k.y, w: tw, h: fs }, d.c.id)) || cands[0];
      taken.push({ id: null, x: c.x, y: c.y, w: tw, h: fs });
      lg.append("text").attr("class", "lbl").attr("text-anchor", c.anchor).attr("x", c.tx).attr("y", c.y + fs * 0.82).text(d.c.name);
    });

    // Chiave delle altezze: tre guglie affiancate con valori tondi, nel mare a sud-ovest della Sardegna.
    const nice = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p; };
    const vals = [nice(maxL), nice(maxL / 3), nice(maxL / 10)].filter((v, i, a) => v > 0 && isFinite(v) && a.indexOf(v) === i);
    const key = svg.append("g").attr("class", "sizekey rv-fade").attr("aria-hidden", "true");
    const step = Math.max(30, 6 * Math.max(...vals.map((v) => fmtRate(v).length)) + 8), ky = h - 22;
    vals.forEach((v, i) => {
      const kx = 8 + step / 2 + i * step;
      key.append("path").attr("d", pin(kx, ky, len(v), pw / 2));
      key.append("text").attr("x", kx).attr("y", ky + 12).attr("text-anchor", "middle").text(fmtRate(v));
    });

    // Legenda in HTML: la scala dei colori com'è davvero (continua fino a ±60%, grigia se non significativa),
    // il significato dell'altezza e il bordo d'oro con il conto delle città che ce l'hanno: per alcuni reati
    // (tutti i delitti, omicidi, usura) nessun capoluogo è in impennata, e la legenda lo dice invece di promettere un bordo che non c'è.
    const mid = css("--mid"), fall = d3.interpolateLab(mid, css("--fall")), rise = d3.interpolateLab(mid, css("--rise"));
    const bar = `linear-gradient(to right, ${fall(1)} 0%, ${fall(0.35)} 40%, ${mid} 40%, ${mid} 60%, ${rise(0.35)} 60%, ${rise(1)} 100%)`;
    $("#map-legend").innerHTML = EN ? `
      <div class="lg">
        <div class="lg-t">Colour · change from ${m.base} to ${Y[LAST]}</div>
        <div class="lg-bar" style="background:${bar}"></div>
        <div class="lg-ticks"><span>−60% or more</span><span>not significant</span><span>+60% or more</span></div>
      </div>
      <div class="lg">
        <div class="lg-t">Height · reports per 100,000 residents, ${m.levelNote}</div>
      </div>
      <div class="lg">
        <div class="lg-t">Gold edge · spike in ${Y[LAST]}</div>
        <div class="lg-row"><svg class="pin-k${nSpike ? "" : " none"}" viewBox="0 0 14 20" aria-hidden="true"><path d="M2,19L7,1L12,19Z"/></svg>${nSpike ? `${nSpike} of ${rows.length} provincial capitals` : "no provincial capital, for this crime"}</div>
      </div>` : `
      <div class="lg">
        <div class="lg-t">Colore · variazione ${Y[LAST]} su ${m.base}</div>
        <div class="lg-bar" style="background:${bar}"></div>
        <div class="lg-ticks"><span>−60% o più</span><span>non significativa</span><span>+60% o più</span></div>
      </div>
      <div class="lg">
        <div class="lg-t">Altezza · denunce ogni 100.000 abitanti, ${m.levelNote}</div>
      </div>
      <div class="lg">
        <div class="lg-t">Bordo d’oro · impennata nel ${Y[LAST]}</div>
        <div class="lg-row"><svg class="pin-k${nSpike ? "" : " none"}" viewBox="0 0 14 20" aria-hidden="true"><path d="M2,19L7,1L12,19Z"/></svg>${nSpike ? `${nSpike} capoluogh${nSpike === 1 ? "o" : "i"} su ${rows.length}` : "nessun capoluogo, per questo reato"}</div>
      </div>`;
    reveal(el.parentNode);
  }

  // Evidenzia la stessa città nella mappa e nelle classifiche, al passaggio del mouse sull'una o sull'altra.
  // La guglia sale in cima finché è evidenziata, poi torna al suo posto, così l'ordine da nord a sud non si perde.
  // Si sposta solo se non è già in cima: rimuovere e reinserire il nodo sotto il puntatore fa scattare di nuovo
  // mouseenter, e senza questo controllo il browser entra in un ciclo e non consegna più i mousemove della nota.
  function hotCity(id, on) {
    document.querySelectorAll(`[data-c="${id}"]`).forEach((n) => {
      n.classList.toggle("hot", on);
      if (n.tagName !== "g") return;
      if (on) { if (n !== n.parentNode.lastElementChild) { n._next = n.nextSibling; n.parentNode.appendChild(n); } }
      else if (n._next !== undefined) { n.parentNode.insertBefore(n, n._next); n._next = undefined; }
    });
  }

  function cityTip(d, m) {
    const sp = d.an[LAST] && d.an[LAST].flag === "spike"
      ? (EN ? `<br>Spike in ${Y[LAST]}: ${fmtPct(d.an[LAST].rr - 1)} on the previous average` : `<br>Impennata nel ${Y[LAST]}: ${fmtPct(d.an[LAST].rr - 1)} sulla media precedente`)
      : "";
    const s = sig(d.cmp);
    const note = s === "flat" ? L(" (non significativa)", " (not significant)") : "";
    return EN
      ? `<b>${esc(d.c.name)}</b> · ${esc(d.c.region)}<br>${esc(m.label)}: ${fmtRate(d.lvl)} per 100,000 res. (${m.levelNote})<br>${ordinal(d.rank)} of ${m.ranked.length} · compared with ${m.base}: ${fmtPct(d.cmp && d.cmp.pct)}${note}${sp}`
      : `<b>${esc(d.c.name)}</b> · ${esc(d.c.region)}<br>${esc(m.label)}: ${fmtRate(d.lvl)} ogni 100.000 ab. (${m.levelNote})<br>${d.rank}° su ${m.ranked.length} · rispetto al ${m.base}: ${fmtPct(d.cmp && d.cmp.pct)}${note}${sp}`;
  }

  // ------------------------------------------------------------------ classifica

  function renderRanking() {
    const m = model(state.mapType, state.mapBase);
    const top = m.ranked.slice(0, 10);
    const bottom = m.ranked.slice().sort((a, b) => a.lvl - b.lvl || b.c.pop[LAST] - a.c.pop[LAST]).slice(0, 10);
    const maxL = top[0] ? top[0].lvl : 1;
    const nSpikeLast = m.rows.filter((d) => d.an[LAST] && d.an[LAST].flag === "spike").length;
    $("#map-dek").textContent = EN
      ? `These are the cities that rankings call “most dangerous” and “safest”. Here we count reports of ${lower(m.label)} per 100,000 residents (${m.levelNote}): a figure that runs higher where commuters and tourists arrive every day. On the map, the height of the spire shows how much is reported, and the colour whether reports have risen or fallen compared with ${m.base}${nSpikeLast ? `; the gold edge marks ${nSpikeLast === 1 ? "the only city" : `the ${nSpikeLast} cities`} with a spike in ${Y[LAST]}` : `; no provincial capital had a spike in ${Y[LAST]} for this crime`}.${GLOSS[m.t] ? ` ${m.label}: ${GLOSS[m.t]}.` : ""}`
      : `Sono le città che le classifiche chiamano “più pericolose” e “più sicure”. Qui contiamo le denunce per ${lower(m.label)} ogni 100.000 residenti (${m.levelNote}): un numero che pesa di più dove arrivano ogni giorno pendolari e turisti. Nella mappa l’altezza della guglia dice quanto si denuncia, il colore se le denunce sono salite o scese rispetto al ${m.base}${nSpikeLast ? `, il bordo d’oro segna ${nSpikeLast === 1 ? "l’unica città" : `le ${nSpikeLast} città`} con un’impennata nel ${Y[LAST]}` : `; nessun capoluogo ha avuto un’impennata nel ${Y[LAST]} per questo reato`}.${GLOSS[m.t] ? ` ${m.label}: ${GLOSS[m.t]}.` : ""}`;
    $("#rank-top-title").textContent = `${L("Più denunce", "Most reports")} · ${m.levelNote}`;
    $("#rank-bottom-title").textContent = `${L("Meno denunce", "Fewest reports")} · ${m.levelNote}`;
    const li = (d, pos) => {
      const few = d.nl < (m.rare ? 10 : 20) ? ` <span class="few">${nf0.format(d.nl)} ${EN ? (d.nl === 1 ? "case" : "cases") : "casi"}</span>` : "";
      return `<li data-c="${d.c.id}"><span class="pos">${pos}</span><span class="dotc ${sig(d.cmp)}" title="${L("Rispetto al", "Compared with")} ${m.base}: ${fmtPct(d.cmp && d.cmp.pct)}"></span><button type="button" data-city="${d.c.id}" title="${esc(d.c.name)}">${esc(d.c.name)}</button>` +
        `<span class="bar" aria-hidden="true"><i class="rv-grow" style="width:${(100 * d.lvl) / maxL}%"></i><b class="rv-fade" style="left:${Math.min(100, (100 * m.itLvl) / maxL)}%"></b></span>` +
        `<span class="val">${fmtRate(d.lvl)}${few}</span></li>`;
    };
    $("#rank-top").innerHTML = top.map((d) => li(d, d.rank)).join("");
    $("#rank-bottom").innerHTML = bottom.map((d) => li(d, d.rank)).join("");
    reveal($(".rank-cols"), document.querySelectorAll(".rank-cols li"));
    const zeros = m.ranked.filter((d) => d.lvl === 0).length;
    const topTourist = top.filter((d) => TOURIST.includes(d.c.name)).map((d) => d.c.name);
    let note = EN ? `The thin line on each bar is the Italian average: ${fmtRate(m.itLvl)}. ` : `La linea sottile su ogni barra è la media italiana: ${fmtRate(m.itLvl)}. `;
    if (topTourist.length && TOURIST_GROUPS.includes(TYPE[m.t].group) && !TOURIST_NOT.includes(m.t)) note += EN
      ? `${andList(topTourist.slice(0, 3))} ${topTourist.length > 1 ? "rank" : "ranks"} high partly because every day ${topTourist.length > 1 ? "they take" : "it takes"} in commuters and tourists who are not counted among residents. `
      : `${topTourist.slice(0, 3).join(", ")} ${topTourist.length > 1 ? "sono" : "è"} in alto anche perché ogni giorno ${topTourist.length > 1 ? "accolgono" : "accoglie"} pendolari e turisti che non entrano nel conto dei residenti. `;
    if (zeros) note += EN
      ? `${zeros} provincial ${zeros === 1 ? "capital" : "capitals"} had no cases ${m.rare ? "between 2022 and 2024" : "in 2024"}, ${zeros === 1 ? "at" : "tied at"} the bottom of the ranking. `
      : `${zeros} capoluoghi non hanno avuto nessun caso ${m.rare ? "tra il 2022 e il 2024" : "nel 2024"}, a pari merito in fondo alla classifica. `;
    if (m.rare) note += L("Con pochi casi l’anno, una sola differenza sposta molto il tasso: per questo usiamo la media di tre anni.", "With few cases a year, a single case more or less moves the rate a lot: that is why we use a three-year average.");
    $("#rank-note").textContent = note;

    const iB = m.base;
    const rowsHTML = m.ranked.map((d) => `<tr><td class="num">${d.rank}</td><td><a href="#${slug(d.c.name)}" data-city="${d.c.id}">${esc(d.c.name)}</a></td><td>${esc(d.c.region)}</td>` +
      `<td class="num">${fmtRate(d.lvl)}</td><td class="num">${nf0.format(d.nl)}</td><td class="num">${chgHTML(d.cmp)}</td><td class="num">${d.spikes.length || ""}</td></tr>`).join("");
    $("#rank-table").innerHTML = EN
      ? `<thead><tr><th class="num">#</th><th>City</th><th>Region</th><th class="num">Per 100,000 res. (${m.levelNote})</th><th class="num">Cases (${m.levelNote})</th><th class="num">Change since ${iB}</th><th class="num">Spikes since 2008</th></tr></thead><tbody>${rowsHTML}</tbody>`
      : `<thead><tr><th class="num">#</th><th>Città</th><th>Regione</th><th class="num">Ogni 100.000 ab. (${m.levelNote})</th><th class="num">Casi (${m.levelNote})</th><th class="num">Var. su ${iB}</th><th class="num">Impennate dal 2008</th></tr></thead><tbody>${rowsHTML}</tbody>`;
  }

  // ------------------------------------------------------------------ impennate

  let spikeList = [], fallList = [];
  function computeSpikes() {
    const yi = Y.indexOf(state.spikeYear);
    spikeList = []; fallList = [];
    const seen = new Set();
    TYPES.forEach((t) => {
      const m = model(t.id);
      m.rows.forEach((r) => {
        const a = r.an[yi];
        if (!a || !a.flag) return;
        seen.add(r.c.id + "|" + t.id + "|" + a.flag);
        (a.flag === "spike" ? spikeList : fallList).push({ r, a, t });
      });
    });
    // la voce madre esce se un suo sottotipo ha lo stesso segnale nella stessa città
    const dedupe = (list) => list.filter((d) => !TYPES.some((t) => PARENT[t.id] === d.t.id && seen.has(d.r.c.id + "|" + t.id + "|" + d.a.flag)));
    spikeList = dedupe(spikeList); fallList = dedupe(fallList);
    if (state.spikeSort === "abs") {
      spikeList.sort((p, q) => (q.a.n - q.a.avg) - (p.a.n - p.a.avg));
      fallList.sort((p, q) => (p.a.n - p.a.avg) - (q.a.n - q.a.avg));
    } else {
      spikeList.sort((p, q) => q.a.low - p.a.low);
      fallList.sort((p, q) => p.a.high - q.a.high);
    }
  }

  function cardHTML(d, kind) {
    const yrs = d.a.baseYears.join(", ").replace(/, (\d+)$/, L(" e $1", " and $1"));
    return `<button type="button" class="card ${kind} rv-up" data-city="${d.r.c.id}" data-type="${d.t.id}">
      <span class="what">${esc(d.t.label)}</span>
      <span class="city">${esc(d.r.c.name)}</span>
      <span class="row"><span class="big">${fmtPct(d.a.rr - 1)}</span><span class="small">${esc(d.r.c.region)}</span></span>
      <span class="why">${EN
        ? `${nf0.format(d.a.n)} ${d.a.n === 1 ? "case" : "cases"} in ${d.a.y} (${d.a.n >= d.a.avg ? "+" : "−"}${nf0.format(Math.abs(Math.round(d.a.n - d.a.avg)))}), compared with an average of ${nf0.format(Math.round(d.a.avg))} in ${yrs}.`
        : `${nf0.format(d.a.n)} casi nel ${d.a.y} (${d.a.n >= d.a.avg ? "+" : "−"}${nf0.format(Math.abs(Math.round(d.a.n - d.a.avg)))}), contro una media di ${nf0.format(Math.round(d.a.avg))} nel ${yrs}.`}</span>
      <svg aria-hidden="true"></svg></button>`;
  }

  function renderSpikes() {
    computeSpikes();
    const shown = spikeList.slice(0, state.spikeShown);
    const nCities = new Set(spikeList.map((d) => d.r.c.id)).size;
    $("#spike-count").textContent = EN
      ? `${spikeList.length} ${spikeList.length === 1 ? "spike" : "spikes"} in ${nCities} ${nCities === 1 ? "city" : "cities"} · ${fallList.length} sharp ${fallList.length === 1 ? "fall" : "falls"}`
      : `${spikeList.length} impennate in ${nCities} città · ${fallList.length} cali netti`;
    const wrap = $("#spike-cards");
    wrap.innerHTML = shown.map((d) => cardHTML(d, "spike")).join("") || (EN ? `<p class="note">No spikes in ${state.spikeYear}.</p>` : `<p class="note">Nessuna impennata nel ${state.spikeYear}.</p>`);
    $("#spike-more").hidden = spikeList.length <= state.spikeShown;
    const falls = fallList.slice(0, 6);
    $("#fall-cards").innerHTML = falls.map((d) => cardHTML(d, "fall")).join("");
    [[wrap, shown], [$("#fall-cards"), falls]].forEach(([el, list]) => {
      const svgs = el.querySelectorAll(".card svg");
      if (!svgs.length) return;
      const w = svgs[0].getBoundingClientRect().width || 200;
      svgs.forEach((s, k) => {
        const d = list[k];
        const vals = d.r.s;
        const an = d.r.an.map((a) => (a && a.y === d.a.y ? a : null));
        drawSpark(s, { w, h: 44, values: vals, yMax: d3.max(vals) * 1.1, an, hover: (i) => (EN
          ? `${esc(d.r.c.name)} · ${esc(d.t.label)}<br><b>${Y[i]}</b>: ${nf0.format(d.r.c.n[d.t.id][i] ?? 0)} ${(d.r.c.n[d.t.id][i] ?? 0) === 1 ? "case" : "cases"}, ${fmtRate(vals[i])} per 100,000 res.`
          : `${esc(d.r.c.name)} · ${esc(d.t.label)}<br><b>${Y[i]}</b>: ${nf0.format(d.r.c.n[d.t.id][i] ?? 0)} casi, ${fmtRate(vals[i])} ogni 100.000 ab.`) });
      });
    });
    reveal(wrap, wrap.querySelectorAll(".card"));
    reveal($("#fall-cards"), $("#fall-cards").querySelectorAll(".card"));
  }

  // ------------------------------------------------------------------ small multiples

  function sortedRows(m) {
    const rows = m.rows.slice();
    const byLvl = (a, b) => (b.lvl ?? -1) - (a.lvl ?? -1);
    switch (state.sort) {
      case "change": return rows.sort((a, b) => (b.cmp && b.cmp.pct != null ? b.cmp.pct : -9) - (a.cmp && a.cmp.pct != null ? a.cmp.pct : -9));
      case "spike": return rows.sort((a, b) => ((b.lastSpike ? b.lastSpike.y : 0) - (a.lastSpike ? a.lastSpike.y : 0)) || ((b.lastSpike ? b.lastSpike.low : 0) - (a.lastSpike ? a.lastSpike.low : 0)) || byLvl(a, b));
      case "name": return rows.sort((a, b) => a.c.name.localeCompare(b.c.name, "it"));
      default: return rows.sort(byLvl);
    }
  }

  function renderGrid() {
    const m = model(state.gridType);
    const nSp = m.rows.filter((r) => r.spikes.length).length;
    $("#grid-dek").textContent = EN
      ? `${m.label}, per 100,000 residents, 2006 to 2024. The gold dots are spikes: ${nSp} ${nSp === 1 ? "provincial capital has" : "provincial capitals have"} had at least one since 2008. With the same scale for all, you can compare levels; with each city’s own scale, the shape of each curve is easier to see.`
      : `${m.label}, ogni 100.000 abitanti, dal 2006 al 2024. I punti d’oro sono le impennate: ${nSp} capoluoghi ne hanno avuta almeno una dal 2008. Con la scala uguale per tutte si confrontano i livelli; con la scala propria si vede meglio la forma di ogni curva.`;
    const host = $("#sm");
    host.innerHTML = "";
    const groups = state.sort === "area"
      ? AREAS.map((a) => ({ title: a, rows: sortedRows({ ...m, rows: m.rows.filter((r) => r.c.area === a) }).sort((x, y) => (y.lvl ?? -1) - (x.lvl ?? -1)) }))
      : [{ title: null, rows: sortedRows(m) }];
    // al massimo state.gridShown città; nell'ordine per area la quota si divide tra le aree in proporzione al numero di capoluoghi
    const n = Math.min(state.gridShown, m.rows.length);
    const quota = groups.map((gp) => (n * gp.rows.length) / m.rows.length);
    const take = quota.map(Math.floor);
    quota.map((q, i) => [q - take[i], i]).sort((a, b) => b[0] - a[0]).slice(0, n - d3.sum(take)).forEach(([, i]) => take[i]++);
    groups.forEach((gp, i) => { gp.rows = gp.rows.slice(0, take[i]); });
    $("#grid-more").hidden = n >= m.rows.length;
    const panels = [];
    groups.forEach((gp) => {
      const g = document.createElement("div");
      g.className = "sm-group";
      if (gp.title) g.innerHTML = `<h3>${areaName(gp.title)}</h3>`;
      const grid = document.createElement("div");
      grid.className = "sm-grid";
      gp.rows.forEach((r) => {
        const b = document.createElement("button");
        b.type = "button";
        const hot = r.an[LAST] && r.an[LAST].flag === "spike";
        b.className = "sm" + (hot ? " hot" : "");
        b.dataset.city = r.c.id;
        b.setAttribute("aria-label", EN
          ? `${r.c.name}: ${fmtRate(r.lvl)} per 100,000 residents, ${fmtPct(r.cmp && r.cmp.pct)} compared with ${m.base}. Open the profile.`
          : `${r.c.name}: ${fmtRate(r.lvl)} ogni 100.000 abitanti, ${fmtPct(r.cmp && r.cmp.pct)} rispetto al ${m.base}. Apri la scheda.`);
        const badge = r.spikes.length ? `<span class="badge" title="${L("Impennate dal 2008", "Spikes since 2008")}">${r.spikes.length}</span>` : "";
        b.innerHTML = `<span class="h"><span class="n">${esc(r.c.name)}</span><span class="small">${fmtRate(r.lvl)}</span></span><svg aria-hidden="true"></svg><span class="x"><span>${esc(r.c.region)}</span><span>${badge} ${chgHTML(r.cmp)}</span></span>`;
        grid.appendChild(b);
        panels.push([b, r]);
      });
      g.appendChild(grid);
      host.appendChild(g);
    });
    if (!panels.length) return;
    const w = panels[0][0].querySelector("svg").getBoundingClientRect().width || 140;
    panels.forEach(([b, r]) => {
      const yMax = state.scale === "shared" ? m.max * 1.04 : Math.max(d3.max(r.s) || 0, d3.max(m.it)) * 1.08;
      drawSpark(b.querySelector("svg"), {
        w, h: 64, values: r.s, italy: m.it, yMax, an: r.an,
        hover: (i) => {
          const a = r.an[i];
          const flag = a && a.flag === "spike" ? (EN ? `<br>Spike: ${fmtPct(a.rr - 1)} on the previous average` : `<br>Impennata: ${fmtPct(a.rr - 1)} sulla media precedente`) : a && a.flag === "fall" ? `<br>${L("Calo netto", "Sharp fall")}: ${fmtPct(a.rr - 1)}` : "";
          return EN
            ? `<b>${esc(r.c.name)}</b> · ${Y[i]}<br>${fmtRate(r.s[i])} per 100,000 res. (Italy ${fmtRate(m.it[i])})<br>${nf0.format(r.c.n[m.t][i])} ${r.c.n[m.t][i] === 1 ? "case" : "cases"}${flag}`
            : `<b>${esc(r.c.name)}</b> · ${Y[i]}<br>${fmtRate(r.s[i])} ogni 100.000 ab. (Italia ${fmtRate(m.it[i])})<br>${nf0.format(r.c.n[m.t][i])} casi${flag}`;
        },
      });
    });
    reveal(host, panels.map((p) => p[0]));
  }

  // ------------------------------------------------------------------ percezione

  function renderPerception() {
    const tot = ITALY.rate.TOT;
    const silcY = Object.keys(ITALY.silc).map(Number);
    const silcV = silcY.map((y) => ITALY.silc[y]);
    const x0 = Math.min(silcY[0], Y[0]), x1 = Math.max(silcY[silcY.length - 1], Y[LAST]);
    const xTicks = [2005, 2010, 2015, 2020, 2025];
    const allYears = d3.range(x0, x1 + 1);
    const crimeVals = allYears.map((y) => (Y.includes(y) ? tot[Y.indexOf(y)] : null));
    const silcVals = allYears.map((y) => ITALY.silc[y] ?? null);
    lineChart($("#perc-crime"), {
      years: allYears, values: crimeVals, xDomain: [x0, x1], xTicks, yMax: d3.max(tot) * 1.1, height: 170, mr: 20,
      marks: [{ year: 2015, text: nf0.format(tot[Y.indexOf(2015)]) }, { year: 2023, text: nf0.format(tot[Y.indexOf(2023)]), dy: 18 }, { year: Y[LAST], text: nf0.format(tot[LAST]), strong: true, anchor: "end" }],
      hover: (i) => `<b>${allYears[i]}</b>: ${nf0.format(crimeVals[i])} ${L("delitti ogni 100.000 ab.", "crimes per 100,000 res.")}`,
    });
    const iMax = d3.maxIndex(silcV), iMin = d3.minIndex(silcV);
    lineChart($("#perc-silc"), {
      years: allYears, values: silcVals, xDomain: [x0, x1], xTicks, yMax: d3.max(silcV) * 1.2, height: 170, mr: 20,
      yFmt: (v) => v + "%",
      marks: [{ year: silcY[iMax], text: nf1.format(silcV[iMax]) + "%" }, { year: silcY[iMin], text: nf1.format(silcV[iMin]) + "%", dy: 18 }, { year: silcY[silcY.length - 1], text: nf1.format(silcV[silcV.length - 1]) + "%", strong: true, anchor: "end" }],
      hover: (i) => `<b>${allYears[i]}</b>: ${nf1.format(silcVals[i])}% ${L("delle famiglie", "of households")}`,
    });

    const a = silcY[iMax], b = silcY[iMin];
    const crimeAB = tot[Y.indexOf(b)] / tot[Y.indexOf(a)] - 1;
    const percAB = silcV[iMin] / silcV[iMax] - 1;
    const lastS = silcY[silcY.length - 1];
    const percUp = silcV[silcV.length - 1] / silcV[iMin] - 1;
    const crimeUp = tot[LAST] / tot[Y.indexOf(b)] - 1;
    $("#perc-dek").innerHTML = EN ? `Between ${a} and ${b} the share of households reporting crime or vandalism in their area went from ${nf1.format(silcV[iMax])}% to ${nf1.format(silcV[iMin])}%: <strong>${fmtPct(percAB)}</strong>. Over the same period reported crimes per resident changed by ${fmtPct(crimeAB)}. From ${b} to ${lastS} the share rose again to ${nf1.format(silcV[silcV.length - 1])}%: <strong>${fmtPct(percUp)}</strong>, against ${fmtPct(crimeUp)} for reported crimes from ${b} to ${Y[LAST]}. Perception moves much more than crime does.` : `Tra il ${a} e il ${b} la quota di famiglie che segnalavano criminalità o vandalismo nella propria zona è passata dal ${nf1.format(silcV[iMax])}% al ${nf1.format(silcV[iMin])}%: <strong>${fmtPct(percAB)}</strong>. Nello stesso periodo i delitti denunciati per abitante sono cambiati di ${fmtPct(crimeAB)}. Dal ${b} al ${lastS} la quota è risalita al ${nf1.format(silcV[silcV.length - 1])}%: <strong>${fmtPct(percUp)}</strong>, contro ${fmtPct(crimeUp)} dei delitti denunciati dal ${b} al ${Y[LAST]}. La percezione si muove molto più dei reati.`;

    // dispersione: grandi città
    const pts = CITIES.filter((c) => c.perc && c.perc["2024"] != null).map((c) => ({ c, x: (c.n.TOT[LAST] / c.pop[LAST]) * 1e5, y: c.perc["2024"] }));
    const el = $("#perc-scatter");
    const w = Math.max(280, el.clientWidth), h = Math.round(Math.min(480, w * 0.78));
    const mg = { t: 12, r: 16, b: 44, l: 44 };
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", L("Grafico a dispersione: tasso di delitti e rischio percepito nelle grandi città", "Scatter chart: crime rate and perceived risk in the large cities"));
    svg.selectAll("*").remove();
    const x = d3.scaleLinear([0, d3.max(pts, (d) => d.x) * 1.08], [mg.l, w - mg.r]).nice();
    const y = d3.scaleLinear([0, d3.max(pts, (d) => d.y) * 1.1], [h - mg.b, mg.t]).nice();
    const ya = svg.append("g").attr("class", "axis").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(w - mg.l - mg.r)).tickFormat((v) => v + "%"));
    ya.select(".domain").remove();
    const xa = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - mg.b})`).call(d3.axisBottom(x).ticks(5).tickSize(-(h - mg.t - mg.b)).tickFormat((v) => nf0.format(v)));
    xa.select(".domain").remove();
    svg.selectAll(".axis .tick line").style("stroke", "var(--grid)");
    svg.append("text").attr("class", "lbl").attr("x", w - mg.r).attr("y", h - 6).attr("text-anchor", "end").text(L("delitti ogni 100.000 abitanti →", "crimes per 100,000 residents →"));
    const itX = tot[LAST], itY = ITALY.perc["2024"];
    svg.append("circle").attr("class", "rv-pop").style("--t0", "0.5s").attr("cx", x(itX)).attr("cy", y(itY)).attr("r", 6).style("fill", "none").style("stroke", "var(--ink)").style("stroke-width", 1.5);
    const labelled = new Set();
    pts.slice().sort((p, q) => q.x - p.x).slice(0, 3).forEach((d) => labelled.add(d.c.id));
    pts.slice().sort((p, q) => q.y - p.y).slice(0, 3).forEach((d) => labelled.add(d.c.id));
    pts.slice().sort((p, q) => p.y - q.y).slice(0, 2).forEach((d) => labelled.add(d.c.id));
    ["058091", "015146", "063049"].forEach((id) => labelled.add(id));
    const boxes = pts.map((d) => [x(d.x) - 6, y(d.y) - 6, x(d.x) + 6, y(d.y) + 6]).concat([[x(itX) - 7, y(itY) - 7, x(itX) + 7, y(itY) + 7]]);
    const place = (px, py, text) => {
      const tw = text.length * 6.4 + 2, th = 12;
      const opts = [[px + 9, py + 4, "start"], [px - 9, py + 4, "end"], [px, py - 10, "middle"], [px, py + 17, "middle"]];
      for (const [lx, ly, anchor] of opts) {
        const x0 = anchor === "start" ? lx : anchor === "end" ? lx - tw : lx - tw / 2;
        const b = [x0, ly - th + 2, x0 + tw, ly + 2];
        if (b[0] < 0 || b[2] > w || b[1] < 0) continue;
        if (boxes.some((o) => !(b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3]))) continue;
        boxes.push(b);
        svg.append("text").attr("class", "lbl halo rv-fade").attr("x", lx).attr("y", ly).attr("text-anchor", anchor).text(text).style("pointer-events", "none");
        return true;
      }
      return false;
    };
    place(x(itX), y(itY), L("Italia", "Italy"));
    pts.forEach((d, k) => {
      svg.append("circle").attr("class", "rv-pop").style("--i", k).attr("cx", x(d.x)).attr("cy", y(d.y)).attr("r", 5).style("fill", "var(--ink-2)").style("stroke", "var(--surface)").style("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mousemove", (ev) => showTip(`<b>${esc(d.c.name)}</b><br>${nf0.format(d.x)} ${L("delitti ogni 100.000 ab.", "crimes per 100,000 res.")} (2024)<br>${nf1.format(d.y)}% ${L("famiglie che sentono a rischio la zona", "of households that feel their area is at risk")}`, ev))
        .on("mouseleave", hideTip)
        .on("click", () => openCity(d.c));
    });
    pts.filter((d) => labelled.has(d.c.id)).forEach((d) => place(x(d.x), y(d.y), d.c.name));
    const r = pearson(pts.map((d) => d.x), pts.map((d) => d.y));
    const hiP = pts.slice().sort((p, q) => q.y - p.y)[0], loC = pts.slice().sort((p, q) => p.x - q.x)[0];
    $("#perc-note").textContent = EN ? `In the ${pts.length} large cities measured by ISTAT, the link between reported crimes and fear is ${Math.abs(r) < 0.3 ? "weak" : Math.abs(r) < 0.6 ? "moderate" : "strong"} (correlation ${nf2.format(r)}). ${hiP.c.name} is the city where the most households feel at risk (${nf1.format(hiP.y)}%), with ${nf0.format(hiP.x)} crimes per 100,000 residents. The perception figure comes from the ISTAT survey Aspetti della vita quotidiana (Aspects of daily life).` : `Nelle ${pts.length} grandi città misurate dall’ISTAT, il legame tra delitti denunciati e paura è ${Math.abs(r) < 0.3 ? "debole" : Math.abs(r) < 0.6 ? "moderato" : "forte"} (correlazione ${nf2.format(r)}). ${hiP.c.name} è la città dove più famiglie si sentono a rischio (${nf1.format(hiP.y)}%), con ${nf0.format(hiP.x)} delitti ogni 100.000 abitanti. Il dato sulla percezione viene dall’indagine ISTAT Aspetti della vita quotidiana.`;
    reveal(el);
    if (has("perc-index")) renderPercIndex();
    if (has("perc-slope")) renderPercSlope();
  }

  // Fatto 100 il primo anno in comune, le due serie sullo stesso asse: la quota di famiglie che segnalano criminalità o
  // vandalismo nella zona (EU-SILC) e i delitti denunciati per abitante. Si vede subito quale delle due si muove di più.
  function renderPercIndex() {
    const tot = ITALY.rate.TOT, sy = Object.keys(ITALY.silc).map(Number).sort((a, b) => a - b);
    const y0 = Math.max(Y[0], sy[0]), y1 = Math.max(Y[LAST], sy[sy.length - 1]);
    const yrs = d3.range(y0, y1 + 1);
    const crime = yrs.map((y) => (Y.includes(y) ? (100 * tot[Y.indexOf(y)]) / tot[Y.indexOf(y0)] : null));
    const silc = yrs.map((y) => (ITALY.silc[y] != null ? (100 * ITALY.silc[y]) / ITALY.silc[y0] : null));
    const all = crime.concat(silc).filter((v) => v != null);
    $("#perc-index-sub").textContent = EN ? `Both series are set to 100 in ${y0}: a line that falls to 50 has halved, one that rises to 150 has grown by half.` : `Le due serie fatte 100 nel ${y0}: una curva che scende a 50 si è dimezzata, una che sale a 150 è cresciuta della metà.`;
    seriesChart($("#perc-index"), {
      years: yrs, label: EN ? `Households reporting crime in their area and reported crimes per resident, ${y0} = 100` : `Famiglie che segnalano criminalità nella zona e delitti denunciati per abitante, ${y0} = 100`,
      yMin: 0, yMax: Math.max(140, d3.max(all) * 1.08), ref: 100, covid: true, height: 280,
      series: [
        { name: L("famiglie che segnalano criminalità", "households reporting crime"), values: silc, color: "var(--ink)", width: 2.5, label: false },
        { name: L("delitti denunciati", "reported crimes"), values: crime, color: "var(--muted)", width: 2, label: false },
      ],
      tip: (i) => `<b>${yrs[i]}</b>` + (silc[i] != null ? `<br>${L("famiglie che segnalano criminalità", "households reporting crime")}: ${nf1.format(ITALY.silc[yrs[i]])}% (${L("indice", "index")} ${nf0.format(silc[i])})` : "") +
        (crime[i] != null ? `<br>${L("delitti denunciati", "reported crimes")}: ${nf0.format(tot[Y.indexOf(yrs[i])])} ${L("ogni 100.000 ab.", "per 100,000 res.")} (${L("indice", "index")} ${nf0.format(crime[i])})` : ""),
    });
  }

  // Le grandi città in due classifiche dello stesso anno: a sinistra per delitti denunciati ogni 100.000 abitanti, a destra
  // per famiglie che giudicano a rischio la propria zona. Le linee più inclinate sono le città dove paura e denunce non vanno insieme.
  function renderPercSlope() {
    const py = CITIES.some((c) => c.perc && c.perc[String(Y[LAST])] != null) ? String(Y[LAST]) : "2024", iy = Y.indexOf(+py);
    const pts = CITIES.filter((c) => c.perc && c.perc[py] != null).map((c) => ({ c, x: (c.n.TOT[iy] / c.pop[iy]) * 1e5, y: c.perc[py] }));
    const byX = pts.slice().sort((a, b) => b.x - a.x), byY = pts.slice().sort((a, b) => b.y - a.y);
    pts.forEach((d) => { d.rx = byX.indexOf(d) + 1; d.ry = byY.indexOf(d) + 1; });
    const n = pts.length, hi = new Set(pts.slice().sort((a, b) => Math.abs(b.rx - b.ry) - Math.abs(a.rx - a.ry)).slice(0, 6).map((d) => d.c.id));
    const el = $("#perc-slope");
    const w = Math.max(300, el.clientWidth), rowH = 18, m = { t: 30, b: 8 }, h = m.t + n * rowH + m.b;
    const lw = Math.min(150, Math.round(w * 0.34)), x0 = lw, x1 = w - lw, yy = (r) => m.t + (r - 0.5) * rowH;
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", EN ? `The ${n} large cities ranked by reported crimes and by perceived risk in ${py}` : `Le ${n} grandi città ordinate per delitti denunciati e per rischio percepito nel ${py}`);
    svg.selectAll("*").remove();
    svg.append("text").attr("class", "lbl-strong").attr("x", x0).attr("y", 12).attr("text-anchor", "middle").text(L("denunce", "reports"));
    svg.append("text").attr("class", "lbl-strong").attr("x", x1).attr("y", 12).attr("text-anchor", "middle").text(L("paura", "fear"));
    const tipOf = (d) => EN ? `<b>${esc(d.c.name)}</b> · ${py}<br>${ordinal(d.rx)} of ${n} for reported crimes: ${nf0.format(d.x)} per 100,000 residents<br>${ordinal(d.ry)} for households that feel their area is at risk: ${nf1.format(d.y)}%` : `<b>${esc(d.c.name)}</b> · ${py}<br>${d.rx}ª su ${n} per delitti denunciati: ${nf0.format(d.x)} ogni 100.000 abitanti<br>${d.ry}ª per famiglie che sentono a rischio la zona: ${nf1.format(d.y)}%`;
    pts.slice().sort((a, b) => hi.has(a.c.id) - hi.has(b.c.id)).forEach((d, k) => {
      const g = svg.append("g").attr("class", "sl rv-fade" + (hi.has(d.c.id) ? " hi" : "")).style("--i", k).style("cursor", "pointer")
        .on("mouseenter", function () { this.classList.add("on"); this.parentNode.appendChild(this); })
        .on("mousemove", (ev) => showTip(tipOf(d), ev))
        .on("mouseleave", function () { this.classList.remove("on"); hideTip(); })
        .on("click", () => { hideTip(); openCity(d.c); });
      g.append("line").attr("class", "hit").attr("x1", x0).attr("x2", x1).attr("y1", yy(d.rx)).attr("y2", yy(d.ry));
      g.append("line").attr("class", "ln").attr("x1", x0).attr("x2", x1).attr("y1", yy(d.rx)).attr("y2", yy(d.ry));
      g.append("circle").attr("cx", x0).attr("cy", yy(d.rx)).attr("r", 3.5);
      g.append("circle").attr("cx", x1).attr("cy", yy(d.ry)).attr("r", 3.5);
      g.append("text").attr("class", "lbl").attr("x", x0 - 9).attr("y", yy(d.rx) + 4).attr("text-anchor", "end").text(`${d.c.name} ${d.rx}`);
      g.append("text").attr("class", "lbl").attr("x", x1 + 9).attr("y", yy(d.ry) + 4).text(`${d.ry} ${d.c.name}`);
    });
    reveal(el);
    const up = pts.filter((d) => d.ry < d.rx).sort((a, b) => (b.rx - b.ry) - (a.rx - a.ry))[0], down = pts.filter((d) => d.ry > d.rx).sort((a, b) => (b.ry - b.rx) - (a.ry - a.rx))[0];
    if (up && down) $("#perc-slope-note").textContent = EN ? `In ${py}, ${up.c.name} is ${ordinal(up.rx)} for reports and ${ordinal(up.ry)} for fear; ${down.c.name}, by contrast, is ${ordinal(down.rx)} for reports and ${ordinal(down.ry)} for fear. Tap a city to open its profile.` : `Nel ${py} ${up.c.name} è ${up.rx}ª per denunce e ${up.ry}ª per paura; ${down.c.name}, al contrario, è ${down.rx}ª per denunce e ${down.ry}ª per paura. Tocca una città per aprirne la scheda.`;
  }

  // Le province: la quota di famiglie che sentono a rischio la propria zona e i delitti denunciati ogni 100.000 abitanti,
  // entrambi come media degli anni in cui c'è la percezione (oggi 2022-2024). Le stime per provincia vengono da un'indagine
  // campionaria e da sole oscillano: la media di tre anni le rende più stabili.
  async function loadPercProv() {
    try {
      const r = await fetch(ROOT + "data/province.json");
      if (!r.ok) throw new Error(r.status);
      PROVP = await r.json();
      renderPercProv();
    } catch (e) {
      $("#perc-prov-note").textContent = EN ? `The province data did not load (${e.message}).` : `I dati delle province non si sono caricati (${e.message}).`;
      console.error(e);
    }
  }

  function renderPercProv() {
    const P = PROVP, yrs = [...new Set(Object.values(P.prov).flatMap((p) => Object.keys(p.perc || {})))].sort();
    const iy = yrs.map((y) => P.meta.years.indexOf(+y)).filter((i) => i >= 0);
    const pts = Object.entries(P.prov).map(([id, p]) => ({ id, p, x: d3.mean(iy, (i) => p.rate.TOT[i]), y: d3.mean(yrs, (y) => (p.perc ? p.perc[y] : undefined)) }))
      .filter((d) => d.x != null && d.y != null);
    const span = yrs.length > 1 ? `${yrs[0]}–${yrs[yrs.length - 1]}` : yrs[0];
    $("#perc-prov-sub").textContent = EN ? `The ${pts.length} provinces, ${span} average. Horizontal axis: reported crimes per 100,000 residents. Vertical axis: households that consider the area they live in very or quite at risk of crime. The empty circle is Italy.` : `Le ${pts.length} province, media ${span}. Asse orizzontale: delitti denunciati ogni 100.000 abitanti. Asse verticale: famiglie che giudicano molto o abbastanza a rischio di criminalità la zona in cui vivono. Il cerchio vuoto è l’Italia.`;
    const el = $("#perc-prov");
    const w = Math.max(280, el.clientWidth), h = Math.round(Math.min(520, Math.max(300, w * 0.66))), mg = { t: 12, r: 16, b: 44, l: 44 };
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", L("Grafico a dispersione: delitti denunciati e rischio percepito nelle province", "Scatter chart: reported crimes and perceived risk in the provinces"));
    svg.selectAll("*").remove();
    const x = d3.scaleLinear([0, d3.max(pts, (d) => d.x) * 1.05], [mg.l, w - mg.r]).nice();
    const y = d3.scaleLinear([0, d3.max(pts, (d) => d.y) * 1.1], [h - mg.b, mg.t]).nice();
    const ya = svg.append("g").attr("class", "axis").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(w - mg.l - mg.r)).tickFormat((v) => v + "%"));
    ya.select(".domain").remove();
    const xa = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - mg.b})`).call(d3.axisBottom(x).ticks(w < 480 ? 4 : 6).tickSize(-(h - mg.t - mg.b)).tickFormat((v) => nf0.format(v)));
    xa.select(".domain").remove();
    svg.selectAll(".axis .tick line").style("stroke", "var(--grid)");
    svg.append("text").attr("class", "lbl").attr("x", w - mg.r).attr("y", h - 6).attr("text-anchor", "end").text(L("delitti ogni 100.000 abitanti →", "crimes per 100,000 residents →"));
    // l'Italia, con le stesse medie
    const itX = d3.mean(yrs.filter((yy) => Y.includes(+yy)), (yy) => ITALY.rate.TOT[Y.indexOf(+yy)]), itY = d3.mean(yrs, (yy) => ITALY.perc[yy]);
    const boxes = pts.map((d) => [x(d.x) - 5, y(d.y) - 5, x(d.x) + 5, y(d.y) + 5]);
    const place = (px, py, text) => {
      const tw = text.length * 6.2 + 2, th = 12;
      for (const [lx, ly, anchor] of [[px + 8, py + 4, "start"], [px - 8, py + 4, "end"], [px, py - 9, "middle"], [px, py + 16, "middle"]]) {
        const bx = anchor === "start" ? lx : anchor === "end" ? lx - tw : lx - tw / 2, b = [bx, ly - th + 2, bx + tw, ly + 2];
        if (b[0] < 0 || b[2] > w || b[1] < 0 || b[3] > h - mg.b) continue;
        if (boxes.some((q) => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]))) continue;
        boxes.push(b);
        svg.append("text").attr("class", "lbl halo rv-fade").attr("x", lx).attr("y", ly).attr("text-anchor", anchor).text(text).style("pointer-events", "none");
        return;
      }
    };
    pts.forEach((d, k) => {
      svg.append("circle").attr("class", "rv-pop").style("--i", k).attr("cx", x(d.x)).attr("cy", y(d.y)).attr("r", 4).style("fill", "var(--ink-2)").style("fill-opacity", 0.75).style("stroke", "var(--surface)").style("stroke-width", 1.5)
        .on("mousemove", (ev) => showTip(`<b>${esc(d.p.name)}</b> · ${esc(d.p.region)}<br>${nf0.format(d.x)} ${L("delitti ogni 100.000 ab.", "crimes per 100,000 res.")}<br>${nf1.format(d.y)}% ${L("famiglie che sentono a rischio la zona", "of households that feel their area is at risk")}<br><span class="small">${EN ? `${span} average` : `media ${span}`}</span>`, ev))
        .on("mouseleave", hideTip);
    });
    if (itX != null && itY != null) {
      svg.append("circle").attr("class", "rv-pop").style("--t0", "0.5s").attr("cx", x(itX)).attr("cy", y(itY)).attr("r", 6).style("fill", "none").style("stroke", "var(--ink)").style("stroke-width", 1.5);
      boxes.push([x(itX) - 7, y(itY) - 7, x(itX) + 7, y(itY) + 7]);
      place(x(itX), y(itY), L("Italia", "Italy"));
    }
    const lab = new Map();
    const add = (list) => list.forEach((d) => lab.set(d.id, d));
    add(pts.slice().sort((a, b) => b.y - a.y).slice(0, 4));
    add(pts.slice().sort((a, b) => a.y - b.y).slice(0, 3));
    add(pts.slice().sort((a, b) => b.x - a.x).slice(0, 3));
    add(pts.slice().sort((a, b) => a.x - b.x).slice(0, 2));
    add(pts.filter((d) => ["Roma", "Milano", "Napoli"].includes(d.p.name)));
    lab.forEach((d) => place(x(d.x), y(d.y), d.p.name.split("/")[0]));
    reveal(el);
    const r = pearson(pts.map((d) => d.x), pts.map((d) => d.y));
    const hiY = pts.slice().sort((a, b) => b.y - a.y)[0], hiX = pts.slice().sort((a, b) => b.x - a.x)[0];
    $("#perc-prov-note").textContent = EN ? `In the ${pts.length} provinces the link between reported crimes and fear is ${Math.abs(r) < 0.3 ? "weak" : Math.abs(r) < 0.6 ? "moderate" : "strong"} (correlation ${nf2.format(r)}). ` +
      `The province where the most households feel their area is at risk is ${hiY.p.name.split("/")[0]} (${nf1.format(hiY.y)}%), with ${nf0.format(hiY.x)} crimes per 100,000 residents; the one with the most reports is ${hiX.p.name.split("/")[0]} (${nf0.format(hiX.x)}), where ${nf1.format(hiX.y)}% of households feel at risk.` : `Nelle ${pts.length} province il legame tra delitti denunciati e paura è ${Math.abs(r) < 0.3 ? "debole" : Math.abs(r) < 0.6 ? "moderato" : "forte"} (correlazione ${nf2.format(r)}). ` +
      `La provincia dove più famiglie sentono a rischio la propria zona è ${hiY.p.name.split("/")[0]} (${nf1.format(hiY.y)}%), con ${nf0.format(hiY.x)} delitti ogni 100.000 abitanti; quella con più denunce è ${hiX.p.name.split("/")[0]} (${nf0.format(hiX.x)}), dove si sente a rischio il ${nf1.format(hiX.y)}% delle famiglie.`;
  }

  function pearson(a, b) {
    const ma = d3.mean(a), mb = d3.mean(b);
    let num = 0, da = 0, db = 0;
    a.forEach((v, i) => { num += (v - ma) * (b[i] - mb); da += (v - ma) ** 2; db += (b[i] - mb) ** 2; });
    return num / Math.sqrt(da * db);
  }

  // ------------------------------------------------------------------ scheda città e comune

  const dlg = $("#city-dialog");
  const cityById = (id) => CITIES.find((c) => c.id === id);
  const normQ = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const placeSlug = (e) => slug(e.name) + "-" + e.sigla.toLowerCase();
  const andList = (a) => (a.length > 1 ? a.slice(0, -1).join(", ") + L(" e ", " and ") + a[a.length - 1] : a[0] || "");

  function showCard() {
    if (!dlg.open) {
      dlg._rvShown = false;
      // finché dura l'animazione d'ingresso i dati che arrivano dopo (province, quartieri) non ridisegnano la scheda
      dlg._rvUntil = revealer && !stillMotion.matches ? Date.now() + 1800 : 0;
      dlg.showModal();
    }
    dlg.scrollTop = 0;
    dlg.appendChild(tip);
  }

  // La scheda ha il suo reato e il suo anno di confronto: quelli della sezione da cui la si apre (mappa, griglia,
  // impennata), altrimenti tutti i delitti sul 2019. Scegliere un altro reato dentro la scheda non tocca la pagina.
  function openCity(c, type = "TOT", base = REF) {
    if (!c) return;
    if (state.city !== c) state.qSel = null;
    state.city = c;
    state.place = null;
    state.cardType = TYPE[type] ? type : "TOT";
    state.cardBase = base;
    renderCity();
    showCard();
    try { history.replaceState(null, "", "#" + slug(c.name)); } catch (e) { /* ignorato */ }
    // la provincia del capoluogo arriva con data/province.json: la scheda si completa appena c'è
    if (!PROV && !placesFailed) loadPlaces().then(() => redrawCard(c)).catch(() => {});
    // i quartieri, per le città che li hanno (data/quartieri/index.json): stessa cosa
    if (QINDEX.has(c.id) && QUART[c.id] === undefined) loadQuart(c.id).then((q) => { if (q) redrawCard(c); });
  }

  // Ridisegna la scheda quando arrivano dati in ritardo, ma solo a scheda ancora aperta sulla stessa città
  // e dopo la fine dell'animazione d'ingresso, così il grafico non si interrompe a metà tratto.
  function redrawCard(c) {
    const wait = Math.max(0, (dlg._rvUntil || 0) - Date.now());
    setTimeout(() => { if (state.city === c) renderCity(); }, wait);
  }

  function openProv(e, type = "TOT", base = REF) {
    state.city = null;
    state.place = e;
    state.cardType = TYPE[type] ? type : "TOT";
    state.cardBase = base;
    renderProv();
    showCard();
    try { history.replaceState(null, "", "#" + placeSlug(e)); } catch (err) { /* ignorato */ }
  }

  function openPlace(e) {
    if (!e) return;
    if (e.city) openCity(cityById(e.city));
    else if (PROV) openProv(e);
  }

  // Il grafico nel tempo e i riquadri di tutti i reati si disegnano dopo l'apertura, quando la scheda ha la sua larghezza.
  function drawCard(series, an, rows, hoverRow) {
    requestAnimationFrame(() => {
      const el = $("#place-chart");
      if (el) multiLine(el, { series, an, label: EN ? `${TYPE[state.cardType].label} per 100,000 residents, ${Y[0]}–${Y[LAST]}` : `${TYPE[state.cardType].label} ogni 100.000 abitanti, ${Y[0]}–${Y[LAST]}` });
      const svgs = $("#city-grid").querySelectorAll("svg");
      const w = svgs.length ? svgs[0].getBoundingClientRect().width || 140 : 0;
      svgs.forEach((s, k) => {
        const { t, row } = rows[k];
        const it = ITALY.rate[t.id];
        drawSpark(s, { w, h: 58, values: row.s, italy: it, an: row.an, yMax: Math.max(d3.max(row.s) || 0, d3.max(it)) * 1.08, hover: (i) => hoverRow(t, row, i) });
      });
      // il grafico e i riquadri si animano insieme a ogni apertura (showCard azzera il ricordo della scheda)
      reveal(dlg, [el].concat(Array.from(svgs, (s) => s.closest(".sm"))).filter(Boolean));
    });
  }

  const chartBlock = (label, keys) => `
      <div class="place-chart">
        <h3 class="subhead">${esc(label)} ${EN ? `from ${Y[0]} to ${Y[LAST]}` : `dal ${Y[0]} al ${Y[LAST]}`}</h3>
        <div class="key" aria-hidden="true">${keys}<span><i class="k-covid"></i>2020–21</span></div>
        <div class="chart" id="place-chart"></div>
      </div>`;

  const gridHTML = (rows) => rows.map(({ t, row }) => `<button type="button" class="sm" data-type="${t.id}" aria-pressed="${t.id === state.cardType}" style="${t.id === state.cardType ? "box-shadow: inset 0 0 0 2px var(--ink)" : ""}"><span class="h"><span class="n" title="${esc(t.label)}">${esc(t.label)}</span></span><svg aria-hidden="true"></svg><span class="x"><span>${fmtRate(row.s[LAST])}</span>${chgHTML(row.cmp)}</span></button>`).join("");

  // I tre reati saliti di più e i tre scesi di più rispetto all'anno base. Con i conteggi contano solo le
  // variazioni che superano la soglia statistica (z ≥ 2), come nelle mappe; senza, i rapporti tra tassi ufficiali.
  // Furti e rapine nel loro insieme lasciano il posto ai sottotipi che vanno nella stessa direzione.
  function moversHTML(rows, detail, tested) {
    const cand = rows.filter(({ t, row }) => t.id !== "TOT" && row && row.cmp && row.cmp.pct != null && isFinite(row.cmp.pct) && sig(row.cmp) !== "flat" && row.cmp.pct !== 0);
    const pick = (dir) => {
      const list = cand.filter(({ row }) => (dir === "up" ? row.cmp.pct > 0 : row.cmp.pct < 0));
      const ids = new Set(list.map((d) => d.t.id));
      return list.filter((d) => !TYPES.some((t) => PARENT[t.id] === d.t.id && ids.has(t.id)))
        .sort((p, q) => (dir === "up" ? q.row.cmp.pct - p.row.cmp.pct : p.row.cmp.pct - q.row.cmp.pct))
        .slice(0, 3);
    };
    const col = (dir, title, none) => {
      const list = pick(dir);
      const items = list.length
        ? list.map(({ t, row }) => `<li><button type="button" data-type="${t.id}" aria-pressed="${t.id === state.cardType}">${iconSVG(t.id)}<span class="mn" title="${esc(t.label)}">${esc(t.label)}</span>${chgHTML(row.cmp)}</button><span class="md">${detail(t, row)}</span></li>`).join("")
        : `<li class="none">${none}</li>`;
      return `<div class="mover ${dir}"><h4>${title}</h4><ol>${items}</ol></div>`;
    };
    const how = tested
      ? L("Solo le variazioni abbastanza grandi da non dipendere dal caso. Furti e rapine nel loro insieme lasciano il posto ai sottotipi.", "Only changes large enough not to be down to chance. Thefts and robberies as a whole make way for their subtypes.")
      : L("Variazioni sui tassi ufficiali della provincia, senza test statistico. Furti e rapine nel loro insieme lasciano il posto ai sottotipi.", "Changes in the province’s official rates, with no statistical test. Thefts and robberies as a whole make way for their subtypes.");
    return `<div class="movers">
        <h3>${L("Cosa è salito e cosa è sceso di più", "What rose and what fell the most")}</h3>
        <p class="small">${Y[LAST]} ${L("rispetto al", "compared with")} ${state.cardBase}. ${how} ${L("Tocca un reato per vederlo nel grafico.", "Tap a crime to see it in the chart.")}</p>
        <div class="movers-cols">
          ${col("up", L("Saliti di più", "Biggest rises"), tested ? L("Nessun aumento che superi la soglia statistica.", "No rise above the statistical threshold.") : L("Nessun reato in aumento.", "No crime type is rising."))}
          ${col("down", L("Scesi di più", "Biggest falls"), tested ? L("Nessun calo che superi la soglia statistica.", "No fall above the statistical threshold.") : L("Nessun reato in calo.", "No crime type is falling."))}
        </div>
      </div>`;
  }

  function spikeNote(pick) {
    const list = [];
    TYPES.forEach((t) => { const row = pick(t.id); if (row && row.an) row.an.forEach((a) => { if (a && a.flag === "spike" && a.y >= 2022) list.push({ t, a }); }); });
    list.sort((p, q) => q.a.y - p.a.y || q.a.low - p.a.low);
    return list.length
      ? EN ? `Spikes since 2022: ${list.slice(0, 6).map((d) => `${esc(lower(d.t.label))} in ${d.a.y} (${fmtPct(d.a.rr - 1)})`).join("; ")}${list.length > 6 ? `; and ${list.length - 6} more` : ""}.` : `Impennate dal 2022: ${list.slice(0, 6).map((d) => `${esc(lower(d.t.label))} nel ${d.a.y} (${fmtPct(d.a.rr - 1)})`).join("; ")}${list.length > 6 ? `; e altre ${list.length - 6}` : ""}.`
      : L("Nessuna impennata dal 2022 per i reati considerati.", "No spikes since 2022 for the crimes covered.");
  }

  // Mappa di posizione: la sagoma dell'Italia, ricavata una volta dai confini provinciali già caricati, e un punto.
  // I vertici più vicini di un pixel si saltano: a questa scala non si vedono e il disegno resta leggero.
  let LOC = null;
  function locMap(lon, lat, name) {
    if (lon == null || lat == null || !TOPO) return "";
    if (!LOC) {
      const obj = TOPO.objects[Object.keys(TOPO.objects)[0]];
      const land = topojson.merge(TOPO, obj.geometries);
      const proj = d3.geoConicConformal().parallels([38, 46]).rotate([-12.5, 0]).fitWidth(200, land);
      const thin = (out) => {
        let px = 0, py = 0, first = true;
        return {
          point(x, y) { if (first || Math.hypot(x - px, y - py) >= 0.9) { out.point(x, y); px = x; py = y; first = false; } },
          lineStart() { first = true; out.lineStart(); }, lineEnd() { out.lineEnd(); },
          polygonStart() { out.polygonStart(); }, polygonEnd() { out.polygonEnd(); },
        };
      };
      const path = d3.geoPath({ stream: (s) => proj.stream(thin(s)) }).digits(1);
      const [[x0, y0], [x1, y1]] = d3.geoPath(proj).bounds(land);
      LOC = { proj, d: path(land), x0: x0 - 8, x1: x1 + 8, y1: y1 + 8, box: [x0 - 8, y0 - 8, x1 - x0 + 16, y1 - y0 + 16].map((v) => v.toFixed(1)).join(" ") };
    }
    const [x, y] = LOC.proj([lon, lat]);
    // il nome accanto al punto: a destra se ci sta, se no a sinistra, se no centrato sotto (o sopra, in fondo alla carta).
    // La larghezza è stimata sul corpo 14 del .loc-name
    const w = name.length * 14 * 0.56;
    const lab = x + 13 + w <= LOC.x1 ? [x + 13, y, "start"] : x - 13 - w >= LOC.x0 ? [x - 13, y, "end"]
      : [Math.min(Math.max(x, LOC.x0 + w / 2), LOC.x1 - w / 2), y + 22 > LOC.y1 ? y - 15 : y + 22, "middle"];
    return `<figure class="loc"><svg viewBox="${LOC.box}" role="img" aria-label="${esc(name)} ${L("sulla carta d’Italia", "on a map of Italy")}"><path class="loc-land" d="${LOC.d}"/><circle class="loc-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9"/><circle class="loc-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/><text class="loc-name" x="${lab[0].toFixed(1)}" y="${lab[1].toFixed(1)}" dy="0.35em" text-anchor="${lab[2]}">${esc(name)}</text></svg></figure>`;
  }

  // In testa alla scheda, in parole semplici: quanto si denuncia, rispetto all'Italia, in che posizione e come è cambiato.
  // Stessi numeri dei riquadri sotto; vale per i capoluoghi e per le province.
  function timesItaly(r) {
    if (r >= 1.4) {
      const h = Math.round(r * 2) / 2;
      if (EN) {
        const WE = { 1.5: "one and a half times", 2: "twice", 2.5: "two and a half times", 3: "three times", 3.5: "three and a half times", 4: "four times", 4.5: "four and a half times", 5: "five times" };
        return `${Math.abs(r - h) <= 0.08 ? "about" : r < h ? "almost" : "more than"} ${WE[h] || nf1.format(h) + " times"} the Italian average`;
      }
      const W = { 1.5: "una volta e mezza", 2: "due volte", 2.5: "due volte e mezza", 3: "tre volte", 3.5: "tre volte e mezza", 4: "quattro volte", 4.5: "quattro volte e mezza", 5: "cinque volte" };
      return `${Math.abs(r - h) <= 0.08 ? "circa" : r < h ? "quasi" : "più di"} ${W[h] || nf1.format(h) + " volte"} la media italiana`;
    }
    const p = Math.round(Math.abs(r - 1) * 100);
    if (EN) return p < 5 ? "in line with the Italian average" : `${nf0.format(p)}% ${r > 1 ? "above" : "below"} the Italian average`;
    return p < 5 ? "in linea con la media italiana" : `${vowelNum(p) ? "l’" : "il "}${nf0.format(p)}% ${r > 1 ? "sopra" : "sotto"} la media italiana`;
  }
  function perPeople(v) {
    for (const s of [100, 1000, 10000]) { const x = (v * s) / 1e5; if (x >= 1.5) return EN ? `about ${nf0.format(Math.round(x))} for every ${nf0.format(s)} residents` : `circa ${nf0.format(Math.round(x))} ogni ${nf0.format(s)} residenti`; }
    return "";
  }
  // o: { t, where ("a Firenze"), lvl, it, rank, n, unit ("capoluoghi"/"province"), cmp, tourist }
  function verdictHTML(o) {
    if (o.lvl == null) return "";
    const m = model(o.t, state.cardBase), pp = perPeople(o.lvl);
    const gl = GLOSS[o.t] ? `<span class="gl"><b>${esc(m.label)}</b>: ${GLOSS[o.t]}.</span>` : "";
    if (o.lvl === 0) return EN ? `<p class="verdict">${esc(m.label)} ${o.where}, ${m.levelNote}: no reports. In Italy, ${fmtRate(o.it)} per 100,000 residents${m.rare ? " a year" : ""}.${gl}</p>` : `<p class="verdict">${esc(m.label)} ${o.where}, ${m.levelNote}: nessuna denuncia. In Italia ${fmtRate(o.it)} ogni 100.000 abitanti${m.rare ? " all’anno" : ""}.${gl}</p>`;
    let s = o.t === "TOT"
      ? EN ? `In ${Y[LAST]}, ${fmtRate(o.lvl)} crimes per 100,000 residents were reported ${o.where}${pp ? `: ${pp} in a year` : ""}. ` : `Nel ${Y[LAST]} ${o.where} sono stati denunciati ${fmtRate(o.lvl)} delitti ogni 100.000 abitanti${pp ? `: in un anno, ${pp}` : ""}. `
      : EN ? `${esc(m.label)} ${o.where}, ${m.levelNote}: ${fmtRate(o.lvl)} reports per 100,000 residents${m.rare ? " a year" : ""}${pp ? `, ${pp}${m.rare ? "" : " in a year"}` : ""}. ` : `${esc(m.label)} ${o.where}, ${m.levelNote}: ${fmtRate(o.lvl)} denunce ogni 100.000 abitanti${m.rare ? " all’anno" : ""}${pp ? `, ${pp}${m.rare ? "" : " in un anno"}` : ""}. `;
    const of = EN ? `of the ${o.n} ${o.unit === "province" ? "provinces" : "provincial capitals"}` : (o.unit === "province" ? "delle " : "dei ") + o.n + " " + o.unit;
    const pos = EN ? (!o.rank ? "" : o.rank === 1 ? `the highest ${of}` : o.rank === o.n ? `the lowest ${of}` : o.rank <= 10 ? `one of the ten highest ${of} (${ordinal(o.rank)})` : o.rank > o.n - 10 ? `one of the ten lowest ${of} (${ordinal(o.rank)})` : `${ordinal(o.rank)} out of ${o.n} ${o.unit === "province" ? "provinces" : "provincial capitals"}`) : !o.rank ? "" : o.rank === 1 ? `il valore più alto ${of}` : o.rank === o.n ? `il valore più basso ${of}` : o.rank <= 10 ? `uno dei dieci valori più alti ${of} (${o.rank}°)` : o.rank > o.n - 10 ? `uno dei dieci valori più bassi ${of} (${o.rank}°)` : `${vowelNum(o.rank) ? "all’" : "al "}${o.rank}° posto su ${o.n} ${o.unit}`;
    if (o.it) s += EN ? `That is ${timesItaly(o.lvl / o.it)} (${fmtRate(o.it)})${pos ? " and " + pos : ""}${o.tourist && o.lvl / o.it >= 1.15 ? ", partly because every day it draws commuters, students and tourists who are not counted as residents" : ""}. ` : `È ${timesItaly(o.lvl / o.it)} (${fmtRate(o.it)})${pos ? " e " + pos : ""}${o.tourist && o.lvl / o.it >= 1.15 ? ", anche perché ogni giorno arrivano pendolari, studenti e turisti che non sono contati tra i residenti" : ""}. `;
    const c = o.cmp;
    if (c && c.pct != null && isFinite(c.pct)) {
      // reati rari nelle province senza conteggi: c.win è "media 2022–2024 su 2017–2019"
      const win = c.win ? (c.winY ? [`${c.winY[0]}–${c.winY[1]}`, `${c.winY[2]}–${c.winY[3]}`] : c.win.replace(/^media /, "").split(" su ")) : null;
      const since = EN ? (win ? `On average, between ${win[1]} and ${win[0]},` : `Compared with ${state.cardBase}${state.cardBase === 2019 ? ", before Covid," : ","}`) : win ? `Tra il ${win[1]} e il ${win[0]}, in media,` : `Rispetto al ${state.cardBase}${state.cardBase === 2019 ? ", prima del Covid," : ""}`;
      s += Math.round(c.pct * 100) === 0 ? `${since} ${L("le denunce per abitante sono rimaste le stesse.", "reports per resident have stayed the same.")}`
        : sig(c) === "flat" ? (Math.abs(c.pct) < 0.1
          ? EN ? `${since} reports per resident are more or less the same (${fmtPct(c.pct)}): a difference this small may be down to chance.` : `${since} le denunce per abitante sono più o meno le stesse (${fmtPct(c.pct)}): una differenza così piccola può dipendere dal caso.`
          : EN ? `${since} reports per resident have ${c.pct > 0 ? "risen" : "fallen"} ${delPct(c.pct)}, but the difference may be down to chance.` : `${since} le denunce per abitante sono ${c.pct > 0 ? "aumentate" : "diminuite"} ${delPct(c.pct)}, ma è una differenza che può dipendere dal caso.`)
        : EN ? `${since} reports per resident have ${c.pct > 0 ? "risen" : "fallen"} ${delPct(c.pct)}.` : `${since} le denunce per abitante sono ${c.pct > 0 ? "aumentate" : "diminuite"} ${delPct(c.pct)}.`;
    }
    return `<p class="verdict">${s}${gl}</p>`;
  }

  function percFact(perc, where) {
    if (!perc || perc["2024"] == null) return "";
    const before = perc["2022"] != null ? EN ? `; ${nf1.format(perc["2022"])}% in 2022` : `; ${nf1.format(perc["2022"])}% nel 2022` : "";
    return `<div class="fact"><div class="fv">${nf1.format(perc["2024"])}%</div><div class="fl">${EN ? `households ${where} that feel their area is very or quite at risk of crime (2024${before}; Italy ${nf1.format(ITALY.perc["2024"])}%)` : `famiglie ${where} che sentono molto o abbastanza a rischio criminalità la propria zona (2024${before}; Italia ${nf1.format(ITALY.perc["2024"])}%)`}</div></div>`;
  }

  function renderCity() {
    const c = state.city;
    if (!c) return;
    const m = model(state.cardType, state.cardBase);
    const r = m.rows.find((d) => d.c.id === c.id);
    $("#city-kicker").textContent = EN ? `Provincial capital · ${c.region} · ${areaName(c.area)} · ${nf0.format(c.pop[LAST])} residents` : `Capoluogo · ${c.region} · ${c.area} · ${nf0.format(c.pop[LAST])} residenti`;
    $("#city-name").textContent = c.name;
    const s = sig(r.cmp);
    const sigText = s === "flat" ? L("variazione non significativa", "not a significant change") : s === "up" ? L("aumento significativo", "significant rise") : s === "down" ? L("calo significativo", "significant fall") : "";
    const tm = model("TOT", state.cardBase), tr = tm.rows.find((d) => d.c.id === c.id);
    // la provincia intorno, quando data/province.json è caricato
    const pid = CITY_PROV[c.id], P = PROV && pid ? PROV[pid] : null;
    const pm = P ? provModel(state.cardType) : null, pr = pm ? pm.byId.get(pid) : null;
    const provFact = pr ? `<div class="fact"><div class="fv">${fmtRate(pr.lvl)}</div><div class="fl">${EN ? `${esc(lower(m.label))} per 100,000 residents in the whole province of ${esc(P.name)} (${m.levelNote}) · ${ordinal(pr.rank)} of ${pm.ranked.length} provinces` : `${esc(lower(m.label))} ogni 100.000 abitanti in tutta la provincia di ${esc(P.name)} (${m.levelNote}) · ${pr.rank}° su ${pm.ranked.length} province`}</div></div>` : "";
    const rows = TYPES.map((t) => ({ t, row: model(t.id, state.cardBase).rows.find((d) => d.c.id === c.id) }));
    const iB = Y.indexOf(state.cardBase);
    const movers = moversHTML(rows, (t) => EN ? `${nf0.format(c.n[t.id][LAST] ?? 0)} cases in ${Y[LAST]}, ${nf0.format(c.n[t.id][iB] ?? 0)} in ${state.cardBase}` : `${nf0.format(c.n[t.id][LAST] ?? 0)} casi nel ${Y[LAST]}, ${nf0.format(c.n[t.id][iB] ?? 0)} nel ${state.cardBase}`, true);
    const q = QUART[c.id] || null; // quartieri, se la città li ha e sono arrivati
    const verdict = verdictHTML({ t: state.cardType, where: EN ? "in " + esc(c.name) : (/^[Aa]/.test(c.name) ? "ad " : "a ") + esc(c.name), lvl: r.lvl, it: m.itLvl, rank: r.rank, n: m.ranked.length, unit: "capoluoghi", cmp: r.cmp, tourist: TOURIST.includes(c.name) && TOURIST_GROUPS.includes(TYPE[state.cardType].group) && !TOURIST_NOT.includes(state.cardType) });
    $("#city-body").innerHTML = `
      <div class="card-head">
      <div class="card-main">
      ${verdict}
      <div class="facts">
        <div class="fact"><div class="fv">${fmtRate(r.lvl)}</div><div class="fl">${esc(lower(m.label))} ${L("ogni 100.000 abitanti", "per 100,000 residents")} (${m.levelNote}) · ${r.rank ? (EN ? ordinal(r.rank) + " of " : r.rank + "° su ") + m.ranked.length : ""} · ${L("Italia", "Italy")} ${fmtRate(m.itLvl)}</div></div>
        <div class="fact"><div class="fv">${fmtPct(r.cmp && r.cmp.pct)}</div><div class="fl">${esc(lower(m.label))}: ${Y[LAST]} ${L("rispetto al", "compared with")} ${state.cardBase}${sigText ? " · " + sigText : ""}</div></div>
        ${state.cardType !== "TOT" ? `<div class="fact"><div class="fv">${fmtRate(tr.lvl)}</div><div class="fl">${EN ? `all crimes per 100,000 residents in ${Y[LAST]} · ${ordinal(tr.rank)} of ${tm.ranked.length}` : `tutti i delitti ogni 100.000 abitanti nel ${Y[LAST]} · ${tr.rank}° su ${tm.ranked.length}`}</div></div>` : ""}
        ${provFact}
        ${percFact(c.perc, EN ? "in " + esc(c.name) : "di " + esc(c.name))}
      </div>
      ${movers}
      </div>
      ${locMap(c.lon, c.lat, c.name)}
      </div>
      ${chartBlock(m.label + L(" a ", " in ") + c.name, `<span><i class="k-city"></i>${esc(c.name)}</span>${P ? `<span><i class="k-prov"></i>${L("provincia di", "province of")} ${esc(P.name)}</span>` : ""}<span><i class="k-it"></i>${L("Italia", "Italy")}</span><span><i class="k-gold"></i>${L("impennata", "spike")}</span>`)}
      <p class="note">${spikeNote((t) => model(t, state.cardBase).rows.find((d) => d.c.id === c.id))}</p>
      ${q ? quartHTML(q) : ""}
      <h3 class="subhead">${L("Tutti i reati a", "Every crime type in")} ${esc(c.name)}</h3>
      <p class="small">${L("Ogni riquadro ha la sua scala. Linea grigia: Italia. Tocca un reato per vederlo in questa scheda.", "Each panel has its own scale. Grey line: Italy. Tap a crime to see it in this profile.")}</p>
      <div class="sm-grid" id="city-grid"></div>
      <h3 class="subhead">${esc(m.label)}: ${L("i numeri anno per anno", "year by year")}</h3>
      <div class="tablewrap"><table><thead><tr><th>${L("Anno", "Year")}</th><th class="num">${L("Casi", "Cases")}</th><th class="num">${L("Ogni 100.000 ab.", "Per 100,000 res.")}</th>${P ? `<th class="num">${L("Provincia", "Province")}</th>` : ""}<th class="num">${L("Italia", "Italy")}</th><th>${L("Nota", "Note")}</th></tr></thead><tbody>
        ${Y.map((yr, i) => {
          const a = r.an[i];
          const note = COVID.has(yr) ? "Covid" : a && a.flag === "spike" ? `${L("Impennata", "Spike")} (${fmtPct(a.rr - 1)})` : a && a.flag === "fall" ? `${L("Calo netto", "Sharp fall")} (${fmtPct(a.rr - 1)})` : "";
          return `<tr><td>${yr}</td><td class="num">${c.n[state.cardType][i] == null ? "–" : nf0.format(c.n[state.cardType][i])}</td><td class="num">${fmtRate(r.s[i])}</td>${P ? `<td class="num">${fmtRate(pr.s[i])}</td>` : ""}<td class="num">${fmtRate(m.it[i])}</td><td>${note}</td></tr>`;
        }).reverse().join("")}
      </tbody></table></div>
      <p class="small src">${L("Fonti: ISTAT, delitti denunciati dalle forze di polizia all’autorità giudiziaria (conteggi per comune capoluogo e tassi per provincia); popolazione residente ISTAT; percezione del rischio dall’indagine ISTAT Aspetti della vita quotidiana.", "Sources: ISTAT, crimes reported by the police to the judicial authorities (counts for each provincial capital and rates for each province); ISTAT resident population; perceived risk from the ISTAT survey Aspetti della vita quotidiana (Aspects of daily life).")}</p>`;
    $("#city-grid").innerHTML = gridHTML(rows);
    const series = [{ name: c.name, values: r.s, color: "var(--ink)", width: 2.25 }];
    if (pr) series.push({ name: EN ? `Province of ${P.name}` : `Provincia di ${P.name}`, values: pr.s, color: "var(--ink-2)", width: 1.75, dash: "5 4" });
    series.push({ name: L("Italia", "Italy"), values: m.it, color: "var(--muted)", width: 1.5 });
    drawCard(series, r.an, rows, (t, row, i) => `<b>${esc(t.label)}</b> · ${Y[i]}<br>${nf0.format(c.n[t.id][i] ?? 0)} ${L("casi", "cases")}, ${fmtRate(row.s[i])} ${L("ogni 100.000 ab.", "per 100,000 res.")} (${L("Italia", "Italy")} ${fmtRate(ITALY.rate[t.id][i])})`);
    if (q) requestAnimationFrame(() => renderQuart(q));
  }

  // ------------------------------------------------------------------ quartiere per quartiere (prototipo: Milano)

  // Per le città elencate in data/quartieri/index.json: confini e dati dei quartieri (<id>.json, <id>.topo.json, dal Comune).
  // Nessuna fonte ufficiale pubblica i reati denunciati sotto il livello comunale: lo strato «Reati» compare solo
  // se ogni quartiere ha i conteggi (areas[].n per tipo di reato e anno, come in vc.json).
  let QINDEX = new Set();
  const QUART = {};
  const QLAYERS = [
    { id: "crime", label: L("Reati", "Crimes"), crime: true },
    { id: "pop", label: L("Residenti", "Residents"), title: (y) => EN ? `Residents on 31 December ${y}` : `Residenti al 31 dicembre ${y}`, fmt: (v) => nf0.format(v) },
    { id: "dens", label: L("Densità", "Density"), title: (y) => EN ? `Residents per km² in ${y}` : `Residenti per km² nel ${y}`, fmt: (v) => nf0.format(v) },
    { id: "str", label: L("Stranieri", "Foreign residents"), title: (y) => EN ? `Foreign residents per 100 residents in ${y}` : `Residenti stranieri ogni 100 residenti nel ${y}`, fmt: (v) => nf1.format(v) + "%", pct: true },
    { id: "old", label: L("65 e più", "65 and over"), title: (y) => EN ? `Residents aged 65 and over per 100 residents in ${y}` : `Residenti di 65 anni e più ogni 100 residenti nel ${y}`, fmt: (v) => nf1.format(v) + "%", pct: true },
    { id: "degr", label: L("Edifici degradati", "Run-down buildings"), title: () => L("Edifici degradati, abbandonati o dismessi censiti nel 2014–2017", "Run-down, abandoned or disused buildings recorded in 2014–2017"), fmt: (v) => nf0.format(v) },
  ];
  const QL = Object.fromEntries(QLAYERS.map((l) => [l.id, l]));
  const QFEW = 1000; // sotto questi residenti nessun tasso: il quartiere è un parco o un'area industriale
  // sulle pagine in inglese, i testi in italiano di data/quartieri/<id>.json che la scheda mostra (meta.unit.long, meta.gap)
  const QTEXT_EN = {
    "Nuclei di identità locale (NIL), i quartieri del Piano di governo del territorio Milano 2030": "Local identity units (NIL), the neighbourhoods defined by the Milano 2030 town plan (PGT)",
    "L'ISTAT e il Ministero dell'Interno pubblicano i delitti denunciati solo per l'intero comune: nessuna fonte ufficiale li pubblica per quartiere.": "ISTAT and the Ministry of the Interior publish reported crimes only for the municipality as a whole: no official source publishes them by neighbourhood.",
  };
  const qtx = (s) => (EN && QTEXT_EN[s]) || s;

  function loadQuart(id) {
    if (QUART[id] !== undefined) return Promise.resolve(QUART[id]);
    const get = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    return Promise.all([get(`${ROOT}data/quartieri/${id}.json`), get(`${ROOT}data/quartieri/${id}.topo.json`)])
      .then(([d, t]) => {
        const obj = t.objects[Object.keys(t.objects)[0]];
        const feats = topojson.feature(t, obj).features;
        const byId = new Map(d.areas.map((a) => [a.id, a]));
        feats.forEach((f) => { f.properties.area = byId.get(f.properties.id); });
        // lo strato dei reati esiste solo se ogni quartiere ha i conteggi: oggi nessuna fonte li pubblica
        const crime = d.areas.length > 0 && d.areas.every((a) => a.n && a.n.TOT);
        QUART[id] = { id, d, t, obj, feats, byId, areas: d.areas, crime };
        if (state.qLayer === "crime" && !crime) state.qLayer = "pop";
        addSources(d.meta.sources, "quartieri");
        return QUART[id];
      })
      .catch(() => { QUART[id] = null; return null; });
  }

  const qcache = new Map();
  function quartModel(q) {
    const key = [q.id, state.qLayer, state.cardType, state.cardBase].join("|");
    if (qcache.has(key)) return qcache.get(key);
    const yrs = q.d.meta.years, L = yrs.length - 1, layer = QL[state.qLayer];
    const iB = Math.max(0, yrs.indexOf(state.cardBase));
    const t = state.cardType, rare = TYPE[t].rare, cm = model(t, state.cardBase);
    const crow = cm.rows.find((d) => d.c.id === q.id);
    const rows = q.areas.map((a) => {
      const r = { a, pop: a.pop[L], few: a.pop[L] < QFEW, lvl: null, s: null, cmp: null, an: null, n: null, nl: null };
      if (layer.crime) {
        const n = a.n[t];
        r.n = n;
        r.s = n.map((v, i) => (v == null || !a.pop[i] ? null : (v / a.pop[i]) * 1e5));
        r.an = anomaliesSeries(n, a.pop, yrs);
        r.nl = rare ? d3.sum(n.slice(L - 2), (v) => v || 0) : n[L];
        if (!r.few) {
          r.lvl = rare ? windowRateSeries(n, a.pop, L - 2, L) : r.s[L];
          r.cmp = rrTest(n[L], a.pop[L], n[iB], a.pop[iB]);
        }
      } else if (layer.id === "pop") {
        r.lvl = a.pop[L]; r.s = a.pop;
        r.cmp = a.pop[iB] ? { pct: a.pop[L] / a.pop[iB] - 1, z: null } : null;
      } else if (layer.id === "dens") {
        r.lvl = a.km2 ? a.pop[L] / a.km2 : null;
      } else if (layer.id === "str" || layer.id === "old") {
        const v = a[layer.id];
        if (!r.few) { r.lvl = (100 * v[L]) / a.pop[L]; r.s = v.map((x, i) => (a.pop[i] >= QFEW ? (100 * x) / a.pop[i] : null)); }
      } else if (layer.id === "degr") {
        r.lvl = a.degr;
      }
      return r;
    });
    const ranked = rows.filter((r) => r.lvl != null).sort((p, w) => w.lvl - p.lvl);
    ranked.forEach((r, i) => (r.rank = i > 0 && r.lvl === ranked[i - 1].lvl ? ranked[i - 1].rank : i + 1));
    // il riferimento sulle barre: la città intera
    const totPop = d3.sum(q.areas, (a) => a.pop[L]), totKm2 = d3.sum(q.areas, (a) => a.km2);
    const ref = layer.crime ? (crow ? crow.lvl : null)
      : layer.id === "dens" ? totPop / totKm2
      : layer.id === "str" || layer.id === "old" ? (100 * d3.sum(q.areas, (a) => a[layer.id][L])) / totPop
      : null;
    const title = layer.crime ? (EN ? `${TYPE[t].label} per 100,000 residents (${cm.levelNote})` : `${TYPE[t].label} ogni 100.000 residenti (${cm.levelNote})`) : layer.title(yrs[L]);
    const out = { rows, ranked, byId: new Map(rows.map((r) => [r.a.id, r])), yrs, L, iB, layer, ref, title, rare, t, cm, crow, fmt: layer.crime ? fmtRate : layer.fmt };
    qcache.set(key, out);
    return out;
  }

  function quartHTML(q) {
    const M = q.d.meta;
    const btns = QLAYERS.filter((l) => !l.crime || q.crime).map((l) => `<button type="button" data-ql="${l.id}" aria-pressed="${l.id === state.qLayer}">${esc(l.label)}</button>`).join("");
    return `<section class="quart" aria-labelledby="quart-title">
      <h3 class="subhead" id="quart-title">${esc(M.name)} ${L("quartiere per quartiere", "neighbourhood by neighbourhood")}</h3>
      <p class="small quart-dek">${EN ? `${esc(qtx(M.unit.long))}: ${q.areas.length} neighbourhoods. Boundaries, residents and commuters come from the open data portal of the city of ${esc(M.name)}. Residents are those on the city’s own population register, slightly more than the ISTAT residents used in the rest of the atlas. Tap a neighbourhood, on the map or in the ranking, for its profile.` : `${esc(M.unit.long)}: ${q.areas.length} quartieri. Confini, residenti e pendolari dal portale open data del Comune di ${esc(M.name)}. I residenti sono quelli dell’anagrafe comunale, un po’ più dei residenti ISTAT usati nel resto dell’atlante. Tocca un quartiere, sulla mappa o nella classifica, per la sua scheda.`}</p>
      <div class="prov-note quart-note" id="quart-note"></div>
      <div class="chips"><span class="small">${L("Strato", "Layer")}</span><div class="seg" id="quart-seg">${btns}</div></div>
      <div class="quart-grid">
        <div class="quart-mapbox" id="quart-mapbox"><div id="quart-map"></div><div class="legend" id="quart-legend"></div></div>
        <div>
          <div class="rank-cols quart-ranks"><div class="rank"><h3 id="quart-top-title"></h3><ol id="quart-top"></ol></div><div class="rank"><h3 id="quart-bottom-title"></h3><ol id="quart-bottom"></ol></div></div>
          <p class="note" id="quart-rank-note"></p>
          <div id="quart-sel"></div>
          <details class="full"><summary>${EN ? `All ${q.areas.length} neighbourhoods (table)` : `Tutti i ${q.areas.length} quartieri (tabella)`}</summary><div class="tablewrap"><table id="quart-table"></table></div></details>
        </div>
      </div>
    </section>`;
  }

  function renderQuart(q) {
    if (!q || !$("#quart-map")) return;
    const m = quartModel(q), M = q.d.meta;
    const note = $("#quart-note");
    note.hidden = !!q.crime;
    if (!q.crime) note.innerHTML = EN ? `<p>${esc(qtx(M.gap))} Here are the figures the city of ${esc(M.name)} publishes on its neighbourhoods: residents, density, foreign residents, age and run-down buildings.</p>` : `<p>${esc(M.gap)} Qui ci sono i dati che il Comune di ${esc(M.name)} pubblica sui suoi quartieri: residenti, densità, stranieri, età ed edifici degradati.</p>`;
    $("#quart-seg").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.ql === state.qLayer));
    const sec = $(".quart");
    if (!sec._wired) {
      sec._wired = true;
      sec.addEventListener("mouseover", (ev) => { const li = ev.target.closest("li[data-q]"); if (li) hotQuart(+li.dataset.q, true); });
      sec.addEventListener("mouseout", (ev) => { const li = ev.target.closest("li[data-q]"); if (li && !li.contains(ev.relatedTarget)) hotQuart(+li.dataset.q, false); });
    }
    renderQuartMap(q, m);
    renderQuartRank(q, m);
    renderQuartSel(q, m);
    renderQuartTable(q, m);
  }

  function quartTip(q, m, r) {
    const a = r.a;
    const head = `<b>${esc(a.name)}</b> · ${L("Municipio", "District")} ${a.mun}<br>`;
    if (m.layer.crime) {
      const s = sig(r.cmp), note = s === "flat" ? L(" (non significativa)", " (not significant)") : "";
      return head + (EN ? `${esc(TYPE[m.t].label)}: ${r.few ? "fewer than 1,000 residents, no rate" : `${fmtRate(r.lvl)} per 100,000 residents`} (${nf0.format(r.nl)} cases, ${m.cm.levelNote})` +
        (r.rank ? `<br>${ordinal(r.rank)} of ${m.ranked.length} · compared with ${state.cardBase}: ${fmtPct(r.cmp && r.cmp.pct)}${note}` : "") + `<br>${nf0.format(r.pop)} residents` : `${esc(TYPE[m.t].label)}: ${r.few ? "meno di 1.000 residenti, nessun tasso" : `${fmtRate(r.lvl)} ogni 100.000 residenti`} (${nf0.format(r.nl)} casi, ${m.cm.levelNote})` +
        (r.rank ? `<br>${r.rank}° su ${m.ranked.length} · rispetto al ${state.cardBase}: ${fmtPct(r.cmp && r.cmp.pct)}${note}` : "") + `<br>${nf0.format(r.pop)} residenti`);
    }
    return head + `${esc(m.title)}: ${r.lvl == null ? L("meno di 1.000 residenti", "fewer than 1,000 residents") : m.fmt(r.lvl)}` + (m.layer.id === "pop" ? "" : `<br>${nf0.format(r.pop)} ${L("residenti", "residents")}`);
  }

  function hotQuart(id, on) {
    document.querySelectorAll(`[data-q="${id}"]`).forEach((n) => {
      n.classList.toggle("hot", on);
      if (n.tagName !== "path") return;
      if (on) { n._next = n.nextSibling; n.parentNode.appendChild(n); }
      else if (n._next !== undefined) { n.parentNode.insertBefore(n, n._next); n._next = undefined; }
    });
  }

  function selectQuart(q, id) {
    state.qSel = id;
    document.querySelectorAll(".qmap .area").forEach((n) => n.classList.toggle("sel", +n.dataset.q === id));
    renderQuartSel(q, quartModel(q));
  }

  function renderQuartMap(q, m) {
    const el = $("#quart-map");
    const w = Math.max(260, el.clientWidth), h = Math.round(w * 0.9);
    const layer = m.layer;
    const fc = { type: "FeatureCollection", features: q.feats };
    const proj = d3.geoMercator().fitExtent([[4, 4], [w - 4, h - 4]], fc);
    const path = d3.geoPath(proj);
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("class", "qmap").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", EN ? `Map of the neighbourhoods of ${q.d.meta.name}: ${m.title}` : `Mappa dei quartieri di ${q.d.meta.name}: ${m.title}`);
    svg.selectAll("*").remove();
    const pat = svg.append("defs").append("pattern").attr("id", "qhatch").attr("width", 6).attr("height", 6).attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)");
    pat.append("rect").attr("width", 6).attr("height", 6).style("fill", "var(--land)");
    pat.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6).style("stroke", "var(--mid)").style("stroke-width", 1.2);
    // scala sequenziale, un solo colore da chiaro a scuro, tagliata al 95° percentile così un quartiere estremo non appiattisce gli altri
    const vals = m.ranked.map((r) => r.lvl);
    const top = d3.max(vals) || 1;
    const hi = Math.max(d3.quantile(vals, 0.95) || top, top * 0.25);
    const col = d3.scaleSequential(d3.interpolateLab(css("--land"), css("--ink"))).domain([0, hi]).clamp(true);
    const sel = state.qSel != null && m.byId.has(state.qSel) ? state.qSel : (m.ranked[0] ? m.ranked[0].a.id : null);
    if (state.qSel == null) state.qSel = sel;
    svg.append("g").selectAll("path").data(q.feats).join("path")
      .attr("class", (f) => "area" + (f.properties.id === sel ? " sel" : ""))
      .attr("data-q", (f) => f.properties.id)
      .attr("d", path)
      .style("fill", (f) => { const r = m.byId.get(f.properties.id); return r.lvl == null ? "url(#qhatch)" : col(r.lvl); })
      .on("mouseenter", (ev, f) => hotQuart(f.properties.id, true))
      .on("mousemove", (ev, f) => showTip(quartTip(q, m, m.byId.get(f.properties.id)), ev))
      .on("mouseleave", (ev, f) => { hideTip(); hotQuart(f.properties.id, false); });
    svg.append("path").attr("class", "edge").attr("d", path(topojson.mesh(q.t, q.obj, (a, b) => a !== b)));
    svg.append("path").attr("class", "mun").attr("d", path(topojson.mesh(q.t, q.obj, (a, b) => a === b || q.byId.get(a.properties.id).mun !== q.byId.get(b.properties.id).mun)));
    // etichette: i quartieri più popolosi e i primi tre in classifica, saltando quelle che si sovrappongono
    const big = new Set(q.areas.slice().sort((a, b) => b.pop[m.L] - a.pop[m.L]).slice(0, w < 420 ? 6 : 12).map((a) => a.id));
    m.ranked.slice(0, 3).forEach((r) => big.add(r.a.id));
    const boxes = [], lg = svg.append("g").attr("class", "labels");
    q.feats.filter((f) => big.has(f.properties.id)).sort((p, w2) => w2.properties.area.pop[m.L] - p.properties.area.pop[m.L]).forEach((f) => {
      const a = f.properties.area, [x, y] = path.centroid(f), tw = a.short.length * 5.6 + 2, th = 11;
      const b = [x - tw / 2, y - th / 2, x + tw / 2, y + th / 2];
      if (b[0] < 0 || b[2] > w || boxes.some((o) => !(b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3]))) return;
      boxes.push(b);
      lg.append("text").attr("class", "lbl").attr("x", x).attr("y", y + 4).attr("text-anchor", "middle").text(a.short);
    });
    const bar = `linear-gradient(to right, ${col(0)}, ${col(hi * 0.25)}, ${col(hi * 0.5)}, ${col(hi * 0.75)}, ${col(hi)})`;
    $("#quart-legend").innerHTML = `
      <div class="lg"><div class="lg-t">${esc(m.title)}</div><div class="lg-bar" style="background:${bar}"></div><div class="lg-ticks"><span>0</span><span>${m.fmt(hi / 2)}</span><span>${m.fmt(hi)}${top > hi ? L(" o più", " or more") : ""}</span></div></div>
      <div class="lg"><div class="lg-t">${L("Confini", "Boundaries")}</div><div class="lg-row"><i class="k-mun"></i>${L("municipi", "districts")}</div>${m.rows.some((r) => r.lvl == null) ? `<div class="lg-row"><i class="k-hatch"></i>${EN ? `fewer than ${nf0.format(QFEW)} residents: no ${layer.crime || layer.pct ? "rate" : "value"}` : `meno di ${nf0.format(QFEW)} residenti: nessun ${layer.crime || layer.pct ? "tasso" : "valore"}`}</div>` : ""}</div>`;
  }

  function renderQuartRank(q, m) {
    const top = m.ranked.slice(0, 10);
    const bottom = m.ranked.slice().sort((a, b) => a.lvl - b.lvl || b.pop - a.pop).slice(0, 10);
    const maxL = top[0] ? top[0].lvl : 1;
    $("#quart-top-title").textContent = m.layer.crime ? L("Più denunce", "Most reports") : L("Più alto", "Highest");
    $("#quart-bottom-title").textContent = m.layer.crime ? L("Meno denunce", "Fewest reports") : L("Più basso", "Lowest");
    // il punto: per i reati vale il test statistico, per i residenti basta il segno della variazione (oltre il 3%)
    const dot = (r) => (!r.cmp ? "none" : m.layer.crime ? sig(r.cmp) : r.cmp.pct > 0.03 ? "up" : r.cmp.pct < -0.03 ? "down" : "flat");
    const li = (r) => `<li data-q="${r.a.id}"${r.a.id === state.qSel ? ' class="sel"' : ""}><span class="pos">${r.rank}</span><span class="dotc ${dot(r)}"${r.cmp ? ` title="${L("Rispetto al", "Compared with")} ${state.cardBase}: ${fmtPct(r.cmp.pct)}"` : ""}></span><button type="button" data-q="${r.a.id}" title="${esc(r.a.name)}">${esc(r.a.short)}</button>` +
      `<span class="bar" aria-hidden="true"><i style="width:${(100 * r.lvl) / maxL}%"></i>${m.ref != null ? `<b style="left:${Math.min(100, (100 * m.ref) / maxL)}%"></b>` : ""}</span><span class="val">${m.fmt(r.lvl)}</span></li>`;
    $("#quart-top").innerHTML = top.map(li).join("");
    $("#quart-bottom").innerHTML = bottom.map(li).join("");
    const few = m.rows.length - m.ranked.length;
    let note = m.ref != null ? EN ? `The thin line on each bar is the value for ${esc(q.d.meta.name)} as a whole: ${m.fmt(m.ref)}. ` : `La linea sottile su ogni barra è il valore di tutta ${esc(q.d.meta.name)}: ${m.fmt(m.ref)}. ` : "";
    if (m.layer.crime) note += EN ? `The coloured dot shows whether the neighbourhood has gone up or down compared with ${state.cardBase}. ` : `Il punto colorato dice se il quartiere è salito o sceso rispetto al ${state.cardBase}. `;
    else if (m.layer.id === "pop") note += EN ? `The coloured dot shows whether residents have grown or fallen by more than 3% compared with ${state.cardBase}. ` : `Il punto colorato dice se i residenti sono cresciuti o calati di oltre il 3% rispetto al ${state.cardBase}. `;
    if (few) note += EN ? `${few} ${few === 1 ? "neighbourhood" : "neighbourhoods"} with fewer than ${nf0.format(QFEW)} residents, parks or industrial areas, ${few === 1 ? "is" : "are"} left out of the ranking.` : `${few} quartieri con meno di ${nf0.format(QFEW)} residenti, parchi o aree industriali, restano fuori dalla classifica.`;
    $("#quart-rank-note").innerHTML = note;
  }

  function renderQuartSel(q, m) {
    const el = $("#quart-sel");
    if (!el) return;
    const id = state.qSel != null && m.byId.has(state.qSel) ? state.qSel : (m.ranked[0] ? m.ranked[0].a.id : null);
    document.querySelectorAll(".quart-ranks li").forEach((n) => n.classList.toggle("sel", +n.dataset.q === id));
    if (id == null) { el.innerHTML = ""; return; }
    const r = m.byId.get(id), a = r.a, L = m.L, yrs = m.yrs, crime = m.layer.crime, name = q.d.meta.name;
    const pct = (num, den) => (den ? nf1.format((100 * num) / den) + "%" : "–");
    let body;
    if (crime) {
      const s = sig(r.cmp), sigText = s === "flat" ? (EN ? ", not a significant change" : ", variazione non significativa") : s === "up" ? (EN ? ", significant rise" : ", aumento significativo") : s === "down" ? (EN ? ", significant fall" : ", calo significativo") : "";
      const spikes = (r.an || []).filter((x) => x && x.flag === "spike").map((x) => x.y);
      const txt = r.few ? (EN ? `Fewer than ${nf0.format(QFEW)} residents: ${nf0.format(r.n[L] ?? 0)} cases in ${yrs[L]}, but no rate would be meaningful.` : `Meno di ${nf0.format(QFEW)} residenti: ${nf0.format(r.n[L] ?? 0)} casi nel ${yrs[L]}, ma nessun tasso ha senso.`)
        : EN ? `${nf0.format(r.n[L] ?? 0)} cases of ${esc(lower(TYPE[m.t].label))} in ${yrs[L]}: ${fmtRate(r.s[L])} per 100,000 residents, against ${fmtRate(m.crow ? m.crow.s[LAST] : null)} for ${esc(name)} as a whole · ${ordinal(r.rank)} of ${m.ranked.length} neighbourhoods · ${fmtPct(r.cmp && r.cmp.pct)} compared with ${state.cardBase}${sigText}.${spikes.length ? ` Spikes: ${spikes.join(", ")}.` : ""}` : `${nf0.format(r.n[L] ?? 0)} casi di ${esc(lower(TYPE[m.t].label))} nel ${yrs[L]}: ${fmtRate(r.s[L])} ogni 100.000 residenti, contro ${fmtRate(m.crow ? m.crow.s[LAST] : null)} in tutta ${esc(name)} · ${r.rank}° su ${m.ranked.length} quartieri · ${fmtPct(r.cmp && r.cmp.pct)} rispetto al ${state.cardBase}${sigText}.${spikes.length ? ` Impennate: ${spikes.join(", ")}.` : ""}`;
      body = EN ? `<p class="chart-title">${esc(TYPE[m.t].label)} per 100,000 residents, ${yrs[0]}–${yrs[L]}</p>
        <div class="key" aria-hidden="true"><span><i class="k-city"></i>neighbourhood</span><span><i class="k-it"></i>${esc(name)}</span><span><i class="k-gold"></i>spike</span><span><i class="k-covid"></i>2020–21</span></div>
        <svg id="quart-spark" aria-hidden="true"></svg><p class="small qsel-note">${txt}</p>` : `<p class="chart-title">${esc(TYPE[m.t].label)} ogni 100.000 residenti, ${yrs[0]}–${yrs[L]}</p>
        <div class="key" aria-hidden="true"><span><i class="k-city"></i>quartiere</span><span><i class="k-it"></i>${esc(name)}</span><span><i class="k-gold"></i>impennata</span><span><i class="k-covid"></i>2020–21</span></div>
        <svg id="quart-spark" aria-hidden="true"></svg><p class="small qsel-note">${txt}</p>`;
    } else {
      const ch = a.pop[m.iB] ? fmtPct(a.pop[L] / a.pop[m.iB] - 1) : "–";
      body = EN ? `<p class="chart-title">Residents from ${yrs[0]} to ${yrs[L]}</p><svg id="quart-spark" aria-hidden="true"></svg>
        <p class="small qsel-note">${nf0.format(a.pop[L])} residents in ${yrs[L]}, ${ch} compared with ${state.cardBase}; foreign residents ${pct(a.str[L], a.pop[L])}, aged 65 and over ${pct(a.old[L], a.pop[L])}, single-person households ${pct(a.single[L], a.fam[L])}.</p>` : `<p class="chart-title">Residenti dal ${yrs[0]} al ${yrs[L]}</p><svg id="quart-spark" aria-hidden="true"></svg>
        <p class="small qsel-note">${nf0.format(a.pop[L])} residenti nel ${yrs[L]}, ${ch} rispetto al ${state.cardBase}; stranieri ${pct(a.str[L], a.pop[L])}, 65 anni e più ${pct(a.old[L], a.pop[L])}, famiglie di una sola persona ${pct(a.single[L], a.fam[L])}.</p>`;
    }
    el.innerHTML = `<div class="qsel">
      <div class="kicker">${EN ? "Neighbourhood · District" : "Quartiere · Municipio"} ${a.mun} · ${nf2.format(a.km2)} km²</div>
      <h4>${esc(a.name)}</h4>
      <div class="facts">
        <div class="fact"><div class="fv">${nf0.format(a.pop[L])}</div><div class="fl">${EN ? `residents in ${yrs[L]}` : `residenti nel ${yrs[L]}`} · ${a.km2 ? nf0.format(a.pop[L] / a.km2) : "–"} per km²</div></div>
        <div class="fact"><div class="fv">${pct(a.str[L], a.pop[L])}</div><div class="fl">${EN ? "foreign residents" : "stranieri"}</div></div>
        <div class="fact"><div class="fv">${pct(a.old[L], a.pop[L])}</div><div class="fl">${EN ? "aged 65 and over" : "65 anni e più"}</div></div>
        <div class="fact"><div class="fv">${nf0.format(a.com)}</div><div class="fl">${EN ? "commuters coming in each day for work or study (2011 census)" : "pendolari in entrata al giorno per lavoro o studio (censimento 2011)"}</div></div>
        <div class="fact"><div class="fv">${nf0.format(a.degr)}</div><div class="fl">${EN ? "run-down buildings recorded in 2014–17" : "edifici degradati censiti nel 2014–17"}</div></div>
      </div>
      ${body}
    </div>`;
    // la serie del quartiere copre meno anni della pagina: si allinea agli anni dell'atlante con dei vuoti in testa
    const pad = Y.indexOf(yrs[0]);
    const padded = (s) => Array(Math.max(0, pad)).fill(null).concat(s);
    const svg = $("#quart-spark");
    const w = svg.getBoundingClientRect().width || 300;
    if (crime) {
      const vals = padded(r.s), city = m.crow ? m.crow.s : [];
      const an = padded(r.an.map((x) => (x ? { ...x, i: x.i + pad } : null)));
      drawSpark(svg, { w, h: 56, values: vals, italy: city, an, yMax: Math.max(d3.max(vals, (v) => v || 0) || 0, d3.max(city, (v) => v || 0) || 0) * 1.08,
        hover: (i) => EN ? `<b>${Y[i]}</b><br>${nf0.format(r.n[i - pad] ?? 0)} cases, ${fmtRate(vals[i])} per 100,000 residents (${esc(name)} ${fmtRate(city[i])})` : `<b>${Y[i]}</b><br>${nf0.format(r.n[i - pad] ?? 0)} casi, ${fmtRate(vals[i])} ogni 100.000 residenti (${esc(name)} ${fmtRate(city[i])})` });
    } else {
      const vals = padded(a.pop);
      drawSpark(svg, { w, h: 56, values: vals, yMax: (d3.max(vals, (v) => v || 0) || 1) * 1.08, hover: (i) => EN ? `<b>${Y[i]}</b>: ${nf0.format(vals[i])} residents` : `<b>${Y[i]}</b>: ${nf0.format(vals[i])} residenti` });
    }
  }

  function renderQuartTable(q, m) {
    const crime = m.layer.crime, L = m.L;
    const rows = m.ranked.concat(m.rows.filter((r) => r.lvl == null));
    const head = crime
      ? (EN ? `<th class="num">Cases (${m.cm.levelNote})</th><th class="num">Per 100,000 res.</th><th class="num">Change vs ${state.cardBase}</th>` : `<th class="num">Casi (${m.cm.levelNote})</th><th class="num">Ogni 100.000 res.</th><th class="num">Var. su ${state.cardBase}</th>`)
      : `<th class="num" title="${esc(m.title)}">${esc(m.layer.label)}${m.layer.pct ? " %" : ""}</th>`;
    $("#quart-table").innerHTML = `<thead><tr><th class="num">#</th><th>${EN ? "Neighbourhood" : "Quartiere"}</th><th class="num">${EN ? "District" : "Municipio"}</th><th class="num">${EN ? "Residents" : "Residenti"} ${m.yrs[L]}</th>${head}</tr></thead><tbody>` +
      rows.map((r) => `<tr><td class="num">${r.rank || ""}</td><td><button type="button" class="link" data-q="${r.a.id}">${esc(r.a.name)}</button></td><td class="num">${r.a.mun}</td><td class="num">${nf0.format(r.pop)}</td>` +
        (crime ? `<td class="num">${nf0.format(r.nl ?? 0)}</td><td class="num">${r.lvl == null ? "–" : fmtRate(r.lvl)}</td><td class="num">${r.cmp ? chgHTML(r.cmp) : "–"}</td>` : `<td class="num">${r.lvl == null ? "–" : m.fmt(r.lvl)}</td>`) + "</tr>").join("") +
      `</tbody>`;
  }

  // ------------------------------------------------------------------ province (comuni che non sono capoluogo)

  // Tassi ufficiali ISTAT per provincia. Con i conteggi (se l'API li ha restituiti) valgono gli stessi test dei capoluoghi;
  // senza, le variazioni sono rapporti tra tassi, segnati con il cerchio vuoto.
  const pcache = new Map();
  function provModel(t) {
    const key = t + "|" + state.cardBase;
    if (pcache.has(key)) return pcache.get(key);
    const iB = Y.indexOf(state.cardBase), rare = TYPE[t].rare, counts = PROV_META.counts;
    const rows = Object.keys(PROV).map((id) => {
      const p = PROV[id], s = p.rate[t];
      const win = s.slice(LAST - 2);
      const lvl = rare ? (win.some((v) => v == null) ? null : d3.mean(win)) : s[LAST];
      let cmp = null;
      if (counts) cmp = rrTest(p.n[t][LAST], p.pop[LAST], p.n[t][iB], p.pop[iB]);
      else if (!rare) cmp = s[LAST] != null && s[iB] ? { pct: s[LAST] / s[iB] - 1, z: null } : null;
      else if (iB <= LAST - 3) {
        // reati rari senza conteggi: un anno contro un anno è rumore, si confrontano due medie triennali
        const before = s.slice(iB - 2, iB + 1);
        if (!win.some((v) => v == null) && !before.some((v) => v == null) && d3.sum(before) > 0) {
          cmp = { pct: d3.sum(win) / d3.sum(before) - 1, z: null, win: EN ? `${Y[LAST - 2]}–${Y[LAST]} average vs ${Y[iB - 2]}–${Y[iB]}` : `media ${Y[LAST - 2]}–${Y[LAST]} su ${Y[iB - 2]}–${Y[iB]}`, winY: [Y[LAST - 2], Y[LAST], Y[iB - 2], Y[iB]] };
        }
      }
      return { id, p, s, lvl, cmp, an: counts ? anomalies(p, t) : null };
    });
    const ranked = rows.filter((r) => r.lvl != null).sort((a, b) => b.lvl - a.lvl);
    ranked.forEach((r, i) => (r.rank = i > 0 && r.lvl === ranked[i - 1].lvl ? ranked[i - 1].rank : i + 1));
    const out = { rows, ranked, byId: new Map(rows.map((r) => [r.id, r])) };
    pcache.set(key, out);
    return out;
  }

  function renderProv() {
    const e = state.place;
    if (!e || !PROV) return;
    const P = PROV[e.prov];
    const t = state.cardType;
    const m = model(t, state.cardBase), pm = provModel(t), r = pm.byId.get(e.prov);
    const tm = provModel("TOT"), tr = tm.byId.get(e.prov);
    const caps = P.caps.map(cityById).filter(Boolean);
    const cap = caps[0], capRow = m.rows.find((d) => d.c.id === cap.id);
    const unit = (UNITS && UNITS[e.sigla]) || P.name;
    const first = Y[P.rate.TOT.findIndex((v) => v != null)];
    const counts = PROV_META.counts;
    $("#city-kicker").textContent = EN ? `Municipality · ${unit} (${e.sigla}) · ${P.region}` : `Comune · ${unit} (${e.sigla}) · ${P.region}`;
    $("#city-name").textContent = e.alt ? `${e.name} / ${e.alt}` : e.name;
    const s = sig(r.cmp);
    const sigText = s === "flat" ? L(" · variazione non significativa", " · not a significant change") : s === "up" ? L(" · aumento significativo", " · significant rise") : s === "down" ? L(" · calo significativo", " · significant fall") : "";
    const capWord = caps.length > 1 ? EN ? `including the provincial capitals ${esc(andList(caps.map((c) => c.name)))}` : `compresi i capoluoghi ${esc(andList(caps.map((c) => c.name)))}` : EN ? `including the provincial capital, ${esc(cap.name)}` : `compreso il capoluogo, ${esc(cap.name)}`;
    const extra = [];
    if (P.region === "Sardegna" && normQ(unit) !== normQ(P.name)) extra.push(EN ? `In Sardegna ISTAT counts crimes by the four historical provinces. According to the official list of municipalities, between 1995 and 2005 ${esc(e.name)} was in the province of ${esc(P.name)}: that is why this profile uses that province’s data.` : `In Sardegna l’ISTAT conta i reati secondo le quattro province storiche. Secondo l’elenco ufficiale dei comuni, tra il 1995 e il 2005 ${esc(e.name)} era in provincia di ${esc(P.name)}: per questo la scheda usa i dati di quella provincia.`);
    if (first > Y[0]) extra.push(EN ? `The province of ${esc(P.name)} has data from ${first}: before then its municipalities were counted in the provinces they came from.` : `La provincia di ${esc(P.name)} ha dati dal ${first}: prima i suoi comuni erano contati nelle province da cui provengono.`);
    const rows = TYPES.map((tt) => ({ t: tt, row: provModel(tt.id).byId.get(e.prov) }));
    const iB = Y.indexOf(state.cardBase);
    const movers = moversHTML(rows, (tt, row) => {
      if (counts) return EN ? `${nf0.format(P.n[tt.id][LAST] ?? 0)} cases in the province in ${Y[LAST]}, ${nf0.format(P.n[tt.id][iB] ?? 0)} in ${state.cardBase}` : `${nf0.format(P.n[tt.id][LAST] ?? 0)} casi in provincia nel ${Y[LAST]}, ${nf0.format(P.n[tt.id][iB] ?? 0)} nel ${state.cardBase}`;
      if (row.cmp.win) return EN ? `${Y[LAST - 2]}–${Y[LAST]} average: ${fmtRate(d3.mean(row.s.slice(LAST - 2)))} per 100,000 res., against ${fmtRate(d3.mean(row.s.slice(iB - 2, iB + 1)))} in ${Y[iB - 2]}–${Y[iB]} (rare crime)` : `Media ${Y[LAST - 2]}–${Y[LAST]}: ${fmtRate(d3.mean(row.s.slice(LAST - 2)))} ogni 100.000 ab., contro ${fmtRate(d3.mean(row.s.slice(iB - 2, iB + 1)))} nel ${Y[iB - 2]}–${Y[iB]} (reato raro)`;
      return EN ? `${fmtRate(row.s[LAST])} per 100,000 res. in ${Y[LAST]}, ${fmtRate(row.s[iB])} in ${state.cardBase}` : `${fmtRate(row.s[LAST])} ogni 100.000 ab. nel ${Y[LAST]}, ${fmtRate(row.s[iB])} nel ${state.cardBase}`;
    }, counts);
    $("#city-body").innerHTML = `
      <div class="card-head">
      <div class="card-main">
      <div class="prov-note">
        <p>${EN ? `<strong>ISTAT publishes reported crimes municipality by municipality only for the 108 provincial capitals.</strong> For ${esc(e.name)} the closest official figure is the one for the whole province of ${esc(P.name)}: ${nf0.format(P.comuni)} municipalities, ${capWord}. The numbers in this profile therefore describe the province, not just the municipality of ${esc(e.name)}.` : `<strong>L’ISTAT pubblica i reati denunciati comune per comune solo per i 108 capoluoghi.</strong> Per ${esc(e.name)} il dato ufficiale più vicino è quello di tutta la provincia di ${esc(P.name)}: ${nf0.format(P.comuni)} comuni, ${capWord}. I numeri di questa scheda descrivono quindi la provincia, non il solo comune di ${esc(e.name)}.`}</p>
        ${extra.map((x) => `<p>${x}</p>`).join("")}
      </div>
      ${verdictHTML({ t, where: EN ? `in the province of ${esc(P.name)}` : `in provincia di ${esc(P.name)}`, lvl: r.lvl, it: m.itLvl, rank: r.rank, n: pm.ranked.length, unit: "province", cmp: r.cmp })}
      <div class="facts">
        <div class="fact"><div class="fv">${fmtRate(r.lvl)}</div><div class="fl">${esc(lower(m.label))} ${EN ? `per 100,000 residents in the province (${m.levelNote}) · ${ordinal(r.rank)} of ${pm.ranked.length} provinces · Italy ${fmtRate(m.itLvl)}` : `ogni 100.000 abitanti in provincia (${m.levelNote}) · ${r.rank}° su ${pm.ranked.length} province · Italia ${fmtRate(m.itLvl)}`}</div></div>
        <div class="fact"><div class="fv">${fmtPct(r.cmp && r.cmp.pct)}</div><div class="fl">${esc(lower(m.label))} ${L("in provincia", "in the province")}: ${r.cmp && r.cmp.win ? r.cmp.win + L(" (reato raro)", " (rare crime)") : !r.cmp && m.rare && !counts ? L("reato raro, troppo pochi anni per un confronto", "rare crime, too few years for a comparison") : `${Y[LAST]} ${L("rispetto al", "compared with")} ${state.cardBase}`}${sigText}</div></div>
        ${t !== "TOT" ? `<div class="fact"><div class="fv">${fmtRate(tr.lvl)}</div><div class="fl">${EN ? `all crimes per 100,000 residents in the province in ${Y[LAST]} · ${ordinal(tr.rank)} of ${tm.ranked.length}` : `tutti i delitti ogni 100.000 abitanti in provincia nel ${Y[LAST]} · ${tr.rank}° su ${tm.ranked.length}`}</div></div>` : ""}
        ${capRow ? `<div class="fact"><div class="fv">${fmtRate(capRow.lvl)}</div><div class="fl">${esc(lower(m.label))} ${EN ? `per 100,000 residents in the municipality of ${esc(cap.name)} alone, the provincial capital (${m.levelNote})` : `ogni 100.000 abitanti nel solo comune di ${esc(cap.name)}, il capoluogo (${m.levelNote})`}</div></div>` : ""}
        ${percFact(P.perc, L("della provincia", "in the province"))}
      </div>
      </div>
      ${locMap(e.lon, e.lat, e.name)}
      </div>
      ${movers}
      ${chartBlock(m.label + L(" in provincia di ", " in the province of ") + P.name, `<span><i class="k-city"></i>${L("provincia di", "province of")} ${esc(P.name)}</span>${capRow ? `<span><i class="k-prov"></i>${esc(cap.name)}, ${L("capoluogo", "provincial capital")}</span>` : ""}<span><i class="k-it"></i>${L("Italia", "Italy")}</span>${counts ? `<span><i class="k-gold"></i>${L("impennata", "spike")}</span>` : ""}`)}
      ${counts ? `<p class="note">${spikeNote((id) => provModel(id).byId.get(e.prov))}</p>` : ""}
      <h3 class="subhead">${L("Tutti i reati in provincia di", "Every crime type in the province of")} ${esc(P.name)}</h3>
      <p class="small">${L("Ogni riquadro ha la sua scala. Linea grigia: Italia. Tocca un reato per vederlo in questa scheda.", "Each panel has its own scale. Grey line: Italy. Tap a crime to see it in this profile.")}</p>
      <div class="sm-grid" id="city-grid"></div>
      <h3 class="subhead">${esc(m.label)}: ${L("i numeri anno per anno", "year by year")}</h3>
      <div class="tablewrap"><table><thead><tr><th>${L("Anno", "Year")}</th>${counts ? `<th class="num">${L("Casi in provincia", "Cases in the province")}</th>` : ""}<th class="num">${L("Provincia, ogni 100.000 ab.", "Province, per 100,000 res.")}</th>${capRow ? `<th class="num">${esc(cap.name)}</th>` : ""}<th class="num">${L("Italia", "Italy")}</th><th>${L("Nota", "Note")}</th></tr></thead><tbody>
        ${Y.map((yr, i) => {
          const a = r.an && r.an[i];
          const note = COVID.has(yr) ? "Covid" : a && a.flag === "spike" ? `${L("Impennata", "Spike")} (${fmtPct(a.rr - 1)})` : a && a.flag === "fall" ? `${L("Calo netto", "Sharp fall")} (${fmtPct(a.rr - 1)})` : "";
          const n = counts ? P.n[t][i] : null;
          return `<tr><td>${yr}</td>${counts ? `<td class="num">${n == null ? "–" : nf0.format(n)}</td>` : ""}<td class="num">${fmtRate(r.s[i])}</td>${capRow ? `<td class="num">${fmtRate(capRow.s[i])}</td>` : ""}<td class="num">${fmtRate(m.it[i])}</td><td>${note}</td></tr>`;
        }).reverse().join("")}
      </tbody></table></div>
      <p class="small src">${L("Fonti: ISTAT, delitti denunciati dalle forze di polizia all’autorità giudiziaria, tasso di delittuosità per provincia e conteggi per comune capoluogo; percezione del rischio dall’indagine ISTAT Aspetti della vita quotidiana; elenco ufficiale ISTAT dei comuni.", "Sources: ISTAT, crimes reported by the police to the judicial authorities, crime rate by province and counts for each provincial capital; perceived risk from the ISTAT survey Aspetti della vita quotidiana (Aspects of daily life); ISTAT official list of municipalities.")}${counts ? "" : L(" Per le province l’ISTAT pubblica i tassi: le variazioni qui sono rapporti tra tassi, senza il test statistico usato per i capoluoghi (cerchio vuoto).", " For the provinces ISTAT publishes rates: the changes here are ratios between rates, without the statistical test used for the provincial capitals (empty circle).")}</p>
      <div class="btns card-foot">${caps.map((c) => `<button type="button" class="btn" data-open-city="${c.id}">${EN ? `Open the ${esc(c.name)} profile` : `Apri la scheda di ${esc(c.name)}`}</button>`).join("")}</div>`;
    $("#city-grid").innerHTML = gridHTML(rows);
    const series = [{ name: EN ? `Province of ${P.name}` : `Provincia di ${P.name}`, values: r.s, color: "var(--ink)", width: 2.25 }];
    if (capRow) series.push({ name: EN ? `${cap.name}, provincial capital` : `${cap.name}, capoluogo`, values: capRow.s, color: "var(--ink-2)", width: 1.75, dash: "5 4" });
    series.push({ name: L("Italia", "Italy"), values: m.it, color: "var(--muted)", width: 1.5 });
    drawCard(series, r.an, rows, (tt, row, i) => `<b>${esc(tt.label)}</b> · ${Y[i]}<br>${counts && P.n[tt.id][i] != null ? nf0.format(P.n[tt.id][i]) + L(" casi, ", " cases, ") : ""}${fmtRate(row.s[i])} ${L("ogni 100.000 ab. in provincia", "per 100,000 res. in the province")} (${L("Italia", "Italy")} ${fmtRate(ITALY.rate[tt.id][i])})`);
  }

  // ------------------------------------------------------------------ ricerca del comune

  // sulle pagine in inglese i capoluoghi si trovano anche con il nome inglese (Rome, Milan…): sono solo chiavi di ricerca, l'elenco mostra il nome italiano
  const EXONYM = { Roma: "Rome", Milano: "Milan", Napoli: "Naples", Torino: "Turin", Firenze: "Florence", Venezia: "Venice", Genova: "Genoa", Padova: "Padua", Siracusa: "Syracuse", Mantova: "Mantua", Livorno: "Leghorn" };
  function entry(name, alt, sigla, prov, city, region, aliases) {
    const keys = [normQ(name)].concat([alt].concat(aliases || [], EN && city && EXONYM[name] ? [EXONYM[name]] : []).filter(Boolean).map(normQ));
    return { name, alt, sigla, prov, city, region, keys };
  }

  function loadPlaces() {
    if (placesPromise) return placesPromise;
    const get = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    placesPromise = Promise.all([get(ROOT + "data/comuni.json"), get(ROOT + "data/province.json")]).then(([cm, pv]) => {
      if (pv.meta.years.join() !== Y.join()) throw new Error("anni diversi tra vc.json e province.json");
      PROV = pv.prov; PROV_META = pv.meta; UNITS = cm.units;
      INDEX = cm.comuni.map(([name, alt, sigla, prov, city, x, y]) => {
        const c = city ? cityById(city) : null;
        if (c) CITY_PROV[c.id] = prov;
        // i capoluoghi usano il nome del resto della pagina (Reggio Emilia), ma si trovano anche con quello ufficiale
        const e = entry(c ? c.name : name, alt, sigla, prov, c ? c.id : "", PROV[prov].region, c && c.name !== name ? [name] : []);
        e.lon = x == null ? null : x / 100;
        e.lat = y == null ? null : y / 100;
        return e;
      });
    }).catch((err) => {
      placesFailed = true;
      const hint = $("#finder-hint");
      if (hint) {
        hint.textContent = L("Non riesco a caricare l’elenco dei comuni: per ora la ricerca trova solo i 108 capoluoghi.", "The list of towns did not load: for now the search only finds the 108 provincial capitals.");
        hint.classList.add("warn");
      }
      throw err;
    });
    return placesPromise;
  }

  // Le parole cercate devono essere l'inizio di parole del nome, nello stesso ordine ("reggio emilia", "sesto giovanni").
  function wordsMatch(key, qt) {
    const words = key.split(" ");
    let j = 0;
    for (const q of qt) {
      while (j < words.length && !words[j].startsWith(q)) j++;
      if (j === words.length) return false;
      j++;
    }
    return true;
  }
  function score(e, q, qt) {
    let best = 9;
    e.keys.forEach((k, i) => {
      const s = k === q ? 0 : k.startsWith(q) ? 1 : wordsMatch(k, qt) ? 2 : k.includes(q) ? 3 : 9;
      if (s < 9) best = Math.min(best, s + (i ? 0.5 : 0));
    });
    return best;
  }
  function search(raw) {
    const run = (list, q) => {
      const qt = q.split(" ");
      return list.map((e) => [e, score(e, q, qt)]).filter((d) => d[1] < 9)
        .sort((a, b) => a[1] - b[1] || (b[0].city ? 1 : 0) - (a[0].city ? 1 : 0) || a[0].name.localeCompare(b[0].name, "it"))
        .slice(0, 12).map((d) => d[0]);
    };
    const q = normQ(raw);
    if (!q) return [];
    let res = run(INDEX, q);
    // "Castro LE", "castro (le)": l'ultima parola può essere la sigla della provincia
    const qt = q.split(" "), last = qt[qt.length - 1].toUpperCase();
    if (!res.length && qt.length > 1 && UNITS && UNITS[last]) res = run(INDEX.filter((e) => e.sigla === last), qt.slice(0, -1).join(" "));
    return res;
  }

  function optionHTML(e, id, i) {
    const unit = UNITS && UNITS[e.sigla];
    const meta = unit && !normQ(unit).startsWith(normQ(e.region)) ? `${unit} · ${e.region}` : e.region;
    return `<li role="option" id="${id}" data-i="${i}" aria-selected="false"><span class="o-name">${esc(e.name)}${e.alt ? ` <span class="small">${esc(e.alt)}</span>` : ""}</span><span class="o-meta">${esc(meta || "")}</span><span class="o-tag${e.city ? " cap" : ""}">${e.city ? L("capoluogo", "provincial capital") : L("dati provinciali", "provincial data")}</span></li>`;
  }

  // Combobox accessibile: frecce per scegliere, Invio per aprire la scheda, Esc per chiudere l'elenco.
  function combo(input, list, keep) {
    let items = [], active = -1;
    const setActive = (i) => {
      active = i;
      list.querySelectorAll("li[data-i]").forEach((li, k) => li.setAttribute("aria-selected", k === i));
      const li = i >= 0 ? list.querySelector(`li[data-i="${i}"]`) : null;
      if (li) { input.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block: "nearest" }); }
      else input.removeAttribute("aria-activedescendant");
    };
    const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); setActive(-1); };
    const update = () => {
      if (!normQ(input.value)) { items = []; list.innerHTML = ""; close(); return; }
      items = search(input.value);
      const loading = !PROV && !placesFailed ? L(" (sto caricando l’elenco dei comuni…)", " (loading the list of towns…)") : "";
      list.innerHTML = items.length ? items.map((e, i) => optionHTML(e, `${list.id}-${i}`, i)).join("") + (loading ? `<li class="o-none">${L("Solo capoluoghi", "Provincial capitals only")}${loading}</li>` : "")
        : `<li class="o-none">${loading ? L("Sto caricando l’elenco dei comuni…", "Loading the list of towns…") : L("Nessun comune con questo nome. L’elenco è quello ufficiale ISTAT: controlla l’ortografia.", "No town by this name. The list is ISTAT’s official one, with Italian names: check the spelling.")}</li>`;
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      setActive(items.length ? 0 : -1);
    };
    const pick = (e) => {
      if (!e) return;
      close();
      input.value = keep ? e.name : "";
      openPlace(e);
    };
    input.addEventListener("input", () => {
      update();
      if (!PROV && !placesFailed) loadPlaces().then(() => { if (document.activeElement === input) update(); }).catch(() => { if (document.activeElement === input) update(); });
    });
    input.addEventListener("focus", () => { if (!placesFailed) loadPlaces().catch(() => {}); });
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowDown") { ev.preventDefault(); if (list.hidden) update(); else if (items.length) setActive((active + 1) % items.length); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); if (items.length) setActive((active - 1 + items.length) % items.length); }
      else if (ev.key === "Enter") { ev.preventDefault(); if (list.hidden) update(); pick(items[active >= 0 ? active : 0]); }
      else if (ev.key === "Escape" && !list.hidden) { ev.preventDefault(); close(); }
    });
    input.addEventListener("blur", () => setTimeout(close, 200));
    list.addEventListener("mousedown", (ev) => ev.preventDefault());
    list.addEventListener("click", (ev) => { const li = ev.target.closest("li[data-i]"); if (li) pick(items[+li.dataset.i]); });
  }

  $("#city-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("close", () => {
    // l'evento arriva in un task successivo: se nel frattempo si è aperta un'altra scheda, non va toccata
    if (dlg.open) return;
    document.body.appendChild(tip);
    hideTip();
    state.city = null;
    state.place = null;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignorato */ }
  });
  dlg.addEventListener("click", (ev) => {
    if (ev.target === dlg) { dlg.close(); return; }
    const oc = ev.target.closest("[data-open-city]");
    if (oc) { openCity(cityById(oc.dataset.openCity), state.cardType, state.cardBase); return; }
    // quartieri: scelta dello strato e del quartiere
    const lb = ev.target.closest("#quart-seg button");
    if (lb) { state.qLayer = lb.dataset.ql; renderQuart(QUART[state.city && state.city.id]); return; }
    const qb = ev.target.closest("[data-q]");
    if (qb && state.city && QUART[state.city.id]) { ev.preventDefault(); selectQuart(QUART[state.city.id], +qb.dataset.q); return; }
    const b = ev.target.closest("[data-type]");
    if (b && dlg.contains(b)) setCardType(b.dataset.type);
  });

  // ------------------------------------------------------------------ comandi

  // Niente comandi che cambiano tutta la pagina: ognuno vale per la sua sezione.
  function setMap(t, base) {
    if (TYPE[t]) state.mapType = t;
    if (base) state.mapBase = base;
    $("#map-type").value = state.mapType;
    $("#base-seg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", +x.dataset.base === state.mapBase));
    renderMap();
    renderRanking();
  }
  // un reato toccato nell'apertura o in «Cosa sale e cosa scende»: lo si vede sulla mappa, e la pagina scende lì;
  // da «Cosa sale e cosa scende» la mappa prende anche il periodo che si stava guardando
  function showOnMap(t, base) {
    setMap(t, base);
    document.getElementById("mappa").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function setCardType(t) {
    if (!TYPE[t]) return;
    state.cardType = t;
    if (state.city) renderCity();
    if (state.place) renderProv();
  }

  function seg(id, attr, onPick) {
    const el = $(id);
    el.addEventListener("click", (ev) => {
      const b = ev.target.closest("button");
      if (!b) return;
      el.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      onPick(b.dataset[attr]);
    });
  }

  // Ogni pagina disegna solo le sezioni che ha: la home quelle sui reati, ogni approfondimento le sue.
  function renderAll() {
    if (has("eyechart")) {
      renderEyechart();
      renderNational();
      renderHeroCities();
      renderHeroTypes();
    }
    renderBrief();
    if (has("mix-grid")) renderMix();
    if (has("map")) { renderMap(); renderRanking(); }
    if (has("sm")) renderGrid();
    if (has("spike-cards")) renderSpikes();
    if (has("perc-scatter")) renderPerception();
    if (PROVP && has("perc-prov")) renderPercProv();
    if (CARCERI && has("carceri-facts")) renderCarceri();
    if (RIMP && has("rimpatri-facts")) renderRimpatri();
    if (AUTORI && has("autori-facts")) renderAutori();
    if (MINORI && has("minori-facts")) renderMinori();
    renderDeepCards();
    if (state.city) renderCity();
    if (state.place) renderProv();
  }

  // L'elenco delle fonti in fondo alla pagina: la home le raccoglie tutte, ogni approfondimento solo le sue (data-only).
  function addSources(list, kind) {
    const ul = $("#sources");
    if (!ul || (ul.dataset.only && ul.dataset.only !== kind)) return;
    ul.insertAdjacentHTML("beforeend", list.map((s) => sourceItem(s, kind)).join(""));
  }
  // Le fonti in inglese, per id; "kind:id" quando lo stesso dataset ha un'altra etichetta in un altro file di dati.
  // s.en (le fonti scritte qui dentro) vince su tutto; se manca la traduzione resta l'etichetta italiana.
  const SOURCE_EN = {
    "73_67_DF_DCCV_DELITTIPS_1": "ISTAT, Crimes reported by the police to the judicial authorities — by type of crime (source: Ministry of the Interior, SDI/SSD database)",
    "73_67_DF_DCCV_DELITTIPS_9": "ISTAT, Reported crimes — crime rate (Italy)",
    "164_164_DF_DCIS_RICPOPRES2011_24": "ISTAT, Reconstructed resident population 2002-2019, all municipalities",
    "22_289": "ISTAT, Resident population on 1 January (2019-2026)",
    "DF_DCSS_BEST_PPC_1_GC": "ISTAT, Households by perceived risk of crime in the area where they live — provinces and large municipalities",
    "33_291": "ISTAT, Pollution, crime and noise in the area where people live (EU-SILC)",
    "openpolis/geojson-italy": "ISTAT administrative boundaries, reworked by openpolis (CC BY 4.0)",
    "73_173_DF_DCCV_DETENUTI_4": "ISTAT, Adult prisoners held in Italian prisons — geographical origin",
    "73_173_DF_DCCV_DETENUTI_1": "ISTAT, Adult prisoners — offences",
    "73_173_DF_DCCV_DETENUTI_2": "ISTAT, Adult prisoners — age",
    "73_173_DF_DCCV_DETENUTI_5": "ISTAT, Adult prisoners — legal status",
    "73_173_DF_DCCV_DETENUTI_6": "ISTAT, Prison capacity and prisoners per 100 places",
    "demo.istat.it": "ISTAT, Demografia in cifre: foreign resident population on 1 January",
    migr_eirtn: "Eurostat, Third-country nationals returned following an order to leave (annual data, rounded)",
    migr_eiord: "Eurostat, Third-country nationals ordered to leave (annual data, rounded)",
    CNTR_RG_60M_2020: "European Commission, GISCO: country boundaries of the world (© EuroGeographics for the administrative boundaries)",
    "73_67_DF_DCCV_DELITTIPS_6": "ISTAT, Reported crimes in which the offender was identified, by type of crime — Italy (source: Ministry of the Interior, SDI/SSD database)",
    "73_67_DF_DCCV_DELITTIPS_2": "ISTAT, Reported crimes by type and identity of the offender, committed during the year — large municipalities",
    "73_67_DF_DCCV_DELITTIPS_5": "ISTAT, Crimes in which the offender was identified, by type — large municipalities (as a cross-check)",
    "73_67_DF_DCCV_DELITTIPS_7": "ISTAT, Crimes in which the offender was identified — provinces",
    "autori:73_67_DF_DCCV_DELITTIPS_9": "ISTAT, Reported crimes — crime rate by province (for the share of thefts)",
    "73_342_DF_DCCV_SEGNALAZPS_2": "ISTAT, Records of minors reported, arrested or detained by the police, by type of crime (source: Ministry of the Interior, SDI/SSD database)",
    "73_342_DF_DCCV_SEGNALAZPS_1": "ISTAT, Records of people reported, arrested or detained by the police, in total",
    ds964: "Comune di Milano, Nuclei d'Identità Locale (NIL, the city’s neighbourhood units) currently in force, PGT 2030 (CC BY 4.0)",
    ds379: "Comune di Milano, area of the Municipi, the city’s districts (CC BY 4.0)",
    ds205: "Comune di Milano, demographic and territorial characteristics of the neighbourhoods, 2011-2024 (population register data, CC BY 4.0)",
    ds503: "Comune di Milano, run-down, abandoned or disused buildings 2014-2017 (CC BY 4.0)",
    ds392: "Comune di Milano on ISTAT data, 2011 Census: commuters coming into Milano, by census section of destination (CC BY 4.0)",
  };
  const sourceLabel = (s, kind) => (EN ? s.en || SOURCE_EN[kind + ":" + s.id] || SOURCE_EN[s.id] || s.label : s.label);
  const sourceItem = (s, kind) => `<li><code>${esc(s.id)}</code> ${esc(sourceLabel(s, kind))}</li>`;

  // I nomi che arrivano con i dati di carceri e rimpatri (continenti, paesi, reati): sulle pagine in en/ si traducono appena
  // caricati, in tutti gli anni allo stesso modo, perché le tabelle cercano i gruppi per nome da un anno all'altro.
  // Paesi: Intl.DisplayNames dal codice ISO; qui i gruppi dell'ISTAT, i codici non ISO e i nomi che si preferiscono.
  const GEO_EN = {
    Europa: "Europe", America: "Americas", Altri: "Other",
    AFR_OTH: "Other African countries", ASI_OTH: "Other Asian countries", EUR_OTH: "Other European countries", OTH: "Other and stateless",
    AME_C: "Central America", AME_N: "North America", AME_S: "South America", X1023: "Middle East",
    UK: "United Kingdom", XK: "Kosovo", TR: "Turkey", BA: "Bosnia and Herzegovina", CG: "Congo", PS: "Palestine", CI: "Ivory Coast",
  };
  let geoNames = null;
  const geoName = (id, name) => {
    if (GEO_EN[id]) return GEO_EN[id];
    try {
      geoNames = geoNames || new Intl.DisplayNames(["en-GB"], { type: "region" });
      const s = geoNames.of(id);
      return s && s !== id ? s : name;
    } catch (e) {
      return name;
    }
  };
  // i reati dei detenuti, per id: il nome intero (nel suggerimento) e quello breve (sulle righe del grafico, OFF_SHORT)
  const PRISON_OFF_EN = {
    STU: "drugs and psychotropic substances", RA: "robbery", FU: "theft offences", LPV: "intentional bodily harm", RIC: "handling stolen goods",
    VIR: "violence, resistance or insult to a public official", AFS: "mafia-type or organised crime associations", ES: "extortion",
    VPV_MIN: "coercion, threats", OMV: "intentional homicide", CA: "offences against the administration of justice",
    MAL: "abuse of family members or children", VS: "sexual violence offences", TR: "fraud offences", ISFF: "inciting, exploiting or aiding prostitution",
  };

  // ------------------------------------------------------------------ carceri

  async function loadCarceri() {
    try {
      const r = await fetch(ROOT + "data/carceri.json");
      if (!r.ok) throw new Error(r.status);
      CARCERI = await r.json();
      if (EN) {
        Object.values(CARCERI.albero).forEach((gs) => gs.forEach((g) => { g.name = GEO_EN[g.name] || g.name; g.children.forEach((c) => { c.name = geoName(c.id, c.name); }); }));
        CARCERI.reati.forEach((x) => { x.name = PRISON_OFF_EN[x.id] || x.name; });
      }
      state.treeYear = CARCERI.meta.last;
      addSources(CARCERI.meta.sources, "carceri");
      const seg = $("#tree-year-seg");
      if (seg) {
        const years = [CARCERI.meta.years[0], 2019, CARCERI.meta.last];
        seg.innerHTML = years.map((y) => `<button type="button" data-ty="${y}" aria-pressed="${y === state.treeYear}">${y}</button>`).join("");
        seg.addEventListener("click", (ev) => {
          const b = ev.target.closest("button");
          if (!b) return;
          seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
          state.treeYear = +b.dataset.ty;
          renderTreemap();
        });
      }
      if (has("carceri-facts")) renderCarceri();
      renderBrief();
      renderDeepCards();
    } catch (e) {
      if (has("carceri-facts")) $("#carceri-facts").innerHTML = `<p class="note">${L("I dati sulle carceri non si sono caricati", "The prison data did not load")} (${esc(e.message)}).</p>`;
      console.error(e);
    }
  }

  function renderCarceri() {
    const C = CARCERI, Yc = C.meta.years, L = Yc.length - 1, last = C.meta.last;
    const tot = C.serie.tot[L], str = C.serie.str[L], quota = (100 * str) / tot;
    // stranieri residenti: ultimo anno disponibile tra last e last-1; residenti.fonte dice da dove viene (sdmx o demo.istat.it)
    const R = C.residenti, resAnni = (R && R.anni) || {};
    const resKey = [last, last - 1].find((y) => resAnni[String(y)]);
    const res = resKey ? resAnni[String(resKey)] : null;
    const nonDef = (p) => (p.AWFJ + p.APP + p.REC + p.MWOD) / Object.values(p).reduce((a, b) => a + b, 0);
    const pIt = C.posizione.it, pStr = C.posizione.str;
    const totIt = Object.values(pIt).reduce((a, b) => a + b, 0), totStr = Object.values(pStr).reduce((a, b) => a + b, 0);
    const ndIt = (pIt.AWFJ + pIt.APP + pIt.REC + pIt.MWOD) / totIt, ndStr = (pStr.AWFJ + pStr.APP + pStr.REC + pStr.MWOD) / totStr;
    $("#carceri-facts").innerHTML = EN ? `
      <div class="fact"><div class="fv">${nf1.format(quota)}%</div><div class="fl">of the ${nf0.format(tot)} prisoners held at the end of ${last} are foreign nationals: ${nf0.format(str)} people. In ${Yc[0]} the figure was ${nf1.format((100 * C.serie.str[0]) / C.serie.tot[0])}%.</div></div>
      ${res ? `<div class="fact"><div class="fv">${nf1.format(res.quota)}%</div><div class="fl">of Italy’s residents are foreign nationals: ${nf0.format(res.stranieri)} out of ${nf0.format(res.pop)} on 1 January ${resKey} (source: ${esc(R.fonte === "demo.istat.it" ? R.fonte_label || "ISTAT" : "ISTAT")})</div></div>`
            : `<div class="fact na"><div class="fv">share among residents: awaiting data</div><div class="fl">The ISTAT series on foreign residents could not be reached when this data was built. It will be added at the next update.</div></div>`}
      <div class="fact"><div class="fv">${nf1.format(ndStr * 100)}%<small>vs ${nf1.format(ndIt * 100)}%</small></div><div class="fl">of foreign prisoners have no final conviction (they are awaiting trial, or have an appeal pending); among Italians the figure is ${nf1.format(ndIt * 100)}%</div></div>
      <div class="fact"><div class="fv">${nf1.format(C.serie.affollamento[L])}</div><div class="fl">prisoners per 100 official places in ${last}. There were ${nf1.format(C.serie.affollamento[Yc.indexOf(2020)])} in 2020 and ${nf1.format(C.serie.affollamento[0])} in ${Yc[0]}.</div></div>` : `
      <div class="fact"><div class="fv">${nf1.format(quota)}%</div><div class="fl">dei ${nf0.format(tot)} detenuti presenti a fine ${last} è straniero: ${nf0.format(str)} persone. Nel ${Yc[0]} era il ${nf1.format((100 * C.serie.str[0]) / C.serie.tot[0])}%.</div></div>
      ${res ? `<div class="fact"><div class="fv">${nf1.format(res.quota)}%</div><div class="fl">degli abitanti dell'Italia è straniero: ${nf0.format(res.stranieri)} residenti su ${nf0.format(res.pop)} al 1° gennaio ${resKey} (fonte: ${esc(R.fonte_label || "ISTAT")})</div></div>`
            : `<div class="fact na"><div class="fv">quota tra i residenti: in attesa del dato</div><div class="fl">La serie ISTAT degli stranieri residenti non era raggiungibile quando questi dati sono stati costruiti. Verrà aggiunta al prossimo aggiornamento.</div></div>`}
      <div class="fact"><div class="fv">${nf1.format(ndStr * 100)}%<small>vs ${nf1.format(ndIt * 100)}%</small></div><div class="fl">dei detenuti stranieri è senza una condanna definitiva (in attesa di giudizio, appellanti, ricorrenti); tra gli italiani è il ${nf1.format(ndIt * 100)}%</div></div>
      <div class="fact"><div class="fv">${nf1.format(C.serie.affollamento[L])}</div><div class="fl">detenuti ogni 100 posti regolamentari nel ${last}. Erano ${nf1.format(C.serie.affollamento[Yc.indexOf(2020)])} nel 2020 e ${nf1.format(C.serie.affollamento[0])} nel ${Yc[0]}.</div></div>`;

    renderTreemap();

    // la presenza straniera, in apertura: ogni 100 detenuti e ogni 100 residenti, con la frase che lo dice a parole
    const share = Yc.map((y, i) => (100 * C.serie.str[i]) / C.serie.tot[i]);
    const NUMW = EN ? ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"]
      : ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci", "undici", "dodici", "tredici", "quattordici", "quindici"];
    const oneIn = (q) => { const r = 100 / q, n = Math.round(r); return { w: NUMW[n] || nf0.format(n), pre: Math.abs(r - n) / n < 0.03 ? "" : r > n ? (EN ? "nearly " : "quasi ") : EN ? "more than " : "più di " }; };
    if (has("carceri-lead")) {
      const a = oneIn(quota), b = res ? oneIn(res.quota) : null, t = EN ? `${a.pre}one prisoner in ${a.w} is a foreign national` : `${a.pre}un detenuto su ${a.w} è straniero`;
      $("#carceri-lead").textContent = t.charAt(0).toUpperCase() + t.slice(1) + (b ? (EN ? `; among people living in Italy, ${b.pre}one in ${b.w}.` : `; tra chi vive in Italia, ${b.pre}uno su ${b.w}.`) : ".");
    }
    if (has("carceri-waffle")) {
      renderWaffle($("#carceri-waffle"), EN ? [
        { v: quota, unit: "foreign nationals", label: `per 100 prisoners held at the end of ${last}`, aria: `${nf1.format(quota)} foreign nationals per 100 prisoners at the end of ${last}` },
        ...(res ? [{ v: res.quota, unit: "foreign nationals", label: `per 100 residents on 1 January ${resKey}`, aria: `${nf1.format(res.quota)} foreign nationals per 100 residents on 1 January ${resKey}` }] : []),
      ] : [
        { v: quota, label: `ogni 100 detenuti presenti a fine ${last}`, aria: `${nf1.format(quota)} stranieri ogni 100 detenuti a fine ${last}` },
        ...(res ? [{ v: res.quota, label: `ogni 100 residenti al 1° gennaio ${resKey}`, aria: `${nf1.format(res.quota)} stranieri ogni 100 residenti al 1° gennaio ${resKey}` }] : []),
      ]);
    }
    // quanti, nel tempo: detenuti italiani e stranieri
    if (has("carceri-counts")) {
      seriesChart($("#carceri-counts"), {
        years: Yc, label: EN ? `Italian and foreign prisoners held at the end of each year, ${Yc[0]}–${last}` : `Detenuti italiani e stranieri presenti a fine anno, ${Yc[0]}–${last}`, height: 230,
        series: [{ name: EN ? "Italians" : "italiani", values: C.serie.it, color: "var(--ink)" }, { name: EN ? "foreign nationals" : "stranieri", values: C.serie.str, color: "var(--fall)", width: 2.5 }],
        tip: (i) => EN
          ? `<b>end of ${Yc[i]}</b><br>${nf0.format(C.serie.it[i])} Italians<br>${nf0.format(C.serie.str[i])} foreign nationals, ${nf1.format(share[i])}%<br>${nf0.format(C.serie.tot[i])} in total, ${nf1.format(C.serie.affollamento[i])} per 100 places`
          : `<b>fine ${Yc[i]}</b><br>${nf0.format(C.serie.it[i])} italiani<br>${nf0.format(C.serie.str[i])} stranieri, il ${nf1.format(share[i])}%<br>${nf0.format(C.serie.tot[i])} in tutto, ${nf1.format(C.serie.affollamento[i])} ogni 100 posti`,
      });
    }
    // la quota di stranieri tra i detenuti e tra i residenti
    const resShare = Yc.map((y) => (resAnni[String(y)] ? resAnni[String(y)].quota : null));
    seriesChart($("#carceri-trend"), {
      years: Yc, label: EN ? "Share of foreign nationals among prisoners and among residents" : "Quota di stranieri tra i detenuti e tra i residenti", yMax: d3.max(share) * 1.15, height: 230,
      yFmt: (v) => v + "%", fmt: (v) => nf1.format(v) + "%",
      series: [{ name: EN ? "among prisoners" : "tra i detenuti", values: share, color: "var(--fall)", width: 2.5 }, { name: EN ? "among residents" : "tra i residenti", values: resShare, color: "var(--ink-2)" }],
      tip: (i) => EN
        ? `<b>${Yc[i]}</b><br>${nf1.format(share[i])}% of prisoners at the end of the year (${nf0.format(C.serie.str[i])} of ${nf0.format(C.serie.tot[i])})` + (resShare[i] != null ? `<br>${nf1.format(resShare[i])}% of residents on 1 January` : "")
        : `<b>${Yc[i]}</b><br>${nf1.format(share[i])}% dei detenuti a fine anno (${nf0.format(C.serie.str[i])} su ${nf0.format(C.serie.tot[i])})` + (resShare[i] != null ? `<br>${nf1.format(resShare[i])}% dei residenti al 1° gennaio` : ""),
    });
    if (has("carceri-nat")) renderCarceriNat();

    // regioni
    const regs = C.regioni;
    $("#carceri-reg-sub").textContent = EN ? `Share of foreign nationals among prisoners in ${last}; the line is Italy (${nf1.format(quota)}%).` : `Quota di stranieri tra i detenuti nel ${last}; la linea è l'Italia (${nf1.format(quota)}%).`;
    const maxQ = d3.max(regs, (r) => r.quota);
    $("#carceri-regions").innerHTML = regs.map((r) => `<li><span class="name" title="${esc(r.name)}">${esc(r.name)}</span><span class="bar" aria-hidden="true"><i class="rv-grow" style="width:${(100 * r.quota) / maxQ}%"></i><b class="rv-fade" style="left:${(100 * quota) / maxQ}%"></b></span><span class="val">${nf1.format(r.quota)}%</span></li>`).join("");
    reveal($("#carceri-regions"), $("#carceri-regions").querySelectorAll("li"));

    renderOffences();
    renderAge();
    const lab = C.posizione.labels;
    $("#carceri-legal").innerHTML = EN
      ? `Legal status in ${last}: among foreign nationals, ${nf1.format((100 * pStr.AWFJ) / totStr)}% are awaiting their first trial (Italians ${nf1.format((100 * pIt.AWFJ) / totIt)}%) and ${nf1.format((100 * pStr.CONVFJ) / totStr)}% have a final conviction (Italians ${nf1.format((100 * pIt.CONVFJ) / totIt)}%).`
      : `Posizione giuridica nel ${last}: tra gli stranieri il ${nf1.format((100 * pStr.AWFJ) / totStr)}% è in attesa del primo giudizio (italiani ${nf1.format((100 * pIt.AWFJ) / totIt)}%) e il ${nf1.format((100 * pStr.CONVFJ) / totStr)}% ha una condanna definitiva (italiani ${nf1.format((100 * pIt.CONVFJ) / totIt)}%).`;
    $("#carceri-note-1").textContent = EN
      ? `Foreign prisoners include people without a residence permit, who do not appear among residents: so the comparison between the two shares is lopsided from the start. Foreign nationals in Italy are also younger on average, and people aged between 25 and 40 are the ones who end up in prison most often in every country. And without a home or a stable job it is harder to obtain alternatives to custody, and more likely to stay in a cell awaiting trial: in ${last}, ${nf1.format(ndStr * 100)}% of foreign nationals had no final conviction, against ${nf1.format(ndIt * 100)}% of Italians.`
      : `Tra i detenuti stranieri ci sono anche persone senza permesso di soggiorno, che non compaiono tra i residenti: il confronto tra le due quote è quindi sbilanciato in partenza. Gli stranieri in Italia sono inoltre mediamente più giovani, e la fascia tra i 25 e i 40 anni è quella che in ogni paese finisce più spesso in carcere. E senza una casa o un lavoro stabile è più difficile ottenere misure alternative alla detenzione e più probabile restare in cella in attesa di giudizio: nel ${last} è senza condanna definitiva il ${nf1.format(ndStr * 100)}% degli stranieri contro il ${nf1.format(ndIt * 100)}% degli italiani.`;
  }

  function renderTreemap() {
    const C = CARCERI, y = state.treeYear;
    const groups = C.albero[String(y)];
    const total = d3.sum(groups, (g) => g.n);
    $("#tree-sub").textContent = EN ? `${nf0.format(total)} foreign prisoners at the end of ${y}. Each rectangle is proportional to the number of people.` : `${nf0.format(total)} detenuti stranieri a fine ${y}. Ogni rettangolo è proporzionale alle persone.`;
    const el = $("#treemap");
    const w = Math.max(300, el.clientWidth), h = Math.round(Math.min(520, Math.max(320, w * 0.72)));
    const root = d3.hierarchy({ name: "root", children: groups.map((g) => ({ name: g.name, children: g.children.filter((c) => c.n > 0).map((c) => ({ name: c.name, id: c.id, n: c.n })) })) })
      .sum((d) => d.n).sort((a, b) => b.value - a.value);
    d3.treemap().size([w, h]).paddingInner(2).paddingOuter(3).paddingTop(20).round(true)(root);
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", EN ? `Treemap of foreign prisoners by nationality in ${y}` : `Treemap dei detenuti stranieri per cittadinanza nel ${y}`);
    svg.selectAll("*").remove();
    const conts = root.children;
    let nLeaf = 0;
    conts.forEach((g, gi) => {
      g.leaves().forEach((d) => {
        const cw = d.x1 - d.x0, ch = d.y1 - d.y0, li = nLeaf++;
        const r = svg.append("rect").attr("class", "leaf rv-pop" + (gi % 2 ? " alt" : "")).style("--i", li).attr("x", d.x0).attr("y", d.y0).attr("width", cw).attr("height", ch).attr("rx", 2);
        r.on("mousemove", (ev) => showTip(`<b>${esc(d.data.name)}</b> · ${esc(g.data.name)}<br>${nf0.format(d.value)} ${L("detenuti", "prisoners")}, ${nf1.format((100 * d.value) / total)}% ${L("degli stranieri", "of foreign prisoners")}`, ev)).on("mouseleave", hideTip);
        const label = d.data.name, est = label.length * 6.6;
        if (cw > est + 10 && ch > 30) {
          svg.append("text").attr("class", "ll rv-fade").style("--i", li).attr("x", d.x0 + 6).attr("y", d.y0 + 16).text(label);
          svg.append("text").attr("class", "lv rv-fade").style("--i", li).attr("x", d.x0 + 6).attr("y", d.y0 + 30).text(`${nf0.format(d.value)} · ${nf1.format((100 * d.value) / total)}%`);
        } else if (cw > 40 && ch > 18) {
          svg.append("text").attr("class", "lv rv-fade").style("--i", li).attr("x", d.x0 + 5).attr("y", d.y0 + 13).text(label.length * 6 < cw - 8 ? label : nf1.format((100 * d.value) / total) + "%");
        }
      });
      svg.append("rect").attr("class", "cont rv-fade").attr("x", g.x0).attr("y", g.y0).attr("width", g.x1 - g.x0).attr("height", g.y1 - g.y0);
      if (g.x1 - g.x0 > 60) {
        svg.append("rect").attr("class", "hd rv-fade").attr("x", g.x0).attr("y", g.y0).attr("width", g.x1 - g.x0).attr("height", 18).style("fill", "var(--ink)");
        svg.append("text").attr("class", "cl rv-fade").attr("x", g.x0 + 6).attr("y", g.y0 + 13).text(`${g.data.name} ${nf1.format((100 * g.value) / total)}%`);
      }
    });
    reveal(el);
    // tabella gemella
    const years = C.meta.years;
    const leaves = groups.flatMap((g) => g.children.map((c) => ({ cont: g.name, ...c })));
    $("#tree-table").innerHTML = `<thead><tr><th>${L("Cittadinanza", "Nationality")}</th><th>Area</th>${years.map((yy) => `<th class="num">${yy}</th>`).join("")}</tr></thead><tbody>` +
      leaves.map((lf) => `<tr><td>${esc(lf.name)}</td><td>${esc(lf.cont)}</td>${years.map((yy) => { const g = C.albero[String(yy)].find((x) => x.name === lf.cont); const c = g && g.children.find((x) => x.id === lf.id); return `<td class="num">${c ? nf0.format(c.n) : "–"}</td>`; }).join("")}</tr>`).join("") +
      `<tr><td><b>${L("Tutti gli stranieri", "All foreign nationals")}</b></td><td></td>${years.map((yy) => `<td class="num"><b>${nf0.format(d3.sum(C.albero[String(yy)], (g) => g.n))}</b></td>`).join("")}</tr></tbody>`;
  }

  const OFF_SHORT = { STU: "Stupefacenti", RA: "Rapina", FU: "Furto", LPV: "Lesioni volontarie", RIC: "Ricettazione", VIR: "Resistenza a pubblico ufficiale", AFS: "Associazione mafiosa", ES: "Estorsione", VPV_MIN: "Violenza privata, minaccia", OMV: "Omicidio volontario", CA: "Contro l’amministrazione della giustizia", MAL: "Maltrattamenti in famiglia", VS: "Violenza sessuale", TR: "Truffa", ISFF: "Sfruttamento della prostituzione" };
  if (EN) Object.assign(OFF_SHORT, { STU: "Drugs", RA: "Robbery", FU: "Theft", LPV: "Assault causing injury", RIC: "Handling stolen goods", VIR: "Resisting a public official", AFS: "Mafia association", ES: "Extortion", VPV_MIN: "Coercion, threats", OMV: "Intentional homicide", CA: "Against the administration of justice", MAL: "Domestic abuse", VS: "Sexual violence", TR: "Fraud", ISFF: "Exploiting prostitution" });

  function renderOffences() {
    const C = CARCERI;
    const rows = C.reati.filter((r) => r.it != null && r.str != null).sort((a, b) => Math.max(b.it, b.str) - Math.max(a.it, a.str));
    const el = $("#carceri-offences");
    const w = Math.max(300, el.clientWidth), rowH = 26, m = { t: 30, r: 40, b: 10, l: Math.min(230, Math.round(w * 0.42)) }, h = m.t + rows.length * rowH + m.b;
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", L("Detenuti per tipo di reato ogni 100: italiani e stranieri", "Prisoners per 100 by type of offence: Italians and foreign nationals"));
    svg.selectAll("*").remove();
    const x = d3.scaleLinear([0, Math.ceil(d3.max(rows, (r) => Math.max(r.it, r.str)) / 10) * 10], [m.l, w - m.r]);
    const xa = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${m.t - 8})`).call(d3.axisTop(x).ticks(4).tickSize(-(h - m.t - m.b + 8)).tickFormat((v) => v));
    xa.select(".domain").remove();
    xa.selectAll(".tick line").style("stroke", "var(--grid)");
    svg.append("text").attr("class", "lbl").attr("x", m.l - 10).attr("y", 10).attr("text-anchor", "end").text(L("ogni 100 detenuti del gruppo", "per 100 prisoners in the group"));
    rows.forEach((r, i) => {
      const yy = m.t + i * rowH + rowH / 2;
      const short = OFF_SHORT[r.id] || r.name;
      svg.append("text").attr("class", "lbl").attr("x", m.l - 10).attr("y", yy + 4).attr("text-anchor", "end").text(short.length * 6.2 > m.l - 14 ? short.slice(0, Math.floor((m.l - 20) / 6.2)) + "…" : short)
        .append("title").text(r.name);
      svg.append("line").attr("class", "rv-grow").style("--i", i).style("--t0", "0.15s").style("transform-origin", r.it <= r.str ? "0 50%" : "100% 50%")
        .attr("x1", x(r.it)).attr("x2", x(r.str)).attr("y1", yy).attr("y2", yy).style("stroke", "var(--rule)").style("stroke-width", 3);
      svg.append("circle").attr("class", "rv-pop").style("--i", i).attr("cx", x(r.it)).attr("cy", yy).attr("r", 5.5).style("fill", "var(--ink)").style("stroke", "var(--surface)").style("stroke-width", 1.5);
      svg.append("circle").attr("class", "rv-pop").style("--i", i).style("--t0", "0.5s").attr("cx", x(r.str)).attr("cy", yy).attr("r", 5.5).style("fill", "var(--fall)").style("stroke", "var(--surface)").style("stroke-width", 1.5);
      const hi = Math.max(r.it, r.str), lo = Math.min(r.it, r.str);
      svg.append("text").attr("class", "lbl halo rv-fade").style("--i", i).style("--t0", "0.7s").attr("x", x(hi) + 9).attr("y", yy + 4).text(nf1.format(hi));
      if (x(hi) - x(lo) > 34 && x(lo) - m.l > 34) svg.append("text").attr("class", "lbl halo rv-fade").style("--i", i).style("--t0", "0.7s").attr("x", x(lo) - 9).attr("y", yy + 4).attr("text-anchor", "end").text(nf1.format(lo));
      svg.append("rect").attr("x", 0).attr("y", yy - rowH / 2).attr("width", w).attr("height", rowH).style("fill", "transparent")
        .on("mousemove", (ev) => showTip(EN
          ? `<b>${esc(r.name)}</b><br>Italians ${nf1.format(r.it)} · foreign nationals ${nf1.format(r.str)} per 100<br>${nf0.format(r.n)} prisoners in all with this offence`
          : `<b>${esc(r.name)}</b><br>italiani ${nf1.format(r.it)} · stranieri ${nf1.format(r.str)} ogni 100<br>${nf0.format(r.n)} detenuti in tutto con questo reato`, ev)).on("mouseleave", hideTip);
    });
    reveal(el);
    if (!el.previousElementSibling.classList.contains("dumb-key")) {
      el.insertAdjacentHTML("beforebegin", `<div class="dumb-key" aria-hidden="true"><span><i class="k-it"></i>${L("italiani", "Italians")}</span><span><i class="k-str"></i>${L("stranieri", "foreign nationals")}</span></div>`);
    }
  }

  function renderAge() {
    const C = CARCERI;
    const labels = { "Y18-20": "18–20", "Y21-24": "21–24", "Y25-29": "25–29", "Y30-34": "30–34", "Y35-39": "35–39", "Y40-44": "40–44", "Y45-49": "45–49", "Y50-59": "50–59", "Y60-69": "60–69", "Y_GE70": "70+" };
    const sumIt = d3.sum(C.eta.it), sumStr = d3.sum(C.eta.str);
    const rows = C.eta.classi.map((c, i) => ({ c: labels[c] || c, it: (100 * C.eta.it[i]) / sumIt, str: (100 * C.eta.str[i]) / sumStr }));
    const el = $("#carceri-age");
    const w = Math.max(280, el.clientWidth), m = { t: 22, r: 12, b: 24, l: 36 }, h = 200;
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", L("Distribuzione per età dei detenuti italiani e stranieri", "Age distribution of Italian and foreign prisoners"));
    svg.selectAll("*").remove();
    const x = d3.scaleBand(rows.map((r) => r.c), [m.l, w - m.r]).paddingInner(0.3).paddingOuter(0.1);
    const y = d3.scaleLinear([0, Math.ceil(d3.max(rows, (r) => Math.max(r.it, r.str)) / 5) * 5], [h - m.b, m.t]);
    const ya = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(w - m.l - m.r)).tickFormat((v) => v + "%"));
    ya.select(".domain").remove();
    ya.selectAll(".tick line").style("stroke", "var(--grid)");
    const every = x.bandwidth() < 30 ? 2 : 1;
    const xa = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).tickSize(0).tickValues(rows.map((r) => r.c).filter((_, i) => i % every === 0)));
    xa.select(".domain").style("stroke", "var(--rule)");
    const bw = x.bandwidth() / 2 - 1;
    rows.forEach((r, i) => {
      svg.append("rect").attr("class", "rv-rise").style("--i", i).attr("x", x(r.c)).attr("y", y(r.it)).attr("width", bw).attr("height", y(0) - y(r.it)).attr("rx", 2).style("fill", "var(--ink)");
      svg.append("rect").attr("class", "rv-rise").style("--i", i).style("--t0", "0.12s").attr("x", x(r.c) + bw + 2).attr("y", y(r.str)).attr("width", bw).attr("height", y(0) - y(r.str)).attr("rx", 2).style("fill", "var(--fall)");
      svg.append("rect").attr("x", x(r.c) - 2).attr("y", m.t).attr("width", x.bandwidth() + 4).attr("height", h - m.t - m.b).style("fill", "transparent")
        .on("mousemove", (ev) => showTip(EN ? `<b>aged ${r.c}</b><br>Italians ${nf1.format(r.it)}% · foreign nationals ${nf1.format(r.str)}%` : `<b>${r.c} anni</b><br>italiani ${nf1.format(r.it)}% · stranieri ${nf1.format(r.str)}%`, ev)).on("mouseleave", hideTip);
    });
    const peakIt = rows.reduce((a, b) => (b.it > a.it ? b : a)), peakStr = rows.reduce((a, b) => (b.str > a.str ? b : a));
    svg.append("text").attr("class", "lbl halo rv-fade").style("--t0", "0.8s").attr("x", x(peakIt.c) + bw / 2).attr("y", y(peakIt.it) - 5).attr("text-anchor", "middle").text(L("italiani", "Italians"));
    svg.append("text").attr("class", "lbl halo rv-fade").style("--t0", "0.8s").attr("x", x(peakStr.c) + bw + 2 + bw / 2).attr("y", y(peakStr.str) - 5).attr("text-anchor", "middle").text(L("stranieri", "foreign nationals"));
    reveal(el);
  }

  // Le cittadinanze nel tempo: un riquadro per paese o gruppo di paesi, come li pubblica l'ISTAT.
  function renderCarceriNat() {
    const C = CARCERI, Yc = C.meta.years, L = Yc.length - 1;
    const pick = (y, cont, id) => { const g = C.albero[String(y)].find((x) => x.name === cont), c = g && g.children.find((x) => x.id === id); return c ? c.n : null; };
    const rows = C.albero[String(C.meta.last)].flatMap((g) => g.children.map((c) => ({ id: c.id, name: c.name, cont: g.name })))
      .filter((d) => d.id !== "OTH")
      .map((d) => ({ ...d, v: Yc.map((y) => pick(y, d.cont, d.id)) }))
      .sort((a, b) => (b.v[L] || 0) - (a.v[L] || 0));
    $("#carceri-nat-sub").textContent = EN
      ? `Foreign prisoners held at the end of each year, from ${Yc[0]} to ${Yc[L]}: the countries that ISTAT publishes one by one and, for the rest, the group. At the top, the number in ${Yc[L]}. Each panel has its own scale: read the shape of the curve, not the comparison between panels.`
      : `Detenuti stranieri presenti a fine anno, dal ${Yc[0]} al ${Yc[L]}: i paesi che l’ISTAT pubblica uno per uno e, per gli altri, il gruppo. In alto il numero del ${Yc[L]}. Ogni riquadro ha la propria scala: si legge la forma della curva, non il confronto tra riquadri.`;
    sparkGrid($("#carceri-nat"), rows, {
      years: Yc,
      lines: (r) => [{ values: r.v, color: "var(--fall)" }],
      head: (r) => `<span class="n" title="${esc(r.name)}">${esc(r.name)}</span><span class="small">${r.v[L] == null ? "–" : nf0.format(r.v[L])}</span>`,
      foot: (r) => { const i0 = r.v.findIndex((v) => v != null); return `<span>${i0 >= 0 && r.v[L] != null ? `${fmtPct(r.v[L] / r.v[i0] - 1)} ${EN ? "since" : "dal"} ${Yc[i0]}` : ""}</span><span>${EN ? "peak" : "picco"} ${Yc[d3.maxIndex(r.v, (v) => v || 0)]}</span>`; },
      tip: (r, i) => EN
        ? `<b>${esc(r.name)}</b> · end of ${Yc[i]}<br>${r.v[i] == null ? "no data" : `${nf0.format(r.v[i])} prisoners`}`
        : `<b>${esc(r.name)}</b> · fine ${Yc[i]}<br>${r.v[i] == null ? "dato non disponibile" : `${nf0.format(r.v[i])} detenuti`}`,
    });
  }

  // ------------------------------------------------------------------ rimpatri

  async function loadRimpatri() {
    try {
      const get = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
      const [data, world] = await Promise.all([get(ROOT + "data/rimpatri.json"), has("rimp-map") ? get(ROOT + "data/mondo.topo.json") : null]);
      RIMP = data;
      if (EN) RIMP.paesi.forEach((p) => { p.name = geoName(p.id, p.name); });
      if (world) WORLD = topojson.feature(world, world.objects.paesi).features;
      state.rimpYear = RIMP.meta.last;
      addSources(RIMP.meta.sources, "rimpatri");
      const yr = $("#rimp-year");
      if (yr) {
        yr.min = RIMP.meta.years[0];
        yr.max = RIMP.meta.last;
        yr.value = state.rimpYear;
        yr.addEventListener("input", () => { state.rimpYear = +yr.value; renderRimpMap(); });
      }
      if (has("rimp-countries")) wireRimpCountries();
      if (has("rimpatri-facts")) renderRimpatri();
      renderBrief();
      renderDeepCards();
    } catch (e) {
      if (has("rimpatri-facts")) $("#rimpatri-facts").innerHTML = `<p class="note">${L("I dati sui rimpatri non si sono caricati", "The returns data did not load")} (${esc(e.message)}).</p>`;
      console.error(e);
    }
  }

  function renderRimpatri() {
    const D = RIMP, Yr = D.meta.years, L = Yr.length - 1, last = D.meta.last;
    const R = D.totale.rimpatri, O = D.totale.ordini;
    const per100 = (r, o) => Math.round((100 * r) / o);
    const iMax = d3.maxIndex(R), iMin = d3.minIndex(R);
    const top = D.paesi.filter((p) => p.r[L]).sort((a, b) => b.r[L] - a.r[L]).slice(0, 3);
    const names = top.map((p) => p.name);
    $("#rimp-span").textContent = `${Yr[0]}–${last}`;
    $("#rimpatri-facts").innerHTML = EN ? `
      <div class="fact"><div class="fv">${nf0.format(R[L])}</div><div class="fl">people returned in ${last} after an order to leave Italy. The highest figure in the series was in ${Yr[iMax]}: ${nf0.format(R[iMax])}.</div></div>
      <div class="fact"><div class="fv">${per100(R[L], O[L])}<small>in 100</small></div><div class="fl">returns per 100 orders in ${last}, out of ${nf0.format(O[L])} orders. In ${Yr[0]} there were ${per100(R[0], O[0])}, but there were ${nf0.format(O[0])} orders.</div></div>
      <div class="fact"><div class="fv">${nf0.format(R[iMin])}</div><div class="fl">returns in ${Yr[iMin]}, the lowest in the series${COVID.has(Yr[iMin]) ? ", when the pandemic closed borders and all but grounded flights" : ""}.</div></div>
      <div class="fact"><div class="fv">${nf0.format((100 * d3.sum(top, (p) => p.r[L])) / R[L])}%</div><div class="fl">of returns in ${last} involved citizens of ${andList(names)}.</div></div>` : `
      <div class="fact"><div class="fv">${nf0.format(R[L])}</div><div class="fl">persone rimpatriate nel ${last} dopo un ordine di lasciare l'Italia. Il massimo della serie è del ${Yr[iMax]}: ${nf0.format(R[iMax])}.</div></div>
      <div class="fact"><div class="fv">${per100(R[L], O[L])}<small>su 100</small></div><div class="fl">rimpatri ogni 100 ordini nel ${last}, su ${nf0.format(O[L])} ordini. Nel ${Yr[0]} erano ${per100(R[0], O[0])}, ma gli ordini erano ${nf0.format(O[0])}.</div></div>
      <div class="fact"><div class="fv">${nf0.format(R[iMin])}</div><div class="fl">rimpatri nel ${Yr[iMin]}, il minimo della serie${COVID.has(Yr[iMin]) ? ", quando la pandemia ha chiuso le frontiere e quasi azzerato i voli" : ""}.</div></div>
      <div class="fact"><div class="fv">${nf0.format((100 * d3.sum(top, (p) => p.r[L])) / R[L])}%</div><div class="fl">dei rimpatri del ${last} riguarda cittadini di ${names.slice(0, -1).join(", ")} ${/^e/i.test(names[names.length - 1]) ? "ed" : "e"} ${names[names.length - 1]}.</div></div>`;
    renderRimpTrend();
    if (has("rimp-countries")) renderRimpCountries();
    if (has("rimp-map") && WORLD) renderRimpMap();
    if (has("rimp-sm")) renderRimpGrid();
    if (has("rimp-table")) renderRimpTable();
  }

  function renderRimpTrend() {
    const D = RIMP, Yr = D.meta.years, L = Yr.length - 1, R = D.totale.rimpatri, O = D.totale.ordini;
    const el = $("#rimp-trend");
    const w = Math.max(280, el.clientWidth), h = 240, m = { t: 14, r: 16, b: 24, l: 48 };
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", EN ? `Orders to leave Italy and returns from ${Yr[0]} to ${Yr[L]}` : `Ordini di lasciare l'Italia e rimpatri dal ${Yr[0]} al ${Yr[L]}`);
    svg.selectAll("*").remove();
    const x = d3.scaleLinear([Yr[0], Yr[L]], [m.l, w - m.r]);
    const y = d3.scaleLinear([0, d3.max(O)], [h - m.b, m.t]).nice(4);
    const step = x(Yr[1]) - x(Yr[0]);
    svg.append("rect").attr("x", x(2020) - step / 2).attr("width", step * 2).attr("y", m.t).attr("height", h - m.t - m.b).style("fill", "var(--covid)");
    svg.append("text").attr("class", "lbl").attr("x", x(2020.5)).attr("y", m.t + 10).attr("text-anchor", "middle").text("Covid");
    const ya = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(-(w - m.l - m.r)).tickFormat((v) => nf0.format(v)));
    ya.select(".domain").remove();
    ya.selectAll(".tick line").style("stroke", "var(--grid)");
    const ticks = [Yr[0], 2012, 2016, 2020, Yr[L]].filter((t, i, a) => i === 0 || i === a.length - 1 || (t > Yr[0] + 1 && t < Yr[L] - 1));
    const xa = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).tickValues(ticks).tickFormat(d3.format("d")).tickSize(4));
    xa.select(".domain").style("stroke", "var(--rule)");
    // lo spazio tra le due linee: ordini che non sono diventati rimpatri
    svg.append("path").attr("class", "area rv-fade").attr("d", d3.area().x((_, i) => x(Yr[i])).y0((_, i) => y(R[i])).y1((v) => y(v))(O)).style("fill", "var(--muted)").style("fill-opacity", 0.1);
    const line = d3.line().x((_, i) => x(Yr[i])).y((v) => y(v));
    svg.append("path").attr("class", "rv-draw").attr("pathLength", 1).attr("d", line(O)).style("fill", "none").style("stroke", "var(--ink-2)").style("stroke-width", 2).style("stroke-linejoin", "round");
    svg.append("path").attr("class", "rv-draw").attr("pathLength", 1).style("--t0", "0.15s").attr("d", line(R)).style("fill", "none").style("stroke", "var(--fall)").style("stroke-width", 2.5).style("stroke-linejoin", "round");
    [[O, "var(--ink-2)", EN ? "orders to leave Italy" : "ordini di lasciare l'Italia"], [R, "var(--fall)", EN ? "returns" : "rimpatri"]].forEach(([s, c, label]) => {
      svg.append("circle").attr("class", "mark rv-pop").attr("cx", x(Yr[L])).attr("cy", y(s[L])).attr("r", 4).style("fill", c).style("stroke", "var(--surface)").style("stroke-width", 2);
      svg.append("text").attr("class", "lbl-strong halo mark rv-fade").attr("x", x(Yr[L]) - 6).attr("y", y(s[L]) - 9).attr("text-anchor", "end").text(nf0.format(s[L]));
      svg.append("text").attr("class", "lbl halo rv-fade").attr("x", x(Yr[0]) + 4).attr("y", y(s[0]) - 9).text(label);
    });
    const guide = svg.append("line").attr("y1", m.t).attr("y2", h - m.b).style("stroke", "var(--rule)").style("display", "none");
    const dots = [O, R].map((_, k) => svg.append("circle").attr("r", 4).style("fill", k ? "var(--fall)" : "var(--ink-2)").style("stroke", "var(--surface)").style("stroke-width", 2).style("display", "none"));
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", w - m.l - m.r).attr("height", h - m.t - m.b).style("fill", "transparent")
      .on("mousemove", (ev) => {
        const i = Yr.indexOf(Math.round(x.invert(d3.pointer(ev)[0])));
        if (i < 0) return;
        guide.style("display", null).attr("x1", x(Yr[i])).attr("x2", x(Yr[i]));
        [O, R].forEach((s, k) => dots[k].style("display", null).attr("cx", x(Yr[i])).attr("cy", y(s[i])));
        showTip(EN
          ? `<b>${Yr[i]}</b><br>${nf0.format(O[i])} orders to leave Italy<br>${nf0.format(R[i])} returns, ${nf0.format(Math.round((100 * R[i]) / O[i]))} per 100 orders`
          : `<b>${Yr[i]}</b><br>${nf0.format(O[i])} ordini di lasciare l'Italia<br>${nf0.format(R[i])} rimpatri, ${nf0.format(Math.round((100 * R[i]) / O[i]))} ogni 100 ordini`, ev);
      })
      .on("mouseleave", () => { guide.style("display", "none"); dots.forEach((d) => d.style("display", "none")); hideTip(); });
    reveal(el);
  }

  // Ordini e rimpatri paese per paese: una riga per paese, sulla stessa scala la barra chiara degli ordini di lasciare
  // l'Italia e quella piena dei rimpatri. Periodo e ordine valgono solo per questo grafico. Il rapporto si legge solo per i
  // paesi con abbastanza ordini nel periodo (250 l'anno): con pochi casi cambia molto da un anno all'altro.
  const RC = { n: 4, sort: "o", all: false, top: 20 };
  function wireRimpCountries() {
    const Yr = RIMP.meta.years, L = Yr.length - 1;
    $("#rc-period-seg").innerHTML = [[1, `${Yr[L]}`], [4, `${Yr[L - 3]}–${Yr[L]}`], [Yr.length, `${Yr[0]}–${Yr[L]}`]]
      .map(([n, t]) => `<button type="button" data-rcn="${n}" aria-pressed="${n === RC.n}">${t}</button>`).join("");
    seg("#rc-period-seg", "rcn", (v) => { RC.n = +v; renderRimpCountries(); });
    seg("#rc-sort-seg", "rcsort", (v) => { RC.sort = v; renderRimpCountries(); });
    $("#rc-more").addEventListener("click", () => { RC.all = !RC.all; renderRimpCountries(); });
  }

  function renderRimpCountries() {
    const D = RIMP, Yr = D.meta.years, L = Yr.length - 1, from = L - RC.n + 1, MIN = 250 * RC.n;
    const sum = (a) => d3.sum(a.slice(from), (v) => v || 0);
    const gli = (n) => `${vowelNum(n) ? "gli" : "i"} ${nf0.format(n)}`, degli = (n) => `${vowelNum(n) ? "degli" : "dei"} ${nf0.format(n)}`;
    const span = EN ? (RC.n === 1 ? `in ${Yr[L]}` : `from ${Yr[from]} to ${Yr[L]}`) : RC.n === 1 ? `nel ${Yr[L]}` : `dal ${Yr[from]} al ${Yr[L]}`, spanT = RC.n === 1 ? `${Yr[L]}` : `${Yr[from]}–${Yr[L]}`;
    let rows = D.paesi.map((p) => ({ p, r: sum(p.r), o: sum(p.o) })).filter((d) => d.o > 0 || d.r > 0).map((d) => ({ ...d, k: d.o ? (100 * d.r) / d.o : null }));
    const R = sum(D.totale.rimpatri), O = sum(D.totale.ordini);
    const ok = rows.filter((d) => d.o >= MIN);
    if (RC.sort === "k") rows = ok.slice().sort((a, b) => b.k - a.k);
    else rows.sort((a, b) => b[RC.sort] - a[RC.sort] || b.o - a.o);
    const shown = RC.sort === "k" || RC.all ? rows : rows.slice(0, RC.top);
    const max = d3.max(shown, (d) => Math.max(d.o, d.r)) || 1, pct = (v) => `${((100 * v) / max).toFixed(2)}%`;
    const kTxt = (d) => (d.k == null ? "–" : d.o < MIN ? `<span class="few" title="${EN ? `Fewer than ${nf0.format(MIN)} orders in the period: the ratio is unstable` : `Meno di ${nf0.format(MIN)} ordini nel periodo: il rapporto è instabile`}">${nf0.format(d.k)}</span>` : nf0.format(d.k));
    const ol = $("#rimp-countries");
    ol.innerHTML = (EN
      ? `<li class="rc-head" aria-hidden="true"><span>Nationality</span><span>Orders and returns, ${spanT}</span><span class="num">Returns out of orders</span><span class="num">Per 100</span></li>`
      : `<li class="rc-head" aria-hidden="true"><span>Cittadinanza</span><span>Ordini e rimpatri, ${spanT}</span><span class="num">Rimpatri su ordini</span><span class="num">Ogni 100</span></li>`) +
      shown.map((d) => `<li><span class="name" title="${esc(d.p.name)}">${esc(d.p.name)}</span><span class="rc-bars" aria-hidden="true"><i class="o rv-grow" style="width:${pct(d.o)}"></i><i class="r rv-grow" style="width:${pct(d.r)}"></i></span>` +
        (EN
          ? `<span class="val"><b>${nf0.format(d.r)}</b><span class="vh"> returns</span> of ${nf0.format(d.o)}<span class="vh"> orders</span></span><span class="k">${kTxt(d)}<span class="vh"> returns per 100 orders</span></span></li>`
          : `<span class="val"><b>${nf0.format(d.r)}</b><span class="vh"> rimpatri</span> su ${nf0.format(d.o)}<span class="vh"> ordini</span></span><span class="k">${kTxt(d)}<span class="vh"> rimpatri ogni 100 ordini</span></span></li>`)).join("");
    const items = ol.querySelectorAll("li:not(.rc-head)");
    reveal(ol, items);
    items.forEach((li, i) => {
      const d = shown[i];
      li.addEventListener("mousemove", (ev) => showTip(EN
        ? `<b>${esc(d.p.name)}</b> · ${spanT}<br>${nf0.format(d.o)} orders to leave Italy<br>${nf0.format(d.r)} returns${d.k == null ? "" : `, ${nf0.format(d.k)} per 100 orders`}`
        : `<b>${esc(d.p.name)}</b> · ${spanT}<br>${nf0.format(d.o)} ordini di lasciare l’Italia<br>${nf0.format(d.r)} rimpatri${d.k == null ? "" : `, ${nf0.format(d.k)} ogni 100 ordini`}`, ev));
      li.addEventListener("mouseleave", hideTip);
    });
    $("#rc-sub").textContent = EN
      ? `Citizens of non-EU countries, ${span}. ` +
        (RC.sort === "k" ? `Only the ${nf0.format(rows.length)} countries with at least ${nf0.format(MIN)} orders in the period: with fewer cases the ratio changes a lot from one year to the next.`
          : shown.length < rows.length ? `The ${shown.length} countries, out of ${nf0.format(rows.length)}, with the most ${RC.sort === "o" ? "orders" : "returns"}.` : `All ${nf0.format(rows.length)} countries, ranked by ${RC.sort === "o" ? "orders" : "returns"}.`) +
        ` In all, ${nf0.format(R)} returns out of ${nf0.format(O)} orders: ${nf0.format((100 * R) / O)} per 100.`
      : `Cittadini di paesi non UE, ${span}. ` +
      (RC.sort === "k" ? `Solo ${gli(rows.length)} paesi con almeno ${nf0.format(MIN)} ordini nel periodo: con meno casi il rapporto cambia molto da un anno all’altro.`
        : `${shown.length < rows.length ? `I primi ${shown.length} ${degli(rows.length)} paesi` : `Tutti ${gli(rows.length)} paesi`} ${RC.sort === "o" ? "con più ordini" : "con più rimpatri"}.`) +
      ` In tutto ${nf0.format(R)} rimpatri su ${nf0.format(O)} ordini: ${nf0.format((100 * R) / O)} ogni 100.`;
    const more = $("#rc-more");
    more.hidden = RC.sort === "k" || rows.length <= RC.top;
    more.textContent = EN ? (RC.all ? `Show only the top ${RC.top}` : `Show all ${nf0.format(rows.length)} countries`) : RC.all ? `Mostra solo i primi ${RC.top}` : `Mostra tutti ${gli(rows.length)} paesi`;
    const byK = ok.slice().sort((a, b) => b.k - a.k);
    if (byK.length > 1) {
      const hi = byK[0], lo = byK[byK.length - 1];
      $("#rc-note").textContent = EN
        ? `Among the ${nf0.format(byK.length)} countries with at least ${nf0.format(MIN)} orders ${span}, returns range from ${nf0.format(lo.k)} per 100 orders (${lo.p.name}: ${nf0.format(lo.r)} of ${nf0.format(lo.o)}) to ${nf0.format(hi.k)} per 100 (${hi.p.name}: ${nf0.format(hi.r)} of ${nf0.format(hi.o)}). Orders and returns in the same period do not always concern the same people.`
        : `Tra ${gli(byK.length)} paesi con almeno ${nf0.format(MIN)} ordini ${span}, i rimpatri vanno da ${nf0.format(lo.k)} ogni 100 ordini (${lo.p.name}: ${nf0.format(lo.r)} su ${nf0.format(lo.o)}) a ${nf0.format(hi.k)} ogni 100 (${hi.p.name}: ${nf0.format(hi.r)} su ${nf0.format(hi.o)}). Ordini e rimpatri dello stesso periodo non riguardano sempre le stesse persone.`;
    }
  }

  function renderRimpMap() {
    const D = RIMP, Yr = D.meta.years, y = state.rimpYear, i = Yr.indexOf(y);
    $("#rimp-year-out").textContent = y;
    const el = $("#rimp-map");
    const w = Math.max(300, el.clientWidth);
    const placed = D.paesi.filter((p) => p.ll);
    // inquadratura fissa per tutti gli anni: tutti i paesi di destinazione e l'Italia, con un margine
    const lons = placed.map((p) => p.ll[0]), lats = placed.map((p) => p.ll[1]);
    const x0 = d3.min(lons) - 10, x1 = d3.max(lons) + 10, y0 = Math.max(-56, d3.min(lats) - 8), y1 = Math.min(64, d3.max(lats) + 8);
    const frame = { type: "MultiPoint", coordinates: d3.range(x0, x1 + 1, 5).flatMap((lon) => [[lon, y0], [lon, y1]]) };
    const proj = d3.geoNaturalEarth1().rotate([-(x0 + x1) / 2, 0]).fitWidth(w - 20, frame);
    const path = d3.geoPath(proj);
    const b = path.bounds(frame);
    const h = Math.ceil(b[1][1] - b[0][1]) + 20;
    proj.translate([proj.translate()[0] + 10 - b[0][0], proj.translate()[1] + 10 - b[0][1]]);
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", EN ? `Map of returns from Italy by country of citizenship in ${y}` : `Carta dei rimpatri dall'Italia per paese di cittadinanza nel ${y}`);
    svg.selectAll("*").remove();

    const rows = placed.map((p) => ({ p, n: p.r[i] || 0, o: p.o[i] })).filter((d) => d.n > 0).sort((a, b2) => b2.n - a.n);
    const dest = new Set(rows.map((d) => d.p.id));
    svg.append("g").attr("class", "base rv-fade").selectAll("path").data(WORLD).join("path").attr("d", path)
      .attr("class", (f) => "land" + (f.id === "IT" ? " home" : dest.has(f.id) ? " dest" : ""));

    // scale comuni a tutti gli anni, così cambiare anno confronta davvero le quantità
    const gmax = d3.max(placed, (p) => d3.max(p.r, (v) => v || 0));
    const rMax = Math.max(10, Math.min(30, w / 40));
    const rad = d3.scaleSqrt([0, gmax], [0, rMax]);
    const wid = d3.scaleLinear([0, gmax], [0.6, Math.max(3, rMax / 3)]);
    const [sx, sy] = proj(D.meta.origine);
    const ends = rows.map((d) => ({ ...d, xy: proj(d.p.ll) }));
    svg.append("g").selectAll("path").data(ends).join("path").attr("class", "flow rv-draw").attr("pathLength", 1).style("--i", (d, k) => k)
      .attr("d", (d) => {
        const [tx, ty] = d.xy, dx = tx - sx, dy = ty - sy;
        // curva verso nord: il punto di controllo sta a lato della corda, proporzionale alla distanza
        const k = 0.22, s = dx >= 0 ? 1 : -1;
        return `M${sx},${sy}Q${(sx + tx) / 2 + s * k * dy},${(sy + ty) / 2 - s * k * dx} ${tx},${ty}`;
      })
      .style("stroke-width", (d) => wid(d.n));
    const g = svg.append("g");
    g.selectAll("circle").data(ends).join("circle").attr("class", "bub rv-pop").style("--i", (d, k) => k)
      .attr("cx", (d) => d.xy[0]).attr("cy", (d) => d.xy[1]).attr("r", (d) => Math.max(1.5, rad(d.n)))
      .on("mousemove", (ev, d) => showTip(EN
        ? `<b>${esc(d.p.name)}</b> · ${y}<br>${nf0.format(d.n)} returns${d.o ? `<br>${nf0.format(d.o)} orders to leave Italy` : ""}`
        : `<b>${esc(d.p.name)}</b> · ${y}<br>${nf0.format(d.n)} rimpatri${d.o ? `<br>${nf0.format(d.o)} ordini di lasciare l'Italia` : ""}`, ev))
      .on("mouseleave", hideTip);
    // etichette dei primi paesi, spinte verso l'esterno rispetto all'Italia; salta quelle che si sovrappongono
    const boxes = [];
    ends.slice(0, w < 560 ? 5 : 8).forEach((d) => {
      const [tx, ty] = d.xy, len = Math.hypot(tx - sx, ty - sy) || 1, ux = (tx - sx) / len, uy = (ty - sy) / len;
      const off = rad(d.n) + 4;
      const t = svg.append("text").attr("class", "lbl-strong halo rv-fade").attr("x", tx + ux * off).attr("y", ty + uy * off + (uy > 0.5 ? 10 : uy < -0.5 ? -2 : 4))
        .attr("text-anchor", ux > 0.35 ? "start" : ux < -0.35 ? "end" : "middle").style("pointer-events", "none")
        .text(`${d.p.name} ${nf0.format(d.n)}`);
      const bb = t.node().getBBox();
      if (bb.x < 0 || bb.x + bb.width > w || boxes.some((o) => bb.x < o.x + o.width + 4 && o.x < bb.x + bb.width + 4 && bb.y < o.y + o.height && o.y < bb.y + bb.height)) t.remove();
      else boxes.push(bb);
    });

    const tot = D.totale.rimpatri[i];
    $("#rimp-map-sub").textContent = EN
      ? `${nf0.format(tot)} people returned in ${y}, citizens of ${rows.length} countries. Each circle is proportional to the number of people; the scale is the same for every year.`
      : `${nf0.format(tot)} persone rimpatriate nel ${y}, cittadine di ${rows.length} paesi. Ogni cerchio è proporzionale alle persone; la scala è la stessa per tutti gli anni.`;
    const keys = [100, 500, 1000].filter((v) => v < gmax);
    $("#rimp-legend").innerHTML = keys.map((v) => `<span><i class="bubk" style="width:${2 * rad(v)}px;height:${2 * rad(v)}px"></i>${nf0.format(v)}</span>`).join("") +
      `<span><i class="swk home"></i>${L("Italia", "Italy")}</span><span><i class="swk dest"></i>${L("paesi con almeno un rimpatrio nell'anno", "countries with at least one return in the year")}</span>`;
    reveal(el.closest(".rimp-mapblock"));
  }

  function renderRimpGrid() {
    const D = RIMP, Yr = D.meta.years, L = Yr.length - 1;
    const rows = D.paesi.slice(0, 24);
    $("#rimp-sm-sub").textContent = EN
      ? `The ${rows.length} countries with the most returns from ${Yr[0]} to ${Yr[L]}. For each year, orders to leave Italy (grey line) and returns (blue line); the shading is the gap between the two. At the top, returns per 100 orders over the whole period; at the bottom, returns since ${Yr[0]} and the year with the most returns. Each panel has its own scale: read the shape, not the comparison between countries.`
      : `${vowelNum(rows.length) ? "Gli" : "I"} ${rows.length} paesi con più rimpatri dal ${Yr[0]} al ${Yr[L]}. Ogni anno gli ordini di lasciare l’Italia (linea grigia) e i rimpatri (linea blu); l’ombra è la distanza tra i due. In alto i rimpatri ogni 100 ordini di tutto il periodo, in basso i rimpatri dal ${Yr[0]} e l’anno con più rimpatri. Ogni riquadro ha la propria scala: si legge la forma, non il confronto tra paesi.`;
    sparkGrid($("#rimp-sm"), rows, {
      years: Yr, gap: true,
      lines: (p) => [{ values: p.r, color: "var(--fall)", width: 2 }, { values: p.o, color: "var(--ink-2)", width: 1.25 }],
      head: (p) => { const r = d3.sum(p.r, (v) => v || 0), o = d3.sum(p.o, (v) => v || 0); return `<span class="n" title="${esc(p.name)}">${esc(p.name)}</span><span class="small">${o ? nf0.format((100 * r) / o) : "–"} ${EN ? "in 100" : "su 100"}</span>`; },
      foot: (p) => `<span>${nf0.format(d3.sum(p.r, (v) => v || 0))} ${EN ? "since" : "dal"} ${Yr[0]}</span><span>${EN ? "peak" : "picco"} ${Yr[d3.maxIndex(p.r, (v) => v || 0)]}</span>`,
      tip: (p, i) => EN
        ? `<b>${esc(p.name)}</b> · ${Yr[i]}<br>${p.o[i] == null ? "–" : nf0.format(p.o[i])} orders to leave Italy<br>${p.r[i] == null ? "–" : nf0.format(p.r[i])} returns${p.o[i] ? `, ${nf0.format((100 * (p.r[i] || 0)) / p.o[i])} per 100` : ""}`
        : `<b>${esc(p.name)}</b> · ${Yr[i]}<br>${p.o[i] == null ? "–" : nf0.format(p.o[i])} ordini di lasciare l’Italia<br>${p.r[i] == null ? "–" : nf0.format(p.r[i])} rimpatri${p.o[i] ? `, ${nf0.format((100 * (p.r[i] || 0)) / p.o[i])} ogni 100` : ""}`,
    });
  }

  // Due righe per paese, ordini e rimpatri, anno per anno: la tabella dice tutto quello che i grafici riassumono.
  function renderRimpTable() {
    const D = RIMP, Yr = D.meta.years;
    const cell = (v) => `<td class="num">${v == null ? "–" : nf0.format(v)}</td>`;
    const tot = (a) => d3.sum(a, (v) => v || 0);
    const k = (r, o) => (tot(o) ? nf0.format((100 * tot(r)) / tot(o)) : "–");
    const rowsOf = (name, r, o, b) => {
      const B = (s) => (b ? `<b>${s}</b>` : s);
      return `<tr class="rc-o"><td rowspan="2">${B(esc(name))}</td><td>${L("ordini", "orders")}</td>${o.map(cell).join("")}${cell(tot(o))}<td class="num" rowspan="2">${B(k(r, o))}</td></tr>` +
        `<tr class="rc-r"><td>${L("rimpatri", "returns")}</td>${r.map(cell).join("")}${cell(tot(r))}</tr>`;
    };
    $("#rimp-table").innerHTML = `<thead><tr><th>${L("Cittadinanza", "Nationality")}</th><th></th>${Yr.map((y) => `<th class="num">${y}</th>`).join("")}<th class="num">${L("Totale", "Total")}</th><th class="num">${L("Rimpatri ogni 100 ordini", "Returns per 100 orders")}</th></tr></thead><tbody>` +
      D.paesi.map((p) => rowsOf(p.name, p.r, p.o, false)).join("") + rowsOf(L("Tutti i paesi", "All countries"), D.totale.rimpatri, D.totale.ordini, true) + `</tbody>`;
  }

  // i comandi delle sezioni sui reati: ci sono solo nella home
  // ------------------------------------------------------------------ grafici condivisi da autori ignoti e minori

  // Due anni a confronto, una riga per voce: il pallino vuoto è il primo anno, quello pieno l'ultimo, la riga li unisce.
  // rows = [{ name, a, b, tip }], già nell'ordine voluto; o = { label, unit, keys: [primo, ultimo], fmt, max }.
  function dumbbell(el, rows, o) {
    const fmt = o.fmt || ((v) => nf1.format(v));
    const w = Math.max(300, el.clientWidth), rowH = 26, m = { t: 30, r: 44, b: 10, l: Math.min(210, Math.round(w * 0.42)) }, h = m.t + rows.length * rowH + m.b;
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", o.label);
    svg.selectAll("*").remove();
    const top = o.max ?? Math.ceil(d3.max(rows, (r) => Math.max(r.a ?? 0, r.b ?? 0)) / 10) * 10;
    const x = d3.scaleLinear([0, top || 1], [m.l, w - m.r]);
    const xa = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${m.t - 8})`).call(d3.axisTop(x).ticks(w < 480 ? 3 : 5).tickSize(-(h - m.t - m.b + 8)).tickFormat((v) => v + "%"));
    xa.select(".domain").remove();
    xa.selectAll(".tick line").style("stroke", "var(--grid)");
    svg.append("text").attr("class", "lbl").attr("x", m.l - 10).attr("y", 10).attr("text-anchor", "end").text(o.unit);
    rows.forEach((r, i) => {
      const yy = m.t + i * rowH + rowH / 2, room = Math.floor((m.l - 20) / 6.2);
      svg.append("text").attr("class", r.strong ? "lbl-strong" : "lbl").attr("x", m.l - 10).attr("y", yy + 4).attr("text-anchor", "end")
        .text(r.name.length > room ? r.name.slice(0, room - 1) + "…" : r.name).append("title").text(r.name);
      if (r.a != null && r.b != null) {
        svg.append("line").attr("class", "rv-grow").style("--i", i).style("--t0", "0.15s").style("transform-origin", r.a <= r.b ? "0 50%" : "100% 50%")
          .attr("x1", x(r.a)).attr("x2", x(r.b)).attr("y1", yy).attr("y2", yy).style("stroke", "var(--rule)").style("stroke-width", 3);
      }
      if (r.a != null) svg.append("circle").attr("class", "rv-pop").style("--i", i).attr("cx", x(r.a)).attr("cy", yy).attr("r", 4.5).style("fill", "var(--surface)").style("stroke", "var(--ink-2)").style("stroke-width", 1.5);
      if (r.b != null) svg.append("circle").attr("class", "rv-pop").style("--i", i).style("--t0", "0.5s").attr("cx", x(r.b)).attr("cy", yy).attr("r", 5.5).style("fill", "var(--fall)").style("stroke", "var(--surface)").style("stroke-width", 1.5);
      if (r.b != null) svg.append("text").attr("class", "lbl halo rv-fade").style("--i", i).style("--t0", "0.7s").attr("x", x(Math.max(r.a ?? 0, r.b)) + 9).attr("y", yy + 4).text(fmt(r.b));
      svg.append("rect").attr("x", 0).attr("y", yy - rowH / 2).attr("width", w).attr("height", rowH).style("fill", "transparent")
        .on("mousemove", (ev) => showTip(r.tip, ev)).on("mouseleave", hideTip);
    });
    reveal(el);
    if (!el.previousElementSibling || !el.previousElementSibling.classList.contains("dumb-key")) {
      el.insertAdjacentHTML("beforebegin", `<div class="dumb-key" aria-hidden="true"><span><i class="k-a"></i>${esc(o.keys[0])}</span><span><i class="k-b"></i>${esc(o.keys[1])}</span></div>`);
    }
  }

  // Una classifica a barre, come quella delle regioni nelle carceri: rows = [{ name, v, few, title }], ref = la linea dell'Italia.
  function barList(ol, rows, o) {
    const max = o.max || d3.max(rows, (r) => r.v) || 1, fmt = o.fmt || ((v) => nf1.format(v) + "%");
    ol.innerHTML = rows.map((r) => `<li${r.title ? ` title="${esc(r.title)}"` : ""}><span class="name" title="${esc(r.name)}">${esc(r.name)}</span><span class="bar" aria-hidden="true"><i class="rv-grow" style="width:${(100 * r.v) / max}%"></i>${o.ref != null ? `<b class="rv-fade" style="left:${(100 * o.ref) / max}%"></b>` : ""}</span><span class="val">${r.v == null ? "–" : fmt(r.v)}${r.few ? '<span class="few"> *</span>' : ""}</span></li>`).join("");
    reveal(ol, ol.querySelectorAll("li"));
  }

  // La carta delle province su cui l'ISTAT pubblica i delitti: i confini sono quelli di oggi (data/italia.topo.json),
  // ma in Sardegna i dati sono per le quattro province storiche, quindi le province di oggi si uniscono a quella da cui vengono.
  const SARD_OLD = { 112: "090", 113: "090", 114: "091", 116: "091", 115: "095", 117: "092", 118: "092", 119: "092" };
  // by = "reg" unisce le province per regione, per la carta dei minori
  function provShapes(by = "prov") {
    provShapes.cache = provShapes.cache || {};
    if (provShapes.cache[by]) return provShapes.cache[by];
    const obj = TOPO.objects[Object.keys(TOPO.objects)[0]], groups = new Map();
    obj.geometries.forEach((g) => {
      const code = g.properties.prov_istat_code, k = by === "reg" ? g.properties.reg_istat_code : SARD_OLD[+code] || code;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(g);
    });
    provShapes.cache[by] = { obj, groups, land: topojson.feature(TOPO, obj) };
    return provShapes.cache[by];
  }
  // vals = Map(codice ISTAT della provincia, a tre cifre, o della regione, a due -> { v, tip }); o = { by, label, legend, fmt }
  function provMap(el, legend, vals, o) {
    const { obj, groups, land } = provShapes(o.by);
    const w = Math.max(260, el.clientWidth), h = Math.round(w * 1.18);
    const proj = d3.geoConicConformal().parallels([38, 46]).rotate([-12.5, 0]).fitExtent([[6, 6], [w - 6, h - 6]], land);
    const path = d3.geoPath(proj);
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", o.label);
    svg.selectAll("*").remove();
    const vs = [...vals.values()].map((d) => d.v).filter((v) => v != null);
    const step = d3.max(vs) - d3.min(vs) > 15 ? 5 : 1, lo = Math.floor(d3.min(vs) / step) * step, hi = Math.ceil(d3.max(vs) / step) * step;
    const col = d3.scaleSequential(d3.interpolateLab(css("--land"), css("--fall"))).domain([lo - (hi - lo) * 0.08, hi]);
    const g = svg.append("g");
    const shapes = [...vals.entries()].filter(([k]) => groups.has(k)).map(([k, d]) => ({ k, d, geo: topojson.merge(TOPO, groups.get(k)) }));
    g.selectAll("path").data(shapes).join("path").attr("class", "pv rv-fade").style("--i", (_, i) => i).attr("d", (s) => path(s.geo))
      .style("fill", (s) => (s.d.v == null ? "var(--land)" : col(s.d.v)))
      .on("mouseenter", function () { d3.select(this).raise().classed("hot", true); })
      .on("mousemove", (ev, s) => showTip(s.d.tip, ev))
      .on("mouseleave", function () { d3.select(this).classed("hot", false); hideTip(); });
    svg.append("path").attr("class", "coast").attr("d", path(topojson.mesh(TOPO, obj, (a, b) => a === b)));
    reveal(el);
    const fmt = o.fmt || ((v) => nf0.format(v) + "%");
    const bar = `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map((t) => col(lo + t * (hi - lo))).join(", ")})`;
    legend.innerHTML = `<div class="lg"><div class="lg-t">${esc(o.legend)}</div><div class="lg-bar" style="background:${bar}"></div><div class="lg-ticks"><span>${fmt(lo)}</span><span>${fmt((lo + hi) / 2)}</span><span>${fmt(hi)}</span></div></div>`;
  }

  // ------------------------------------------------------------------ autori ignoti

  async function loadAutori() {
    try {
      const r = await fetch(ROOT + "data/autori.json");
      if (!r.ok) throw new Error(r.status);
      AUTORI = await r.json();
      addSources(AUTORI.meta.sources, "autori");
      const sel = $("#autori-city-type");
      if (sel) {
        sel.innerHTML = AUTORI.types.filter((t) => TYPE[t]).map((t) => `<option value="${t}">${esc(TYPE[t].label)}</option>`).join("");
        sel.value = state.autoriType;
        sel.addEventListener("change", () => { state.autoriType = sel.value; renderAutoriCities(); });
      }
      if (has("autori-facts")) renderAutori();
      renderDeepCards();
    } catch (e) {
      if (has("autori-facts")) $("#autori-facts").innerHTML = `<p class="note">${L("I dati sugli autori dei delitti non si sono caricati", "The data on offenders did not load")} (${esc(e.message)}).</p>`;
      console.error(e);
    }
  }

  // «quattro su cinque», «quasi tre su quattro»: la frazione semplice più vicina a una quota (0–1)
  const FRACW = EN ? ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
    : ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci"];
  function fracWords(q) {
    let best = null;
    for (let n = 2; n <= 10; n++) for (let k = 1; k < n; k++) {
      const err = Math.abs(k / n - q);
      if (!best || err < best.err - 0.012) best = { k, n, err };
    }
    return { k: best.k, n: best.n, pre: best.err < 0.01 ? "" : best.k / best.n > q ? L("quasi ", "nearly ") : L("più di ", "more than ") };
  }
  const tLabel = (t) => (TYPE[t] ? TYPE[t].label : t);
  // nomi brevi per le righe dei grafici, dove lo spazio è poco; il nome intero resta nel suggerimento
  const T_SHORT = { THEFT: "Furti", BURGTHEF: "Furti in casa", PICKTHEF: "Borseggi", BAGTHEF: "Scippi", CARTHEF: "Furti d’auto", VEHITHEF: "Furti su auto",
    ROBBER: "Rapine", HOUSEROB: "Rapine in casa", SWINCYB: "Truffe e frodi", CYBERCRIM: "Delitti informatici" };
  if (EN) Object.assign(T_SHORT, { THEFT: "Thefts", BURGTHEF: "Burglaries", PICKTHEF: "Pickpocketing", BAGTHEF: "Bag snatching", CARTHEF: "Car thefts", VEHITHEF: "Thefts from cars",
    ROBBER: "Robberies", HOUSEROB: "Home robberies", SWINCYB: "Fraud", CYBERCRIM: "Cybercrime" });
  const tShort = (t) => T_SHORT[t] || tLabel(t);
  // l'articolo davanti a una percentuale: «il 5,4%» ma «l’8,2%», «nell’11,3%»
  const ELIDE = /^(8|1(?![0-9])|11(?![0-9]))/;
  // in inglese niente articolo: solo «5.4%»
  const pctA = (prep, v) => { const s = nf1.format(v); if (EN) return s + "%"; return (ELIDE.test(s) ? { il: "l’", nel: "nell’", al: "all’", del: "dell’", dal: "dall’" }[prep] : prep + " ") + s + "%"; };

  function renderAutori() {
    const A = AUTORI, Ya = A.meta.years, L = Ya.length - 1, last = A.meta.last, it = A.italia;
    const v = (t, i = L) => (it[t] ? it[t][i] : null);
    const tot = v("TOT"), un = fracWords(1 - tot / 100);
    const lead = EN
      ? `${un.pre}${FRACW[un.k]} in ${FRACW[un.n]} crimes ${un.k === 1 ? "remains" : "remain"} without a known offender`
      : `${un.pre}${un.k === 1 ? "un delitto" : FRACW[un.k] + " delitti"} su ${FRACW[un.n]} ${un.k === 1 ? "resta" : "restano"} senza un autore noto`;
    $("#autori-lead").textContent = lead.charAt(0).toUpperCase() + lead.slice(1);
    $("#autori-lead-sub").textContent = EN
      ? `Each square is one in every hundred crimes committed in ${last} and reported. In blue, those whose offender is known.`
      : `Ogni quadratino è un delitto su cento commessi nel ${last} e denunciati. In blu quelli di cui si conosce l’autore.`;
    renderWaffle($("#autori-waffle"), (EN ? [["TOT", "all crimes"], ["THEFT", "thefts"], ["CULPINJU", "assaults causing injury"]] : [["TOT", "tutti i delitti"], ["THEFT", "furti"], ["CULPINJU", "lesioni dolose"]]).filter(([t]) => v(t) != null).map(([t, name]) => (EN ? {
      v: v(t), unit: "in 100", label: `${name}, ${last}`, aria: `${nf1.format(v(t))} ${name} in 100 with a known offender in ${last}`,
    } : {
      v: v(t), unit: "su 100", label: `${name}, ${last}`, aria: `${nf1.format(v(t))} ${name} su 100 con autore noto nel ${last}`,
    })));
    $("#autori-note-1").textContent = EN
      ? `For thefts the offender is known in only ${nf1.format(v("THEFT"))}% of cases: thieves are usually not seen, and victims often notice only later. For assaults causing injury the share rises to ${nf1.format(v("CULPINJU"))}%, for sexual violence to ${nf1.format(v("RAPE"))}%: victims often know their attacker, or see their face.`
      : `Nei furti l’autore è noto solo ${pctA("nel", v("THEFT"))} dei casi: chi ruba di solito non si fa vedere, e spesso la vittima se ne accorge dopo. Nelle lesioni dolose la quota sale ${pctA("al", v("CULPINJU"))}, nelle violenze sessuali ${pctA("al", v("RAPE"))}: chi le subisce spesso conosce chi aggredisce, o lo vede in faccia.`;

    // le città, sugli ultimi tre anni sommati: le servono i fatti in apertura, la classifica e la tabella
    const K = d3.range(Math.max(0, L - 2), L + 1), span = `${Ya[K[0]]}–${last}`;
    const pool = (c, t) => { const n = d3.sum(K, (i) => c.tot[t][i] || 0), k = d3.sum(K, (i) => c.noto[t][i] || 0); return { n, k, v: n ? (100 * k) / n : null }; };
    const cityTot = A.citta.map((c) => ({ c, ...pool(c, "TOT") })).sort((a, b) => a.v - b.v);
    const cLo = cityTot[0], cHi = cityTot[cityTot.length - 1];
    $("#autori-facts").innerHTML = EN ? `
      <div class="fact"><div class="fv">${nf1.format(tot)}%</div><div class="fl">of crimes committed and reported in ${last} had a known offender by the end of the year. In ${Ya[0]} it was ${nf1.format(v("TOT", 0))}%.</div></div>
      <div class="fact"><div class="fv">${nf1.format(v("THEFT"))}%</div><div class="fl">of thefts. For home burglaries ${nf1.format(v("BURGTHEF"))}%, for car thefts ${nf1.format(v("CARTHEF"))}%.</div></div>
      <div class="fact"><div class="fv">${nf1.format(v("INTENHOM"))}%</div><div class="fl">of intentional homicides have a known offender by 31 December. Offenders identified the following year are not counted.</div></div>
      <div class="fact"><div class="fv">${nf1.format(cLo.v)}%</div><div class="fl">of crimes had a known offender in ${esc(cLo.c.name)} between ${Ya[K[0]]} and ${last}, the lowest share among the twelve big cities. The highest is in ${esc(cHi.c.name)}: ${nf1.format(cHi.v)}%.</div></div>` : `
      <div class="fact"><div class="fv">${nf1.format(tot)}%</div><div class="fl">dei delitti commessi e denunciati nel ${last} ha un autore noto entro l’anno. Nel ${Ya[0]} era ${pctA("il", v("TOT", 0))}.</div></div>
      <div class="fact"><div class="fv">${nf1.format(v("THEFT"))}%</div><div class="fl">dei furti. Per i furti in casa ${pctA("il", v("BURGTHEF"))}, per i furti d’auto ${pctA("il", v("CARTHEF"))}.</div></div>
      <div class="fact"><div class="fv">${nf1.format(v("INTENHOM"))}%</div><div class="fl">degli omicidi volontari ha un autore noto entro il 31 dicembre. Chi viene scoperto l’anno dopo non entra nel conto.</div></div>
      <div class="fact"><div class="fv">${nf1.format(cLo.v)}%</div><div class="fl">dei delitti con autore noto a ${esc(cLo.c.name)} tra il ${Ya[K[0]]} e il ${last}, la quota più bassa tra le dodici grandi città. La più alta è a ${esc(cHi.c.name)}: ${nf1.format(cHi.v)}%.</div></div>`;

    // reato per reato: il primo anno e l'ultimo, dalla quota più alta alla più bassa
    const rows = A.types.filter((t) => t !== "TOT" && v(t) != null).map((t) => ({
      name: tShort(t), a: v(t, 0), b: v(t), tip: (EN
        ? `<b>${esc(tLabel(t))}</b><br>known offender: ${nf1.format(v(t))}% in ${last}, ${nf1.format(v(t, 0))}% in ${Ya[0]}`
        : `<b>${esc(tLabel(t))}</b><br>autore noto: ${nf1.format(v(t))}% nel ${last}, ${nf1.format(v(t, 0))}% nel ${Ya[0]}`) + `${GLOSS[t] ? `<br><span class="small">${esc(GLOSS[t])}</span>` : ""}`,
    })).sort((a, b) => b.b - a.b);
    rows.push({ name: tLabel("TOT"), a: v("TOT", 0), b: tot, strong: true, tip: EN
      ? `<b>All crimes</b><br>known offender: ${nf1.format(tot)}% in ${last}, ${nf1.format(v("TOT", 0))}% in ${Ya[0]}`
      : `<b>Tutti i delitti</b><br>autore noto: ${nf1.format(tot)}% nel ${last}, ${nf1.format(v("TOT", 0))}% nel ${Ya[0]}` });
    $("#autori-types-sub").textContent = EN
      ? `Italy, crimes committed in ${Ya[0]} and in ${last}, from the highest share to the lowest; at the bottom, all crimes together.`
      : `Italia, delitti commessi nel ${Ya[0]} e nel ${last}, dalla quota più alta alla più bassa; in fondo tutti i delitti insieme.`;
    dumbbell($("#autori-types"), rows, EN
      ? { label: `Crimes with a known offender per 100, by type, ${Ya[0]} and ${last}`, unit: "per 100 crimes", keys: [String(Ya[0]), String(last)], max: 100 }
      : { label: `Delitti con autore noto ogni 100, per tipo, ${Ya[0]} e ${last}`, unit: "ogni 100 delitti", keys: [String(Ya[0]), String(last)], max: 100 });
    $("#autori-types-note").textContent = EN
      ? "At the top are drug dealing and handling stolen goods: they are discovered almost only during a police check, with the offender already there, so the share shows how much checking goes on. At the bottom are thefts, especially of cars and from parked cars, criminal damage and cybercrime: the people who commit them are almost never seen."
      : "In cima stanno spaccio e ricettazione: si scoprono quasi solo durante un controllo, con l’autore già davanti, quindi la quota dice quanto si controlla. In fondo i furti, soprattutto di auto e sulle auto in sosta, i danneggiamenti e i delitti informatici: chi li commette quasi mai si fa vedere.";

    // nel tempo: un riquadro per tipo, ognuno con la sua scala
    if (has("autori-sm")) {
      const types = ["TOT"].concat(A.types.filter((t) => t !== "TOT" && v(t) != null));
      sparkGrid($("#autori-sm"), types, {
        years: Ya,
        head: (t) => `<span class="n" title="${esc(tLabel(t))}">${esc(tLabel(t))}</span><span class="chg">${nf1.format(v(t))}%</span>`,
        foot: (t) => `<span>${Ya[0]}: ${nf1.format(v(t, 0))}%</span><span>${last}</span>`,
        lines: (t) => [{ values: it[t], color: "var(--fall)" }],
        tip: (t, i) => `<b>${esc(tLabel(t))}</b> · ${Ya[i]}<br>${it[t][i] == null ? (EN ? "no data" : "nessun dato") : nf1.format(it[t][i]) + (EN ? "% with a known offender" : "% con autore noto")}`,
      });
    }

    renderAutoriCities();

    // tabella: i tipi di delitto per riga, le città per colonna
    const head = `<thead><tr><th scope="col">${EN ? "Crime" : "Delitto"}</th>${A.citta.map((c) => `<th scope="col" class="num">${esc(c.name)}</th>`).join("")}<th scope="col" class="num">${EN ? "Italy" : "Italia"}</th></tr></thead>`;
    const body = A.types.filter((t) => v(t) != null).map((t) => `<tr><th scope="row">${esc(tLabel(t))}</th>${A.citta.map((c) => {
      const p = pool(c, t);
      return `<td class="num">${p.v == null ? "–" : nf1.format(p.v) + (p.n < 20 ? "*" : "")}</td>`;
    }).join("")}<td class="num">${nf1.format(d3.mean(K, (i) => it[t][i]))}</td></tr>`).join("");
    $("#autori-city-table").innerHTML = `<caption>${EN
      ? `Crimes with a known offender per 100 committed and reported, ${span}; an asterisk marks fewer than 20 crimes over the three years. For Italy, the average of the annual shares.`
      : `Delitti con autore noto ogni 100 commessi e denunciati, ${span}; l’asterisco indica meno di 20 delitti nei tre anni. Per l’Italia, media delle quote annuali.`}</caption>${head}<tbody>${body}</tbody>`;

    // province: media delle quote degli ultimi tre anni
    const P = A.province, ids = Object.keys(P);
    const mean = (p, key) => d3.mean(K, (i) => p[key][i]);
    const prov = ids.map((id) => ({ id, p: P[id], v: mean(P[id], "pct"), f: mean(P[id], "furti") })).filter((d) => d.v != null);
    const itK = d3.mean(K, (i) => it.TOT[i]);
    $("#autori-prov-sub").textContent = EN
      ? `Crimes with a known offender per 100 committed and reported, all crimes, average ${span}. The darker the colour, the more often the offender is known.`
      : `Delitti con autore noto ogni 100 commessi e denunciati, sul totale dei delitti, media ${span}. Più è scuro, più spesso l’autore è noto.`;
    if (has("autori-map")) {
      provMap($("#autori-map"), $("#autori-legend"), new Map(prov.map((d) => [d.p.cap.slice(0, 3), { v: d.v, tip: EN
        ? `<b>${esc(d.p.name)}</b> · ${esc(d.p.region)}<br>${nf1.format(d.v)}% of crimes with a known offender<br><span class="small">average ${span}; in ${last}: ${nf1.format(d.p.pct[L])}%</span>${d.f != null ? `<br><span class="small">thefts: ${nf0.format(d.f)} in 100 reported crimes</span>` : ""}`
        : `<b>${esc(d.p.name)}</b> · ${esc(d.p.region)}<br>${nf1.format(d.v)}% dei delitti con autore noto<br><span class="small">media ${span}; nel ${last}: ${nf1.format(d.p.pct[L])}%</span>${d.f != null ? `<br><span class="small">furti: ${nf0.format(d.f)} delitti denunciati su 100</span>` : ""}` }])),
        EN ? { label: `Map of provinces: crimes with a known offender per 100, average ${span}`, legend: `Crimes with a known offender per 100, ${span}` }
          : { label: `Carta delle province: delitti con autore noto ogni 100, media ${span}`, legend: `Delitti con autore noto ogni 100, ${span}` });
    }
    const byV = prov.slice().sort((a, b) => b.v - a.v), n = 8, mx = byV[0].v;
    const item = (d) => ({ name: d.p.name.split("/")[0], v: d.v, title: `${d.p.name}: ${nf1.format(d.v)}% (${span})` });
    barList($("#autori-prov-top"), byV.slice(0, n).map(item), { max: mx, ref: itK });
    barList($("#autori-prov-bottom"), byV.slice(-n).reverse().map(item), { max: mx, ref: itK });
    const withF = prov.filter((d) => d.f != null), r = pearson(withF.map((d) => d.f), withF.map((d) => d.v));
    const big = ["Milano", "Roma", "Napoli", "Torino"].map((nm) => prov.find((d) => d.p.name === nm)).filter(Boolean);
    $("#autori-prov-note").textContent = EN
      ? `The line in the bars is Italy (${nf1.format(itK)}%). The provinces of the big cities have the lowest shares: ${big.map((d) => `${d.p.name} ${nf1.format(d.v)}%`).join(", ")}. ` +
        `The main reason is theft: where thefts make up more of all crimes, the offender is known less often (correlation ${nf2.format(r).replace("-", "−")} across the ${withF.length} provinces). In Sardegna the colours follow the four historical provinces for which ISTAT publishes data; the borders drawn are today’s.`
      : `La linea nelle barre è l’Italia (${nf1.format(itK)}%). Le province delle grandi città hanno le quote più basse: ${big.map((d) => `${d.p.name} ${nf1.format(d.v)}%`).join(", ")}. ` +
      `Il motivo principale sono i furti: dove pesano di più sul totale dei delitti, l’autore si conosce meno spesso (correlazione ${nf2.format(r).replace("-", "−")} tra le ${withF.length} province). In Sardegna i colori seguono le quattro province storiche su cui l’ISTAT pubblica i dati; i confini disegnati sono quelli di oggi.`;
  }

  function renderAutoriCities() {
    const A = AUTORI, Ya = A.meta.years, L = Ya.length - 1, last = A.meta.last, t = state.autoriType;
    if (!has("autori-cities") || !A.types.includes(t)) return;
    const K = d3.range(Math.max(0, L - 2), L + 1), span = `${Ya[K[0]]}–${last}`;
    const rows = A.citta.map((c) => {
      const n = d3.sum(K, (i) => c.tot[t][i] || 0), k = d3.sum(K, (i) => c.noto[t][i] || 0);
      return { name: c.name, v: n ? (100 * k) / n : null, few: n < 20, title: EN ? `${c.name}: ${nf0.format(k)} crimes with a known offender out of ${nf0.format(n)}, ${span}` : `${c.name}: ${nf0.format(k)} delitti con autore noto su ${nf0.format(n)}, ${span}` };
    }).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
    const itK = d3.mean(K, (i) => A.italia[t][i]);
    $("#autori-city-title").textContent = EN ? `${tLabel(t)}: crimes with a known offender per 100` : `${tLabel(t)}: delitti con autore noto ogni 100`;
    $("#autori-city-sub").textContent = EN
      ? `Crimes committed and reported between ${Ya[K[0]]} and ${last}, added together. The line is Italy (${nf1.format(itK)}%, the average of the annual shares).` + (rows.some((r) => r.few) ? " An asterisk marks fewer than 20 crimes over the three years." : "")
      : `Delitti commessi e denunciati tra il ${Ya[K[0]]} e il ${last}, sommati. La linea è l’Italia (${nf1.format(itK)}%, media delle quote annuali).` + (rows.some((r) => r.few) ? " L’asterisco indica meno di 20 delitti nei tre anni." : "");
    barList($("#autori-cities"), rows, { max: Math.max(d3.max(rows, (r) => r.v), itK) * 1.02, ref: itK });
  }

  // ------------------------------------------------------------------ minori

  async function loadMinori() {
    try {
      const r = await fetch(ROOT + "data/minori.json");
      if (!r.ok) throw new Error(r.status);
      MINORI = await r.json();
      addSources(MINORI.meta.sources, "minori");
      const sel = $("#minori-reg-type");
      if (sel) {
        sel.innerHTML = minoriTypes().map((t) => `<option value="${t}">${esc(tLabel(t))}</option>`).join("");
        sel.value = state.minoriType;
        sel.addEventListener("change", () => { state.minoriType = sel.value; renderMinoriRegions(); });
      }
      if (has("minori-facts")) renderMinori();
      renderDeepCards();
    } catch (e) {
      if (has("minori-facts")) $("#minori-facts").innerHTML = `<p class="note">${L("I dati sui minorenni non si sono caricati", "The data on minors did not load")} (${esc(e.message)}).</p>`;
      console.error(e);
    }
  }

  // minorenni ogni 100 persone segnalate, per il tipo t nell'anno di indice i (null prima del 2014, quando manca il totale)
  const minShare = (t, i) => { const m = MINORI.italia.min[t][i], n = MINORI.italia.tot[t][i]; return m != null && n ? (100 * m) / n : null; };
  // i delitti con abbastanza segnalazioni di minorenni perché la quota regga: almeno 20 nel 2014 o nell'ultimo anno
  function minoriTypes() {
    const M = MINORI, Ym = M.meta.years, i0 = Ym.indexOf(M.meta.share_from), L = Ym.length - 1;
    return M.types.filter((t) => (TYPE[t] || t === "TOT") && M.italia.tot[t][L] && Math.max(M.italia.min[t][i0] || 0, M.italia.min[t][L] || 0) >= 20);
  }
  // «una su quattro», «più di una su otto»
  function oneIn(q) {
    const r = 100 / q, n = Math.round(r);
    return { n, w: FRACW[n] || nf0.format(n), pre: Math.abs(r - n) / n < 0.03 ? "" : r > n ? L("quasi ", "nearly ") : L("più di ", "more than ") };
  }

  function renderMinori() {
    const M = MINORI, Ym = M.meta.years, L = Ym.length - 1, last = M.meta.last, y0 = M.meta.share_from, i0 = Ym.indexOf(y0);
    const mn = M.italia.min, sh = minShare;

    // apertura: le rapine in strada, il delitto dove la quota è cresciuta di più
    const s1 = sh("STREETROB", L), s0 = sh("STREETROB", i0), a = oneIn(s1), b = oneIn(s0);
    $("#minori-lead").textContent = EN
      ? `${a.pre ? a.pre.charAt(0).toUpperCase() + a.pre.slice(1) + "one" : "One"} in ${a.w} records for street robbery involves a minor`
      : `${a.pre ? a.pre.charAt(0).toUpperCase() + a.pre.slice(1) + "una" : "Una"} segnalazione su ${a.w} per rapina in strada riguarda un minorenne`;
    $("#minori-lead-sub").textContent = EN
      ? `In ${y0} it was ${b.pre}one in ${b.w}. Each square is one record in a hundred; in blue, those involving a minor.`
      : `Nel ${y0} era ${b.pre}una su ${b.w}. Ogni quadratino è una segnalazione su cento; in blu quelle che riguardano un minorenne.`;
    renderWaffle($("#minori-waffle"), EN ? [
      { v: sh("TOT", L), unit: "in 100", label: `all crimes, ${last}`, aria: `${nf1.format(sh("TOT", L))} records in 100 involve a minor, all crimes, ${last}` },
      { v: s0, unit: "in 100", label: `street robberies, ${y0}`, aria: `${nf1.format(s0)} street robbery records in 100 involve a minor in ${y0}` },
      { v: s1, unit: "in 100", label: `street robberies, ${last}`, aria: `${nf1.format(s1)} street robbery records in 100 involve a minor in ${last}` },
    ] : [
      { v: sh("TOT", L), unit: "su 100", label: `tutti i delitti, ${last}`, aria: `${nf1.format(sh("TOT", L))} segnalazioni su 100 riguardano un minorenne, tutti i delitti, ${last}` },
      { v: s0, unit: "su 100", label: `rapine in strada, ${y0}`, aria: `${nf1.format(s0)} segnalazioni su 100 per rapina in strada riguardano un minorenne nel ${y0}` },
      { v: s1, unit: "su 100", label: `rapine in strada, ${last}`, aria: `${nf1.format(s1)} segnalazioni su 100 per rapina in strada riguardano un minorenne nel ${last}` },
    ]);
    $("#minori-note-1").textContent = EN
      ? `Records of minors for theft fell from ${nf0.format(mn.THEFT[i0])} in ${y0} to ${nf0.format(mn.THEFT[L])} in ${last}, but those of adults fell too: among all people recorded for theft, the share of minors went from ${nf1.format(sh("THEFT", i0))}% to ${nf1.format(sh("THEFT", L))}%. ` +
        `For street robbery, records of minors went from ${nf0.format(mn.STREETROB[i0])} to ${nf0.format(mn.STREETROB[L])}, and the share from ${nf1.format(s0)}% to ${nf1.format(s1)}%: there, minors really do account for more.`
      : `Le segnalazioni di minorenni per furto sono scese da ${nf0.format(mn.THEFT[i0])} nel ${y0} a ${nf0.format(mn.THEFT[L])} nel ${last}, ma sono scese anche quelle degli adulti: tra tutte le persone segnalate per furto, i minorenni sono passati ${pctA("dal", sh("THEFT", i0))} ${pctA("al", sh("THEFT", L))}. ` +
      `Per le rapine in strada le segnalazioni di minorenni sono passate da ${nf0.format(mn.STREETROB[i0])} a ${nf0.format(mn.STREETROB[L])}, e la quota ${pctA("dal", s0)} ${pctA("al", s1)}: lì i minorenni pesano davvero di più.`;
    $("#minori-facts").innerHTML = EN ? `
      <div class="fact"><div class="fv">${nf0.format(mn.TOT[L])}</div><div class="fl">records of minors in ${last}: ${nf1.format(sh("TOT", L))}% of those for all people reported or arrested. In ${y0} there were ${nf0.format(mn.TOT[i0])}, ${nf1.format(sh("TOT", i0))}%.</div></div>
      <div class="fact"><div class="fv">${nf1.format(sh("ROBBER", L))}%</div><div class="fl">of records for robbery involve a minor. In ${y0} it was ${nf1.format(sh("ROBBER", i0))}%.</div></div>
      <div class="fact"><div class="fv">${nf1.format(sh("CULPINJU", L))}%</div><div class="fl">of records for assault causing injury involve a minor. In ${y0} it was ${nf1.format(sh("CULPINJU", i0))}%.</div></div>
      <div class="fact"><div class="fv">${nf1.format(sh("THEFT", L))}%</div><div class="fl">of records for theft involve a minor: here the share has fallen, from ${nf1.format(sh("THEFT", i0))}% in ${y0}.</div></div>` : `
      <div class="fact"><div class="fv">${nf0.format(mn.TOT[L])}</div><div class="fl">segnalazioni di minorenni nel ${last}: ${pctA("il", sh("TOT", L))} di quelle di tutte le persone denunciate o arrestate. Nel ${y0} erano ${nf0.format(mn.TOT[i0])}, ${pctA("il", sh("TOT", i0))}.</div></div>
      <div class="fact"><div class="fv">${nf1.format(sh("ROBBER", L))}%</div><div class="fl">delle segnalazioni per rapina riguarda un minorenne. Nel ${y0} era ${pctA("il", sh("ROBBER", i0))}.</div></div>
      <div class="fact"><div class="fv">${nf1.format(sh("CULPINJU", L))}%</div><div class="fl">delle segnalazioni per lesioni dolose riguarda un minorenne. Nel ${y0} era ${pctA("il", sh("CULPINJU", i0))}.</div></div>
      <div class="fact"><div class="fv">${nf1.format(sh("THEFT", L))}%</div><div class="fl">delle segnalazioni per furto riguarda un minorenne: qui la quota è scesa, ${pctA("dal", sh("THEFT", i0))} del ${y0}.</div></div>`;

    // reato per reato: la quota nel 2014 e nell'ultimo anno
    const types = minoriTypes().filter((t) => t !== "TOT");
    const tip = (t) => `<b>${esc(tLabel(t))}</b><br>${[i0, L].map((i) => `${Ym[i]}: ${nf0.format(mn[t][i] || 0)} ${EN ? "minors out of" : "minorenni su"} ${nf0.format(M.italia.tot[t][i] || 0)} ${EN ? "records" : "segnalazioni"}, ${sh(t, i) == null ? "–" : nf1.format(sh(t, i)) + "%"}`).join("<br>")}`;
    const rows = types.map((t) => ({ t, name: tShort(t), a: sh(t, i0), b: sh(t, L), tip: tip(t) })).sort((p, q) => q.b - p.b);
    rows.push({ t: "TOT", name: tLabel("TOT"), a: sh("TOT", i0), b: sh("TOT", L), strong: true, tip: tip("TOT") });
    $("#minori-types-sub").textContent = EN
      ? `Italy, ${y0} and ${last}, from the highest share to the lowest; at the bottom, all crimes together. Crimes with fewer than 20 records of minors in both years are left out.`
      : `Italia, ${y0} e ${last}, dalla quota più alta alla più bassa; in fondo tutti i delitti insieme. Mancano i delitti con meno di 20 segnalazioni di minorenni in entrambi gli anni.`;
    dumbbell($("#minori-types"), rows, EN
      ? { label: `Minors per 100 people recorded, by type of crime, ${y0} and ${last}`, unit: "per 100 records", keys: [String(y0), String(last)] }
      : { label: `Minorenni ogni 100 persone segnalate, per tipo di delitto, ${y0} e ${last}`, unit: "ogni 100 segnalazioni", keys: [String(y0), String(last)] });
    const moves = rows.filter((r) => r.t !== "TOT").map((r) => ({ ...r, d: r.b - r.a }));
    const up = moves.slice().sort((p, q) => q.d - p.d).slice(0, 3), down = moves.filter((r) => r.d < 0).sort((p, q) => p.d - q.d).slice(0, 3);
    const say = (r) => (EN ? `${lower(tShort(r.t))} (from ${nf1.format(r.a)} to ${nf1.format(r.b)})` : `${lower(tShort(r.t))} (da ${nf1.format(r.a)} a ${nf1.format(r.b)})`);
    $("#minori-types-note").textContent = EN
      ? `The share grew most for ${andList(up.map(say))}.` + (down.length ? ` It fell for ${andList(down.map(say))}.` : "") + " For the rarer crimes a few cases move the share a lot: the numbers are in the box that appears when you hover over a row."
      : `La quota è cresciuta di più per ${up.map(say).join(", ")}.` + (down.length ? ` È scesa per ${down.map(say).join(", ")}.` : "") + " Per i delitti più rari pochi casi spostano molto la quota: i numeri sono nel riquadro che compare passando sopra una riga.";

    // nel tempo: la quota dal 2014, i numeri dal 2004
    const ys = Ym.slice(i0), shs = (t) => ys.map((_, k) => sh(t, i0 + k));
    $("#minori-trend-sub").textContent = EN ? `Records of minors per 100 records of all people, ${y0}–${last}` : `Segnalazioni di minorenni ogni 100 segnalazioni di tutte le persone, ${y0}–${last}`;
    seriesChart($("#minori-trend"), {
      years: ys, label: EN ? `Minors per 100 people recorded, ${y0}–${last}` : `Minorenni ogni 100 persone segnalate, ${y0}–${last}`, height: 250, covid: true, yFmt: (v) => v + "%", fmt: (v) => nf1.format(v) + "%",
      series: [
        { name: EN ? "robberies" : "rapine", values: shs("ROBBER"), color: "var(--fall)", width: 2.5, at: 2017, dy: -10 },
        { name: EN ? "assaults causing injury" : "lesioni dolose", values: shs("CULPINJU"), color: "var(--ink)", at: 2016, dy: -10 },
        { name: EN ? "thefts" : "furti", values: shs("THEFT"), color: "var(--muted)", dash: "4 3", at: 2015, dy: 16, dyEnd: 16 },
        { name: EN ? "all crimes" : "tutti i delitti", values: shs("TOT"), color: "var(--ink-2)", at: 2015, dy: 16 },
      ],
    });
    $("#minori-counts-sub").textContent = EN ? `Records of minors reported or arrested, ${Ym[0]}–${last}` : `Segnalazioni di minorenni denunciati o arrestati, ${Ym[0]}–${last}`;
    seriesChart($("#minori-counts"), {
      years: Ym, label: EN ? `Records of minors, ${Ym[0]}–${last}` : `Segnalazioni di minorenni, ${Ym[0]}–${last}`, height: 250, covid: true, yMin: 0,
      series: [{ name: EN ? "minors recorded" : "minorenni segnalati", values: mn.TOT, color: "var(--fall)", width: 2.5, label: false }],
      tip: (i) => EN
        ? `<b>${Ym[i]}</b><br>${nf0.format(mn.TOT[i])} records of minors` + (sh("TOT", i) != null ? `<br>${nf1.format(sh("TOT", i))}% of all people recorded` : "")
        : `<b>${Ym[i]}</b><br>${nf0.format(mn.TOT[i])} segnalazioni di minorenni` + (sh("TOT", i) != null ? `<br>${nf1.format(sh("TOT", i))}% di tutte le persone segnalate` : ""),
    });
    if (has("minori-sm")) {
      $("#minori-sm-sub").textContent = EN
        ? `Records of minors by type of crime, ${Ym[0]}–${last}; for the types of theft and robbery, from 2006. Each panel has its own scale.`
        : `Segnalazioni di minorenni per tipo di delitto, ${Ym[0]}–${last}; per i tipi di furto e di rapina dal 2006. Ogni riquadro ha la sua scala.`;
      const first = (t) => mn[t].findIndex((x) => x != null);
      sparkGrid($("#minori-sm"), ["TOT"].concat(types), {
        years: Ym,
        head: (t) => `<span class="n" title="${esc(tLabel(t))}">${esc(tLabel(t))}</span><span class="chg">${nf0.format(mn[t][L])}</span>`,
        foot: (t) => `<span>${Ym[first(t)]}: ${nf0.format(mn[t][first(t)])}</span><span>${last}</span>`,
        lines: (t) => [{ values: mn[t], color: "var(--fall)" }],
        tip: (t, i) => EN
          ? `<b>${esc(tLabel(t))}</b> · ${Ym[i]}<br>${mn[t][i] == null ? "no data" : nf0.format(mn[t][i]) + " records of minors"}${sh(t, i) != null ? `<br>${nf1.format(sh(t, i))}% of all people recorded` : ""}`
          : `<b>${esc(tLabel(t))}</b> · ${Ym[i]}<br>${mn[t][i] == null ? "nessun dato" : nf0.format(mn[t][i]) + " segnalazioni di minorenni"}${sh(t, i) != null ? `<br>${nf1.format(sh(t, i))}% di tutte le persone segnalate` : ""}`,
      });
    }
    renderMinoriRegions();
  }

  function renderMinoriRegions() {
    const M = MINORI, ry = M.meta.region_years, Lr = ry.length - 1, last = M.meta.last, t = state.minoriType;
    if (!has("minori-regions") || !M.types.includes(t)) return;
    const K = d3.range(Math.max(0, Lr - 2), Lr + 1);
    const pool = (o) => { const m = d3.sum(K, (i) => o.min[t][i] || 0), n = d3.sum(K, (i) => o.tot[t][i] || 0); return { m, n, v: n ? (100 * m) / n : null }; };
    const Ym = M.meta.years, off = Ym.indexOf(ry[0]);
    const itm = d3.sum(K, (i) => M.italia.min[t][off + i] || 0), itn = d3.sum(K, (i) => M.italia.tot[t][off + i] || 0), itv = itn ? (100 * itm) / itn : null;
    const rows = M.regioni.map((r) => ({ r, ...pool(r) })).filter((d) => d.v != null).sort((p, q) => q.v - p.v);
    const span = EN ? `between ${ry[K[0]]} and ${last}` : `tra il ${ry[K[0]]} e il ${last}`;
    $("#minori-reg-title").textContent = EN ? `${tLabel(t)}: minors per 100 people recorded` : `${tLabel(t)}: minorenni ogni 100 persone segnalate`;
    $("#minori-reg-sub").textContent = EN
      ? `Records ${span}, added together. The line is Italy (${nf1.format(itv)}%).` + (rows.some((d) => d.m < 20) ? " An asterisk marks fewer than 20 records of minors over the three years." : "")
      : `Segnalazioni ${span}, sommate. La linea è l’Italia (${nf1.format(itv)}%).` + (rows.some((d) => d.m < 20) ? " L’asterisco indica meno di 20 segnalazioni di minorenni nei tre anni." : "");
    barList($("#minori-regions"), rows.map((d) => ({ name: d.r.name, v: d.v, few: d.m < 20, title: EN ? `${d.r.name}: ${nf0.format(d.m)} minors out of ${nf0.format(d.n)} records, ${ry[K[0]]}–${last}` : `${d.r.name}: ${nf0.format(d.m)} minorenni su ${nf0.format(d.n)} segnalazioni, ${ry[K[0]]}–${last}` })), { max: Math.max(rows[0].v, itv) * 1.02, ref: itv });
    if (has("minori-map")) {
      provMap($("#minori-map"), $("#minori-legend"), new Map(rows.map((d) => [d.r.istat, { v: d.v, tip: EN
        ? `<b>${esc(d.r.name)}</b><br>${nf1.format(d.v)} minors per 100 people recorded<br><span class="small">${esc(tLabel(t))}, ${ry[K[0]]}–${last}: ${nf0.format(d.m)} of ${nf0.format(d.n)}</span>`
        : `<b>${esc(d.r.name)}</b><br>${nf1.format(d.v)} minorenni ogni 100 persone segnalate<br><span class="small">${esc(tLabel(t))}, ${ry[K[0]]}–${last}: ${nf0.format(d.m)} su ${nf0.format(d.n)}</span>` }])),
        EN ? { by: "reg", label: `Map of regions: minors per 100 people recorded, ${tLabel(t)}`, legend: `Minors per 100 people recorded, ${ry[K[0]]}–${last}`, fmt: (v) => nf0.format(v) + "%" }
          : { by: "reg", label: `Carta delle regioni: minorenni ogni 100 persone segnalate, ${tLabel(t)}`, legend: `Minorenni ogni 100 segnalati, ${ry[K[0]]}–${last}`, fmt: (v) => nf0.format(v) + "%" });
    }
    // nella nota solo le regioni con almeno 20 segnalazioni di minorenni: con meno casi la quota è poco solida
    const solid = rows.filter((d) => d.m >= 20), hi = solid.slice(0, 2), lo = solid.slice(-2).reverse(), nm = (d) => `${d.r.name} (${nf1.format(d.v)}%)`;
    $("#minori-reg-note").textContent = EN
      ? (solid.length >= 4 ? `The highest shares are in ${hi.map(nm).join(" and ")}, the lowest in ${lo.map(nm).join(" and ")}` + (solid.length < rows.length ? ", among regions with at least 20 records of minors" : "") + ". " : "") + "The share does not say where young people commit the most crimes: it also depends on how many crimes adults commit, and on how many young people live in each region."
      : (solid.length >= 4 ? `Le quote più alte sono in ${hi.map(nm).join(" e ")}, le più basse in ${lo.map(nm).join(" e ")}` + (solid.length < rows.length ? ", tra le regioni con almeno 20 segnalazioni di minorenni" : "") + ". " : "") + `La quota non dice dove i ragazzi delinquono di più: dipende anche da quanti delitti commettono gli adulti e da quanti giovani vivono in ogni regione.`;
  }

  function wireHome() {
    // il menu dei reati, uguale nella mappa e nella griglia delle città: ognuno cambia solo la sua sezione
    const groups = d3.group(TYPES, (t) => t.group);
    // t.group resta in italiano (il codice lo confronta): qui si scrive nella lingua della pagina
    const groupName = (g) => (EN && { Totale: "All", Furti: "Thefts", Rapine: "Robberies", "Contro la persona": "Against the person", "Patrimonio ed economia": "Property and economy", Altro: "Other" }[g]) || g;
    const typeOptions = Array.from(groups, ([g, ts]) => `<optgroup label="${esc(groupName(g))}">${ts.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join("")}</optgroup>`).join("");
    const mapSel = $("#map-type"), gridSel = $("#grid-type");
    mapSel.innerHTML = gridSel.innerHTML = typeOptions;
    mapSel.value = state.mapType;
    gridSel.value = state.gridType;
    mapSel.addEventListener("change", () => setMap(mapSel.value));
    gridSel.addEventListener("change", () => { state.gridType = gridSel.value; renderGrid(); });

    heroCarousel();
    $("#base-label").textContent = EN ? `Compare ${Y[LAST]} with` : `Confronta il ${Y[LAST]} con il`;
    seg("#base-seg", "base", (v) => setMap(null, +v));
    // «Cosa sale e cosa scende»: due periodi, solo per questa sezione
    $("#mix-base-seg").querySelectorAll("button").forEach((b) => { b.textContent = EN ? `Between ${b.dataset.mbase} and ${Y[LAST]}` : `Tra il ${b.dataset.mbase} e il ${Y[LAST]}`; });
    seg("#mix-base-seg", "mbase", (v) => { state.mixBase = +v; renderMix(); });
    seg("#spike-year-seg", "year", (v) => { state.spikeYear = +v; state.spikeShown = 8; renderSpikes(); });
    seg("#spike-sort-seg", "ssort", (v) => { state.spikeSort = v; state.spikeShown = 8; renderSpikes(); });
    seg("#sort-seg", "sort", (v) => { state.sort = v; renderGrid(); });
    seg("#scale-seg", "scale", (v) => { state.scale = v; renderGrid(); });
    $("#spike-more").addEventListener("click", () => { state.spikeShown += 8; renderSpikes(); });
    $("#grid-more").addEventListener("click", () => { state.gridShown += 12; renderGrid(); });

    // passaggio del mouse sulle classifiche: la guglia corrispondente si accende sulla mappa
    const rc = $(".rank-cols");
    rc.addEventListener("mouseover", (ev) => { const li = ev.target.closest("li[data-c]"); if (li) hotCity(li.dataset.c, true); });
    rc.addEventListener("mouseout", (ev) => { const li = ev.target.closest("li[data-c]"); if (li && !li.contains(ev.relatedTarget)) hotCity(li.dataset.c, false); });
  }

  function wire() {
    if (has("map-type")) wireHome();

    // ricerca: subito i 108 capoluoghi, poi tutti i comuni appena arriva data/comuni.json
    INDEX = CITIES.map((c) => entry(c.name, "", "", null, c.id, c.region));
    if (has("finder-input")) combo($("#finder-input"), $("#finder-list"), true);
    combo($("#city-search"), $("#city-list"), false);

    // clic su città (classifica, tabella, small multiples) e su schede impennate: la scheda si apre sul reato
    // della sezione da cui viene il clic, e la pagina sotto resta com'è
    document.addEventListener("click", (ev) => {
      const card = ev.target.closest(".card[data-city]");
      if (card) {
        openCity(CITIES.find((c) => c.id === card.dataset.city), card.dataset.type);
        return;
      }
      const el = ev.target.closest("[data-city]");
      if (el && !dlg.contains(el)) {
        ev.preventDefault();
        const c = CITIES.find((x) => x.id === el.dataset.city);
        if (el.closest("#mappa")) openCity(c, state.mapType, state.mapBase);
        else if (el.closest("#citta")) openCity(c, state.gridType);
        else openCity(c);
      }
    });

    let lastW = innerWidth, t;
    addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(() => { if (Math.abs(innerWidth - lastW) > 20) { lastW = innerWidth; renderAll(); } }, 180);
    });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderAll);
    // menu in testata: segna la sezione in vista (l'ultima il cui inizio è salito sotto la barra incollata)
    // e, quando la riga delle voci scorre di lato (telefono), tiene la voce segnata in vista.
    const menu = $(".masthead .menu");
    if (menu) {
      // data-spy: una voce che porta a un'altra pagina ma si accende su una sezione di questa (Approfondimenti, sulla fascia della home)
      const links = [...menu.querySelectorAll('a[href^="#"], a[data-spy]')];
      const targets = links.map((a) => document.getElementById(a.dataset.spy || a.hash.slice(1)));
      const bars = [$(".masthead")];
      let current = null;
      const more = () => menu.toggleAttribute("data-more", menu.scrollWidth - menu.clientWidth - menu.scrollLeft > 4);
      const spy = () => {
        const line = bars.reduce((h, b) => h + (b ? b.offsetHeight : 0), 0) + 24;
        let i = -1;
        targets.forEach((t, k) => { if (t && t.getBoundingClientRect().top <= line) i = k; });
        if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) i = targets.length - 1;
        const next = i < 0 ? null : links[i];
        if (next !== current) {
          if (current) current.removeAttribute("aria-current");
          current = next;
          if (current) {
            current.setAttribute("aria-current", "true");
            if (menu.scrollWidth > menu.clientWidth) menu.scrollTo({ left: current.offsetLeft - (menu.clientWidth - current.offsetWidth) / 2, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          }
        }
        more();
      };
      addEventListener("scroll", spy, { passive: true });
      addEventListener("resize", spy);
      menu.addEventListener("scroll", more, { passive: true });
      spy();
      // il nome riporta in cima (l'ancora non basta: la testata è incollata e per il browser è già in vista)
      const home = $(".wordmark a");
      if (home && home.getAttribute("href") === "#") home.addEventListener("click", (ev) => { ev.preventDefault(); scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); });
    }
    // Una barra sola, a ogni larghezza. La lente in fondo apre la ricerca del comune al posto delle voci; sotto i
    // 560px le sezioni diventano un menu a tendina che segue la sezione in vista (vc.css).
    const tools = $(".bar-tools"), secSel = $("#section-select"), findBtn = $("#bar-find");
    if (tools && secSel && findBtn) {
      const mast = $(".masthead"), input = $("#city-search");
      const searching = (on) => {
        mast.classList.toggle("searching", on);
        findBtn.setAttribute("aria-expanded", on);
        findBtn.setAttribute("aria-label", on ? L("Chiudi la ricerca", "Close the search") : L("Cerca un comune", "Search for a town"));
        if (on) input.focus();
      };
      findBtn.addEventListener("click", () => searching(!mast.classList.contains("searching")));
      // Esc: il primo chiude l'elenco (lo fa la ricerca, con preventDefault), il secondo la ricerca
      input.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !ev.defaultPrevented && mast.classList.contains("searching")) { searching(false); findBtn.focus(); } });
      // scelto un comune si apre la scheda: la ricerca si richiude
      new MutationObserver(() => { if (dlg.open) searching(false); }).observe(dlg, { attributes: true, attributeFilter: ["open"] });
      // toccando altrove, a campo vuoto, la barra torna com'era
      tools.addEventListener("focusout", (ev) => {
        if (!mast.classList.contains("searching") || tools.contains(ev.relatedTarget) || input.value) return;
        setTimeout(() => { if (!tools.contains(document.activeElement) && !input.value) searching(false); }, 200);
      });
      // tutte le voci, anche quelle che portano a un'altra pagina: gli approfondimenti, e dagli approfondimenti la home
      const links = [...document.querySelectorAll(".masthead .menu a")];
      secSel.innerHTML = `<option value="" hidden>${L("Sezioni", "Sections")}</option>` + links.map((a) => `<option value="${esc(a.getAttribute("href"))}">${esc(a.textContent)}</option>`).join("");
      // segue la voce che il menu in testata segna come in vista (il suo ascoltatore di scroll gira prima di questo)
      const sync = () => { const a = $(".masthead .menu a[aria-current]"), v = a ? a.getAttribute("href") : ""; if (secSel.value !== v) secSel.value = v; };
      secSel.addEventListener("change", () => {
        const v = secSel.value;
        if (v.charAt(0) !== "#") { location.href = v; return; }
        const t = document.getElementById(v.slice(1));
        if (t) t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        secSel.blur();
      });
      addEventListener("scroll", sync, { passive: true });
      sync();
    }
    new MutationObserver(renderAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const extraSources = [
      { id: "73_67_DF_DCCV_DELITTIPS_9", label: "ISTAT, Delitti denunciati — tasso di delittuosità per provincia (schede dei comuni che non sono capoluogo)",
        en: "ISTAT, Reported crimes — crime rate by province (profiles of towns that are not provincial capitals)" },
      { id: "Elenco-comuni-italiani.csv", label: "ISTAT, Elenco dei comuni italiani (codici statistici delle unità amministrative territoriali), per la ricerca del comune",
        en: "ISTAT, List of Italian municipalities (statistical codes of the territorial administrative units), for the town search" },
    ];
    const srcs = $("#sources");
    if (srcs && !srcs.dataset.only) srcs.innerHTML = META.sources.concat(extraSources).map((s) => sourceItem(s)).join("");
    // l'approfondimento sulla percezione: delitti, popolazione, le due indagini sulla percezione e i tassi delle province
    else if (srcs && srcs.dataset.only === "percezione") addSources(META.sources.filter((s) => !/geojson/.test(s.id)).map((s) => (/DELITTIPS_9$/.test(s.id) ? { ...s, label: "ISTAT, Delitti denunciati — tasso di delittuosità, Italia e province", en: "ISTAT, Reported crimes — crime rate, Italy and provinces" } : s)), "percezione");
    if (has("colophon")) $("#colophon").innerHTML = EN
      ? `Atlante della sicurezza · ISTAT data up to ${Y[LAST]}, dataset built on ${new Date(META.built).toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" })}`
      : `Atlante della sicurezza · dati ISTAT aggiornati al ${Y[LAST]}, dataset generato il ${new Date(META.built).toLocaleDateString(LOCALE)}`;
  }

  // ------------------------------------------------------------------ avvio

  async function start() {
    try {
      const [data, topo, qindex] = await Promise.all([
        fetch(ROOT + "data/vc.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        fetch(ROOT + "data/italia.topo.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        // città con i dati per quartiere: se l'indice manca, nessuna
        fetch(ROOT + "data/quartieri/index.json").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);
      QINDEX = new Set(Array.isArray(qindex) ? qindex : []);
      META = data.meta; Y = META.years; LAST = Y.length - 1;
      TYPES = data.types; TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));
      if (EN) TYPES.forEach((t) => { if (TYPE_EN[t.id]) t.label = TYPE_EN[t.id]; });
      CITIES = data.cities; ITALY = data.italy; TOPO = topo;
      wire();
      renderAll();
      // carceri e rimpatri: le loro pagine, e la home per due domande frequenti e per le schede degli approfondimenti;
      // la pagina del progetto (l'elenco completo delle fonti, senza data-only) li carica per le fonti, e così i quartieri
      const allSources = !!$("#sources:not([data-only])");
      const loads = [];
      if (has("carceri-facts") || has("brief") || $('[data-dd="carceri"]') || allSources) loads.push(loadCarceri());
      if (has("rimpatri-facts") || has("brief") || $('[data-dd="rimpatri"]') || allSources) loads.push(loadRimpatri());
      if (has("perc-prov")) loads.push(loadPercProv());
      if (has("autori-facts") || $('[data-dd="autori"]') || allSources) loads.push(loadAutori());
      if (has("minori-facts") || $('[data-dd="minori"]') || allSources) loads.push(loadMinori());
      if (allSources) QINDEX.forEach((id) => loadQuart(id));
      let h = location.hash.slice(1);
      try { h = decodeURIComponent(h); } catch (e) { /* ignorato */ }
      if (h) {
        const c = CITIES.find((x) => slug(x.name) === h);
        if (c) openCity(c);
        else if (/-[a-z]{2}$/.test(h)) {
          // scheda di un comune non capoluogo: #nome-sigla
          loadPlaces().then(() => { const e = INDEX.find((x) => !x.city && placeSlug(x) === h); if (e) openProv(e); }).catch(() => {});
        } else if (document.getElementById(h)) {
          // arrivando da un'altra pagina (../#carceri) il browser salta alla sezione prima dei grafici: la si ritrova
          // a disegno fatto, e di nuovo quando arrivano i dati caricati dopo, se intanto nessuno ha scorso la pagina
          const go = () => { document.getElementById(h).scrollIntoView(); return scrollY; };
          const y = go();
          Promise.allSettled(loads).then(() => { if (Math.abs(scrollY - y) < 2) go(); });
        } else if (h === "metodo" || h === "domande") {
          // i vecchi link alla metodologia e alle domande frequenti della home: ora stanno nella pagina del progetto
          location.replace(PAGES + "progetto/#" + h);
        } else if (["carceri", "rimpatri", "percezione"].includes(h) && has("approfondimenti")) {
          // i vecchi link alle sezioni della home su carceri, rimpatri e percezione: ora sono approfondimenti
          location.replace(PAGES + "approfondimenti/" + h + ".html");
        }
      }
    } catch (e) {
      $("#app").insertAdjacentHTML("afterbegin", EN
        ? `<p class="loading wrap">The data could not be loaded (${esc(e.message)}). Reload the page; if the problem persists, the files in <code>data/</code> may be missing.</p>`
        : `<p class="loading wrap">Non riesco a caricare i dati (${esc(e.message)}). Ricarica la pagina; se il problema resta, i file in <code>data/</code> potrebbero mancare.</p>`);
      throw e;
    }
  }
  start();
})();

/* Il tasto della lingua (EN sulle pagine italiane, IT su quelle in en/) porta alla pagina gemella: se è aperta la scheda
   di una città o si è su una sezione (#roma, #mappa), porta lì anche nell'altra lingua, perché gli id sono gli stessi. */
(function () {
  "use strict";
  const a = document.querySelector(".bar-lang");
  if (a) a.addEventListener("click", () => { a.href = a.href.split("#")[0] + location.hash; });
})();

/* Apertura con video (solo la home, vc.css "apertura con video"). Non aspetta i dati: parte appena la pagina c'è.
   Il film è il 1280 sugli schermi larghi e il 640 fino a 900px; con prefers-reduced-motion resta la locandina e parte
   solo dal tasto. Si ferma quando l'apertura esce dallo schermo. Gli iPhone in risparmio energetico rifiutano di
   avviare anche un film muto ma lo lasciano partire a un tocco: ogni tocco o tasto riprova finché non parte.
   La barra è trasparente finché il film le passa sotto (.on-film), smerigliata appena il film sale (.drift). */
(function () {
  "use strict";
  const head = document.querySelector(".vhead"), v = document.getElementById("vh-video");
  if (!head || !v) return;
  const mast = document.querySelector(".masthead"), btn = document.getElementById("vh-pause"), clock = document.getElementById("vh-clock");
  let inView = true, held = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EN = /^en\b/i.test(document.documentElement.lang);

  // il film sta accanto a vc.js, non accanto alla pagina (la home inglese è in en/)
  v.src = new URL(`video/hero-roma-${matchMedia("(max-width: 900px)").matches ? 640 : 1280}.mp4`, document.currentScript.src).href;
  const play = () => {
    if (!inView || held) return;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  };
  const hold = (h) => {
    held = h;
    btn.setAttribute("aria-pressed", h);
    btn.setAttribute("aria-label", EN ? (h ? "Play the video" : "Pause the video") : h ? "Fai ripartire il video" : "Ferma il video");
    if (h) v.pause(); else play();
  };
  hold(held);
  btn.addEventListener("click", () => hold(!held));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      if (inView) play(); else v.pause();
    }).observe(head);
  }
  // link, pulsanti e campi avviano il film col loro clic, senza ritardo
  const gestures = ["touchend", "click", "keydown"];
  const retry = (e) => {
    if (e.type === "touchend" && e.target.closest && e.target.closest("a, button, select, input")) return;
    if (v.paused) play();
  };
  gestures.forEach((ev) => addEventListener(ev, retry, { passive: true }));
  v.addEventListener("playing", () => gestures.forEach((ev) => removeEventListener(ev, retry)), { once: true });

  const film = () => {
    const over = head.getBoundingClientRect().bottom > mast.offsetHeight + 1;
    mast.classList.toggle("on-film", over);
    mast.classList.toggle("drift", over && scrollY > 24);
  };
  addEventListener("scroll", film, { passive: true });
  addEventListener("resize", film);
  film();

  // l'ora vera, come sullo schermo di una telecamera
  const pad = (n) => String(n).padStart(2, "0");
  const tick = () => {
    const d = new Date();
    clock.textContent = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);
})();
