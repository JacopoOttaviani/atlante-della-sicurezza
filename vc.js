/* Atlante della Sicurezza — interfaccia.
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
  // sotto i 20 casi in uno dei due anni una variazione percentuale non dice molto: grigia, come nelle pagine delle città
  // (MIN_N in scripts/build_seo.py) e come la soglia delle impennate
  const MIN_N = 20;
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
    RAPE: "atti sessuali imposti con la violenza, la minaccia o l’abuso di autorità; sono tra i reati che si denunciano meno, e più denunce possono voler dire anche più fiducia nel denunciare",
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
    RAPE: "sexual acts imposed through violence, threats or abuse of authority; among the least reported crimes, and more reports can also mean more willingness to report",
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
  const state = { mapType: "TOT", mapBase: REF, gridType: "TOT", cardType: "TOT", cardBase: REF, mixBase: REF, sort: "level", scale: "shared", spikeYear: 2024, spikeSort: "rel", spikeShown: 8, gridShown: 12, city: null, place: null, treeYear: null, rimpYear: null, qLayer: "pop", qSel: null, autoriType: "TOT", minoriType: "TOT", cautMode: "ord", istMode: "reg", istSort: "ratio", istSel: null, procMode: "presc", procSort: "dur", esMode: "pop" };
  let CARCERI = null;
  let PROVP = null; // province con percezione e tassi (data/province.json), solo per l'approfondimento sulla percezione
  let RIMP = null, WORLD = null;
  let AUTORI = null; // delitti con autore noto (data/autori.json), per il suo approfondimento e la sua scheda
  let MINORI = null; // minorenni denunciati e arrestati (data/minori.json), idem
  let CAUT = null, DIST_OF = {}; // custodia cautelare e ingiusta detenzione (data/cautelari.json); DIST_OF: provincia della carta -> distretto
  let IST = null; // carcere per carcere: persone, posti e morti per istituto (data/istituti.json)
  // tutti i comuni (data/comuni.json) e le province (data/province.json): caricati alla prima ricerca
  let PROV = null, PROV_META = null, PERC_SIGLA = {}, UNITS = null, INDEX = [], CITY_PROV = {}, placesPromise = null, placesFailed = false;

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
  const casi = (n) => (n === 1 ? L("caso", "case") : L("casi", "cases"));
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
      rr, z: lr / se, n1, n0,
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
    // per i reati rari l'Italia come le città: conteggi dei tre anni sulla popolazione dei tre anni
    const nIt = ITALY.n && ITALY.n[t], pIt = Y.map((_, i) => itPop(i));
    const m = {
      t, base, rows, ranked, it, rare,
      itLvl: rare ? (nIt && windowRateSeries(nIt, pIt, LAST - 2, LAST)) || d3.mean(it.slice(LAST - 2)) : it[LAST],
      max: d3.max(rows, (r) => d3.max(r.s)),
      label: TYPE[t].label,
      levelNote: rare ? L(`media ${Y[LAST - 2]}–${Y[LAST]}`, `${Y[LAST - 2]}–${Y[LAST]} average`) : String(Y[LAST]),
    };
    cache.set(key, m);
    return m;
  }

  function sig(cmp) {
    if (!cmp || cmp.pct == null) return "";
    if (cmp.z == null) return "nd"; // tassi provinciali senza conteggi: nessun test possibile
    if (Math.abs(cmp.z) < 2 || few(cmp)) return "flat";
    return cmp.pct > 0 ? "up" : "down";
  }
  const few = (cmp) => !!cmp && cmp.n1 != null && Math.min(cmp.n1, cmp.n0) < MIN_N;
  // l'etichetta accanto a una variazione: «significativo» si legge «grande», quindi si dice che cosa vuol dire
  function sigLabel(cmp) {
    const s = sig(cmp);
    return s === "flat" ? (few(cmp) ? L("troppo pochi casi per dirlo", "too few cases to tell") : L("variazione non significativa", "not a significant change"))
      : s === "up" ? L("un aumento che il caso non spiega", "a rise that chance does not explain")
      : s === "down" ? L("un calo che il caso non spiega", "a fall that chance does not explain") : "";
  }
  function chgHTML(cmp) {
    const s = sig(cmp) || "nd";
    const ndText = cmp && cmp.pct != null
      ? (EN
        ? `${cmp.win ? "Rare crime: " + cmp.win + ", " : ""}change calculated from the official rates, without a statistical test`
        : `${cmp.win ? "Reato raro: " + cmp.win + ", " : ""}variazione calcolata sui tassi ufficiali, senza test statistico`)
      : L("Variazione non calcolabile: nessun caso o nessun dato nell’anno di confronto", "Change cannot be calculated: no cases or no data in the comparison year");
    const title = s === "flat" ? (few(cmp) ? L(' title="Meno di 20 casi in uno dei due anni: la variazione dice poco"', ' title="Fewer than 20 cases in one of the two years: the change means little"') : L(' title="Variazione non significativa"', ' title="Change not significant"')) : s === "nd" ? ` title="${ndText}"` : "";
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
    // il grafico è un'immagine con la sua descrizione: un lettore di schermo non legge le tacche una per una
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", o.label || "");
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
  // numeri che si leggono con la vocale davanti (uno, otto, undici, ottanta…): "dell’8%", "l’11%", "dell’1%"
  const vowelNum = (n) => n === 1 || n === 11 || /^8/.test(String(n));
  // gli ordinali invece: 1° si legge «primo», quindi «al 1° posto»; 8° e 11° «all’8°», «all’11°»
  const vowelOrd = (n) => n === 11 || /^8/.test(String(n));
  const delPct = (p) => { const n = Math.round(Math.abs(p) * 100); return EN ? `by ${nf0.format(n)}%` : `${vowelNum(n) ? "dell’" : "del "}${nf0.format(n)}%`; };
  const moved = (p, m, f) => (Math.round(p * 100) === 0 ? L("rimasti uguali", "stayed the same") : `${p > 0 ? m : f} ${delPct(p)}`);
  // in inglese: 1st, 2nd, 3rd, 4th… 11th, 12th, 13th
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");

  // Variazione nazionale di un reato tra due anni, calcolata dai conteggi e dalla popolazione: i tassi di data/vc.json
  // sono arrotondati a un decimale, e per i reati rari il rapporto tra tassi arrotondati gonfia la variazione
  // (omicidi 2019–2024: 0,5 → 0,6 darebbe +20%, i conteggi 318 → 326 danno +4%).
  function natCh(id, iB, iL = LAST) {
    const n = ITALY.n && ITALY.n[id], nt = ITALY.n && ITALY.n.TOT, rt = ITALY.rate.TOT;
    if (n && nt && n[iB] > 0 && n[iL] != null && nt[iB] > 0 && nt[iL] > 0 && rt[iB] > 0 && rt[iL] > 0)
      return (n[iL] / n[iB]) / ((nt[iL] / rt[iL]) / (nt[iB] / rt[iB])) - 1;
    const a = ITALY.rate[id][iB], b = ITALY.rate[id][iL];
    return a > 0 && b != null ? b / a - 1 : NaN;
  }
  // Popolazione media dell'Italia implicita nel tasso di tutti i delitti (delitti / tasso), la stessa dell'ISTAT.
  const itPop = (i) => (ITALY.n && ITALY.n.TOT[i] && ITALY.rate.TOT[i] ? (ITALY.n.TOT[i] / ITALY.rate.TOT[i]) * 1e5 : null);
  // La regola delle città vale anche per l'Italia: una variazione è un aumento o un calo solo se supera il 3% e se
  // il caso da solo non la spiega (|z| ≥ 2 sui conteggi); altrimenti è «flat», minima o non significativa.
  // Omicidi 2019–2024: 318 → 326, +4% ma z = 0,5.
  function natSig(id, iB, iL = LAST) {
    const ch = natCh(id, iB, iL), n = ITALY.n && ITALY.n[id];
    const r = n ? rrTest(n[iL], itPop(iL), n[iB], itPop(iB)) : null;
    if (!isFinite(ch)) return "nd";
    if (Math.abs(ch) <= 0.03 || (r && Math.abs(r.z) < 2)) return "flat";
    return ch > 0 ? "up" : "down";
  }

  function renderBrief() {
    const host = $("#brief");
    if (!host) return;
    const tot = ITALY.rate.TOT, iB = Y.indexOf(REF), tm = model("TOT");
    const cards = [];
    const card = (q, a, href, go) => cards.push(`<details class="faq-q rv-up"><summary><h3>${q}</h3></summary><div class="faq-a"><p>${a}</p><a class="go" href="${PAGES + href}">${go} <span aria-hidden="true">→</span></a></div></details>`);

    // cosa sale e cosa scende, in Italia
    const ch = TYPES.filter((t) => t.id !== "TOT").map((t) => ({ t, ch: natCh(t.id, iB), s: natSig(t.id, iB) })).filter((d) => isFinite(d.ch));
    const ups = ch.filter((d) => d.s === "up").sort((a, b) => b.ch - a.ch).slice(0, 3);
    const downs = ch.filter((d) => d.s === "down").sort((a, b) => a.ch - b.ch).slice(0, 3);
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
      // «con le denunce quasi ferme» solo se i delitti dell'ultimo anno della percezione ci sono
      const crime = tot[Y.indexOf(yb)] / tot[Y.indexOf(ya)] - 1, after = Y.includes(ylast) ? tot[Y.indexOf(ylast)] / tot[Y.indexOf(yb)] - 1 : null;
      const py = String(percYear()), pts = CITIES.filter((c) => c.perc && c.perc[py] != null);
      const most = pts.length ? pts.reduce((p, q) => (q.perc[py] > p.perc[py] ? q : p)) : null;
      const mr = most && tm.rows.find((r) => r.c.id === most.id);
      if (EN) card("Do we feel as unsafe as we really are?",
        `No: fear moves much more than crime does. Between ${ya} and ${yb} the share of households reporting crime or vandalism in their area fell from ${nf1.format(ITALY.silc[ya])}% to ${nf1.format(ITALY.silc[yb])}%, while reported crimes per resident ${moved(crime, "rose", "fell")}. ` +
        (ylast > yb ? `In ${ylast} the share rose again to ${nf1.format(ITALY.silc[ylast])}%${after != null && Math.abs(after) < 0.05 ? ", with reports almost flat" : ""}. ` : "") +
        (mr && mr.rank ? `${esc(most.name)} is the large city where the most households feel their area is at risk of crime (${nf1.format(most.perc[py])}%), but for reported crimes it ranks ${ordinal(mr.rank)} of ${tm.ranked.length}.` : ""),
        "approfondimenti/percezione.html", "Perception and reality, the deep dive");
      else card("Ci sentiamo in pericolo quanto lo siamo?",
        `No: la paura si muove molto più dei reati. Tra il ${ya} e il ${yb} le famiglie che segnalano criminalità o vandalismo nella propria zona sono scese dal ${nf1.format(ITALY.silc[ya])}% al ${nf1.format(ITALY.silc[yb])}%, mentre i delitti denunciati per abitante sono ${moved(crime, "cresciuti", "calati")}. ` +
        (ylast > yb ? `Nel ${ylast} la quota è risalita al ${nf1.format(ITALY.silc[ylast])}%${after != null && Math.abs(after) < 0.05 ? ", con le denunce quasi ferme" : ""}. ` : "") +
        (mr && mr.rank ? `${esc(most.name)} è la grande città dove più famiglie sentono a rischio la propria zona (${nf1.format(most.perc[py])}%), ma per denunce è ${vowelOrd(mr.rank) ? "all’" : "al "}${mr.rank}° posto su ${tm.ranked.length}.` : ""),
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
        "But the comparison is lopsided: prisoners also include people without a residence permit, who do not appear among residents; foreign nationals are younger on average, and in most countries young adults end up in prison more often than older people; " +
        `and without a home or a steady job, people are more often kept in a cell awaiting trial: ${nf1.format(nonDef(C.posizione.str) * 100)}% of foreign prisoners have no final conviction, against ${nf1.format(nonDef(C.posizione.it) * 100)}% of Italians.`,
        "approfondimenti/carceri.html", "Foreign nationals in prison, the deep dive");
      else card("Gli stranieri commettono più reati degli italiani?",
        `Questi dati non bastano per dirlo. A fine ${last} gli stranieri erano il ${nf1.format(share(L))}% dei detenuti (nel ${Yc[0]} il ${nf1.format(share(0))}%)${res ? ` e il ${nf1.format(res.quota)}% dei residenti` : ""}. ` +
        "Ma il confronto è sbilanciato: tra i detenuti ci sono anche persone senza permesso di soggiorno, che tra i residenti non compaiono; gli stranieri sono in media più giovani, e in gran parte dei paesi i giovani adulti finiscono in carcere più spesso delle persone più anziane; " +
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
      "No, only those that reach the police and are passed on to the judicial authorities. Many crimes are never reported, and how often people report varies from crime to crime: a car theft almost always, for the insurance; violence in the family far less often. " +
      `To compare large and small cities, reports are counted per 100,000 residents: Italy’s ${nf0.format(tot[LAST])} in ${Y[LAST]} come to about ${nf0.format(Math.round(tot[LAST] / 1000))} for every 100 people in a year.`,
      "progetto/#metodo", "How to read these numbers");
    else card("Questi numeri contano tutti i reati?",
      "No, solo quelli che arrivano alle forze di polizia e da lì all’autorità giudiziaria. Molti reati non vengono mai denunciati, e quanto si denuncia cambia da reato a reato: un furto d’auto quasi sempre, per l’assicurazione; una violenza in famiglia molto meno. " +
      `Per confrontare città grandi e piccole si contano le denunce ogni 100.000 abitanti: i ${nf0.format(tot[LAST])} dell’Italia nel ${Y[LAST]} sono circa ${nf0.format(Math.round(tot[LAST] / 1000))} ogni 100 persone in un anno.`,
      "progetto/#metodo", "Come leggere questi numeri");

    // denunce e condanne: nessuna fonte le collega, e la quota senza autore noto arriva quando c'è data/autori.json
    const ign = AUTORI ? { y: AUTORI.meta.last, n: Math.round(100 - AUTORI.italia.TOT[AUTORI.meta.years.indexOf(AUTORI.meta.last)]) } : null;
    if (EN) card("How many reports end in a conviction?",
      "No public source says, and dividing convictions by reports would give a meaningless number. Reports count events, in the year they reach the police; convictions count people, in the year the conviction becomes final, often years later, and the offence can change name along the way. " +
      `In between, many cases close without a trial, for example because the offender remains unknown${ign ? `: of the crimes committed and reported in ${ign.y}, ${nf0.format(ign.n)} in 100 were still without a known offender by the end of the year` : ""}. ` +
      "And a conviction is final only when it can no longer be appealed: until then, the accused is not considered guilty.",
      "progetto/#condanna", "A report is not a conviction");
    else card("Quante denunce finiscono in una condanna?",
      "Nessuna fonte pubblica lo dice, e dividere le condanne per le denunce darebbe un numero senza senso. Le denunce contano fatti, nell’anno in cui arrivano alle forze di polizia; le condanne contano persone, nell’anno in cui la condanna diventa definitiva, spesso anni dopo, e lungo la strada il reato può cambiare nome. " +
      `In mezzo molti procedimenti si chiudono senza un processo, per esempio perché l’autore resta ignoto${ign ? `: dei delitti commessi e denunciati nel ${ign.y}, ${nf0.format(ign.n)} su 100 erano ancora senza un autore noto a fine anno` : ""}. ` +
      "E una condanna è definitiva solo quando non si può più impugnare: fino ad allora chi è accusato non è considerato colpevole.",
      "progetto/#condanna", "Una denuncia non è una condanna");

    // si ridisegna quando arrivano carceri e rimpatri o cambia la larghezza: le risposte aperte restano aperte
    const open = new Set(Array.from(host.querySelectorAll("details[open] h3"), (x) => x.textContent));
    host.innerHTML = cards.join("");
    host.querySelectorAll("details").forEach((d) => { if (open.has(d.querySelector("h3").textContent)) d.open = true; });
    reveal(host, host.querySelectorAll(".faq-q"));
  }

  // La fase del percorso penale da cui vengono i numeri di ogni scheda, sulla foto: una denuncia non è una condanna.
  // Custodia cautelare e carceri dicono «carcere», non «pena»: tra le persone detenute c'è chi non ha una condanna definitiva.
  // La scrive vc.js e non l'HTML perché le schede stanno anche in fondo a ogni approfondimento.
  const FASE = {
    percezione: ["Denuncia", "Police report"], autori: ["Denuncia", "Police report"], minori: ["Denuncia", "Police report"],
    cautelari: ["Prima della condanna", "Before the verdict"], carceri: ["Carcere", "Prison"], istituti: ["Carcere", "Prison"],
    processi: ["Processo", "Trial"], esecuzione: ["Fuori dal carcere", "Outside prison"],
  };
  function renderFasi() {
    document.querySelectorAll(".dd-card[data-dd]").forEach((el) => {
      if (el.querySelector(".dd-fase")) return;
      const f = FASE[el.dataset.dd];
      if (f) el.insertAdjacentHTML("afterbegin", `<span class="dd-fase"><span>${L("Fase", "Stage")}</span> ${L(...f)}</span>`);
      else if (el.dataset.dd === "rimpatri") el.insertAdjacentHTML("afterbegin", `<span class="dd-fase">${L("Fuori dal percorso penale", "Outside criminal justice")}</span>`);
    });
  }

  // Le schede degli approfondimenti, nella home e nella pagina che li raccoglie: una cifra per ognuno, appena i suoi dati ci sono.
  function renderDeepCards() {
    renderFasi();
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
        ? `returns per 100 orders to leave Italy in ${D.meta.last}: ${nf0.format(R)} returns, ${nf0.format(O)} orders`
        : `rimpatri ogni 100 ordini di lasciare l’Italia nel ${D.meta.last}: ${nf0.format(R)} rimpatri, ${nf0.format(O)} ordini`);
    }
    if (ITALY && ITALY.silc) {
      // come il resto della home, dal 2019 (REF) all'ultimo anno che ha sia la percezione sia i delitti: non dal massimo al minimo
      const sy = Object.keys(ITALY.silc).map(Number).filter((y) => Y.includes(y)), tot = ITALY.rate.TOT;
      const a = REF, b = d3.max(sy);
      if (sy.includes(a) && a < b) fill("percezione", fmtPct(ITALY.silc[b] / ITALY.silc[a] - 1), EN
        ? `households reporting crime in their area, from ${a} to ${b}; reported crimes per resident over the same period: ${fmtPct(tot[Y.indexOf(b)] / tot[Y.indexOf(a)] - 1)}`
        : `famiglie che segnalano criminalità nella propria zona, dal ${a} al ${b}; i delitti denunciati per abitante, nello stesso periodo: ${fmtPct(tot[Y.indexOf(b)] / tot[Y.indexOf(a)] - 1)}`);
    }
    if (AUTORI) {
      const A = AUTORI, L = A.meta.years.indexOf(A.meta.last), t = A.italia.TOT[L], f = A.italia.THEFT[L];
      fill("autori", EN ? `${nf0.format(Math.round(100 - t))} in 100` : `${nf0.format(Math.round(100 - t))} su 100`, EN
        ? `crimes committed and reported in ${A.meta.last} still without a known offender by the end of the year; among thefts, ${nf0.format(Math.round(100 - f))} in 100`
        : `delitti commessi e denunciati nel ${A.meta.last} rimasti senza un autore noto entro l’anno; tra i furti, ${nf0.format(Math.round(100 - f))} su 100`);
    }
    if (MINORI) {
      const M = MINORI, Ym = M.meta.years, L = Ym.indexOf(M.meta.last), i0 = Ym.indexOf(M.meta.share_from);
      fill("minori", `${nf1.format(minShare("STREETROB", L))}%`, EN
        ? `of records of people reported or arrested for street robbery in ${M.meta.last} concern a minor; in ${M.meta.share_from}, ${nf1.format(minShare("STREETROB", i0))}%`
        : `delle segnalazioni per rapina in strada nel ${M.meta.last} riguarda un minorenne; nel ${M.meta.share_from}, ${pctA("il", minShare("STREETROB", i0))}`);
    }
    if (CAUT) {
      const I = CAUT.detenuti.italia, Yc = CAUT.meta.years, L = Yc.length - 1;
      fill("cautelari", `${nf1.format(dispShare(I, L))}%`, EN
        ? `of people in prison at the end of ${CAUT.meta.last} had no final conviction; in ${Yc[0]}, ${nf1.format(dispShare(I, 0))}%`
        : `delle persone detenute a fine ${CAUT.meta.last} non aveva una condanna definitiva; nel ${Yc[0]}, ${pctA("il", dispShare(I, 0))}`);
    }
    if (IST) {
      const D = IST, M = D.meta.months, iL = M.length - 1, G = D.posti[D.posti.length - 1];
      const r = Math.round((100 * D.italia.pres[iL]) / D.italia.cap[iL]), rd = Math.round((100 * G[1]) / G[2]);
      fill("istituti", EN ? `${nf0.format(r)} per 100` : `${nf0.format(r)} ogni 100`, EN
        ? `people held for every 100 official prison places at the end of ${monthLong(M[iL])}; counting only the places that can be used, ${nf0.format(rd)} (${dayLong(isoDate(G[0]))})`
        : `persone detenute ogni 100 posti regolamentari a fine ${monthLong(M[iL])}; sui posti davvero disponibili, ${nf0.format(rd)} (${dayLong(isoDate(G[0]))})`);
    }
    if (GIUS) {
      const G = GIUS, Yg = G.meta.years, L = Yg.length - 1, D = G.italia.durata.mono;
      fill("processi", EN ? `${days(D[L])} days` : `${days(D[L])} giorni`, EN
        ? `average length of a first-instance trial closed in ${G.meta.last} before a single judge; ${days(D[0])} days in ${Yg[0]}`
        : `la durata media di un processo di primo grado chiuso nel ${G.meta.last} davanti al giudice monocratico; ${days(D[0])} giorni nel ${Yg[0]}`);
    }
    if (ESEC) {
      const E = ESEC, L = E.meta.years.length - 1, r = Math.round((100 * altOf(E.uepe.italia, L)) / E.carcere.italia[L]);
      fill("esecuzione", EN ? `${r} per 100` : `${r} ogni 100`, EN
        ? `people in alternatives to prison for every 100 people in prison at the end of ${E.meta.last}`
        : `persone in misura alternativa ogni 100 persone in carcere a fine ${E.meta.last}`);
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
      label: EN ? `${m.label} per 100,000 residents in Italy, ${Y[0]}–${Y[LAST]}: ${fmtRate(it[0])} in ${Y[0]}, ${fmtRate(it[iB])} in ${REF}, ${fmtRate(it[LAST])} in ${Y[LAST]}` : `${m.label} ogni 100.000 abitanti in Italia, ${Y[0]}–${Y[LAST]}: ${fmtRate(it[0])} nel ${Y[0]}, ${fmtRate(it[iB])} nel ${REF}, ${fmtRate(it[LAST])} nel ${Y[LAST]}`,
      years: Y, values: it, xDomain: [Y[0], Y[LAST]], xTicks: [2006, 2010, 2015, 2020, 2024],
      yMin: 0, yMax: d3.max(it) * 1.08, covid: true, height: h, mr: 18,
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
    // il 2019 è il punto più basso prima del Covid: il conteggio sul 2014 accanto, perché il confronto dipende dall'anno scelto
    const tot = ITALY.rate.TOT, low = tot[Y.indexOf(REF)] === d3.min(Y.filter((y) => y < 2020), (y) => tot[Y.indexOf(y)]);
    const r14 = Y.includes(2014) ? model(m.t, 2014).rows.filter((r) => r.lvl != null) : [];
    const u14 = r14.filter((r) => sig(r.cmp) === "up").length, d14 = r14.filter((r) => sig(r.cmp) === "down").length;
    const alt = low && r14.length ? (EN ? ` ${REF} has the fewest reports of any year before Covid: compared with 2014 they have risen in ${u14} and fallen in ${d14}.` : ` Il ${REF} è l’anno con meno denunce prima del Covid: rispetto al 2014 salgono in ${u14} e calano in ${d14}.`) : "";
    if (EN) {
      $("#cities-kicker").textContent = `Not everywhere · ${rows.length} provincial capitals`;
      $("#cities-title").textContent = `${m.label}: since ${REF}, reports have risen in ${up.length} ${up.length === 1 ? "city" : "cities"} and fallen in ${down.length}`;
      $("#cities-sub").textContent = `Each spire is a provincial capital, as tall as its reports per resident (${m.levelNote}); red if they have risen since ${REF}, blue if they have fallen; spikes in gold.${alt}`;
    } else {
    $("#cities-kicker").textContent = `Non ovunque · ${rows.length} capoluoghi`;
    $("#cities-title").textContent = `${m.label}: dal ${REF} le denunce salgono in ${up.length} città e calano in ${down.length}`;
    $("#cities-sub").textContent = `Ogni guglia un capoluogo, alta quanto le denunce per abitante (${m.levelNote}); rossa se dal ${REF} salgono, blu se calano; in oro le impennate.${alt}`;
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
      .map((t) => ({ t, lvl: ITALY.rate[t.id][LAST], ch: natCh(t.id, iB), s: natSig(t.id, iB) }))
      .filter((d) => isFinite(d.ch)).sort((a, b) => b.ch - a.ch);
    if (items.length < 2) return;
    const totCh = ITALY.rate.TOT[LAST] / ITALY.rate.TOT[iB] - 1;
    const rows = items.slice(0, 5).concat(items.slice(-5));
    const short = (t) => t.label.replace(/ \(.*\)$/, "");
    const first = items[0], last = items[items.length - 1];
    if (EN) {
      $("#types-kicker").textContent = `Not all · ${items.length} crimes`;
      $("#types-title").textContent = `${short(first.t)} ${fmtPct(first.ch)}, ${lower(short(last.t))} ${fmtPct(last.ch)}: crimes do not move together`;
      $("#types-sub").textContent = `Change in reports per 100,000 residents in Italy, ${Y[LAST]} compared with ${REF}. More reports do not always mean more crimes: for sexual violence they can also mean more willingness to report`;
    } else {
    $("#types-kicker").textContent = `Non tutti · ${items.length} reati`;
    $("#types-title").textContent = `${short(first.t)} ${fmtPct(first.ch)}, ${lower(short(last.t))} ${fmtPct(last.ch)}: i reati non si muovono insieme`;
    $("#types-sub").textContent = `Variazione delle denunce ogni 100.000 abitanti in Italia, ${Y[LAST]} rispetto al ${REF}. Più denunce non vuol dire sempre più reati: per le violenze sessuali può voler dire anche più fiducia nel denunciare`;
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
      const color = d.s === "flat" ? "var(--mid)" : up ? "var(--rise)" : "var(--fall)";
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
    let i = 0, p = 0, hover = false, focus = false, seen = true, paused = false, last = performance.now();
    const show = (k) => {
      i = ((k % 3) + 3) % 3;
      p = 0;
      box.style.setProperty("--i", i);
      box.style.setProperty("--p", "0");
      dots.forEach((b, k2) => b.setAttribute("aria-selected", k2 === i));
      // i riquadri non visibili escono anche dalla tastiera e dai lettori di schermo (inert), titoli compresi
      metas.forEach((el) => { el.classList.toggle("on", +el.dataset.k === i); el.inert = +el.dataset.k !== i; el.setAttribute("aria-hidden", +el.dataset.k !== i); });
      panels.forEach((el) => { el.setAttribute("aria-hidden", +el.dataset.k !== i); el.inert = +el.dataset.k !== i; });
    };
    // un tasto per fermare lo scorrimento automatico (WCAG 2.2.2), accanto alle frecce; non serve se il movimento è ridotto
    const nav = $(".car-nav", box), next = nav && nav.querySelector('.arr[data-dir="1"]');
    if (next && !stillMotion.matches) {
      const pb = document.createElement("button");
      pb.type = "button";
      pb.className = "arr car-pause";
      pb.setAttribute("aria-pressed", "false");
      pb.setAttribute("aria-label", L("Ferma lo scorrimento dei grafici", "Stop the charts from advancing"));
      pb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M9 6v12M15 6v12"/><path class="i-play" d="M8 6l10 6-10 6z"/></svg>';
      pb.addEventListener("click", () => { paused = !paused; pb.setAttribute("aria-pressed", paused); });
      next.after(pb);
    }
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
      if (!stillMotion.matches && !paused && document.visibilityState === "visible" && !hover && !focus && seen) {
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
      return { t, it, ch: natCh(t.id, iB), s: natSig(t.id, iB) };
    }).filter((d) => isFinite(d.ch)).sort((a, b) => b.ch - a.ch);
    const totCh = ITALY.rate.TOT[LAST] / ITALY.rate.TOT[iB] - 1;
    const up = items.filter((d) => d.s === "up").length, down = items.filter((d) => d.s === "down").length, rest = items.length - up - down;
    // sono denunce, non condanne: lo dice l'etichetta della fase, come nelle schede dei comuni, e lo ripete la frase
    $("#mix-dek").innerHTML = EN
      ? `${faseTag("denuncia")}These are crimes reported to the police, not convictions. Between ${base} and ${Y[LAST]}, reports per resident rose in Italy for <strong>${up} of ${items.length} crimes</strong> and fell for <strong>${down}</strong>; for the other ${rest} the change is minimal or could be down to chance. All reported crimes combined, ${fmtPct(totCh)}. Crimes do not move together: tap a crime to see it on the map of provincial capitals.`
      : `${faseTag("denuncia")}Sono delitti denunciati alle forze di polizia, non condanne. Tra il ${base} e il ${Y[LAST]}, in Italia le denunce per abitante sono aumentate per <strong>${up} reati su ${items.length}</strong> e calate per <strong>${down}</strong>; per gli altri ${rest} la variazione è minima o può dipendere dal caso. Tutti i delitti denunciati insieme ${fmtPct(totCh)}. I reati non si muovono insieme: tocca un reato per vederlo sulla mappa dei capoluoghi.`;
    // scala comune con tetto fisso: la barra si ferma, il numero dice il valore vero
    const cap = Math.min(1.5, Math.max(0.3, Math.ceil(d3.max(items, (d) => Math.abs(d.ch)) * 10) / 10));
    const pos = (v) => 50 + 50 * Math.max(-1, Math.min(1, v / cap));
    const grid = $("#mix-grid");
    grid.innerHTML = "";
    items.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mrow" + (PARENT[d.t.id] ? " sub" : "");
      const cls = d.s === "nd" ? "flat" : d.s;
      const left = Math.min(50, pos(d.ch)), width = Math.abs(pos(d.ch) - 50);
      b.innerHTML = `<span class="ml">${esc(d.t.label)}</span>` +
        `<span class="mbar" aria-hidden="true"><i class="z"></i><i class="b ${cls} rv-grow" style="left:${left}%;width:${width}%"></i><i class="ref rv-fade" style="left:${pos(totCh)}%"></i></span>` +
        `<span class="mv ${cls}">${fmtPct(d.ch)}</span><svg aria-hidden="true"></svg>`;
      b.setAttribute("aria-label", EN
        ? `${d.t.label}: ${fmtRate(d.it[LAST])} reports per 100,000 residents in ${Y[LAST]}, ${fmtPct(d.ch)} compared with ${base}${cls === "flat" ? ", a minimal change or one that could be down to chance" : ""}. Show it on the map`
        : `${d.t.label}: ${fmtRate(d.it[LAST])} denunce ogni 100.000 abitanti nel ${Y[LAST]}, ${fmtPct(d.ch)} rispetto al ${base}${cls === "flat" ? ", una variazione minima o che può dipendere dal caso" : ""}. Mostralo sulla mappa`);
      b.addEventListener("click", () => showOnMap(d.t.id, base));
      grid.appendChild(b);
    });
    const w = grid.querySelector(".mrow svg").getBoundingClientRect().width || 72;
    grid.querySelectorAll(".mrow").forEach((b, k) => {
      const d = items[k];
      drawSpark(b.querySelector("svg"), {
        w, h: 32, pad: { t: 4, r: 3, b: 3, l: 1 }, values: d.it, yMax: d3.max(d.it) * 1.08,
        hover: (i) => `<b>${esc(d.t.label)}</b><br>${Y[i]}: ${fmtRate(d.it[i])} ${L("denunce ogni 100.000 ab.", "reports per 100,000 res.")}`,
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
      ? `${zeros} provincial ${zeros === 1 ? "capital" : "capitals"} had no cases ${m.rare ? `between ${Y[LAST - 2]} and ${Y[LAST]}` : `in ${Y[LAST]}`}, ${zeros === 1 ? "at" : "tied at"} the bottom of the ranking. `
      : `${zeros} capoluoghi non hanno avuto nessun caso ${m.rare ? `tra il ${Y[LAST - 2]} e il ${Y[LAST]}` : `nel ${Y[LAST]}`}, a pari merito in fondo alla classifica. `;
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
        : `${nf0.format(d.a.n)} ${(d.a.n) === 1 ? "caso" : "casi"} nel ${d.a.y} (${d.a.n >= d.a.avg ? "+" : "−"}${nf0.format(Math.abs(Math.round(d.a.n - d.a.avg)))}), contro una media di ${nf0.format(Math.round(d.a.avg))} nel ${yrs}.`}</span>
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
          : `${esc(d.r.c.name)} · ${esc(d.t.label)}<br><b>${Y[i]}</b>: ${nf0.format(d.r.c.n[d.t.id][i] ?? 0)} ${(d.r.c.n[d.t.id][i] ?? 0) === 1 ? "caso" : "casi"}, ${fmtRate(vals[i])} ogni 100.000 ab.`) });
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
      ? `${m.label}, per 100,000 residents, ${Y[0]} to ${Y[LAST]}. The gold dots are spikes: ${nSp} ${nSp === 1 ? "provincial capital has" : "provincial capitals have"} had at least one since 2008. With the same scale for all, you can compare levels; with each city’s own scale, the shape of each curve is easier to see.`
      : `${m.label}, ogni 100.000 abitanti, dal ${Y[0]} al ${Y[LAST]}. I punti d’oro sono le impennate: ${nSp} capoluoghi ne hanno avuta almeno una dal 2008. Con la scala uguale per tutte si confrontano i livelli; con la scala propria si vede meglio la forma di ogni curva.`;
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
            : `<b>${esc(r.c.name)}</b> · ${Y[i]}<br>${fmtRate(r.s[i])} ogni 100.000 ab. (Italia ${fmtRate(m.it[i])})<br>${nf0.format(r.c.n[m.t][i])} ${(r.c.n[m.t][i]) === 1 ? "caso" : "casi"}${flag}`;
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
      label: EN ? `Crimes reported per 100,000 residents in Italy, ${Y[0]}–${Y[LAST]}: ${nf0.format(tot[0])} in ${Y[0]}, ${nf0.format(tot[LAST])} in ${Y[LAST]}` : `Delitti denunciati ogni 100.000 abitanti in Italia, ${Y[0]}–${Y[LAST]}: ${nf0.format(tot[0])} nel ${Y[0]}, ${nf0.format(tot[LAST])} nel ${Y[LAST]}`,
      years: allYears, values: crimeVals, xDomain: [x0, x1], xTicks, yMax: d3.max(tot) * 1.1, height: 170, mr: 20,
      // i delitti segnati negli stessi anni del massimo e del minimo della percezione, qui sotto
      marks: [silcY[d3.maxIndex(silcV)], silcY[d3.minIndex(silcV)]].filter((y) => Y.includes(y) && y !== Y[LAST])
        .map((y, k) => ({ year: y, text: nf0.format(tot[Y.indexOf(y)]), dy: k ? 18 : undefined }))
        .concat([{ year: Y[LAST], text: nf0.format(tot[LAST]), strong: true, anchor: "end" }]),
      hover: (i) => `<b>${allYears[i]}</b>: ${nf0.format(crimeVals[i])} ${L("delitti ogni 100.000 ab.", "crimes per 100,000 res.")}`,
    });
    const iMax = d3.maxIndex(silcV), iMin = d3.minIndex(silcV);
    lineChart($("#perc-silc"), {
      label: EN ? `Households reporting crime or vandalism in their area, ${silcY[0]}–${silcY[silcY.length - 1]}: ${nf1.format(silcV[0])}% in ${silcY[0]}, ${nf1.format(silcV[silcV.length - 1])}% in ${silcY[silcY.length - 1]}` : `Famiglie che segnalano criminalità o vandalismo nella zona, ${silcY[0]}–${silcY[silcY.length - 1]}: ${nf1.format(silcV[0])}% nel ${silcY[0]}, ${nf1.format(silcV[silcV.length - 1])}% nel ${silcY[silcY.length - 1]}`,
      years: allYears, values: silcVals, xDomain: [x0, x1], xTicks, yMax: d3.max(silcV) * 1.2, height: 170, mr: 20,
      yFmt: (v) => v + "%",
      marks: [{ year: silcY[iMax], text: nf1.format(silcV[iMax]) + "%" }, { year: silcY[iMin], text: nf1.format(silcV[iMin]) + "%", dy: 18 }, { year: silcY[silcY.length - 1], text: nf1.format(silcV[silcV.length - 1]) + "%", strong: true, anchor: "end" }],
      hover: (i) => `<b>${allYears[i]}</b>: ${nf1.format(silcVals[i])}% ${L("delle famiglie", "of households")}`,
    });

    const a = silcY[iMax], b = silcY[iMin];
    const crimeAB = tot[Y.indexOf(b)] / tot[Y.indexOf(a)] - 1;
    const percAB = silcV[iMin] / silcV[iMax] - 1;
    // la risalita si confronta sugli stessi anni: fino all'ultimo anno che ha anche i delitti; l'anno dopo, se c'è, a parte
    const lastS = silcY[silcY.length - 1], lastC = d3.max(silcY.filter((y) => Y.includes(y)));
    const percUp = ITALY.silc[lastC] / silcV[iMin] - 1;
    const crimeUp = tot[Y.indexOf(lastC)] / tot[Y.indexOf(b)] - 1;
    const after = lastS > lastC ? EN ? ` In ${lastS} it reached ${nf1.format(ITALY.silc[lastS])}%; ISTAT has not yet published reported crimes for that year.` : ` Nel ${lastS} è arrivata al ${nf1.format(ITALY.silc[lastS])}%; i delitti denunciati di quell’anno l’ISTAT non li ha ancora pubblicati.` : "";
    $("#perc-dek").innerHTML = EN ? `Between ${a} and ${b} the share of households reporting crime or vandalism in their area went from ${nf1.format(silcV[iMax])}% to ${nf1.format(silcV[iMin])}%: <strong>${fmtPct(percAB)}</strong>; reported crimes per resident changed by ${fmtPct(crimeAB)}.${lastC > b ? ` From ${b} to ${lastC} the share rose again to ${nf1.format(ITALY.silc[lastC])}% (<strong>${fmtPct(percUp)}</strong>), against ${fmtPct(crimeUp)} for reported crimes.` : ""}${after}` : `Tra il ${a} e il ${b} le famiglie che segnalano criminalità o vandalismo nella propria zona sono passate dal ${nf1.format(silcV[iMax])}% al ${nf1.format(silcV[iMin])}%: <strong>${fmtPct(percAB)}</strong>; i delitti denunciati per abitante sono cambiati di ${fmtPct(crimeAB)}.${lastC > b ? ` Dal ${b} al ${lastC} la quota è risalita al ${nf1.format(ITALY.silc[lastC])}% (<strong>${fmtPct(percUp)}</strong>), contro ${fmtPct(crimeUp)} dei delitti denunciati.` : ""}${after}`;

    // dispersione: grandi città, delitti e percezione dello stesso anno (l'ultimo che ha tutti e due)
    const py = percYear(), sy = String(py), iy = Y.indexOf(py);
    if (has("perc-scatter-year")) $("#perc-scatter-year").textContent = sy;
    const pts = CITIES.filter((c) => c.perc && c.perc[sy] != null).map((c) => ({ c, x: (c.n.TOT[iy] / c.pop[iy]) * 1e5, y: c.perc[sy] }));
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
    const itX = tot[iy], itY = ITALY.perc[sy];
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
        .on("mousemove", (ev) => showTip(`<b>${esc(d.c.name)}</b><br>${nf0.format(d.x)} ${L("delitti ogni 100.000 ab.", "crimes per 100,000 res.")} (${sy})<br>${nf1.format(d.y)}% ${L("famiglie che sentono a rischio la zona", "of households that feel their area is at risk")}`, ev))
        .on("mouseleave", hideTip)
        .on("click", () => openCity(d.c));
    });
    pts.filter((d) => labelled.has(d.c.id)).forEach((d) => place(x(d.x), y(d.y), d.c.name));
    const r = pearson(pts.map((d) => d.x), pts.map((d) => d.y));
    const hiP = pts.slice().sort((p, q) => q.y - p.y)[0], loC = pts.slice().sort((p, q) => p.x - q.x)[0];
    $("#perc-note").textContent = EN ? `In the ${pts.length} large cities measured by ISTAT, the link between reported crimes and fear is ${Math.abs(r) < 0.3 ? "weak" : Math.abs(r) < 0.6 ? "moderate" : "strong"} (correlation ${nf2.format(r)}). ${hiP.c.name} is the city where the most households feel at risk (${nf1.format(hiP.y)}%), with ${nf0.format(hiP.x)} crimes per 100,000 residents.` : `Nelle ${pts.length} grandi città misurate dall’ISTAT, il legame tra delitti denunciati e paura è ${Math.abs(r) < 0.3 ? "debole" : Math.abs(r) < 0.6 ? "moderato" : "forte"} (correlazione ${nf2.format(r)}). ${hiP.c.name} è la città dove più famiglie si sentono a rischio (${nf1.format(hiP.y)}%), con ${nf0.format(hiP.x)} delitti ogni 100.000 abitanti.`;
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
    const py = String(percYear()), iy = Y.indexOf(+py);
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
        .on("mousemove", (ev) => showTip(`<b>${esc(d.p.name)}</b> · ${esc(d.p.region)}<br>${nf0.format(d.x)} ${L("delitti ogni 100.000 ab.", "crimes per 100,000 res.")}<br>${nf1.format(d.y)}% ${L("famiglie che sentono a rischio la zona", "of households that feel their area is at risk")}${d.p.perc_da && d.p.perc_da.length > 1 ? `<br><span class="small">${EN ? `perception: ${esc(andList(d.p.perc_da))} combined` : `percezione: ${esc(andList(d.p.perc_da))} insieme`}</span>` : ""}<br><span class="small">${EN ? `${span} average` : `media ${span}`}</span>`, ev))
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
      `The share of households feeling at risk is highest in ${hiY.p.name.split("/")[0]} (${nf1.format(hiY.y)}%, with ${nf0.format(hiY.x)} crimes per 100,000 residents); reported crimes are highest in ${hiX.p.name.split("/")[0]} (${nf0.format(hiX.x)}), where ${nf1.format(hiX.y)}% feel at risk.` : `Nelle ${pts.length} province il legame tra delitti denunciati e paura è ${Math.abs(r) < 0.3 ? "debole" : Math.abs(r) < 0.6 ? "moderato" : "forte"} (correlazione ${nf2.format(r)}). ` +
      `La provincia dove più famiglie si sentono a rischio è ${hiY.p.name.split("/")[0]} (${nf1.format(hiY.y)}%, con ${nf0.format(hiY.x)} delitti ogni 100.000 abitanti); quella con più denunce è ${hiX.p.name.split("/")[0]} (${nf0.format(hiX.x)}), dove si sente a rischio il ${nf1.format(hiX.y)}%.`;
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

  // il tasto della lingua anche nella scheda: la scheda copre la testata, e chiuderla toglierebbe la città dall'indirizzo
  function cardLang() {
    const bar = $(".bar-lang");
    if (!bar || dlg.querySelector(".card-lang")) return;
    const a = bar.cloneNode(true);
    a.classList.remove("bar-lang");
    a.classList.add("btn", "card-lang");
    a.addEventListener("click", () => { a.href = bar.href.split("#")[0] + location.hash; });
    $("#city-close").before(a);
  }

  function showCard() {
    cardLang();
    // le tabelle della scheda: intestazioni di colonna dichiarate, per chi le legge con un lettore di schermo
    dlg.querySelectorAll("thead th:not([scope])").forEach((th) => th.setAttribute("scope", "col"));
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
    // il tribunale del comune (data/giustizia.json): stessa cosa
    if (!GIUS && !giusFailed) loadGiustizia().then(() => redrawCard(c)).catch(() => {});
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
    if (!GIUS && !giusFailed) loadGiustizia().then(() => {
      setTimeout(() => { if (state.place === e) renderProv(); }, Math.max(0, (dlg._rvUntil || 0) - Date.now()));
    }).catch(() => {});
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

  // La fase del percorso penale di ogni grafico della scheda, con le parole delle schede degli approfondimenti (FASE):
  // sono tutte denunce, tranne il tribunale in fondo, che conta processi. Condanne comune per comune non ne pubblica nessuno.
  const faseTag = (k) => `<span class="fase-tag"><span>${L("Fase", "Stage")}</span> ${k === "processo" ? L("Processo", "Trial") : L("Denuncia", "Police report")}</span> `;
  const faseLine = (court) => `<p class="fase-line">${faseTag("denuncia")} <span>${EN
    ? `This profile counts crimes reported to the police, not convictions: no source publishes convictions town by town.${court ? " At the bottom, the trials of the local court." : ""}`
    : `Questa scheda conta i delitti denunciati, non le condanne: nessuna fonte pubblica le condanne comune per comune.${court ? " In fondo, i processi del tribunale." : ""}`}</span></p>`;

  const chartBlock = (label, keys) => `
      <div class="place-chart">
        <h3 class="subhead">${faseTag("denuncia")}${esc(label)} ${EN ? `from ${Y[0]} to ${Y[LAST]}` : `dal ${Y[0]} al ${Y[LAST]}`}</h3>
        <div class="key" aria-hidden="true">${keys}<span><i class="k-covid"></i>2020–21</span></div>
        <div class="chart" id="place-chart"></div>
      </div>`;

  const gridHTML = (rows) => rows.map(({ t, row }) => `<button type="button" class="sm" data-type="${t.id}" aria-pressed="${t.id === state.cardType}" style="${t.id === state.cardType ? "box-shadow: inset 0 0 0 2px var(--ink)" : ""}"><span class="h"><span class="n" title="${esc(t.label)}">${esc(t.label)}</span></span><svg aria-hidden="true"></svg><span class="x"><span>${fmtRate(row.s[LAST])}</span></span></button>`).join("");

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
      ? L("Solo le variazioni abbastanza grandi da non dipendere dal caso, con almeno 20 casi in tutti e due gli anni. Furti e rapine nel loro insieme lasciano il posto ai sottotipi.", "Only changes large enough not to be down to chance, with at least 20 cases in both years. Thefts and robberies as a whole make way for their subtypes.")
      : L("Variazioni sui tassi ufficiali della provincia, senza test statistico. Furti e rapine nel loro insieme lasciano il posto ai sottotipi.", "Changes in the province’s official rates, with no statistical test. Thefts and robberies as a whole make way for their subtypes.");
    return `<div class="movers">
        <h3>${faseTag("denuncia")}${L("Cosa è salito e cosa è sceso di più", "What rose and what fell the most")}</h3>
        <p class="small">${Y[LAST]} ${L("rispetto al", "compared with")} ${state.cardBase}. ${how} ${L("Tocca un reato per vederlo nel grafico.", "Tap a crime to see it in the chart.")}</p>
        <div class="movers-cols">
          ${col("up", L("Saliti di più", "Biggest rises"), tested ? L("Nessun aumento che superi la soglia statistica.", "No rise above the statistical threshold.") : L("Nessun reato in aumento.", "No crime type is rising."))}
          ${col("down", L("Scesi di più", "Biggest falls"), tested ? L("Nessun calo che superi la soglia statistica.", "No fall above the statistical threshold.") : L("Nessun reato in calo.", "No crime type is falling."))}
        </div>
      </div>`;
  }

  function spikeNote(pick) {
    const list = [];
    TYPES.forEach((t) => { const row = pick(t.id); if (row && row.an) row.an.forEach((a) => { if (a && a.flag === "spike" && a.y >= Y[LAST - 2]) list.push({ t, a }); }); });
    list.sort((p, q) => q.a.y - p.a.y || q.a.low - p.a.low);
    return list.length
      ? EN ? `Spikes since ${Y[LAST - 2]}: ${list.slice(0, 6).map((d) => `${esc(lower(d.t.label))} in ${d.a.y} (${fmtPct(d.a.rr - 1)})`).join("; ")}${list.length > 6 ? `; and ${list.length - 6} more` : ""}.` : `Impennate dal ${Y[LAST - 2]}: ${list.slice(0, 6).map((d) => `${esc(lower(d.t.label))} nel ${d.a.y} (${fmtPct(d.a.rr - 1)})`).join("; ")}${list.length > 6 ? `; e altre ${list.length - 6}` : ""}.`
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
    const pos = EN ? (!o.rank ? "" : o.rank === 1 ? `the highest ${of}` : o.rank === o.n ? `the lowest ${of}` : o.rank <= 10 ? `one of the ten highest ${of} (${ordinal(o.rank)})` : o.rank > o.n - 10 ? `one of the ten lowest ${of} (${ordinal(o.rank)})` : `${ordinal(o.rank)} out of ${o.n} ${o.unit === "province" ? "provinces" : "provincial capitals"}`) : !o.rank ? "" : o.rank === 1 ? `il valore più alto ${of}` : o.rank === o.n ? `il valore più basso ${of}` : o.rank <= 10 ? `uno dei dieci valori più alti ${of} (${o.rank}°)` : o.rank > o.n - 10 ? `uno dei dieci valori più bassi ${of} (${o.rank}°)` : `${vowelOrd(o.rank) ? "all’" : "al "}${o.rank}° posto su ${o.n} ${o.unit}`;
    if (o.it) s += EN ? `That is ${timesItaly(o.lvl / o.it)} (${fmtRate(o.it)})${pos ? " and " + pos : ""}${o.tourist && o.lvl / o.it >= 1.15 ? ", partly because every day it draws commuters, students and tourists who are not counted as residents" : ""}. ` : `È ${timesItaly(o.lvl / o.it)} (${fmtRate(o.it)})${pos ? " e " + pos : ""}${o.tourist && o.lvl / o.it >= 1.15 ? ", anche perché ogni giorno arrivano pendolari, studenti e turisti che non sono contati tra i residenti" : ""}. `;
    const c = o.cmp;
    if (c && c.pct != null && isFinite(c.pct)) {
      // reati rari nelle province senza conteggi: c.win è "media 2022–2024 su 2017–2019"
      const win = c.win ? (c.winY ? [`${c.winY[0]}–${c.winY[1]}`, `${c.winY[2]}–${c.winY[3]}`] : c.win.replace(/^media /, "").split(" su ")) : null;
      const since = EN ? (win ? `On average, between ${win[1]} and ${win[0]},` : `Compared with ${state.cardBase}${state.cardBase === 2019 ? ", before Covid," : ","}`) : win ? `Tra il ${win[1]} e il ${win[0]}, in media,` : `Rispetto al ${state.cardBase}${state.cardBase === 2019 ? ", prima del Covid," : ""}`;
      s += Math.round(c.pct * 100) === 0 ? `${since} ${L("le denunce per abitante sono rimaste le stesse.", "reports per resident have stayed the same.")}`
        : sig(c) === "flat" ? (Math.abs(c.pct) < 0.1
          ? EN ? `${since} reports per resident are more or less the same (${fmtPct(c.pct)}): a difference this small may be down to chance.` : `${since} le denunce per abitante sono più o meno le stesse (${fmtPct(c.pct)}): una differenza così piccola può dipendere dal caso.`
          : few(c) ? (EN ? `${since} reports per resident have ${c.pct > 0 ? "risen" : "fallen"} ${delPct(c.pct)}, but with so few cases (${nf0.format(c.n1)} against ${nf0.format(c.n0)}) the change means little.` : `${since} le denunce per abitante sono ${c.pct > 0 ? "aumentate" : "diminuite"} ${delPct(c.pct)}, ma con così pochi casi (${nf0.format(c.n1)} contro ${nf0.format(c.n0)}) la variazione dice poco.`)
          : EN ? `${since} reports per resident have ${c.pct > 0 ? "risen" : "fallen"} ${delPct(c.pct)}, but the difference may be down to chance.` : `${since} le denunce per abitante sono ${c.pct > 0 ? "aumentate" : "diminuite"} ${delPct(c.pct)}, ma è una differenza che può dipendere dal caso.`)
        : EN ? `${since} reports per resident have ${c.pct > 0 ? "risen" : "fallen"} ${delPct(c.pct)}.` : `${since} le denunce per abitante sono ${c.pct > 0 ? "aumentate" : "diminuite"} ${delPct(c.pct)}.`;
    }
    return `<p class="verdict">${s}${gl}</p>`;
  }

  // l'ultimo anno della percezione che ha anche i delitti denunciati (oggi il 2024)
  function percYear() {
    const ys = Object.keys(ITALY.perc).map(Number);
    return d3.max(ys.filter((y) => Y.includes(y))) || d3.max(ys);
  }

  function percFact(perc, where) {
    const ys = Object.keys(ITALY.perc).map(Number).sort((a, b) => a - b), y1 = String(ys[ys.length - 1]), y0 = String(ys[0]);
    if (!perc || perc[y1] == null) return "";
    const before = y0 !== y1 && perc[y0] != null ? EN ? `; ${nf1.format(perc[y0])}% in ${y0}` : `; ${nf1.format(perc[y0])}% nel ${y0}` : "";
    return `<div class="fact"><div class="fv">${nf1.format(perc[y1])}%</div><div class="fl">${EN ? `households ${where} that, in an ISTAT survey, feel their area is very or fairly at risk of crime (${y1}${before}; Italy ${nf1.format(ITALY.perc[y1])}%)` : `famiglie ${where} che, in un’indagine ISTAT, sentono molto o abbastanza a rischio criminalità la propria zona (${y1}${before}; Italia ${nf1.format(ITALY.perc[y1])}%)`}</div></div>`;
  }

  function renderCity() {
    const c = state.city;
    if (!c) return;
    const m = model(state.cardType, state.cardBase);
    const r = m.rows.find((d) => d.c.id === c.id);
    $("#city-kicker").textContent = EN ? `Provincial capital · ${c.region} · ${areaName(c.area)} · ${nf0.format(c.pop[LAST])} residents` : `Capoluogo · ${c.region} · ${c.area} · ${nf0.format(c.pop[LAST])} residenti`;
    $("#city-name").textContent = c.name;
    const s = sig(r.cmp);
    const sigText = sigLabel(r.cmp);
    const tm = model("TOT", state.cardBase), tr = tm.rows.find((d) => d.c.id === c.id);
    // la provincia intorno, quando data/province.json è caricato
    const pid = CITY_PROV[c.id], P = PROV && pid ? PROV[pid] : null;
    const pm = P ? provModel(state.cardType) : null, pr = pm ? pm.byId.get(pid) : null;
    const provFact = pr ? `<div class="fact"><div class="fv">${fmtRate(pr.lvl)}</div><div class="fl">${EN ? `${esc(lower(m.label))} per 100,000 residents in the whole province of ${esc(P.name)} (${m.levelNote}) · ${ordinal(pr.rank)} of ${pm.ranked.length} provinces` : `${esc(lower(m.label))} ogni 100.000 abitanti in tutta la provincia di ${esc(P.name)} (${m.levelNote}) · ${pr.rank}° su ${pm.ranked.length} province`}</div></div>` : "";
    const rows = TYPES.map((t) => ({ t, row: model(t.id, state.cardBase).rows.find((d) => d.c.id === c.id) }));
    const iB = Y.indexOf(state.cardBase);
    const movers = moversHTML(rows, (t) => EN ? `${nf0.format(c.n[t.id][LAST] ?? 0)} ${(c.n[t.id][LAST] ?? 0) === 1 ? "case" : "cases"} in ${Y[LAST]}, ${nf0.format(c.n[t.id][iB] ?? 0)} in ${state.cardBase}` : `${nf0.format(c.n[t.id][LAST] ?? 0)} ${(c.n[t.id][LAST] ?? 0) === 1 ? "caso" : "casi"} nel ${Y[LAST]}, ${nf0.format(c.n[t.id][iB] ?? 0)} nel ${state.cardBase}`, true);
    const q = QUART[c.id] || null; // quartieri, se la città li ha e sono arrivati
    const verdict = verdictHTML({ t: state.cardType, where: EN ? "in " + esc(c.name) : (/^[Aa]/.test(c.name) ? "ad " : "a ") + esc(c.name), lvl: r.lvl, it: m.itLvl, rank: r.rank, n: m.ranked.length, unit: "capoluoghi", cmp: r.cmp, tourist: TOURIST.includes(c.name) && TOURIST_GROUPS.includes(TYPE[state.cardType].group) && !TOURIST_NOT.includes(state.cardType) });
    // le note di data/vc.json (meta.note): dati ISTAT che non tornano, confini cambiati
    const cn = META.note && META.note[c.id], dropped = (yr) => !!(cn && cn.null && (cn.null[yr] || []).includes(state.cardType));
    const court = courtHTML(GIUS ? GIUS.capoluoghi[c.id] : null, c.name);
    $("#city-body").innerHTML = `
      <div class="card-head">
      <div class="card-main">
      ${faseLine(court)}
      ${verdict}
      ${cn ? `<p class="note">${esc(EN ? cn.en : cn.it)}</p>` : ""}
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
      <h3 class="subhead">${faseTag("denuncia")}${L("Tutti i reati a", "Every crime type in")} ${esc(c.name)}</h3>
      <p class="small">${L("Ogni riquadro ha la sua scala. Linea grigia: Italia. Tocca un reato per vederlo in questa scheda.", "Each panel has its own scale. Grey line: Italy. Tap a crime to see it in this profile.")}</p>
      <div class="sm-grid" id="city-grid"></div>
      <h3 class="subhead">${faseTag("denuncia")}${esc(m.label)}: ${L("i numeri anno per anno", "year by year")}</h3>
      <div class="tablewrap"><table><thead><tr><th>${L("Anno", "Year")}</th><th class="num">${L("Denunce", "Reports")}</th><th class="num">${L("Ogni 100.000 ab.", "Per 100,000 res.")}</th>${P ? `<th class="num">${L("Provincia", "Province")}</th>` : ""}<th class="num">${L("Italia", "Italy")}</th><th>${L("Nota", "Note")}</th></tr></thead><tbody>
        ${Y.map((yr, i) => {
          const a = r.an[i];
          const note = dropped(yr) ? L("dato ISTAT escluso", "ISTAT figure left out") : COVID.has(yr) ? "Covid" : a && a.flag === "spike" ? `${L("Impennata", "Spike")} (${fmtPct(a.rr - 1)})` : a && a.flag === "fall" ? `${L("Calo netto", "Sharp fall")} (${fmtPct(a.rr - 1)})` : "";
          return `<tr><td>${yr}</td><td class="num">${c.n[state.cardType][i] == null ? "–" : nf0.format(c.n[state.cardType][i])}</td><td class="num">${fmtRate(r.s[i])}</td>${P ? `<td class="num">${fmtRate(pr.s[i])}</td>` : ""}<td class="num">${fmtRate(m.it[i])}</td><td>${note}</td></tr>`;
        }).reverse().join("")}
      </tbody></table></div>
      ${court}
      <p class="small src">${L("Fonti: ISTAT, delitti denunciati dalle forze di polizia all’autorità giudiziaria (conteggi per comune capoluogo e tassi per provincia); popolazione residente ISTAT; percezione del rischio dall’indagine ISTAT Aspetti della vita quotidiana.", "Sources: ISTAT, crimes reported by the police to the judicial authorities (counts for each provincial capital and rates for each province); ISTAT resident population; perceived risk from the ISTAT survey Aspetti della vita quotidiana (Aspects of daily life).")}</p>`;
    $("#city-grid").innerHTML = gridHTML(rows);
    const series = [{ name: c.name, values: r.s, color: "var(--ink)", width: 2.25 }];
    if (pr) series.push({ name: EN ? `Province of ${P.name}` : `Provincia di ${P.name}`, values: pr.s, color: "var(--ink-2)", width: 1.75, dash: "5 4" });
    series.push({ name: L("Italia", "Italy"), values: m.it, color: "var(--muted)", width: 1.5 });
    drawCard(series, r.an, rows, (t, row, i) => `<b>${esc(t.label)}</b> · ${Y[i]}<br>${nf0.format(c.n[t.id][i] ?? 0)} ${casi(c.n[t.id][i] ?? 0)}, ${fmtRate(row.s[i])} ${L("ogni 100.000 ab.", "per 100,000 res.")} (${L("Italia", "Italy")} ${fmtRate(ITALY.rate[t.id][i])})`);
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
      return head + (EN ? `${esc(TYPE[m.t].label)}: ${r.few ? "fewer than 1,000 residents, no rate" : `${fmtRate(r.lvl)} per 100,000 residents`} (${nf0.format(r.nl)} ${(r.nl) === 1 ? "case" : "cases"}, ${m.cm.levelNote})` +
        (r.rank ? `<br>${ordinal(r.rank)} of ${m.ranked.length} · compared with ${state.cardBase}: ${fmtPct(r.cmp && r.cmp.pct)}${note}` : "") + `<br>${nf0.format(r.pop)} residents` : `${esc(TYPE[m.t].label)}: ${r.few ? "meno di 1.000 residenti, nessun tasso" : `${fmtRate(r.lvl)} ogni 100.000 residenti`} (${nf0.format(r.nl)} ${(r.nl) === 1 ? "caso" : "casi"}, ${m.cm.levelNote})` +
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
    // gli strati sui residenti stanno accanto ai reati della città, ma non ne dicono nulla: lo si scrive
    if (!m.layer.crime) note += EN ? "This layer describes who lives in each neighbourhood, not how safe it is: no official source publishes crimes by neighbourhood. " : "Questo strato dice chi abita nei quartieri, non quanto sono sicuri: nessuna fonte ufficiale pubblica i reati per quartiere. ";
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
      const sigText = sigLabel(r.cmp) ? ", " + sigLabel(r.cmp) : "";
      const spikes = (r.an || []).filter((x) => x && x.flag === "spike").map((x) => x.y);
      const txt = r.few ? (EN ? `Fewer than ${nf0.format(QFEW)} residents: ${nf0.format(r.n[L] ?? 0)} ${(r.n[L] ?? 0) === 1 ? "case" : "cases"} in ${yrs[L]}, but no rate would be meaningful.` : `Meno di ${nf0.format(QFEW)} residenti: ${nf0.format(r.n[L] ?? 0)} ${(r.n[L] ?? 0) === 1 ? "caso" : "casi"} nel ${yrs[L]}, ma nessun tasso ha senso.`)
        : EN ? `${nf0.format(r.n[L] ?? 0)} ${(r.n[L] ?? 0) === 1 ? "case" : "cases"} of ${esc(lower(TYPE[m.t].label))} in ${yrs[L]}: ${fmtRate(r.s[L])} per 100,000 residents, against ${fmtRate(m.crow ? m.crow.s[LAST] : null)} for ${esc(name)} as a whole · ${ordinal(r.rank)} of ${m.ranked.length} neighbourhoods · ${fmtPct(r.cmp && r.cmp.pct)} compared with ${state.cardBase}${sigText}.${spikes.length ? ` Spikes: ${spikes.join(", ")}.` : ""}` : `${nf0.format(r.n[L] ?? 0)} ${(r.n[L] ?? 0) === 1 ? "caso" : "casi"} di ${esc(lower(TYPE[m.t].label))} nel ${yrs[L]}: ${fmtRate(r.s[L])} ogni 100.000 residenti, contro ${fmtRate(m.crow ? m.crow.s[LAST] : null)} in tutta ${esc(name)} · ${r.rank}° su ${m.ranked.length} quartieri · ${fmtPct(r.cmp && r.cmp.pct)} rispetto al ${state.cardBase}${sigText}.${spikes.length ? ` Impennate: ${spikes.join(", ")}.` : ""}`;
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
        hover: (i) => EN ? `<b>${Y[i]}</b><br>${nf0.format(r.n[i - pad] ?? 0)} ${(r.n[i - pad] ?? 0) === 1 ? "case" : "cases"}, ${fmtRate(vals[i])} per 100,000 residents (${esc(name)} ${fmtRate(city[i])})` : `<b>${Y[i]}</b><br>${nf0.format(r.n[i - pad] ?? 0)} ${(r.n[i - pad] ?? 0) === 1 ? "caso" : "casi"}, ${fmtRate(vals[i])} ogni 100.000 residenti (${esc(name)} ${fmtRate(city[i])})` });
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
    const same = (a, b) => Math.round(a * 100) === Math.round(b * 100);
    ranked.forEach((r, i) => (r.rank = i > 0 && same(r.lvl, ranked[i - 1].lvl) ? ranked[i - 1].rank : i + 1));
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
    const sigText = sigLabel(r.cmp) ? " · " + sigLabel(r.cmp) : "";
    const capWord = caps.length > 1 ? EN ? `including the provincial capitals ${esc(andList(caps.map((c) => c.name)))}` : `compresi i capoluoghi ${esc(andList(caps.map((c) => c.name)))}` : EN ? `including the provincial capital, ${esc(cap.name)}` : `compreso il capoluogo, ${esc(cap.name)}`;
    const extra = [];
    // in Sardegna i reati seguono le province storiche, la percezione quelle di oggi (data/province.json, perc_sigla)
    const ps = PERC_SIGLA[e.sigla];
    if (P.region === "Sardegna" && normQ(unit) !== normQ(P.name)) extra.push(EN ? `In Sardegna ISTAT counts crimes by the four historical provinces. According to the official list of municipalities, between 1995 and 2005 ${esc(e.name)} was in the province of ${esc(P.name)}: that is why this profile uses that province’s data. Perceived risk, which ISTAT measures by today’s provinces, is that of the province of ${esc(unit)}.` : `In Sardegna l’ISTAT conta i reati secondo le quattro province storiche. Secondo l’elenco ufficiale dei comuni, tra il 1995 e il 2005 ${esc(e.name)} era in provincia di ${esc(P.name)}: per questo la scheda usa i dati di quella provincia. La percezione del rischio, che l’ISTAT misura sulle province di oggi, è invece quella della provincia ${/^Sud /.test(unit) ? "del" : "di"} ${esc(unit)}.`);
    if (first > Y[0]) extra.push(EN ? `The province of ${esc(P.name)} has data from ${first}: before then its municipalities were counted in the provinces they came from.` : `La provincia di ${esc(P.name)} ha dati dal ${first}: prima i suoi comuni erano contati nelle province da cui provengono.`);
    const rows = TYPES.map((tt) => ({ t: tt, row: provModel(tt.id).byId.get(e.prov) }));
    const iB = Y.indexOf(state.cardBase);
    const movers = moversHTML(rows, (tt, row) => {
      if (counts) return EN ? `${nf0.format(P.n[tt.id][LAST] ?? 0)} ${(P.n[tt.id][LAST] ?? 0) === 1 ? "case" : "cases"} in the province in ${Y[LAST]}, ${nf0.format(P.n[tt.id][iB] ?? 0)} in ${state.cardBase}` : `${nf0.format(P.n[tt.id][LAST] ?? 0)} ${(P.n[tt.id][LAST] ?? 0) === 1 ? "caso" : "casi"} in provincia nel ${Y[LAST]}, ${nf0.format(P.n[tt.id][iB] ?? 0)} nel ${state.cardBase}`;
      if (row.cmp.win) return EN ? `${Y[LAST - 2]}–${Y[LAST]} average: ${fmtRate(d3.mean(row.s.slice(LAST - 2)))} per 100,000 res., against ${fmtRate(d3.mean(row.s.slice(iB - 2, iB + 1)))} in ${Y[iB - 2]}–${Y[iB]} (rare crime)` : `Media ${Y[LAST - 2]}–${Y[LAST]}: ${fmtRate(d3.mean(row.s.slice(LAST - 2)))} ogni 100.000 ab., contro ${fmtRate(d3.mean(row.s.slice(iB - 2, iB + 1)))} nel ${Y[iB - 2]}–${Y[iB]} (reato raro)`;
      return EN ? `${fmtRate(row.s[LAST])} per 100,000 res. in ${Y[LAST]}, ${fmtRate(row.s[iB])} in ${state.cardBase}` : `${fmtRate(row.s[LAST])} ogni 100.000 ab. nel ${Y[LAST]}, ${fmtRate(row.s[iB])} nel ${state.cardBase}`;
    }, counts);
    const court = courtHTML(GIUS && e.i != null && GIUS.comuni_trib.length === INDEX.length ? GIUS.comuni_trib[e.i] : null, e.name);
    $("#city-body").innerHTML = `
      <div class="card-head">
      <div class="card-main">
      ${faseLine(court)}
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
        ${ps ? percFact(ps.perc, EN ? `in the province of ${esc(ps.name)}` : `della provincia ${/^Sud /.test(ps.name) ? "del" : "di"} ${esc(ps.name)}`) : percFact(P.perc, L("della provincia", "in the province"))}
      </div>
      </div>
      ${locMap(e.lon, e.lat, e.name)}
      </div>
      ${movers}
      ${chartBlock(m.label + L(" in provincia di ", " in the province of ") + P.name, `<span><i class="k-city"></i>${L("provincia di", "province of")} ${esc(P.name)}</span>${capRow ? `<span><i class="k-prov"></i>${esc(cap.name)}, ${L("capoluogo", "provincial capital")}</span>` : ""}<span><i class="k-it"></i>${L("Italia", "Italy")}</span>${counts ? `<span><i class="k-gold"></i>${L("impennata", "spike")}</span>` : ""}`)}
      ${counts ? `<p class="note">${spikeNote((id) => provModel(id).byId.get(e.prov))}</p>` : ""}
      <h3 class="subhead">${faseTag("denuncia")}${L("Tutti i reati in provincia di", "Every crime type in the province of")} ${esc(P.name)}</h3>
      <p class="small">${L("Ogni riquadro ha la sua scala. Linea grigia: Italia. Tocca un reato per vederlo in questa scheda.", "Each panel has its own scale. Grey line: Italy. Tap a crime to see it in this profile.")}</p>
      <div class="sm-grid" id="city-grid"></div>
      <h3 class="subhead">${faseTag("denuncia")}${esc(m.label)}: ${L("i numeri anno per anno", "year by year")}</h3>
      <div class="tablewrap"><table><thead><tr><th>${L("Anno", "Year")}</th>${counts ? `<th class="num">${L("Denunce in provincia", "Reports in the province")}</th>` : ""}<th class="num">${L("Provincia, ogni 100.000 ab.", "Province, per 100,000 res.")}</th>${capRow ? `<th class="num">${esc(cap.name)}</th>` : ""}<th class="num">${L("Italia", "Italy")}</th><th>${L("Nota", "Note")}</th></tr></thead><tbody>
        ${Y.map((yr, i) => {
          const a = r.an && r.an[i];
          const note = COVID.has(yr) ? "Covid" : a && a.flag === "spike" ? `${L("Impennata", "Spike")} (${fmtPct(a.rr - 1)})` : a && a.flag === "fall" ? `${L("Calo netto", "Sharp fall")} (${fmtPct(a.rr - 1)})` : "";
          const n = counts ? P.n[t][i] : null;
          return `<tr><td>${yr}</td>${counts ? `<td class="num">${n == null ? "–" : nf0.format(n)}</td>` : ""}<td class="num">${fmtRate(r.s[i])}</td>${capRow ? `<td class="num">${fmtRate(capRow.s[i])}</td>` : ""}<td class="num">${fmtRate(m.it[i])}</td><td>${note}</td></tr>`;
        }).reverse().join("")}
      </tbody></table></div>
      ${court}
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
      PROV = pv.prov; PROV_META = pv.meta; PERC_SIGLA = pv.perc_sigla || {}; UNITS = cm.units;
      INDEX = cm.comuni.map(([name, alt, sigla, prov, city, x, y], i) => {
        const c = city ? cityById(city) : null;
        if (c) CITY_PROV[c.id] = prov;
        // i capoluoghi usano il nome del resto della pagina (Reggio Emilia), ma si trovano anche con quello ufficiale
        const e = entry(c ? c.name : name, alt, sigla, prov, c ? c.id : "", PROV[prov].region, c && c.name !== name ? [name] : []);
        e.i = i; // la posizione in data/comuni.json, che data/giustizia.json usa per il tribunale
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
    // scritto senza apostrofi né spazi («laquila», «reggiocalabria»): si confrontano i nomi tutti attaccati
    if (best === 9 && q.length >= 4) {
      const qc = q.replace(/ /g, "");
      e.keys.forEach((k) => { const kc = k.replace(/ /g, ""); if (kc === qc) best = Math.min(best, 1); else if (kc.startsWith(qc)) best = Math.min(best, 2.5); });
    }
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
    // quanti comuni ha trovato la ricerca, detto ai lettori di schermo (l'elenco da solo non viene letto)
    const status = document.createElement("span");
    status.className = "vh";
    status.setAttribute("role", "status");
    list.after(status);
    const say = () => { status.textContent = list.hidden ? "" : items.length ? (EN ? `${items.length} ${items.length === 1 ? "town" : "towns"} found` : `${items.length} ${items.length === 1 ? "comune trovato" : "comuni trovati"}`) : (list.textContent || "").trim(); };
    const setActive = (i) => {
      active = i;
      list.querySelectorAll("li[data-i]").forEach((li, k) => li.setAttribute("aria-selected", k === i));
      const li = i >= 0 ? list.querySelector(`li[data-i="${i}"]`) : null;
      if (li) { input.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block: "nearest" }); }
      else input.removeAttribute("aria-activedescendant");
    };
    const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); setActive(-1); };
    const update = () => {
      if (!normQ(input.value)) {
        items = [];
        // solo simboli, emoji o lettere di altri alfabeti: nessun comune, e lo si dice
        if (input.value.trim()) { list.innerHTML = `<li class="o-none">${L("Nessun comune con questo nome. L’elenco è quello ufficiale ISTAT: controlla l’ortografia.", "No town by this name. The list is ISTAT’s official one, with Italian names: check the spelling.")}</li>`; list.hidden = false; input.setAttribute("aria-expanded", "true"); setActive(-1); return; }
        list.innerHTML = ""; close(); return;
      }
      items = search(input.value);
      const loading = !PROV && !placesFailed ? L(" (sto caricando l’elenco dei comuni…)", " (loading the list of towns…)") : "";
      list.innerHTML = items.length ? items.map((e, i) => optionHTML(e, `${list.id}-${i}`, i)).join("") + (loading ? `<li class="o-none">${L("Solo capoluoghi", "Provincial capitals only")}${loading}</li>` : "")
        : `<li class="o-none">${loading ? L("Sto caricando l’elenco dei comuni…", "Loading the list of towns…") : L("Nessun comune con questo nome. L’elenco è quello ufficiale ISTAT: controlla l’ortografia.", "No town by this name. The list is ISTAT’s official one, with Italian names: check the spelling.")}</li>`;
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      setActive(items.length ? 0 : -1);
      say();
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
      else if (ev.key === "Enter") {
        ev.preventDefault();
        if (list.hidden) update();
        // l'elenco dei comuni non è ancora arrivato e il nome non è un capoluogo: si sceglie appena arriva
        if (!items.length && !PROV && !placesFailed) {
          const q = input.value;
          loadPlaces().then(() => { if (input.value === q) { update(); pick(items[0]); } }).catch(() => {});
          return;
        }
        pick(items[active >= 0 ? active : 0]);
      }
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
    // aperta dalla ricerca della testata, che intanto si è richiusa: il fuoco torna sulla lente, non in cima alla pagina
    if (document.activeElement === document.body && $("#bar-find")) $("#bar-find").focus({ preventScroll: true });
    document.body.appendChild(tip);
    hideTip();
    state.city = null;
    state.place = null;
    // si toglie dall'indirizzo solo la scheda (#roma, #rovereto-tn): una sezione appena raggiunta (#mappa), che ha
    // chiuso la scheda passando da route(), resta
    let h = location.hash.slice(1);
    try { h = decodeURIComponent(h); } catch (e) { /* ignorato */ }
    const hs = slug(h);
    if (hs && (CITIES.some((x) => slug(x.name) === hs) || /-[a-z]{2}$/.test(hs))) {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignorato */ }
    }
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
    if (b && dlg.contains(b)) {
      // la scheda si ridisegna tutta: il fuoco torna sul tasto dello stesso reato, nello stesso gruppo
      const t = b.dataset.type, grp = b.closest(".sm-grid") ? ".sm-grid" : b.closest(".mover") ? ".mover" : null;
      setCardType(t);
      const nb = (grp && dlg.querySelector(`${grp} [data-type="${t}"]`)) || dlg.querySelector(`[data-type="${t}"]`);
      if (nb) nb.focus({ preventScroll: true });
    }
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
    // il fuoco segue la pagina: sulla scelta del reato della mappa, che ora mostra quello appena toccato
    const sel = $("#map-type");
    if (sel) sel.focus({ preventScroll: true });
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
    if (CAUT && has("caut-facts")) renderCautelari();
    if (IST && has("ist-facts")) renderIstituti();
    if (GIUS && has("proc-facts")) renderProcessi();
    if (ESEC && has("es-facts")) renderEsecuzione();
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
      <div class="fact"><div class="fv">${nf1.format(ndStr * 100)}%<small> vs ${nf1.format(ndIt * 100)}%</small></div><div class="fl">of foreign prisoners have no final conviction; of Italians, ${nf1.format(ndIt * 100)}%.</div></div>
      <div class="fact"><div class="fv">${nf1.format(C.serie.affollamento[L])}</div><div class="fl">prisoners per 100 official places in ${last}. There were ${nf1.format(C.serie.affollamento[Yc.indexOf(2020)])} in 2020 and ${nf1.format(C.serie.affollamento[0])} in ${Yc[0]}.</div></div>` : `
      <div class="fact"><div class="fv">${nf1.format(quota)}%</div><div class="fl">dei ${nf0.format(tot)} detenuti presenti a fine ${last} è straniero: ${nf0.format(str)} persone. Nel ${Yc[0]} era il ${nf1.format((100 * C.serie.str[0]) / C.serie.tot[0])}%.</div></div>
      ${res ? `<div class="fact"><div class="fv">${nf1.format(res.quota)}%</div><div class="fl">degli abitanti dell'Italia è straniero: ${nf0.format(res.stranieri)} residenti su ${nf0.format(res.pop)} al 1° gennaio ${resKey} (fonte: ${esc(R.fonte_label || "ISTAT")})</div></div>`
            : `<div class="fact na"><div class="fv">quota tra i residenti: in attesa del dato</div><div class="fl">La serie ISTAT degli stranieri residenti non era raggiungibile quando questi dati sono stati costruiti. Verrà aggiunta al prossimo aggiornamento.</div></div>`}
      <div class="fact"><div class="fv">${nf1.format(ndStr * 100)}%<small> vs ${nf1.format(ndIt * 100)}%</small></div><div class="fl">dei detenuti stranieri è senza condanna definitiva; tra gli italiani, il ${nf1.format(ndIt * 100)}%.</div></div>
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
    $("#carceri-reg-sub").textContent = EN ? `Share of foreign nationals among prisoners in ${last}, by region of the prison (not of residence or of the offence); the line is Italy (${nf1.format(quota)}%). An asterisk marks regions with fewer than 500 people in prison, where a few cases move the share a lot.` : `Quota di stranieri tra i detenuti nel ${last}, per regione del carcere (non di residenza né del reato); la linea è l'Italia (${nf1.format(quota)}%). L’asterisco indica le regioni con meno di 500 persone detenute, dove pochi casi spostano molto la quota.`;
    const maxQ = d3.max(regs, (r) => r.quota);
    $("#carceri-regions").innerHTML = regs.map((r) => `<li><span class="name" title="${esc(r.name)}">${esc(r.name)}</span><span class="bar" aria-hidden="true"><i class="rv-grow" style="width:${(100 * r.quota) / maxQ}%"></i><b class="rv-fade" style="left:${(100 * quota) / maxQ}%"></b></span><span class="val">${nf1.format(r.quota)}%${r.tot < 500 ? "*" : ""}</span></li>`).join("");
    reveal($("#carceri-regions"), $("#carceri-regions").querySelectorAll("li"));

    renderOffences();
    renderAge();
    const lab = C.posizione.labels;
    $("#carceri-legal").innerHTML = EN
      ? `Legal status in ${last}: among foreign nationals, ${nf1.format((100 * pStr.AWFJ) / totStr)}% are awaiting their first trial (Italians ${nf1.format((100 * pIt.AWFJ) / totIt)}%) and ${nf1.format((100 * (pStr.CONVFJ + pStr.MWD)) / totStr)}% have a final conviction (Italians ${nf1.format((100 * (pIt.CONVFJ + pIt.MWD)) / totIt)}%).`
      : `Posizione giuridica nel ${last}: tra gli stranieri il ${nf1.format((100 * pStr.AWFJ) / totStr)}% è in attesa del primo giudizio (italiani ${nf1.format((100 * pIt.AWFJ) / totIt)}%) e il ${nf1.format((100 * (pStr.CONVFJ + pStr.MWD)) / totStr)}% ha una condanna definitiva (italiani ${nf1.format((100 * (pIt.CONVFJ + pIt.MWD)) / totIt)}%).`;
    $("#carceri-note-1").textContent = EN
      ? `Foreign prisoners include people without a residence permit, who do not appear among residents. Foreign nationals in Italy are also younger, and in most countries young adults end up in prison more often. And without a home or a stable job, alternatives to custody are harder to obtain.`
      : `Tra i detenuti stranieri ci sono anche persone senza permesso di soggiorno, che tra i residenti non compaiono. Gli stranieri in Italia sono anche più giovani, e in gran parte dei paesi i giovani adulti finiscono in carcere più spesso. E senza una casa o un lavoro stabile è più difficile ottenere misure alternative.`;
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
      ? `Foreign prisoners at the end of each year, ${Yc[0]}–${Yc[L]}: the countries ISTAT lists one by one and, for the rest, the group; at the top, the ${Yc[L]} figure. Each panel has its own scale.`
      : `Detenuti stranieri a fine anno, ${Yc[0]}–${Yc[L]}: i paesi che l’ISTAT pubblica uno per uno e, per gli altri, il gruppo; in alto il numero del ${Yc[L]}. Ogni riquadro ha la sua scala.`;
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
    if (has("rimpatri-title")) $("#rimpatri-title").textContent = EN ? `In ${last}, ${per100(R[L], O[L])} returns for every 100 orders to leave Italy` : `Nel ${last}, ${per100(R[L], O[L])} rimpatri ogni 100 ordini di lasciare l’Italia`;
    $("#rimpatri-facts").innerHTML = EN ? `
      <div class="fact"><div class="fv">${nf0.format(R[L])}</div><div class="fl">people returned in ${last} after an order to leave Italy. The highest figure in the series was in ${Yr[iMax]}: ${nf0.format(R[iMax])}.</div></div>
      <div class="fact"><div class="fv">${per100(R[L], O[L])}<small> in 100</small></div><div class="fl">returns per 100 orders in ${last}, out of ${nf0.format(O[L])} orders. In ${Yr[0]} there were ${per100(R[0], O[0])}, but there were ${nf0.format(O[0])} orders.</div></div>
      <div class="fact"><div class="fv">${nf0.format(R[iMin])}</div><div class="fl">returns in ${Yr[iMin]}, the lowest in the series${COVID.has(Yr[iMin]) ? ", in the pandemic years" : ""}${O[iMin] < 0.6 * d3.median(O) ? `; orders recorded that year are also far fewer than usual (${nf0.format(O[iMin])})` : ""}.</div></div>
      <div class="fact"><div class="fv">${nf0.format((100 * d3.sum(top, (p) => p.r[L])) / R[L])}%</div><div class="fl">of returns in ${last} involved citizens of ${andList(names)}.</div></div>` : `
      <div class="fact"><div class="fv">${nf0.format(R[L])}</div><div class="fl">persone rimpatriate nel ${last} dopo un ordine di lasciare l'Italia. Il massimo della serie è del ${Yr[iMax]}: ${nf0.format(R[iMax])}.</div></div>
      <div class="fact"><div class="fv">${per100(R[L], O[L])}<small> su 100</small></div><div class="fl">rimpatri ogni 100 ordini nel ${last}, su ${nf0.format(O[L])} ordini. Nel ${Yr[0]} erano ${per100(R[0], O[0])}, ma gli ordini erano ${nf0.format(O[0])}.</div></div>
      <div class="fact"><div class="fv">${nf0.format(R[iMin])}</div><div class="fl">rimpatri nel ${Yr[iMin]}, il minimo della serie${COVID.has(Yr[iMin]) ? ", negli anni della pandemia" : ""}${O[iMin] < 0.6 * d3.median(O) ? `; anche gli ordini registrati quell’anno sono molti meno del solito (${nf0.format(O[iMin])})` : ""}.</div></div>
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
    // lo spazio tra le due linee: la distanza tra ordini e rimpatri dello stesso anno
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
    // celle vuote solo dove Eurostat segna il dato come mancante (Regno Unito finché era nell'UE, Croazia 2022), per ordini
    // e rimpatri insieme: le cittadinanze senza casi in un anno sono già 0 in data/rimpatri.json (build_rimpatri.py)
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
    const placed = D.paesi.filter((p) => p.ll && p.r.some((v) => v > 0));
    // inquadratura fissa per tutti gli anni: i paesi con almeno un rimpatrio e l'Italia, con un margine
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
      ? `The ${rows.length} countries with the most returns from ${Yr[0]} to ${Yr[L]}: orders (grey) and returns (blue). At the top, returns per 100 orders; at the bottom, total returns since ${Yr[0]} and the peak year. Each panel has its own scale.`
      : `${vowelNum(rows.length) ? "Gli" : "I"} ${rows.length} paesi con più rimpatri dal ${Yr[0]} al ${Yr[L]}: ordini (grigio) e rimpatri (blu). In alto i rimpatri ogni 100 ordini, in basso il totale dal ${Yr[0]} e l’anno di picco. Ogni riquadro ha la sua scala.`;
    sparkGrid($("#rimp-sm"), rows, {
      years: Yr, gap: true,
      lines: (p) => [{ values: p.r, color: "var(--fall)", width: 2 }, { values: p.o, color: "var(--ink-2)", width: 1.25 }],
      head: (p) => { const r = d3.sum(p.r, (v) => v || 0), o = d3.sum(p.o, (v) => v || 0); return `<span class="n" title="${esc(p.name)}">${esc(p.name)}</span><span class="small">${o ? nf0.format((100 * r) / o) : "–"} ${EN ? "in 100" : "su 100"}</span>`; },
      foot: (p) => `<span>${nf0.format(d3.sum(p.r, (v) => v || 0))} ${EN ? "since" : "dal"} ${Yr[0]}</span><span>${EN ? "peak" : "picco"} ${Yr[d3.maxIndex(p.r, (v) => v || 0)]}</span>`,
      tip: (p, i) => EN
        ? `<b>${esc(p.name)}</b> · ${Yr[i]}<br>${p.o[i] == null ? "–" : nf0.format(p.o[i])} orders to leave Italy<br>${p.r[i] == null ? "–" : nf0.format(p.r[i])} returns${p.o[i] && p.r[i] != null ? `, ${nf0.format((100 * p.r[i]) / p.o[i])} per 100` : ""}`
        : `<b>${esc(p.name)}</b> · ${Yr[i]}<br>${p.o[i] == null ? "–" : nf0.format(p.o[i])} ordini di lasciare l’Italia<br>${p.r[i] == null ? "–" : nf0.format(p.r[i])} rimpatri${p.o[i] && p.r[i] != null ? `, ${nf0.format((100 * p.r[i]) / p.o[i])} ogni 100` : ""}`,
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
  // by = "reg" unisce le province per regione, per la carta dei minori; by = "dist" per distretto di Corte d'appello (DIST_OF)
  function provShapes(by = "prov") {
    provShapes.cache = provShapes.cache || {};
    if (provShapes.cache[by]) return provShapes.cache[by];
    const obj = TOPO.objects[Object.keys(TOPO.objects)[0]], groups = new Map();
    obj.geometries.forEach((g) => {
      const code = g.properties.prov_istat_code, k = by === "reg" ? g.properties.reg_istat_code : by === "dist" ? DIST_OF[code] : SARD_OLD[+code] || code;
      if (k == null) return;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(g);
    });
    provShapes.cache[by] = { obj, groups, land: topojson.feature(TOPO, obj) };
    return provShapes.cache[by];
  }
  // vals = Map(codice ISTAT della provincia, a tre cifre, o della regione, a due, o id del distretto -> { v, tip });
  // o = { by, label, legend, fmt, sqrt }: con sqrt i colori seguono la radice, quando un valore stacca molto gli altri
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
    const col = (o.sqrt ? d3.scaleSequentialSqrt : d3.scaleSequential)(d3.interpolateLab(css("--land"), css("--fall"))).domain(o.sqrt ? [Math.max(0, lo - (hi - lo) * 0.02), hi] : [lo - (hi - lo) * 0.08, hi]);
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
      renderBrief();
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
    const A = AUTORI, Ya = A.meta.years, last = A.meta.last, L = Ya.indexOf(last), it = A.italia;
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
      ? "At the top, drug dealing and handling stolen goods: found almost only during a police check, with the offender already there, so the share shows how much checking goes on. At the bottom, thefts (above all of and from cars), criminal damage and cybercrime, whose authors are almost never seen."
      : "In cima spaccio e ricettazione: si scoprono quasi solo durante un controllo, con l’autore già davanti, quindi la quota dice quanto si controlla. In fondo i furti, soprattutto di auto e sulle auto, i danneggiamenti e i delitti informatici, di cui quasi mai si vede l’autore.";

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
      ? `The line is Italy (${nf1.format(itK)}%). Milano, Roma, Napoli and Torino are among the provinces with the lowest shares: ${big.map((d) => `${d.p.name} ${nf1.format(d.v)}%`).join(", ")}. ` +
        `Theft is part of the reason: where it makes up more of all crimes, the offender is known less often (correlation ${nf2.format(r).replace("-", "−")} across the ${withF.length} provinces). In Sardegna the colours follow the four historical provinces, on today’s borders.`
      : `La linea è l’Italia (${nf1.format(itK)}%). Milano, Roma, Napoli e Torino sono tra le province con le quote più basse: ${big.map((d) => `${d.p.name} ${nf1.format(d.v)}%`).join(", ")}. ` +
      `In parte si spiega con i furti: dove pesano di più sul totale dei delitti, l’autore si conosce meno spesso (correlazione ${nf2.format(r).replace("-", "−")} tra le ${withF.length} province). In Sardegna i colori seguono le quattro province storiche, sui confini di oggi.`;
  }

  function renderAutoriCities() {
    const A = AUTORI, Ya = A.meta.years, last = A.meta.last, L = Ya.indexOf(last), t = state.autoriType;
    if (!has("autori-cities") || !A.types.includes(t)) return;
    const K = d3.range(Math.max(0, L - 2), L + 1), span = `${Ya[K[0]]}–${last}`;
    let rows = A.citta.map((c) => {
      const n = d3.sum(K, (i) => c.tot[t][i] || 0), k = d3.sum(K, (i) => c.noto[t][i] || 0);
      return { name: c.name, v: n ? (100 * k) / n : null, few: n < 20, title: EN ? `${c.name}: ${nf0.format(k)} ${k === 1 ? "crime" : "crimes"} with a known offender out of ${nf0.format(n)}, ${span}` : `${c.name}: ${nf0.format(k)} ${k === 1 ? "delitto" : "delitti"} con autore noto su ${nf0.format(n)}, ${span}` };
    });
    // le città senza nessun caso nei tre anni non hanno una quota: non spariscono in silenzio, lo dice il sottotitolo
    const none = rows.filter((r) => r.v == null).map((r) => r.name);
    rows = rows.filter((r) => r.v != null).sort((a, b) => b.v - a.v);
    const itK = d3.mean(K, (i) => A.italia[t][i]);
    $("#autori-city-title").textContent = EN ? `${tLabel(t)}: crimes with a known offender per 100` : `${tLabel(t)}: delitti con autore noto ogni 100`;
    $("#autori-city-sub").textContent = EN
      ? `Crimes committed and reported between ${Ya[K[0]]} and ${last}, added together. The line is Italy (${nf1.format(itK)}%, the average of the annual shares).` + (rows.some((r) => r.few) ? " An asterisk marks fewer than 20 crimes over the three years." : "") + (none.length ? ` No case in ${andList(none)} in these years.` : "")
      : `Delitti commessi e denunciati tra il ${Ya[K[0]]} e il ${last}, sommati. La linea è l’Italia (${nf1.format(itK)}%, media delle quote annuali).` + (rows.some((r) => r.few) ? " L’asterisco indica meno di 20 delitti nei tre anni." : "") + (none.length ? ` Nessun caso ${none.length === 1 ? "a" : "nelle città di"} ${andList(none)} in questi anni.` : "");
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

  // minorenni ogni 100 segnalazioni, per il tipo t nell'anno di indice i (null prima del 2014, quando manca il totale)
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
    const M = MINORI, Ym = M.meta.years, last = M.meta.last, L = Ym.indexOf(last), y0 = M.meta.share_from, i0 = Ym.indexOf(y0);
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
      ? `Records of minors for theft fell from ${nf0.format(mn.THEFT[i0])} in ${y0} to ${nf0.format(mn.THEFT[L])} in ${last}, but adults’ fell too: the share of minors went from ${nf1.format(sh("THEFT", i0))}% to ${nf1.format(sh("THEFT", L))}%. ` +
        `For street robbery, records of minors went from ${nf0.format(mn.STREETROB[i0])} to ${nf0.format(mn.STREETROB[L])}, and the share from ${nf1.format(s0)}% to ${nf1.format(s1)}%: there, minors really do weigh more.`
      : `Le segnalazioni di minorenni per furto sono scese da ${nf0.format(mn.THEFT[i0])} nel ${y0} a ${nf0.format(mn.THEFT[L])} nel ${last}, ma sono scese anche quelle degli adulti: la quota dei minorenni è passata ${pctA("dal", sh("THEFT", i0))} ${pctA("al", sh("THEFT", L))}. ` +
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
      ? { label: `Minors per 100 records, by type of crime, ${y0} and ${last}`, unit: "per 100 records", keys: [String(y0), String(last)] }
      : { label: `Minorenni ogni 100 segnalazioni, per tipo di delitto, ${y0} e ${last}`, unit: "ogni 100 segnalazioni", keys: [String(y0), String(last)] });
    const moves = rows.filter((r) => r.t !== "TOT").map((r) => ({ ...r, d: r.b - r.a }));
    const up = moves.slice().sort((p, q) => q.d - p.d).slice(0, 3), down = moves.filter((r) => r.d < 0).sort((p, q) => p.d - q.d).slice(0, 3);
    const say = (r) => (EN ? `${lower(tShort(r.t))} (from ${nf1.format(r.a)} to ${nf1.format(r.b)})` : `${lower(tShort(r.t))} (da ${nf1.format(r.a)} a ${nf1.format(r.b)})`);
    $("#minori-types-note").textContent = EN
      ? `The share grew most for ${andList(up.map(say))}.` + (down.length ? ` It fell for ${andList(down.map(say))}.` : "") + " For rarer crimes a few cases move the share a lot (hover over a row for the numbers)."
      : `La quota è cresciuta di più per ${up.map(say).join(", ")}.` + (down.length ? ` È scesa per ${down.map(say).join(", ")}.` : "") + " Nei delitti più rari pochi casi spostano molto la quota (i numeri compaiono passando sopra una riga).";

    // nel tempo: la quota dal 2014, i numeri dal 2004
    const ys = Ym.slice(i0), shs = (t) => ys.map((_, k) => sh(t, i0 + k));
    $("#minori-trend-sub").textContent = EN ? `Records of minors per 100 records of all people, ${y0}–${last}` : `Segnalazioni di minorenni ogni 100 segnalazioni di tutte le persone, ${y0}–${last}`;
    seriesChart($("#minori-trend"), {
      years: ys, label: EN ? `Minors per 100 records, ${y0}–${last}` : `Minorenni ogni 100 segnalazioni, ${y0}–${last}`, height: 250, covid: true, yFmt: (v) => v + "%", fmt: (v) => nf1.format(v) + "%",
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
        ? `<b>${Ym[i]}</b><br>${nf0.format(mn.TOT[i])} records of minors` + (sh("TOT", i) != null ? `<br>${nf1.format(sh("TOT", i))}% of all records` : "")
        : `<b>${Ym[i]}</b><br>${nf0.format(mn.TOT[i])} segnalazioni di minorenni` + (sh("TOT", i) != null ? `<br>${nf1.format(sh("TOT", i))}% di tutte le segnalazioni` : ""),
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
          ? `<b>${esc(tLabel(t))}</b> · ${Ym[i]}<br>${mn[t][i] == null ? "no data" : nf0.format(mn[t][i]) + " records of minors"}${sh(t, i) != null ? `<br>${nf1.format(sh(t, i))}% of all records` : ""}`
          : `<b>${esc(tLabel(t))}</b> · ${Ym[i]}<br>${mn[t][i] == null ? "nessun dato" : nf0.format(mn[t][i]) + " segnalazioni di minorenni"}${sh(t, i) != null ? `<br>${nf1.format(sh(t, i))}% di tutte le segnalazioni` : ""}`,
      });
    }
    renderMinoriRegions();
  }

  function renderMinoriRegions() {
    const M = MINORI, ry = M.meta.region_years, last = M.meta.last, Lr = ry.includes(last) ? ry.indexOf(last) : ry.length - 1, t = state.minoriType;
    if (!has("minori-regions") || !M.types.includes(t)) return;
    const K = d3.range(Math.max(0, Lr - 2), Lr + 1);
    const pool = (o) => { const m = d3.sum(K, (i) => o.min[t][i] || 0), n = d3.sum(K, (i) => o.tot[t][i] || 0); return { m, n, v: n ? (100 * m) / n : null }; };
    const Ym = M.meta.years, off = Ym.indexOf(ry[0]);
    const itm = d3.sum(K, (i) => M.italia.min[t][off + i] || 0), itn = d3.sum(K, (i) => M.italia.tot[t][off + i] || 0), itv = itn ? (100 * itm) / itn : null;
    const rows = M.regioni.map((r) => ({ r, ...pool(r) })).filter((d) => d.v != null).sort((p, q) => q.v - p.v);
    const span = EN ? `between ${ry[K[0]]} and ${last}` : `tra il ${ry[K[0]]} e il ${last}`;
    $("#minori-reg-title").textContent = EN ? `${tLabel(t)}: minors per 100 records` : `${tLabel(t)}: minorenni ogni 100 segnalazioni`;
    $("#minori-reg-sub").textContent = EN
      ? `Records ${span}, added together. The line is Italy (${nf1.format(itv)}%).` + (rows.some((d) => d.m < 20) ? " An asterisk marks fewer than 20 records of minors over the three years." : "")
      : `Segnalazioni ${span}, sommate. La linea è l’Italia (${nf1.format(itv)}%).` + (rows.some((d) => d.m < 20) ? " L’asterisco indica meno di 20 segnalazioni di minorenni nei tre anni." : "");
    barList($("#minori-regions"), rows.map((d) => ({ name: d.r.name, v: d.v, few: d.m < 20, title: EN ? `${d.r.name}: ${nf0.format(d.m)} minors out of ${nf0.format(d.n)} records, ${ry[K[0]]}–${last}` : `${d.r.name}: ${nf0.format(d.m)} minorenni su ${nf0.format(d.n)} segnalazioni, ${ry[K[0]]}–${last}` })), { max: Math.max(rows[0].v, itv) * 1.02, ref: itv });
    if (has("minori-map")) {
      provMap($("#minori-map"), $("#minori-legend"), new Map(rows.map((d) => [d.r.istat, { v: d.v, tip: EN
        ? `<b>${esc(d.r.name)}</b><br>${nf1.format(d.v)} minors per 100 records<br><span class="small">${esc(tLabel(t))}, ${ry[K[0]]}–${last}: ${nf0.format(d.m)} of ${nf0.format(d.n)}</span>`
        : `<b>${esc(d.r.name)}</b><br>${nf1.format(d.v)} minorenni ogni 100 segnalazioni<br><span class="small">${esc(tLabel(t))}, ${ry[K[0]]}–${last}: ${nf0.format(d.m)} su ${nf0.format(d.n)}</span>` }])),
        EN ? { by: "reg", label: `Map of regions: minors per 100 records, ${tLabel(t)}`, legend: `Minors per 100 records, ${ry[K[0]]}–${last}`, fmt: (v) => nf0.format(v) + "%" }
          : { by: "reg", label: `Carta delle regioni: minorenni ogni 100 segnalazioni, ${tLabel(t)}`, legend: `Minorenni ogni 100 segnalazioni, ${ry[K[0]]}–${last}`, fmt: (v) => nf0.format(v) + "%" });
    }
    // nella nota solo le regioni con almeno 20 segnalazioni di minorenni: con meno casi la quota è poco solida
    const solid = rows.filter((d) => d.m >= 20), hi = solid.slice(0, 2), lo = solid.slice(-2).reverse(), nm = (d) => `${d.r.name} (${nf1.format(d.v)}%)`;
    $("#minori-reg-note").textContent = EN
      ? (solid.length >= 4 ? `The highest shares are in ${hi.map(nm).join(" and ")}, the lowest in ${lo.map(nm).join(" and ")}` + (solid.length < rows.length ? ", among regions with at least 20 records of minors" : "") + ". " : "") + "The share does not say where young people commit the most crimes: it also depends on adults’ crimes and on how many young people live there."
      : (solid.length >= 4 ? `Le quote più alte sono in ${hi.map(nm).join(" e ")}, le più basse in ${lo.map(nm).join(" e ")}` + (solid.length < rows.length ? ", tra le regioni con almeno 20 segnalazioni di minorenni" : "") + ". " : "") + `La quota non dice dove i ragazzi delinquono di più: dipende anche dai delitti degli adulti e da quanti giovani ci vivono.`;
  }

  // ------------------------------------------------------------------ prima della condanna (custodia cautelare)

  async function loadCautelari() {
    try {
      const r = await fetch(ROOT + "data/cautelari.json");
      if (!r.ok) throw new Error(r.status);
      CAUT = await r.json();
      DIST_OF = {};
      CAUT.riparazione.distretti.forEach((d) => d.map.forEach((p) => { DIST_OF[p] = d.id; }));
      addSources(CAUT.meta.sources, "cautelari");
      if (has("caut-dist-seg")) seg("#caut-dist-seg", "dmode", (v) => { state.cautMode = v; renderCautDistricts(); });
      if (has("caut-facts")) renderCautelari();
      renderDeepCards();
    } catch (e) {
      if (has("caut-facts")) $("#caut-facts").innerHTML = `<p class="note">${L("I dati sulla custodia cautelare non si sono caricati", "The data on pre-trial detention did not load")} (${esc(e.message)}).</p>`;
      console.error(e);
    }
  }

  // quante persone detenute ogni 100 non hanno una condanna definitiva, nell'anno di indice i (s = una serie di detenuti)
  const dispShare = (s, i) => (s.ALL[i] ? (100 * s.DISPAUTH[i]) / s.ALL[i] : null);

  // Cento quadratini divisi in parti, nell'ordine dato: parts = [{ v (su 100), cls, label }]. I resti si assegnano
  // ai decimali più grandi, così i quadratini sono sempre cento.
  function stackWaffle(el, parts, o) {
    const fl = parts.map((p) => Math.floor(p.v)), left = 100 - d3.sum(fl);
    parts.map((p, i) => ({ i, r: p.v - fl[i] })).sort((a, b) => b.r - a.r).slice(0, left).forEach((d) => { fl[d.i] += 1; });
    let k = 0;
    const cells = parts.flatMap((p, j) => d3.range(fl[j]).map(() => k++).map((i) => `<rect class="rv-pop ${p.cls}" style="--i:${i}" x="${(i % 10) * 10 + 0.75}" y="${Math.floor(i / 10) * 10 + 0.75}" width="8.5" height="8.5" rx="1.5"/>`)).join("");
    el.innerHTML = `<figure class="waffle"><svg viewBox="0 0 100 100" role="img" aria-label="${esc(o.aria)}">${cells}</svg><figcaption><span class="wv">${o.big}<small> ${o.unit}</small></span><span class="wl">${o.label}</span></figcaption></figure>` +
      `<ul class="sw-key">${parts.map((p) => `<li><i class="${p.cls}" aria-hidden="true"></i><span>${p.label}</span><b>${nf1.format(p.v)}%</b></li>`).join("")}</ul>`;
    reveal(el, el.querySelectorAll(".waffle"));
  }

  // Barre al 100%, una per riga: rows = [{ name, parts: [n, …], strong }], cats = [{ cls, label }] nello stesso ordine.
  function stackBars(el, rows, cats) {
    el.innerHTML = `<ul class="sbar-key" aria-hidden="true">${cats.map((c) => `<li><i class="${c.cls}"></i>${c.label}</li>`).join("")}</ul>` +
      `<ol class="sbars">${rows.map((r, j) => {
        const tot = d3.sum(r.parts);
        const segs = r.parts.map((n, i) => { const p = (100 * n) / tot; return `<i class="${cats[i].cls}" style="width:${p}%" title="${esc(cats[i].label)}: ${nf1.format(p)}% (${nf0.format(n)})">${p >= 7 ? `<span>${nf0.format(Math.round(p))}%</span>` : ""}</i>`; }).join("");
        return `<li${r.strong ? ' class="strong"' : ""}><span class="name">${esc(r.name)}</span><span class="sbar rv-grow" style="--i:${j}">${segs}</span><span class="val">${nf0.format(tot)}</span></li>`;
      }).join("")}</ol>`;
    reveal(el, el.querySelectorAll("li"));
  }

  function renderCautelari() {
    const C = CAUT, Yc = C.meta.years, L = Yc.length - 1, last = C.meta.last, y0 = Yc[0];
    const D = C.detenuti, I = D.italia;
    const R = C.riparazione, Yr = C.meta.rel_years, Lr = Yr.length - 1, lastR = C.meta.rel_last;
    const sL = dispShare(I, L), s0 = dispShare(I, 0), aw = (100 * I.AWFJ[L]) / I.ALL[L];
    const sIt = dispShare(D.cit.it, L), sStr = dispShare(D.cit.str, L);
    const a = oneIn(sL);

    // apertura: una persona su quattro, e i quadratini divisi per posizione giuridica
    const lead = EN ? `${a.pre}one person in ${a.w} held in prison has no final conviction` : `${a.pre}una persona detenuta su ${a.w} non ha una condanna definitiva`;
    $("#caut-lead").textContent = lead.charAt(0).toUpperCase() + lead.slice(1);
    $("#caut-lead-sub").textContent = EN
      ? `At the end of ${last}: ${nf0.format(I.DISPAUTH[L])} of the ${nf0.format(I.ALL[L])} people in Italian prisons. Each square is one person in a hundred.`
      : `A fine ${last} erano ${nf0.format(I.DISPAUTH[L])} delle ${nf0.format(I.ALL[L])} persone detenute. Ogni quadratino è una persona su cento.`;
    const pc = (k) => (100 * I[k][L]) / I.ALL[L];
    // qui L è l'indice dell'ultimo anno, non la funzione delle due lingue
    stackWaffle($("#caut-waffle"), [
      { v: pc("AWFJ"), cls: "p1", label: EN ? "awaiting their first trial" : "in attesa del primo giudizio" },
      { v: pc("APP") + pc("REC") + pc("MWOD"), cls: "p2", label: EN ? "convicted at first or second instance, awaiting appeal or the Court of Cassation" : "condannate in primo o secondo grado, in attesa di appello o di Cassazione" },
      { v: pc("CONVFJ") + pc("MWD"), cls: "p3", label: EN ? "with at least one final conviction" : "con almeno una condanna definitiva" },
      { v: pc("SUBSM"), cls: "p4", label: EN ? "under a security measure" : "in misura di sicurezza" },
    ], EN
      ? { big: nf1.format(sL) + "%", unit: "", label: `without a final conviction, end of ${last}`, aria: `${nf1.format(sL)} people in 100 held in prison without a final conviction at the end of ${last}` }
      : { big: nf1.format(sL) + "%", unit: "", label: `senza condanna definitiva, fine ${last}`, aria: `${nf1.format(sL)} persone detenute su 100 senza condanna definitiva a fine ${last}` });

    const pay = d3.sum(R.importi), ord = d3.sum(R.ordinanze);
    $("#caut-facts").innerHTML = EN ? `
      <div class="fact"><div class="fv">${nf1.format(sL)}%</div><div class="fl">of people in prison had no final conviction at the end of ${last}. In ${y0}: ${nf1.format(s0)}%.</div></div>
      <div class="fact"><div class="fv">${nf0.format(I.AWFJ[L])}</div><div class="fl">people were awaiting their first trial verdict: ${nf1.format(aw)}% of the total.</div></div>
      <div class="fact"><div class="fv">${nf1.format(sStr)}%<small> vs ${nf1.format(sIt)}%</small></div><div class="fl">of foreign nationals in prison had no final conviction; of Italians, ${nf1.format(sIt)}%.</div></div>
      <div class="fact"><div class="fv">€${nf1.format(R.importi[Lr] / 1e6)}<small> million</small></div><div class="fl">paid by the State in ${lastR} under ${nf0.format(R.ordinanze[Lr])} compensation orders for wrongful detention; €${nf0.format(pay / 1e6)} million from ${Yr[0]} to ${lastR}.</div></div>` : `
      <div class="fact"><div class="fv">${nf1.format(sL)}%</div><div class="fl">delle persone detenute era senza condanna definitiva a fine ${last}. Nel ${y0}, ${pctA("il", s0)}.</div></div>
      <div class="fact"><div class="fv">${nf0.format(I.AWFJ[L])}</div><div class="fl">persone aspettavano la sentenza di primo grado: ${pctA("il", aw)} del totale.</div></div>
      <div class="fact"><div class="fv">${nf1.format(sStr)}%<small> vs ${nf1.format(sIt)}%</small></div><div class="fl">delle persone straniere detenute era senza condanna definitiva; delle italiane, ${pctA("il", sIt)}.</div></div>
      <div class="fact"><div class="fv">${nf1.format(R.importi[Lr] / 1e6)}<small> milioni di euro</small></div><div class="fl">pagati dallo Stato nel ${lastR} con ${nf0.format(R.ordinanze[Lr])} ordinanze di riparazione per ingiusta detenzione; ${nf0.format(pay / 1e6)} milioni dal ${Yr[0]} al ${lastR}.</div></div>`;

    // nel tempo
    const share = Yc.map((_, i) => dispShare(I, i)), shareAw = Yc.map((_, i) => (100 * I.AWFJ[i]) / I.ALL[i]);
    $("#caut-time-title").textContent = EN
      ? `Since ${y0} the share has fallen from ${nf1.format(s0)}% to ${nf1.format(sL)}%`
      : `Dal ${y0} la quota è scesa ${pctA("dal", s0)} ${pctA("al", sL)}`;
    $("#caut-share-sub").textContent = EN ? `People in prison per 100, at the end of each year, ${y0}–${last}` : `Persone detenute ogni 100, a fine anno, ${y0}–${last}`;
    seriesChart($("#caut-share"), {
      years: Yc, label: EN ? `Share of people in prison without a final conviction, ${y0}–${last}` : `Quota di persone detenute senza condanna definitiva, ${y0}–${last}`, height: 240,
      yFmt: (v) => v + "%", fmt: (v) => nf1.format(v) + "%", yMax: d3.max(share) * 1.12,
      series: [
        { name: EN ? "without a final conviction" : "senza condanna definitiva", values: share, color: "var(--fall)", width: 2.5, at: 2012, dy: -10 },
        { name: EN ? "awaiting first trial" : "in attesa del primo giudizio", values: shareAw, color: "var(--ink-2)", at: 2016, dy: -10, dyEnd: 16 },
      ],
      tip: (i) => EN
        ? `<b>end of ${Yc[i]}</b><br>${nf1.format(share[i])}% without a final conviction (${nf0.format(I.DISPAUTH[i])})<br>${nf1.format(shareAw[i])}% awaiting first trial (${nf0.format(I.AWFJ[i])})`
        : `<b>fine ${Yc[i]}</b><br>${nf1.format(share[i])}% senza condanna definitiva (${nf0.format(I.DISPAUTH[i])})<br>${nf1.format(shareAw[i])}% in attesa del primo giudizio (${nf0.format(I.AWFJ[i])})`,
    });
    $("#caut-counts-sub").textContent = EN ? `People held at the end of each year, ${y0}–${last}` : `Persone detenute a fine anno, ${y0}–${last}`;
    seriesChart($("#caut-counts"), {
      years: Yc, label: EN ? `People in prison, in total and without a final conviction, ${y0}–${last}` : `Persone detenute, in tutto e senza condanna definitiva, ${y0}–${last}`, height: 240, yMin: 0, gap: true,
      series: [
        { name: EN ? "everyone in prison" : "tutte le persone detenute", values: I.ALL, color: "var(--ink)", at: 2012, dy: -10 },
        { name: EN ? "without a final conviction" : "senza condanna definitiva", values: I.DISPAUTH, color: "var(--fall)", width: 2.5, at: 2016, dy: -10, dyEnd: 16 },
      ],
    });
    const i15 = Yc.indexOf(2015);
    $("#caut-time-note").textContent = EN
      ? `The steepest fall, from ${nf1.format(s0)}% to ${nf1.format(share[i15])}%, came between ${y0} and 2015: the years of the Torreggiani judgment (2013), in which the European Court of Human Rights condemned Italy over prison overcrowding, and of the laws that restricted pre-trial custody in prison, up to Law 47 of 2015. The timing matches; how much each law weighed, the numbers do not say. Since then the prison population has grown again, while those without a final conviction have stayed between ${nf0.format(Math.floor(d3.min(I.DISPAUTH.slice(i15)) / 1000))},000 and ${nf0.format(Math.ceil(d3.max(I.DISPAUTH.slice(i15)) / 1000))},000.`
      : `Il calo più forte, ${pctA("dal", s0)} ${pctA("al", share[i15])}, è tra il ${y0} e il 2015: gli anni della sentenza Torreggiani (2013), con cui la Corte europea dei diritti dell’uomo ha condannato l’Italia per il sovraffollamento, e delle leggi che hanno ristretto la custodia in carcere, fino alla legge 47 del 2015. I tempi coincidono; quanto abbia pesato ciascuna legge, i numeri non lo dicono. Da allora le persone detenute sono tornate a crescere, quelle senza condanna definitiva sono rimaste tra ${nf0.format(Math.floor(d3.min(I.DISPAUTH.slice(i15)) / 1000))} e ${nf0.format(Math.ceil(d3.max(I.DISPAUTH.slice(i15)) / 1000))} mila.`;

    // chi: italiani e stranieri, donne e uomini
    const pair = (a, b) => ({ a: Yc.map((_, i) => dispShare(a, i)), b: Yc.map((_, i) => dispShare(b, i)) });
    const pc2 = pair(D.cit.it, D.cit.str), ps2 = pair(D.sex.uomini, D.sex.donne);
    seriesChart($("#caut-cit"), {
      years: Yc, label: EN ? "Without a final conviction, per 100 Italians and per 100 foreign nationals in prison" : "Senza condanna definitiva, ogni 100 persone detenute italiane e straniere", height: 220,
      yFmt: (v) => v + "%", fmt: (v) => nf1.format(v) + "%", yMax: d3.max(pc2.b) * 1.12,
      series: [
        { name: EN ? "foreign nationals" : "straniere", values: pc2.b, color: "var(--fall)", width: 2.5, at: 2012, dy: -10 },
        { name: EN ? "Italians" : "italiane", values: pc2.a, color: "var(--ink)", at: 2016, dy: 18, dyEnd: 16 },
      ],
    });
    seriesChart($("#caut-sex"), {
      years: Yc, label: EN ? "Without a final conviction, per 100 women and per 100 men in prison" : "Senza condanna definitiva, ogni 100 donne e ogni 100 uomini detenuti", height: 220,
      yFmt: (v) => v + "%", fmt: (v) => nf1.format(v) + "%", yMax: d3.max(ps2.b.concat(ps2.a)) * 1.12,
      series: [
        { name: EN ? "men" : "uomini", values: ps2.a, color: "var(--ink)", at: 2015, dy: -10 },
        { name: EN ? "women" : "donne", values: ps2.b, color: "var(--rise)", width: 2.5, at: 2015, dy: 18, dyEnd: 16 },
      ],
    });
    const awStr = (100 * D.cit.str.AWFJ[L]) / D.cit.str.ALL[L], awIt = (100 * D.cit.it.AWFJ[L]) / D.cit.it.ALL[L];
    const ndW = (100 * D.sex.donne.DISPAUTH[L]) / D.sex.donne.ALL[L], ndM = (100 * D.sex.uomini.DISPAUTH[L]) / D.sex.uomini.ALL[L];
    $("#caut-who-note").textContent = EN
      ? `The gap has been there in every year since ${y0}: at the end of ${last}, ${nf1.format(awStr)}% of foreign nationals in prison were awaiting their first trial, against ${nf1.format(awIt)}% of Italians. One possible explanation, which these figures cannot test: house arrest requires a home. Women are ${nf1.format((100 * D.sex.donne.ALL[L]) / I.ALL[L])}% of people in prison; their share without a final conviction is ${ndW < ndM ? "a little lower than" : "a little higher than"} the men’s (${nf1.format(ndW)}% against ${nf1.format(ndM)}%).`
      : `Lo scarto c’è in ogni anno dal ${y0}: a fine ${last} era in attesa del primo giudizio ${pctA("il", awStr)} delle persone straniere detenute, contro ${pctA("il", awIt)} delle italiane. Una spiegazione possibile, che questi dati non permettono di verificare: per gli arresti domiciliari serve una casa. Le donne sono ${pctA("il", (100 * D.sex.donne.ALL[L]) / I.ALL[L])} delle persone detenute; tra loro la quota senza condanna definitiva è ${ndW < ndM ? "un po’ più bassa" : "un po’ più alta"} che tra gli uomini (${nf1.format(ndW)}% contro ${nf1.format(ndM)}%).`;

    renderCautRegions();
    renderCautMeasures();
    renderCautRepair();
  }

  function renderCautRegions() {
    const C = CAUT, Yc = C.meta.years, L = Yc.length - 1, last = C.meta.last, itv = dispShare(C.detenuti.italia, L);
    const rows = C.detenuti.regioni.map((r) => ({ r, n: r.all[L], d: r.disp[L], v: (100 * r.disp[L]) / r.all[L] })).sort((p, q) => q.v - p.v);
    $("#caut-reg-sub").textContent = EN
      ? `People in prison without a final conviction per 100, by region where the prison is, end of ${last}. The line is Italy (${nf1.format(itv)}%).` + (rows.some((d) => d.n < 300) ? " An asterisk marks regions with fewer than 300 people in prison." : "")
      : `Persone detenute senza condanna definitiva ogni 100, per regione in cui si trova il carcere, fine ${last}. La linea è l’Italia (${nf1.format(itv)}%).` + (rows.some((d) => d.n < 300) ? " L’asterisco indica le regioni con meno di 300 persone detenute." : "");
    barList($("#caut-regions"), rows.map((d) => ({ name: d.r.name, v: d.v, few: d.n < 300, title: EN ? `${d.r.name}: ${nf0.format(d.d)} of ${nf0.format(d.n)} people in prison` : `${d.r.name}: ${nf0.format(d.d)} su ${nf0.format(d.n)} persone detenute` })), { max: Math.max(rows[0].v, itv) * 1.02, ref: itv });
    if (has("caut-reg-map")) {
      provMap($("#caut-reg-map"), $("#caut-reg-legend"), new Map(rows.map((d) => [d.r.istat, { v: d.v, tip: EN
        ? `<b>${esc(d.r.name)}</b><br>${nf1.format(d.v)}% without a final conviction<br><span class="small">${nf0.format(d.d)} of ${nf0.format(d.n)} people in prison, end of ${last}</span>`
        : `<b>${esc(d.r.name)}</b><br>${nf1.format(d.v)}% senza condanna definitiva<br><span class="small">${nf0.format(d.d)} su ${nf0.format(d.n)} persone detenute, fine ${last}</span>` }])),
        EN ? { by: "reg", label: `Map of regions: people in prison without a final conviction per 100, end of ${last}`, legend: `Without a final conviction per 100, end of ${last}` }
          : { by: "reg", label: `Carta delle regioni: persone detenute senza condanna definitiva ogni 100, fine ${last}`, legend: `Senza condanna definitiva ogni 100, fine ${last}` });
    }
    const solid = rows.filter((d) => d.n >= 300), hi = solid.slice(0, 2), lo = solid.slice(-2).reverse(), nm = (d) => `${d.r.name} (${nf1.format(d.v)}%)`;
    $("#caut-reg-note").textContent = EN
      ? `The highest shares are in ${hi.map(nm).join(" and ")}, the lowest in ${lo.map(nm).join(" and ")}. What counts is where the prison is, not where the trial takes place: people awaiting trial are usually held near their court, while someone serving a long sentence can be moved far away. Why the share is so high in ${hi[0].r.name}, these data do not say.`
      : `Le quote più alte sono in ${hi.map(nm).join(" e ")}, le più basse in ${lo.map(nm).join(" e ")}. Conta la regione del carcere, non quella del processo: chi aspetta il giudizio sta di solito vicino al suo tribunale, chi sconta una pena lunga può essere trasferito lontano. Perché la quota sia così alta in ${hi[0].r.name}, questi dati non lo dicono.`;
  }

  function renderCautMeasures() {
    const C = CAUT, M = C.misure, Yr = C.meta.rel_years, Lr = Yr.length - 1, lastR = C.meta.rel_last;
    const byId = Object.fromEntries(M.tipi.map((t) => [t.id, t]));
    const custodial = Yr.map((_, i) => d3.sum(M.tipi.filter((t) => t.custodiale), (t) => t.n[i]));
    const house = Yr.map((_, i) => byId.domiciliari.n[i] + byId.braccialetto.n[i]);
    const prison = byId.carcere.n, tot = M.totale;
    $("#caut-measures-sub").textContent = EN ? `Coercive personal precautionary measures ordered by the courts each year, ${Yr[0]}–${lastR}` : `Misure cautelari personali coercitive disposte dai giudici ogni anno, ${Yr[0]}–${lastR}`;
    seriesChart($("#caut-measures"), {
      years: Yr, label: EN ? `Precautionary measures ordered, ${Yr[0]}–${lastR}` : `Misure cautelari disposte, ${Yr[0]}–${lastR}`, height: 240, yMin: 0, covid: true, xTicks: Yr,
      series: [
        { name: EN ? "all measures" : "tutte le misure", values: tot, color: "var(--ink)", at: 2019, dy: -10 },
        { name: EN ? "custody in prison" : "custodia in carcere", values: prison, color: "var(--fall)", width: 2.5, at: 2019, dy: -10 },
        { name: EN ? "house arrest" : "arresti domiciliari", values: house, color: "var(--ink-2)", at: 2019, dy: 16, dyEnd: 16 },
      ],
      tip: (i) => EN
        ? `<b>${Yr[i]}</b>${M.stimati.includes(Yr[i]) ? " · includes estimates" : ""}<br>${nf0.format(tot[i])} measures<br>${nf0.format(custodial[i])} involving custody (${nf1.format((100 * custodial[i]) / tot[i])}%)<br>${nf0.format(prison[i])} in prison, ${nf0.format(house[i])} house arrest`
        : `<b>${Yr[i]}</b>${M.stimati.includes(Yr[i]) ? " · con stime" : ""}<br>${nf0.format(tot[i])} misure<br>${nf0.format(custodial[i])} custodiali (${nf1.format((100 * custodial[i]) / tot[i])}%)<br>${nf0.format(prison[i])} in carcere, ${nf0.format(house[i])} ai domiciliari`,
    });
    // nomi brevi sulle righe, quello intero nel suggerimento
    const SHORT = EN
      ? { espatrio: "Ban on leaving Italy", firma: "Reporting to the police", allontanamento: "Removal from home", avvicinamento: "Keeping away from victim", divieto_dimora: "Ban on living in a place", obbligo_dimora: "Must live in a place", domiciliari: "House arrest", braccialetto: "House arrest with tag", carcere: "Custody in prison", cura: "Custody in a care facility" }
      : { espatrio: "Divieto di espatrio", firma: "Obbligo di firma", allontanamento: "Allontanamento da casa", avvicinamento: "Divieto di avvicinamento", divieto_dimora: "Divieto di dimora", obbligo_dimora: "Obbligo di dimora", domiciliari: "Arresti domiciliari", braccialetto: "Domiciliari con braccialetto", carcere: "Custodia in carcere", cura: "Custodia in luogo di cura" };
    const FULL_EN = { espatrio: "Ban on leaving Italy", firma: "Obligation to report to the police", allontanamento: "Removal from the family home", avvicinamento: "Ban on approaching the victim", divieto_dimora: "Ban on living in a place", obbligo_dimora: "Obligation to live in a place", domiciliari: "House arrest without electronic tag", braccialetto: "House arrest with electronic tag", carcere: "Custody in prison", cura: "Custody in a care facility" };
    const rows = M.tipi.map((t) => ({ name: SHORT[t.id], full: EN ? FULL_EN[t.id] : t.nome, v: (100 * t.n[Lr]) / tot[Lr], n: t.n[Lr], art: t.art })).sort((p, q) => q.v - p.v);
    $("#caut-types-sub").textContent = EN ? `Share of all ${nf0.format(tot[Lr])} measures ordered in ${lastR}` : `Quota sulle ${nf0.format(tot[Lr])} misure disposte nel ${lastR}`;
    barList($("#caut-types"), rows.map((r) => ({ name: r.name, v: r.v, title: EN ? `${r.full} (${/ e /.test(r.art) ? "arts" : "art."} ${r.art.replace(/ e /g, " and ").replace(/ c\. (\d+)/g, "($1)").replace(/ (bis|ter)\b/g, "-$1")} of the Code of Criminal Procedure): ${nf0.format(r.n)}` : `${r.full} (art. ${r.art} c.p.p.): ${nf0.format(r.n)}` })), { max: rows[0].v * 1.05 });

    // come finiscono i procedimenti, per le misure emesse e chiuse nello stesso anno
    const E = C.esiti, X = C.esiti_misura.righe, def = E.definiti[Lr];
    const parts = (r) => [r[0] + r[2], r[1] + r[3], r[4], r[5]];
    const cats = EN
      ? [{ cls: "o1", label: "convicted, sentence not suspended" }, { cls: "o2", label: "convicted, suspended sentence" }, { cls: "o3", label: "acquitted" }, { cls: "o4", label: "proceedings dropped for other reasons" }]
      : [{ cls: "o1", label: "condanna senza sospensione della pena" }, { cls: "o2", label: "condanna con sospensione condizionale" }, { cls: "o3", label: "assoluzione" }, { cls: "o4", label: "proscioglimento per altri motivi" }];
    stackBars($("#caut-outcomes"), [
      { name: EN ? "Custody in prison" : "Custodia in carcere", parts: parts(X.carcere) },
      { name: EN ? "House arrest" : "Arresti domiciliari", parts: parts(X.domiciliari) },
      { name: EN ? "House arrest with tag" : "Domiciliari con braccialetto", parts: parts(X.braccialetto) },
      { name: EN ? "All measures" : "Tutte le misure", parts: parts(X.totale), strong: true },
    ], cats);
    const free = (r) => r[4] + r[5], cust = ["carcere", "domiciliari", "braccialetto", "cura"];
    // sospensione condizionale dopo carcere o domiciliari (con o senza braccialetto): sulle misure di questo tipo e su tutte
    const cd = ["carcere", "domiciliari", "braccialetto"], susp = d3.sum(cd, (k) => X[k][1] + X[k][3]), custDef = d3.sum(cd, (k) => d3.sum(X[k]));
    const shareDef = (100 * def) / C.misure.totale[Lr];
    $("#caut-out-sub").textContent = EN
      ? `The ${nf0.format(def)} measures ordered in ${lastR} in proceedings that ended the same year, by type and outcome. The number on the right is how many; judgments may still be appealed.`
      : `Le ${nf0.format(def)} misure disposte nel ${lastR} in procedimenti chiusi nello stesso anno, per tipo ed esito. A destra quante sono; le sentenze possono non essere definitive.`;
    $("#caut-out-note").textContent = EN
      ? `Read with care: this is only ${nf1.format(shareDef)}% of the measures ordered in ${lastR}, those in the shortest proceedings, closed within the year; the report does not follow the others. Within that limit, ${nf1.format((100 * free(X.carcere)) / d3.sum(X.carcere))}% of the orders for custody in prison ended in an acquittal or with the case dropped. And ${nf0.format(susp)} orders for prison or house arrest were followed by a suspended sentence, although the law (art. 275(2-bis) of the Code of Criminal Procedure) rules both out when the judge expects the sentence to be suspended. The Ministry calls it marginal: ${nf1.format((100 * susp) / custDef)}% of those orders, ${nf1.format((100 * susp) / def)}% of all measures. The report counts measures, not people.`
      : `Da leggere con cautela: è solo ${pctA("il", shareDef)} delle misure del ${lastR}, quelle dei procedimenti più brevi, chiusi entro l’anno; gli altri la relazione non li segue. Con questo limite, ${pctA("il", (100 * free(X.carcere)) / d3.sum(X.carcere))} delle custodie in carcere si è chiuso con un’assoluzione o un proscioglimento. E ${nf0.format(susp)} misure di carcere o di domiciliari sono state seguite da una pena sospesa, anche se la legge (art. 275, comma 2 bis c.p.p.) le esclude quando il giudice prevede la sospensione. Per il Ministero è un dato marginale: ${pctA("il", (100 * susp) / custDef)} di quelle misure, ${pctA("il", (100 * susp) / def)} di tutte. La relazione conta misure, non persone.`;
  }

  function renderCautRepair() {
    const C = CAUT, R = C.riparazione, Yr = C.meta.rel_years, Lr = Yr.length - 1, lastR = C.meta.rel_last;
    const G = C.disciplinari, Dd = R.definite, mot = R.motivi;
    const ord = d3.sum(R.ordinanze), pay = d3.sum(R.importi), meanReq = d3.mean(R.domande), meanAcc = d3.mean(R.accolte_pct);
    const az = d3.sum(G.azioni), sanz = d3.sum(G.sanzioni), clean = d3.sum(G.assoluzioni) + d3.sum(G.non_doversi_procedere), open = d3.sum(G.in_corso);
    $("#caut-rip-facts").innerHTML = EN ? `
      <div class="fact"><div class="fv">${nf0.format(Math.round(meanReq))}</div><div class="fl">requests for compensation a year, on average (${Yr[0]}–${lastR}). About ${nf0.format(Math.round(meanAcc))} in 100 are granted.</div></div>
      <div class="fact"><div class="fv">${nf1.format(mot.proscioglimento_pct[Lr])}%</div><div class="fl">of the compensation orders that became final in ${lastR} followed an acquittal or a dropped case; the rest, an unlawful precautionary order.</div></div>
      <div class="fact"><div class="fv">${nf0.format(ord)}</div><div class="fl">payment orders from ${Yr[0]} to ${lastR}, for €${nf1.format(pay / 1e6)} million: about €${nf0.format(Math.round(pay / ord / 1000) * 1000)} each.</div></div>
      <div class="fact"><div class="fv">${nf0.format(sanz)}</div><div class="fl">disciplinary sanctions against judges, out of ${nf0.format(az)} proceedings opened since ${G.anni[0]} for detention outside the cases allowed by law.</div></div>` : `
      <div class="fact"><div class="fv">${nf0.format(Math.round(meanReq))}</div><div class="fl">domande di riparazione l’anno, in media (${Yr[0]}–${lastR}). Ne vengono accolte circa ${nf0.format(Math.round(meanAcc))} su 100.</div></div>
      <div class="fact"><div class="fv">${nf1.format(mot.proscioglimento_pct[Lr])}%</div><div class="fl">delle riparazioni diventate definitive nel ${lastR} segue un’assoluzione, un proscioglimento o un’archiviazione; le altre, un’ordinanza cautelare illegittima.</div></div>
      <div class="fact"><div class="fv">${nf0.format(ord)}</div><div class="fl">ordinanze di pagamento dal ${Yr[0]} al ${lastR}, per ${nf1.format(pay / 1e6)} milioni di euro: circa ${nf0.format(Math.round(pay / ord / 1000) * 1000)} euro ciascuna.</div></div>
      <div class="fact"><div class="fv">${nf0.format(sanz)}</div><div class="fl">sanzioni disciplinari ai magistrati, su ${nf0.format(az)} procedimenti avviati dal ${G.anni[0]} per una detenzione fuori dai casi consentiti.</div></div>`;
    $("#caut-pay-sub").textContent = EN ? `Compensation for wrongful detention paid each year, millions of euros, ${Yr[0]}–${lastR}` : `Riparazioni per ingiusta detenzione pagate ogni anno, milioni di euro, ${Yr[0]}–${lastR}`;
    seriesChart($("#caut-pay"), {
      years: Yr, label: EN ? `Compensation paid, millions of euros, ${Yr[0]}–${lastR}` : `Riparazioni pagate, milioni di euro, ${Yr[0]}–${lastR}`, height: 220, yMin: 0, xTicks: Yr,
      fmt: (v) => nf1.format(v), yFmt: (v) => nf0.format(v),
      series: [{ name: EN ? "€ million" : "milioni di euro", values: R.importi.map((v) => v / 1e6), color: "var(--fall)", width: 2.5, label: false }],
      tip: (i) => EN
        ? `<b>${Yr[i]}</b><br>€${nf1.format(R.importi[i] / 1e6)} million<br>${nf0.format(R.ordinanze[i])} orders, €${nf0.format(R.importi[i] / R.ordinanze[i])} on average`
        : `<b>${Yr[i]}</b><br>${nf1.format(R.importi[i] / 1e6)} milioni di euro<br>${nf0.format(R.ordinanze[i])} ordinanze, ${nf0.format(R.importi[i] / R.ordinanze[i])} euro in media`,
    });
    $("#caut-req-sub").textContent = EN ? `Requests for compensation and payment orders each year, ${Yr[0]}–${lastR}` : `Domande di riparazione e ordinanze di pagamento ogni anno, ${Yr[0]}–${lastR}`;
    seriesChart($("#caut-req"), {
      years: Yr, label: EN ? `Requests for compensation and payment orders, ${Yr[0]}–${lastR}` : `Domande di riparazione e ordinanze di pagamento, ${Yr[0]}–${lastR}`, height: 220, yMin: 0, xTicks: Yr,
      series: [
        { name: EN ? "requests" : "domande", values: R.domande, color: "var(--ink)", at: 2019, dy: -10 },
        { name: EN ? "payment orders" : "ordinanze di pagamento", values: R.ordinanze, color: "var(--fall)", width: 2.5, at: 2021, dy: 18, dyEnd: 16 },
      ],
      tip: (i) => EN
        ? `<b>${Yr[i]}</b><br>${nf0.format(R.domande[i])} new requests, ${nf1.format(R.accolte_pct[i])}% of decided ones granted<br>${nf0.format(R.ordinanze[i])} payment orders`
        : `<b>${Yr[i]}</b><br>${nf0.format(R.domande[i])} domande nuove, accolte ${nf1.format(R.accolte_pct[i])}% di quelle decise<br>${nf0.format(R.ordinanze[i])} ordinanze di pagamento`,
    });
    $("#caut-disc").textContent = EN
      ? `Custody may have been entirely lawful when it was ordered and turn out to be unjust only after an acquittal: for this reason the Ministry does not link compensation to the responsibility of judges. From ${G.anni[0]} to ${G.anni[G.anni.length - 1]}, ${nf0.format(az)} disciplinary proceedings were opened for ordering detention outside the cases allowed by law through serious and inexcusable negligence: ${nf0.format(clean)} ended without a sanction, ${nf0.format(sanz)} with one, ${nf0.format(open)} are still open.`
      : `La custodia può essere stata del tutto legittima quando è stata disposta e rivelarsi ingiusta solo dopo l’assoluzione: per questo il Ministero non collega le riparazioni alla responsabilità dei magistrati. Dal ${G.anni[0]} al ${G.anni[G.anni.length - 1]} i procedimenti disciplinari per una detenzione disposta fuori dai casi consentiti, per negligenza grave e inescusabile, sono stati ${nf0.format(az)}: ${nf0.format(clean)} chiusi senza sanzione, ${nf0.format(sanz)} con una sanzione, ${nf0.format(open)} in corso.`;
    $("#caut-def-note").textContent = EN
      ? `In ${lastR} the courts of appeal decided ${nf0.format(Dd.totale)} requests: ${nf0.format(Dd.accolte)} granted, ${nf0.format(Dd.respinte)} rejected, ${nf0.format(Dd.inammissibili)} inadmissible. Compensation must be requested within two years of the final judgment, and is refused to anyone who contributed to their own detention through intent or gross negligence.`
      : `Nel ${lastR} le Corti d’appello hanno deciso ${nf0.format(Dd.totale)} domande: ${nf0.format(Dd.accolte)} accolte, ${nf0.format(Dd.respinte)} respinte, ${nf0.format(Dd.inammissibili)} inammissibili. La riparazione va chiesta entro due anni dalla sentenza definitiva, e non spetta a chi ha contribuito alla propria detenzione con dolo o colpa grave.`;
    renderCautDistricts();
  }

  function renderCautDistricts() {
    const C = CAUT, R = C.riparazione, Yr = C.meta.rel_years, lastR = C.meta.rel_last, mode = state.cautMode;
    const span = `${Yr[0]}–${lastR}`, popY = C.meta.pop_year;
    const popIt = d3.sum(R.distretti, (d) => d.pop), ordIt = d3.sum(R.ordinanze), payIt = d3.sum(R.importi);
    const val = (o, e, p) => (mode === "ord" ? (1e5 * o) / p : mode === "eur" ? e / p : e / 1e6);
    const rows = R.distretti.map((d) => { const o = d3.sum(d.ordinanze), e = d3.sum(d.importi); return { d, o, e, v: val(o, e, d.pop) }; }).sort((p, q) => q.v - p.v);
    const itv = mode === "tot" ? null : val(ordIt, payIt, popIt);
    const fmt = (v) => nf1.format(v);
    const T = EN
      ? { ord: [`Compensation orders per 100,000 residents, ${span}`, "orders per 100,000 residents"], eur: [`Euros of compensation per resident, ${span}`, "euros per resident"], tot: [`Compensation paid, millions of euros, ${span}`, "€ million"] }
      : { ord: [`Ordinanze di riparazione ogni 100.000 abitanti, ${span}`, "ordinanze ogni 100.000 abitanti"], eur: [`Euro di riparazione per abitante, ${span}`, "euro per abitante"], tot: [`Riparazioni pagate, milioni di euro, ${span}`, "milioni di euro"] };
    $("#caut-dist-title").textContent = T[mode][0];
    $("#caut-dist-sub").textContent = EN
      ? `Courts of appeal, ${span} added together; Sassari, Taranto and Bolzano are detached sections of Cagliari, Lecce and Trento, counted separately` + (itv != null ? `. Residents on 1 January ${popY}; the line is Italy (${fmt(itv)}).` : ".")
      : `Corti d’appello, ${span} sommati; Sassari, Taranto e Bolzano sono sezioni distaccate di Cagliari, Lecce e Trento, contate a parte` + (itv != null ? `. Residenti al 1° gennaio ${popY}; la linea è l’Italia (${fmt(itv)}).` : ".");
    const tip = (r) => EN
      ? `<b>${esc(r.d.name)}</b><br>${nf0.format(r.o)} orders, €${nf1.format(r.e / 1e6)} million, ${span}<br><span class="small">${nf1.format((1e5 * r.o) / r.d.pop)} orders per 100,000 residents, €${nf1.format(r.e / r.d.pop)} per resident</span>`
      : `<b>${esc(r.d.name)}</b><br>${nf0.format(r.o)} ordinanze, ${nf1.format(r.e / 1e6)} milioni di euro, ${span}<br><span class="small">${nf1.format((1e5 * r.o) / r.d.pop)} ordinanze ogni 100.000 abitanti, ${nf1.format(r.e / r.d.pop)} euro per abitante</span>`;
    barList($("#caut-districts"), rows.map((r) => ({ name: r.d.name, v: r.v, title: tip(r).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() })), { max: rows[0].v * 1.02, ref: itv, fmt });
    if (has("caut-dist-map")) {
      provMap($("#caut-dist-map"), $("#caut-dist-legend"), new Map(rows.map((r) => [r.d.id, { v: r.v, tip: tip(r) }])),
        { by: "dist", sqrt: true, label: EN ? `Map of court districts: ${T[mode][1]}` : `Carta dei distretti di Corte d’appello: ${T[mode][1]}`, legend: T[mode][1], fmt: (v) => nf0.format(v) });
    }
    const top = rows[0], second = rows[1];
    // il rapporto con l'Italia segue la misura scelta: euro per abitante con «euro», ordinanze per abitante altrimenti
    const eur = mode === "eur", xIt = (r) => (eur ? (r.e / r.d.pop) / (payIt / popIt) : ((1e5 * r.o) / r.d.pop) / ((1e5 * ordIt) / popIt));
    const first = (f) => R.distretti.reduce((p, q) => (f(q) > f(p) ? q : p));
    const every = first((d) => d3.sum(d.ordinanze) / d.pop) === top.d && first((d) => d3.sum(d.importi) / d.pop) === top.d;
    $("#caut-dist-note").textContent = EN
      ? `${top.d.name} stands out${every ? " in every measure" : ""}: ${nf0.format(top.o)} orders and €${nf1.format(top.e / 1e6)} million over ${Yr.length} years, for a district of ${nf0.format(Math.round(top.d.pop / 1000) * 1000)} residents, ${nf0.format(xIt(top))} times the national ${eur ? "payments per resident" : "rate of orders per resident"}. ${second.d.name} follows. A single large trial ending in many acquittals can fill several years of payments, and the report does not say which proceedings the orders come from.`
      : `${top.d.name} spicca${every ? " in ogni misura" : ""}: ${nf0.format(top.o)} ordinanze e ${nf1.format(top.e / 1e6)} milioni di euro in ${Yr.length} anni, per un distretto di ${nf0.format(Math.round(top.d.pop / 1000) * 1000)} abitanti, ${nf0.format(xIt(top))} volte la media italiana ${eur ? "dei pagamenti per abitante" : "delle ordinanze per abitante"}. Segue ${second.d.name}. Un solo grande processo finito con molte assoluzioni può riempire più anni di pagamenti, e la relazione non dice da quali procedimenti vengano le ordinanze.`;
  }

  // ------------------------------------------------------------------ dal reato alla sentenza (procure, tribunali, Corti d'appello)

  let GIUS = null, giusPromise = null, giusFailed = false;
  // data/giustizia.json serve alla sua pagina e alle schede di tutti i comuni (il tribunale): si carica una volta sola
  function loadGiustizia() {
    if (!giusPromise) {
      giusPromise = fetch(ROOT + "data/giustizia.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => {
        GIUS = d;
        d.distretti.forEach((x) => x.map.forEach((p) => { DIST_OF[p] = x.id; }));
        addSources(d.meta.sources, "giustizia");
        return d;
      }).catch((e) => { giusFailed = true; throw e; });
    }
    return giusPromise;
  }
  async function loadProcessi() {
    try {
      await loadGiustizia();
      if (has("proc-dist-seg")) seg("#proc-dist-seg", "pmode", (v) => { state.procMode = v; renderProcDistricts(); });
      if (has("proc-sort")) seg("#proc-sort", "psort", (v) => { state.procSort = v; renderProcTable(); });
      if (has("proc-find")) $("#proc-find").addEventListener("input", renderProcTable);
      if (has("proc-facts")) renderProcessi();
      renderDeepCards();
    } catch (e) {
      if (has("proc-facts")) $("#proc-facts").innerHTML = `<p class="note">${L("I dati sui procedimenti penali non si sono caricati", "The data on criminal proceedings did not load")} (${esc(e.message)}).</p>`;
      console.error(e);
    }
  }

  // il primo grado è il dibattimento monocratico, collegiale e di assise: le sezioni si sommano anno per anno
  function flowSum(list) {
    const f = list.filter(Boolean), add = (k) => f[0][k].map((_, i) => d3.sum(f, (x) => x[k][i]));
    return { s: add("s"), d: add("d"), p: add("p") };
  }
  const gFlow = (F, k) => (k === "trib" ? flowSum([F.mono, F.coll, F.assise]) : F[k]);
  // disposition time: i giorni che servirebbero a chiudere i procedimenti aperti al ritmo dell'anno (pendenti / definiti × 365)
  const dtime = (f, i) => (f && f.d[i] ? (365 * f.p[i]) / f.d[i] : null);
  // prescritti ogni 100 definiti negli ultimi k anni che hanno tutti e due i numeri
  function prescShare(p, d, k = 3) {
    let sp = 0, sd = 0, n = 0;
    for (let i = p.length - 1; i >= 0 && n < k; i--) if (p[i] != null && d[i]) { sp += p[i]; sd += d[i]; n++; }
    return sd ? (100 * sp) / sd : null;
  }
  const lastK = (Yg, k = 3) => `${Yg[Yg.length - k]}–${Yg[Yg.length - 1]}`;
  const days = (v) => (v == null ? "–" : nf0.format(Math.round(v)));

  const GSTAGES = [
    { k: "procura", name: L("Procure", "Prosecutors"), what: L("le indagini", "investigation"), dur: "procura" },
    { k: "gip", name: L("GIP e GUP", "Preliminary judges"), what: L("archiviazioni, riti alternativi, rinvii a giudizio", "dismissals, fast-track trials, committals"), dur: "gip" },
    { k: "trib", name: L("Tribunali", "Trial courts"), what: L("il processo di primo grado", "the first-instance trial"), dur: "mono" },
    { k: "appello", name: L("Corti d’appello", "Courts of appeal"), what: L("il secondo grado", "the appeal"), dur: "appello" },
    { k: "cass", name: L("Cassazione", "Court of Cassation"), what: L("l’ultimo grado", "the final appeal"), dur: null },
  ];

  function renderProcessi() {
    const G = GIUS, Yg = G.meta.years, iL = Yg.length - 1, last = G.meta.last, y0 = Yg[0], i19 = Yg.indexOf(2019);
    const F = G.italia.flussi, Du = G.italia.durata, P = G.italia.presc;
    const st = GSTAGES.map((s) => ({ ...s, f: gFlow(F, s.k) }));
    const pend = (i) => d3.sum(st, (s) => s.f.p[i]);
    const pL = pend(iL), p0 = pend(0);
    $("#proc-lead").textContent = EN
      ? `${nf1.format(pL / 1e6)} million criminal proceedings were open at the end of ${last}, ${fmtPct(pL / p0 - 1).replace("−", "")} fewer than in ${y0}`
      : `A fine ${last} erano aperti ${nf1.format(pL / 1e6)} milioni di procedimenti penali, ${fmtPct(pL / p0 - 1).replace("−", "")} in meno che nel ${y0}`;
    $("#proc-lead-sub").textContent = EN
      ? `Proceedings with a known suspect, from the prosecutor's office to the Court of Cassation, on 31 December ${last}. Each stage counts the proceedings it has open; the same case moves from one stage to the next over the years.`
      : `Procedimenti con un indagato noto, dalla procura alla Cassazione, al 31 dicembre ${last}. Ogni fase conta i procedimenti che ha aperti; lo stesso procedimento passa da una fase all’altra negli anni.`;
    $("#proc-stages").innerHTML = `<ol class="proc-stages">${st.map((s, j) => {
      const d = s.dur ? Du[s.dur][iL] : null;
      return `<li class="rv-pop" style="--i:${j}"><span class="ps-k">${s.name}</span><span class="ps-w">${s.what}</span>
        <span class="ps-v">${nf0.format(s.f.p[iL])}</span><span class="ps-l">${L("procedimenti aperti", "open proceedings")}</span>
        <span class="ps-c">${fmtPct(s.f.p[iL] / s.f.p[0] - 1)} ${L("dal", "since")} ${y0}</span>
        <span class="ps-d">${d != null ? (EN ? `average length ${days(d)} days` : `durata media ${days(d)} giorni`) : EN ? `${nf0.format(s.f.d[iL])} closed in ${last}` : `${nf0.format(s.f.d[iL])} chiusi nel ${last}`}</span></li>`;
    }).join("")}</ol>`;
    reveal($("#proc-stages"), $("#proc-stages").querySelectorAll("li"));

    const mono = Du.mono, lg = Du.lunghi.mono[iL], lgA = Du.lunghi.appello[iL];
    const prTot = (i) => (P.gip_arch[i] == null ? null : P.appello[i] + P.trib[i] + P.gip_arch[i] + P.gip_sent[i] + P.gdp[i]);
    const prL = prTot(iL), pr0 = prTot(0);
    $("#proc-facts").innerHTML = EN ? `
      <div class="fact"><div class="fv">${days(mono[iL])}<small> days</small></div><div class="fl">average length of the first-instance trials closed in ${last} before a single judge, most of them; in ${y0}, ${days(mono[0])} days.</div></div>
      <div class="fact"><div class="fv">${nf0.format((100 * lg[0]) / lg[1])}%</div><div class="fl">of those trials ended more than two years after reaching the court; in the courts of appeal, ${nf0.format((100 * lgA[0]) / lgA[1])}% took more than three years.</div></div>
      <div class="fact"><div class="fv">${days(Du.appello[iL])}<small> days</small></div><div class="fl">average length of an appeal closed in ${last}, ${days(Du.appello[i19])} in 2019.</div></div>
      <div class="fact"><div class="fv">${nf0.format(prL)}</div><div class="fl">proceedings closed in ${last} because the time limit for prosecution had run out; ${nf0.format(pr0)} in ${y0}.</div></div>` : `
      <div class="fact"><div class="fv">${days(mono[iL])}<small> giorni</small></div><div class="fl">la durata media dei processi di primo grado chiusi nel ${last} davanti al giudice monocratico, la maggior parte; nel ${y0}, ${days(mono[0])} giorni.</div></div>
      <div class="fact"><div class="fv">${nf0.format((100 * lg[0]) / lg[1])}%</div><div class="fl">di quei processi si è chiuso più di due anni dopo l’arrivo in tribunale; in appello ${pctA("il", (100 * lgA[0]) / lgA[1])} è durato più di tre anni.</div></div>
      <div class="fact"><div class="fv">${days(Du.appello[iL])}<small> giorni</small></div><div class="fl">la durata media di un appello chiuso nel ${last}; ${days(Du.appello[i19])} nel 2019.</div></div>
      <div class="fact"><div class="fv">${nf0.format(prL)}</div><div class="fl">procedimenti chiusi nel ${last} per prescrizione, cioè perché era passato il tempo per giudicare; ${nf0.format(pr0)} nel ${y0}.</div></div>`;

    // nel tempo: gli arretrati (2014 = 100) e le durate medie
    const idx = (f) => f.p.map((v) => (100 * v) / f.p[0]);
    const S = Object.fromEntries(st.map((s) => [s.k, s]));
    $("#proc-pend-sub").textContent = EN ? `Proceedings open at the end of each year, ${y0} = 100` : `Procedimenti aperti a fine anno, ${y0} = 100`;
    seriesChart($("#proc-pend"), {
      years: Yg, label: EN ? `Open proceedings by stage, ${y0} = 100` : `Procedimenti aperti per fase, ${y0} = 100`, height: 260, yMin: 0, yMax: 115, covid: true,
      fmt: (v) => nf0.format(v), ref: 100,
      series: [
        { name: S.procura.name, values: idx(S.procura.f), color: "var(--ink)", at: 2015, dy: -10 },
        { name: S.gip.name, values: idx(S.gip.f), color: "var(--ink-2)", at: 2016, dy: 16, dyEnd: 16 },
        { name: S.trib.name, values: idx(S.trib.f), color: "var(--fall)", width: 2.5, at: 2018, dy: -10 },
        { name: S.appello.name, values: idx(S.appello.f), color: "var(--rise)", width: 2.5, at: 2017, dy: -10 },
        { name: S.cass.name, values: idx(S.cass.f), color: "var(--muted)", at: 2022, dy: 16, dyEnd: 16 },
      ],
      tip: (i) => `<b>${Yg[i]}</b><br>` + st.map((s) => `${s.name}: ${nf0.format(s.f.p[i])}`).join("<br>"),
    });
    $("#proc-dur-sub").textContent = EN ? `Average length of the proceedings closed each year, in days` : `Durata media dei procedimenti chiusi ogni anno, in giorni`;
    seriesChart($("#proc-dur"), {
      years: Yg, label: EN ? `Average length of closed proceedings, days, ${y0}–${last}` : `Durata media dei procedimenti chiusi, giorni, ${y0}–${last}`, height: 260, yMin: 0, covid: true,
      series: [
        { name: L("appello", "appeal"), values: Du.appello, color: "var(--rise)", width: 2.5, at: 2015, dy: -10 },
        { name: L("collegiale", "panel of judges"), values: Du.coll, color: "var(--ink-2)", at: 2015, dy: -10 },
        { name: L("monocratico", "single judge"), values: Du.mono, color: "var(--fall)", width: 2.5, at: 2015, dy: 16, dyEnd: 16 },
        { name: L("procura", "prosecutors"), values: Du.procura, color: "var(--ink)", at: 2015, dy: 16, dyEnd: 16 },
      ],
    });
    const dtM = (i) => dtime(S.trib.f, i), dtA = (i) => dtime(S.appello.f, i);
    $("#proc-time-note").textContent = EN
      ? `Backlogs have fallen at every stage, but average lengths have not: when a court closes its oldest files, the average length of the cases it closes goes up. The disposition time, which the Ministry uses for the targets of the Recovery Plan (PNRR), estimates instead how long it would take to clear the backlog at the current pace: in first-instance trials, ${days(dtM(i19))} days in 2019 and ${days(dtM(iL))} in ${last}; in appeal, ${days(dtA(i19))} and ${days(dtA(iL))}. Italy committed to cutting the criminal disposition time of trial courts, courts of appeal and the Court of Cassation by 25% from 2019 by June 2026.`
      : `Gli arretrati sono scesi in ogni fase, le durate medie no: quando un tribunale chiude i fascicoli più vecchi, la durata media di quelli che chiude sale. Il disposition time, che il Ministero usa per gli obiettivi del PNRR, stima invece quanto servirebbe a smaltire l’arretrato al ritmo dell’anno: nel primo grado ${days(dtM(i19))} giorni nel 2019 e ${days(dtM(iL))} nel ${last}; in appello ${days(dtA(i19))} e ${days(dtA(iL))}. L’Italia si è impegnata a ridurre del 25%, entro giugno 2026 e rispetto al 2019, il disposition time penale di tribunali, Corti d’appello e Cassazione.`;

    renderProcPresc();
    renderProcDistricts();
    renderProcTable();
  }

  function renderProcPresc() {
    const G = GIUS, Yg = G.meta.years, iL = Yg.length - 1, last = G.meta.last, y0 = Yg[0], P = G.italia.presc;
    const gip = Yg.map((_, i) => (P.gip_arch[i] == null ? null : P.gip_arch[i] + P.gip_sent[i]));
    const sh = (p, d) => p.map((v, i) => (v != null && d[i] ? (100 * v) / d[i] : null));
    const shA = sh(P.appello, P.def.appello), shT = sh(P.trib, P.def.trib);
    $("#proc-presc-title").textContent = EN
      ? `In appeal, ${nf0.format(shA[iL])} proceedings in 100 still end because time ran out`
      : `In appello ${nf0.format(shA[iL])} procedimenti su 100 finiscono ancora per prescrizione`;
    $("#proc-presc-sub").textContent = EN ? `Proceedings closed because of the statute of limitations, each year` : `Procedimenti chiusi per prescrizione, ogni anno`;
    seriesChart($("#proc-presc"), {
      years: Yg, label: EN ? `Proceedings closed because of the statute of limitations, ${y0}–${last}` : `Procedimenti chiusi per prescrizione, ${y0}–${last}`, height: 240, yMin: 0, covid: true,
      series: [
        { name: L("GIP e GUP", "preliminary judges"), values: gip, color: "var(--ink)", at: 2015, dy: -10, dyEnd: -14 },
        { name: L("tribunali", "trial courts"), values: P.trib, color: "var(--fall)", width: 2.5, at: 2022, dy: -10, dyEnd: 4 },
        { name: L("Corti d’appello", "courts of appeal"), values: P.appello, color: "var(--rise)", width: 2.5, at: 2020, dy: 18, dyEnd: 22 },
      ],
    });
    $("#proc-presc-share-sub").textContent = EN ? `Closed because of the statute of limitations, per 100 proceedings closed in the same office` : `Chiusi per prescrizione ogni 100 procedimenti chiusi nello stesso ufficio`;
    seriesChart($("#proc-presc-share"), {
      years: Yg, label: EN ? `Share closed because of the statute of limitations, ${y0}–${last}` : `Quota chiusa per prescrizione, ${y0}–${last}`, height: 240, yMin: 0, covid: true,
      yFmt: (v) => v + "%", fmt: (v) => nf1.format(v) + "%",
      series: [
        { name: L("appello", "appeal"), values: shA, color: "var(--rise)", width: 2.5, at: 2015, dy: -10 },
        { name: L("tribunale", "trial court"), values: shT, color: "var(--fall)", width: 2.5, at: 2015, dy: 16, dyEnd: 16 },
      ],
    });
    const iMax = shA.indexOf(d3.max(shA));
    $("#proc-presc-note").textContent = EN
      ? `In the courts of appeal the share peaked in ${Yg[iMax]} (${nf1.format(shA[iMax])}%) and has fallen since. The rules changed three times in a few years: in 2017; in 2019, for crimes committed from 2020 onwards, the clock stops after the first-instance judgment; in 2021 the Cartabia reform confirmed that rule and added a time limit for appeals, after which the proceedings end as inadmissible (improcedibilità). The fall in appeal therefore also depends on the law, not only on the speed of the courts. The Ministry did not publish the preliminary judges' dismissals for prescription in 2024.`
      : `Nelle Corti d’appello la quota ha toccato il massimo nel ${Yg[iMax]} (${nf1.format(shA[iMax])}%) ed è scesa da allora. Le regole sono cambiate tre volte in pochi anni: nel 2017; nel 2019, per i reati commessi dal 2020 la prescrizione si ferma con la sentenza di primo grado; nel 2021 la riforma Cartabia ha confermato quella regola e ha aggiunto un tempo massimo per l’appello, superato il quale il procedimento si chiude per improcedibilità. Il calo in appello dipende quindi anche dalla legge, non solo dalla velocità dei tribunali. Le archiviazioni per prescrizione dei GIP del 2024 il Ministero non le ha pubblicate.`;
  }

  // distretto per distretto: tre misure a scelta, sulla carta e in classifica
  function renderProcDistricts() {
    const G = GIUS, Yg = G.meta.years, iL = Yg.length - 1, last = G.meta.last, mode = state.procMode, k3 = lastK(Yg);
    const it = G.italia;
    const M = {
      presc: { v: (d) => prescShare(d.presc.appello, d.presc.appello_def), itv: prescShare(it.presc.appello, it.presc.def.appello), fmt: (v) => nf1.format(v) + "%",
        title: EN ? `Closed because of the statute of limitations per 100 appeals closed, ${k3}` : `Prescritti ogni 100 procedimenti chiusi in appello, ${k3}`, unit: L("prescritti ogni 100", "time-barred per 100") },
      app: { v: (d) => d.durata.appello[iL], itv: it.durata.appello[iL], fmt: (v) => days(v),
        title: EN ? `Average length of an appeal closed in ${last}, days` : `Durata media di un appello chiuso nel ${last}, giorni`, unit: L("giorni", "days") },
      trib: { v: (d) => d.durata.mono[iL], itv: it.durata.mono[iL], fmt: (v) => days(v),
        title: EN ? `Average length of a first-instance trial before a single judge, closed in ${last}, days` : `Durata media di un processo di primo grado davanti al giudice monocratico, chiuso nel ${last}, giorni`, unit: L("giorni", "days") },
    }[mode];
    const rows = G.distretti.map((d) => ({ d, v: M.v(d) })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
    const miss = G.distretti.filter((d) => M.v(d) == null).map((d) => d.name);
    $("#proc-dist-title").textContent = M.title;
    $("#proc-dist-sub").textContent = (EN
      ? `Court of appeal districts, with the detached sections of Sassari, Taranto and Bolzano. The line is Italy (${M.fmt(M.itv)}).`
      : `Distretti di Corte d’appello, con le sezioni distaccate di Sassari, Taranto e Bolzano. La linea è l’Italia (${M.fmt(M.itv)}).`) +
      (miss.length ? (EN ? ` No separate figure for ${andList(miss)}: counted with their main district.` : ` Nessun dato a parte per ${andList(miss)}: contati con il distretto principale.`) : "");
    const tip = (r) => `<b>${esc(r.d.name)}</b><br>${M.fmt(r.v)} ${M.unit}`;
    barList($("#proc-districts"), rows.map((r) => ({ name: r.d.name, v: r.v, title: `${r.d.name}: ${M.fmt(r.v)} ${M.unit}` })), { max: d3.max(rows, (r) => r.v) * 1.02, ref: M.itv, fmt: M.fmt });
    if (has("proc-dist-map")) {
      provMap($("#proc-dist-map"), $("#proc-dist-legend"), new Map(rows.map((r) => [r.d.id, { v: r.v, tip: tip(r) }])),
        { by: "dist", label: EN ? `Map of court districts: ${M.title}` : `Carta dei distretti: ${M.title}`, legend: M.title, fmt: (v) => (mode === "presc" ? nf0.format(v) + "%" : nf0.format(v)) });
    }
    const hi = rows.slice(0, 2), lo = rows.slice(-2).reverse(), nm = (r) => `${r.d.name} (${M.fmt(r.v)})`;
    $("#proc-dist-note").textContent = EN
      ? `Highest: ${hi.map(nm).join(" and ")}; lowest: ${lo.map(nm).join(" and ")}. ` + (mode === "presc"
        ? "A district with many old cases still pending under the old rules can show many prescriptions for years, even if its courts are now faster."
        : "Average lengths depend on the mix of cases and on how many old files a court closes in the year, not only on how fast it works.")
      : `I valori più alti: ${hi.map(nm).join(" e ")}; i più bassi: ${lo.map(nm).join(" e ")}. ` + (mode === "presc"
        ? "Un distretto con molti fascicoli vecchi, ancora con le regole di prima, può avere molte prescrizioni per anni anche se oggi i suoi tribunali sono più veloci."
        : "La durata media dipende dal tipo di processi e da quanti fascicoli vecchi un ufficio chiude nell’anno, non solo da quanto lavora in fretta.");
  }

  // tribunale per tribunale: la tabella, con l'ordine scelto e una ricerca per nome
  function renderProcTable() {
    const G = GIUS, Yg = G.meta.years, iL = Yg.length - 1, last = G.meta.last, i19 = Yg.indexOf(2019), k3 = lastK(Yg);
    const dn = Object.fromEntries(G.distretti.map((d) => [d.id, d.name]));
    const q = has("proc-find") ? normQ($("#proc-find").value || "") : "";
    const rows = G.tribunali.map((t) => {
      const f = flowSum([t.flussi.mono, t.flussi.coll, t.flussi.assise]), lg = t.lunghi.mono[iL];
      return { t, f, dm: t.durata.mono[iL], dc: t.durata.coll[iL], lg: lg ? (100 * lg[0]) / lg[1] : null, dt: dtime(f, iL), pr: prescShare(t.presc.trib, t.presc.trib_def), ch: f.p[i19] ? f.p[iL] / f.p[i19] - 1 : null };
    }).filter((r) => !q || normQ(r.t.name).includes(q) || normQ(dn[r.t.dist]).includes(q));
    const by = { dur: (a, b) => (b.dm ?? -1) - (a.dm ?? -1), dt: (a, b) => (b.dt ?? -1) - (a.dt ?? -1), presc: (a, b) => (b.pr ?? -1) - (a.pr ?? -1), name: (a, b) => a.t.name.localeCompare(b.t.name, LOCALE) }[state.procSort];
    rows.sort(by);
    $("#proc-table-sub").textContent = EN
      ? `The 140 trial courts and the residents of the municipalities they cover (1 January ${G.meta.pop_year}). Lengths: first-instance trials closed in ${last}. Over 2 years: share of single-judge trials closed after more than two years. Backlog: days needed to close the open trials at the ${last} pace. Time-barred: per 100 trials closed, ${k3}. Small courts close few trials, and their averages can rest on a handful of cases.`
      : `I 140 tribunali e i residenti dei comuni di cui sono competenti (1° gennaio ${G.meta.pop_year}). Durate: processi di primo grado chiusi nel ${last}. Oltre 2 anni: quota dei processi monocratici chiusi dopo più di due anni. Arretrato: giorni per chiudere i processi aperti al ritmo del ${last}. Prescritti: ogni 100 processi chiusi, ${k3}. I tribunali piccoli chiudono pochi processi, e le loro medie possono dipendere da pochi fascicoli.`;
    const f1 = (v) => (v == null ? "–" : nf1.format(v) + "%"), f0 = (v) => (v == null ? "–" : nf0.format(Math.round(v)));
    $("#proc-table").innerHTML = rows.length ? `<table class="ist-table proc-table"><thead><tr>
        <th scope="col">${L("Tribunale", "Court")}</th><th scope="col">${L("Distretto", "District")}</th><th scope="col" class="num">${L("Residenti", "Residents")}</th>
        <th scope="col" class="num">${L("Monocratico, giorni", "Single judge, days")}</th><th scope="col" class="num">${L("Collegiale, giorni", "Panel, days")}</th>
        <th scope="col" class="num">${L("Oltre 2 anni", "Over 2 years")}</th><th scope="col" class="num">${L("Arretrato, giorni", "Backlog, days")}</th>
        <th scope="col" class="num">${L("Prescritti", "Time-barred")}</th><th scope="col" class="num">${L(`Chiusi nel ${last}`, `Closed in ${last}`)}</th><th scope="col" class="num">${L(`Aperti a fine ${last}`, `Open, end ${last}`)}</th><th scope="col" class="num">${L("Dal 2019", "Since 2019")}</th></tr></thead><tbody>${rows.map((r) =>
      `<tr><th scope="row">${esc(r.t.name)}</th><td>${esc(dn[r.t.dist])}</td><td class="num">${nf0.format(r.t.pop)}</td>
        <td class="num">${f0(r.dm)}</td><td class="num">${f0(r.dc)}</td><td class="num">${f1(r.lg)}</td><td class="num">${f0(r.dt)}</td>
        <td class="num">${f1(r.pr)}</td><td class="num">${nf0.format(r.f.d[iL])}</td><td class="num">${nf0.format(r.f.p[iL])}</td><td class="num">${fmtPct(r.ch)}</td></tr>`).join("")}</tbody></table>`
      : `<p class="note">${L("Nessun tribunale con questo nome.", "No court with that name.")}</p>`;
  }

  // ------------------------------------------------------------------ il tribunale nella scheda di un comune

  // ti = indice in GIUS.tribunali; where = il nome del comune, per la frase
  function courtHTML(ti, where) {
    if (!GIUS || ti == null) return "";
    const G = GIUS, t = G.tribunali[ti], Yg = G.meta.years, iL = Yg.length - 1, last = G.meta.last, i19 = Yg.indexOf(2019), it = G.italia, k3 = lastK(Yg);
    const f = flowSum([t.flussi.mono, t.flussi.coll, t.flussi.assise]), fIt = gFlow(it.flussi, "trib");
    const lg = t.lunghi.mono[iL], lgIt = it.durata.lunghi.mono[iL];
    const pr = prescShare(t.presc.trib, t.presc.trib_def), prIt = prescShare(it.presc.trib, it.presc.def.trib);
    const d = G.distretti.find((x) => x.id === t.dist), same = normQ(t.name) === normQ(where);
    const intro = EN
      ? `${same ? `The court of ${esc(t.name)} tries` : `${esc(where)} falls under the court of ${esc(t.name)}, which tries`} crimes committed in ${nf0.format(t.comuni)} ${t.comuni === 1 ? "municipality" : "municipalities"} with ${nf0.format(t.pop)} residents; appeals go to the court of appeal of ${esc(d.name)}. These are its figures, not the town's alone: proceedings with a known suspect, all crime types together. Lengths and open trials count trials, not convictions: a closed trial can end in a conviction, an acquittal or a time bar.`
      : `${same ? `Il tribunale di ${esc(t.name)} giudica` : `${esc(where)} è nel circondario del tribunale di ${esc(t.name)}, che giudica`} i reati di ${nf0.format(t.comuni)} ${t.comuni === 1 ? "comune" : "comuni"} con ${nf0.format(t.pop)} residenti; in appello si va alla Corte d’appello di ${esc(d.name)}. Sono i numeri del tribunale, non del solo comune: procedimenti con un indagato noto, per tutti i reati insieme. Durate e processi aperti contano processi, non condanne: un processo chiuso può finire con una condanna, un’assoluzione o una prescrizione.`;
    const vs = (a, b, fmt) => (a == null || b == null ? "" : a > b * 1.1 ? L(`più dell’Italia (${fmt(b)})`, `more than Italy (${fmt(b)})`) : a < b * 0.9 ? L(`meno dell’Italia (${fmt(b)})`, `less than Italy (${fmt(b)})`) : L(`come l’Italia (${fmt(b)})`, `similar to Italy (${fmt(b)})`));
    const pc = (v) => nf0.format(v) + "%";
    // come si chiudono i procedimenti davanti al GIP e al GUP: le quattro modalità principali che il Ministero conta,
    // nel tribunale e in Italia, in barre al 100% (le stesse classi delle barre di custodia cautelare)
    const ge = t.gip_esiti, gi = it.gip_esiti, gparts = (X) => [X.arch[iL], X.decreti[iL], X.riti[iL], X.giudizio[iL]];
    const gcats = EN
      ? [{ cls: "o3", label: "dismissed, no trial" }, { cls: "o1", label: "penal decree of conviction" }, { cls: "o2", label: "fast-track judgment (plea bargain or abbreviated trial)" }, { cls: "o4", label: "sent to trial" }]
      : [{ cls: "o3", label: "archiviati, senza processo" }, { cls: "o1", label: "decreto penale di condanna" }, { cls: "o2", label: "rito alternativo (patteggiamento o abbreviato)" }, { cls: "o4", label: "rinviati a giudizio" }];
    const sbarRow = (name, parts, strong) => {
      const tot = d3.sum(parts);
      return `<li${strong ? ' class="strong"' : ""}><span class="name">${esc(name)}</span><span class="sbar">${parts.map((n, i) => {
        const p = (100 * n) / tot;
        return `<i class="${gcats[i].cls}" style="width:${p}%" title="${esc(gcats[i].label)}: ${nf1.format(p)}% (${nf0.format(n)})">${p >= 7 ? `<span>${nf0.format(Math.round(p))}%</span>` : ""}</i>`;
      }).join("")}</span><span class="val">${nf0.format(tot)}</span></li>`;
    };
    const gcov = ge && ge.arch[iL] != null ? (100 * d3.sum(gparts(ge))) / t.flussi.gip.d[iL] : null;
    // su 100 nuovi processi di primo grado in Italia, quanti arrivano con un rinvio a giudizio del GUP: gli altri per altre
    // strade (citazione diretta, direttissimo, giudizio immediato, opposizione a un decreto penale)
    const gGup = Math.round((100 * gi.giudizio[iL]) / fIt.s[iL]), gDec = ge && ge.decreti[iL];
    // decreti penali quasi assenti in un anno: non registrati, più che un tribunale che non ne emette
    const gDecNote = gDec == null || gDec > 5 ? "" : EN
      ? ` At the court of ${esc(t.name)} ${gDec === 0 ? "none was" : gDec === 1 ? "only one was" : `only ${gDec} were`} recorded in ${last}: probably not all of them were.`
      : ` Al tribunale di ${esc(t.name)} nel ${last} ${gDec === 0 ? "non ne risulta nessuno" : gDec === 1 ? "ne risulta uno solo" : `ne risultano solo ${gDec}`}: probabilmente non sono stati registrati tutti.`;
    const gip = gcov == null ? "" : `
      <p class="chart-title">${EN ? `How proceedings close before the preliminary judges, ${last}` : `Come si chiudono i procedimenti davanti al GIP e al GUP, ${last}`}</p>
      <p class="chart-sub">${EN
        ? `The four main outcomes the Ministry counts, per 100; on the right, how many proceedings. They cover ${nf0.format(gcov)}% of the proceedings closed by the court's preliminary judges (GIP and GUP).`
        : `Le quattro modalità principali che il Ministero conta, ogni 100; a destra quanti procedimenti. Coprono ${pctA("il", Math.round(gcov)).replace(",0%", "%")} dei procedimenti chiusi dal GIP e dal GUP del tribunale.`}</p>
      <ul class="sbar-key" aria-hidden="true">${gcats.map((c) => `<li><i class="${c.cls}"></i>${c.label}</li>`).join("")}</ul>
      <ol class="sbars">${sbarRow(L("Tribunale di ", "Court of ") + t.name, gparts(ge), true)}${sbarRow(L("Italia", "Italy"), gparts(gi))}</ol>
      <p class="small">${EN
        ? `Dismissals are the largest share because every dismissal goes through the GIP, while most trials do not: in Italy, of every 100 new first-instance trials in ${last}, only ${gGup} started with a committal by the GUP. The others reach court by other routes, mostly a direct summons by the prosecutor, which for many offences, those with lower penalties, sends the defendant to trial without a preliminary hearing. So these bars do not say how many proceedings end in a dismissal and how many in a trial.`
        : `Le archiviazioni sono la quota più grande perché ogni archiviazione passa dal GIP, mentre la maggior parte dei processi no: in Italia, su 100 nuovi processi di primo grado nel ${last}, solo ${gGup} sono arrivati con un rinvio a giudizio del GUP. Gli altri ci arrivano per altre strade, soprattutto con la citazione diretta del pubblico ministero, che per molti reati, quelli puniti con pene più basse, porta l’imputato a processo senza udienza preliminare. Queste barre quindi non dicono quanti procedimenti finiscono archiviati e quanti a processo.`}</p>
      <p class="small">${EN
        ? "A penal decree of conviction is a conviction to a fine decided without a trial, which became enforceable because nobody opposed it. Fast-track judgments include plea bargains, which count as convictions, and abbreviated trials, which can also end in an acquittal: the Ministry does not separate them. A dismissal closes the proceedings without a trial and does not say that the person is guilty. With a committal for trial the case goes to court: how it ends, conviction or acquittal, the Ministry does not publish court by court."
        : "Il decreto penale di condanna è una condanna a una pena pecuniaria decisa senza processo, diventata esecutiva perché nessuno si è opposto. Tra i riti alternativi ci sono i patteggiamenti, che valgono come una condanna, e i giudizi abbreviati, che possono finire anche con un’assoluzione: il Ministero non li separa. L’archiviazione chiude il procedimento senza processo e non dice che la persona sia colpevole. Con il rinvio a giudizio il procedimento va in tribunale: come finisce, con una condanna o un’assoluzione, il Ministero non lo pubblica tribunale per tribunale."}</p>
      <p class="small">${EN
        ? `The Ministry counts only the offices that answer its survey, and one court's figures for a single year can be incomplete or jump from one year to the next. It happens most with penal decrees: in several courts the number recorded changes a lot from year to year, and in some years it is close to zero. Where some are missing, the share of dismissals comes out a few points higher.${gDecNote}`
        : `Il Ministero conta solo gli uffici che rispondono alla rilevazione, e i numeri di un tribunale in un singolo anno possono essere incompleti o saltare da un anno all’altro. Succede soprattutto con i decreti penali: in diversi tribunali quelli registrati cambiano molto di anno in anno, e in qualche anno sono quasi zero. Se ne mancano, la quota di archiviazioni risulta più alta di qualche punto.${gDecNote}`}</p>`;
    return `<h3 class="subhead">${faseTag("processo")}${L("Dopo la denuncia: il tribunale di", "After the report: the court of")} ${esc(t.name)}</h3>
      <p class="small">${intro}</p>
      <div class="facts">
        <div class="fact"><div class="fv">${days(t.durata.mono[iL])}<small> ${L("giorni", "days")}</small></div><div class="fl">${EN ? `average length of the first-instance trials closed in ${last} before a single judge; ${vs(t.durata.mono[iL], it.durata.mono[iL], days)}` : `la durata media dei processi di primo grado chiusi nel ${last} davanti al giudice monocratico; ${vs(t.durata.mono[iL], it.durata.mono[iL], days)}`}</div></div>
        ${lg ? `<div class="fact"><div class="fv">${pc((100 * lg[0]) / lg[1])}</div><div class="fl">${EN ? `of those trials took more than two years; ${vs((100 * lg[0]) / lg[1], (100 * lgIt[0]) / lgIt[1], pc)}` : `di quei processi è durato più di due anni; ${vs((100 * lg[0]) / lg[1], (100 * lgIt[0]) / lgIt[1], pc)}`}</div></div>` : ""}
        ${pr != null ? `<div class="fact"><div class="fv">${nf1.format(pr)}</div><div class="fl">${EN ? `trials time-barred per 100 closed in court, ${k3}; Italy ${nf1.format(prIt)}` : `processi prescritti ogni 100 chiusi in tribunale, ${k3}; Italia ${nf1.format(prIt)}`}</div></div>` : ""}
        <div class="fact"><div class="fv">${nf0.format(f.p[iL])}</div><div class="fl">${EN ? `trials still open at the end of ${last}: ${fmtPct(f.p[iL] / f.p[i19] - 1)} compared with 2019 (Italy ${fmtPct(fIt.p[iL] / fIt.p[i19] - 1)})` : `processi ancora aperti a fine ${last}: ${fmtPct(f.p[iL] / f.p[i19] - 1)} rispetto al 2019 (Italia ${fmtPct(fIt.p[iL] / fIt.p[i19] - 1)})`}</div></div>
      </div>${gip}
      <p class="small">${L("Fonte: Ministero della Giustizia, Direzione generale di statistica.", "Source: Ministry of Justice, Statistics Directorate.")} <a href="${PAGES}approfondimenti/processi.html#tribunali">${L("Tutti i 140 tribunali, e che cosa succede dopo una denuncia", "All 140 courts, and what happens after a report")}</a></p>`;
  }

  // ------------------------------------------------------------------ fuori dal carcere (misure alternative e messa alla prova)

  let ESEC = null;
  async function loadEsecuzione() {
    try {
      const r = await fetch(ROOT + "data/esecuzione.json");
      if (!r.ok) throw new Error(r.status);
      ESEC = await r.json();
      ESEC.distretti.forEach((x) => x.map.forEach((p) => { DIST_OF[p] = x.id; }));
      addSources(ESEC.meta.sources, "esecuzione");
      if (has("es-reg-seg")) seg("#es-reg-seg", "emode", (v) => { state.esMode = v; renderEsRegions(); });
      if (has("es-facts")) renderEsecuzione();
      renderDeepCards();
    } catch (e) {
      if (has("es-facts")) $("#es-facts").innerHTML = `<p class="note">${L("I dati sulle misure fuori dal carcere non si sono caricati", "The data on community sentences did not load")} (${esc(e.message)}).</p>`;
      console.error(e);
    }
  }
  // misure alternative alla detenzione: affidamento in prova, detenzione domiciliare, semilibertà
  const altOf = (u, i) => u.affidamento[i] + u.domiciliare[i] + u.semiliberta[i];
  const sostOf = (u, i) => u.domiciliare_sost[i] + u.semiliberta_sost[i] + u.lpu_sost[i];

  function renderEsecuzione() {
    const E = ESEC, Ye = E.meta.years, iL = Ye.length - 1, last = E.meta.last, y0 = Ye[0], U = E.uepe.italia, C = E.carcere.italia;
    const alt = altOf(U, iL), alt0 = altOf(U, 0), pr = C[iL], per100 = Math.round((100 * alt) / pr);
    const S = E.stato_2025, free = S.affidamento.dalla_liberta + S.domiciliare.dalla_liberta + S.semiliberta.dalla_liberta;
    $("#es-lead").textContent = EN
      ? `For every 100 people in prison, ${per100} serve their sentence outside it`
      : `Per ogni 100 persone in carcere, ${per100} scontano la pena fuori`;
    $("#es-lead-sub").textContent = EN
      ? `On 31 December ${last}: ${nf0.format(pr)} people in prison and ${nf0.format(alt)} on probation, in home detention or in semi-liberty, the alternatives to prison, supervised by the probation offices (UEPE). Below, everyone those offices were following, by measure.`
      : `Al 31 dicembre ${last}: ${nf0.format(pr)} persone in carcere e ${nf0.format(alt)} in affidamento in prova, in detenzione domiciliare o in semilibertà, le misure alternative al carcere, seguite dagli uffici di esecuzione penale esterna (UEPE). Sotto, tutte le persone seguite da quegli uffici, per misura.`;
    const lpu = U.lpu_strada[iL] + U.lpu_droga[iL];
    const who = [
      { name: L("In carcere", "In prison"), v: pr, strong: true, title: L("Persone detenute negli istituti per adulti (ISTAT su dati DAP)", "People held in adult prisons (ISTAT on prison administration data)") },
      { name: L("Affidamento in prova", "Probation"), v: U.affidamento[iL], title: L("Misura alternativa: la pena si sconta fuori, con un programma seguito dall’UEPE", "Alternative to prison: the sentence is served outside, under a programme supervised by the UEPE") },
      { name: L("Detenzione domiciliare", "Home detention"), v: U.domiciliare[iL], title: L("Misura alternativa: la pena si sconta a casa o in un luogo di cura", "Alternative to prison: the sentence is served at home or in a care facility") },
      { name: L("Semilibertà", "Semi-liberty"), v: U.semiliberta[iL], title: L("Misura alternativa: di giorno fuori, di notte in carcere", "Alternative to prison: out by day, in prison at night") },
      { name: L("Messa alla prova", "Probation before trial"), v: U.map[iL], title: L("Il processo si sospende e, se la prova va bene, il reato si estingue: non è una condanna", "The trial is suspended and, if the probation goes well, the offence is extinguished: it is not a conviction") },
      { name: L("Pene sostitutive", "Substitute sentences"), v: sostOf(U, iL), title: L("Dalla riforma Cartabia (2023): detenzione domiciliare, semilibertà o lavoro di pubblica utilità decisi dal giudice del processo al posto di una pena breve", "Since the Cartabia reform (2023): home detention, semi-liberty or community service ordered by the trial judge instead of a short prison sentence") },
      { name: L("Lavoro di pubblica utilità", "Community service"), v: lpu, title: L("Per guida in stato di ebbrezza o reati di droga", "For drink-driving or drug offences") },
      { name: L("Libertà vigilata", "Supervised liberty"), v: U.liberta_vigilata[iL], title: L("Misura di sicurezza, di solito dopo la pena", "A security measure, usually after the sentence") },
      { name: L("Pena sospesa con obblighi", "Suspended sentence"), v: U.sospensione[iL], title: L("Pena sospesa con obblighi seguiti dall’UEPE (dal 2023)", "Suspended sentence with conditions supervised by the UEPE (since 2023)") },
    ];
    $("#es-who-sub").textContent = EN ? `People on 31 December ${last}` : `Persone al 31 dicembre ${last}`;
    barList($("#es-who"), who.map((r) => ({ name: r.name, v: r.v, title: `${r.title}: ${nf0.format(r.v)}` })), { max: pr * 1.02, fmt: (v) => nf0.format(v) });
    $("#es-who").querySelectorAll("li")[0].classList.add("strong");
    $("#es-facts").innerHTML = EN ? `
      <div class="fact"><div class="fv">${nf0.format(alt)}</div><div class="fl">people in an alternative to prison at the end of ${last}; ${nf0.format(alt0)} at the end of ${y0}.</div></div>
      <div class="fact"><div class="fv">${nf0.format((100 * free) / alt)}%</div><div class="fl">of them started the measure from freedom, without going to prison for that sentence: ${nf0.format(free)} people.</div></div>
      <div class="fact"><div class="fv">${nf0.format(U.map[iL])}</div><div class="fl">people on probation before trial (messa alla prova), which is not a conviction; ${nf0.format(U.map[0])} at the end of ${y0}, the year it was extended to adults.</div></div>
      <div class="fact"><div class="fv">${nf0.format(E.ingressi.tot[E.ingressi.tot.length - 1])}</div><div class="fl">entries into prison from freedom in ${E.ingressi.years[E.ingressi.years.length - 1]}; ${nf0.format(d3.max(E.ingressi.tot))} in ${E.ingressi.years[E.ingressi.tot.indexOf(d3.max(E.ingressi.tot))]}.</div></div>` : `
      <div class="fact"><div class="fv">${nf0.format(alt)}</div><div class="fl">persone in misura alternativa al carcere a fine ${last}; ${nf0.format(alt0)} a fine ${y0}.</div></div>
      <div class="fact"><div class="fv">${nf0.format((100 * free) / alt)}%</div><div class="fl">di loro ha cominciato la misura dalla libertà, senza passare dal carcere per quella pena: ${nf0.format(free)} persone.</div></div>
      <div class="fact"><div class="fv">${nf0.format(U.map[iL])}</div><div class="fl">persone in messa alla prova, che non è una condanna; ${nf0.format(U.map[0])} a fine ${y0}, l’anno in cui è stata estesa agli adulti.</div></div>
      <div class="fact"><div class="fv">${nf0.format(E.ingressi.tot[E.ingressi.tot.length - 1])}</div><div class="fl">ingressi in carcere dalla libertà nel ${E.ingressi.years[E.ingressi.years.length - 1]}; ${nf0.format(d3.max(E.ingressi.tot))} nel ${E.ingressi.years[E.ingressi.tot.indexOf(d3.max(E.ingressi.tot))]}.</div></div>`;

    // nel tempo
    const altS = Ye.map((_, i) => altOf(U, i)), sost = Ye.map((_, i) => (sostOf(U, i) ? sostOf(U, i) : null));
    $("#es-time-title").textContent = EN
      ? `Since ${y0} people in alternatives to prison have gone from ${nf0.format(alt0)} to ${nf0.format(alt)}`
      : `Dal ${y0} le persone in misura alternativa sono passate da ${nf0.format(alt0)} a ${nf0.format(alt)}`;
    $("#es-time-sub").textContent = EN ? `People on 31 December of each year, ${y0}–${last}` : `Persone al 31 dicembre di ogni anno, ${y0}–${last}`;
    seriesChart($("#es-time"), {
      years: Ye, label: EN ? `People in prison, in alternatives to prison, on probation before trial and in substitute sentences, ${y0}–${last}` : `Persone in carcere, in misura alternativa, in messa alla prova e in pena sostitutiva, ${y0}–${last}`, height: 260, yMin: 0, covid: true,
      series: [
        { name: L("in carcere", "in prison"), values: C, color: "var(--ink)", width: 2.5, at: 2015, dy: -10 },
        { name: L("misure alternative", "alternatives to prison"), values: altS, color: "var(--fall)", width: 2.5, at: 2015, dy: -10 },
        { name: L("messa alla prova", "probation before trial"), values: U.map, color: "var(--ink-2)", at: 2017, dy: 16, dyEnd: 16 },
        { name: L("pene sostitutive", "substitute sentences"), values: sost, color: "var(--muted)", at: 2023, dy: -10, dyEnd: 16 },
      ],
    });
    $("#es-time-note").textContent = EN
      ? `Alternatives to prison grew fastest after 2021: from ${nf0.format(altS[Ye.indexOf(2021)])} to ${nf0.format(alt)}, mostly probation (affidamento in prova), while the prison population also grew. Probation before trial took off after Law 67 of 2014 extended it to adults; substitute sentences exist since the Cartabia reform, in force from 30 December 2022.`
      : `Le misure alternative sono cresciute soprattutto dopo il 2021: da ${nf0.format(altS[Ye.indexOf(2021)])} a ${nf0.format(alt)}, soprattutto affidamenti in prova, mentre crescevano anche le persone in carcere. La messa alla prova è decollata dopo la legge 67 del 2014, che l’ha estesa agli adulti; le pene sostitutive ci sono dalla riforma Cartabia, in vigore dal 30 dicembre 2022.`;
    const I = E.ingressi, Li = I.years.length - 1;
    $("#es-ing-sub").textContent = EN ? `Entries into prison from freedom each year, ${I.years[0]}–${I.years[Li]}` : `Ingressi in carcere dalla libertà ogni anno, ${I.years[0]}–${I.years[Li]}`;
    seriesChart($("#es-ing"), {
      years: I.years, label: EN ? `Entries into prison from freedom, ${I.years[0]}–${I.years[Li]}` : `Ingressi in carcere dalla libertà, ${I.years[0]}–${I.years[Li]}`, height: 220, yMin: 0,
      xTicks: [1991, 2000, 2010, 2020, I.years[Li]],
      series: [
        { name: L("tutti", "everyone"), values: I.tot, color: "var(--ink)", width: 2.5, at: 1995, dy: -10 },
        { name: L("stranieri", "foreign nationals"), values: I.str, color: "var(--fall)", at: 1995, dy: 16, dyEnd: 16 },
      ],
    });
    $("#es-ing-note").textContent = EN
      ? `Entries from freedom are arrests and orders to serve a sentence. They halved between 2008 and 2015, the years of the European Court's Torreggiani judgment and of the laws on house arrest and short sentences, and have risen slowly since 2020.`
      : `Gli ingressi dalla libertà sono arresti e ordini di esecuzione di una pena. Si sono dimezzati tra il 2008 e il 2015, gli anni della sentenza Torreggiani della Corte europea e delle leggi su domiciliari e pene brevi, e risalgono piano dal 2020.`;
    renderEsRegions();
    renderEsSorv();
  }

  function renderEsRegions() {
    const E = ESEC, Ye = E.meta.years, iL = Ye.length - 1, last = E.meta.last, mode = state.esMode;
    const reg = E.regioni.map((r) => {
      const u = E.uepe.regioni[r.id], a = u ? altOf(u, iL) : null, p = E.carcere.regioni[r.id][iL];
      return { r, a, p, v: a == null ? null : mode === "pop" ? (1e5 * a) / r.pop : (100 * a) / p };
    }).filter((d) => d.v != null).sort((a, b) => b.v - a.v);
    const aIt = altOf(E.uepe.italia, iL), itv = mode === "pop" ? (1e5 * aIt) / d3.sum(E.regioni, (r) => r.pop) : (100 * aIt) / E.carcere.italia[iL];
    const fmt = (v) => nf0.format(Math.round(v));
    const T = mode === "pop"
      ? [L(`Persone in misura alternativa ogni 100.000 abitanti, fine ${last}`, `People in alternatives to prison per 100,000 residents, end of ${last}`), L("ogni 100.000 abitanti", "per 100,000 residents")]
      : [L(`Persone in misura alternativa ogni 100 persone detenute nella regione, fine ${last}`, `People in alternatives to prison per 100 people held in the region's prisons, end of ${last}`), L("ogni 100 persone detenute", "per 100 people in prison")];
    $("#es-reg-title").textContent = T[0];
    $("#es-reg-sub").textContent = EN
      ? `Region of the probation office; prisons by region where they are. The line is Italy (${fmt(itv)}).`
      : `Regione dell’ufficio di esecuzione penale esterna; le carceri per regione in cui si trovano. La linea è l’Italia (${fmt(itv)}).`;
    const tip = (d) => `<b>${esc(d.r.name)}</b><br>${fmt(d.v)} ${T[1]}<br><span class="small">${nf0.format(d.a)} ${L("in misura alternativa", "in alternatives")}, ${nf0.format(d.p)} ${L("in carcere", "in prison")}</span>`;
    barList($("#es-regions"), reg.map((d) => ({ name: d.r.name, v: d.v, title: tip(d).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() })), { max: reg[0].v * 1.02, ref: itv, fmt });
    if (has("es-reg-map")) provMap($("#es-reg-map"), $("#es-reg-legend"), new Map(reg.map((d) => [d.r.istat, { v: d.v, tip: tip(d) }])),
      { by: "reg", label: EN ? `Map of regions: ${T[0]}` : `Carta delle regioni: ${T[0]}`, legend: T[0], fmt });
    const hi = reg.slice(0, 2), lo = reg.slice(-2).reverse(), nm = (d) => `${d.r.name} (${fmt(d.v)})`;
    $("#es-reg-note").textContent = EN
      ? `Highest: ${hi.map(nm).join(" and ")}; lowest: ${lo.map(nm).join(" and ")}. ${mode === "pop" ? "More people in alternatives can mean more convictions as well as more use of alternatives." : "People in prison are counted where the prison is, and can come from other regions: the ratio is a rough comparison."} Someone supervised by more than one office counts in each region.`
      : `I valori più alti: ${hi.map(nm).join(" e ")}; i più bassi: ${lo.map(nm).join(" e ")}. ${mode === "pop" ? "Più persone in misura alternativa possono voler dire più condanne, oltre che un uso maggiore delle alternative." : "Le persone detenute si contano dove si trova il carcere e possono venire da altre regioni: il rapporto è un confronto di massima."} Chi è seguito da più uffici conta in ogni regione.`;
  }

  function renderEsSorv() {
    const E = ESEC, Ys = E.meta.sorv_years, iL = Ys.length - 1, S = E.sorveglianza.italia, c = S.concesse, rv = S.revocate;
    const totC = Ys.map((_, i) => c.affidamento[i] + c.domiciliare[i] + c.semiliberta[i]), totR = Ys.map((_, i) => rv.affidamento[i] + rv.domiciliare[i] + rv.semiliberta[i]);
    $("#es-sorv-sub").textContent = EN ? `Alternatives to prison granted and revoked by the supervision courts each year, ${Ys[0]}–${Ys[iL]}` : `Misure alternative concesse e revocate dai tribunali di sorveglianza ogni anno, ${Ys[0]}–${Ys[iL]}`;
    seriesChart($("#es-sorv"), {
      years: Ys, xTicks: Ys, label: EN ? `Alternatives to prison granted and revoked, ${Ys[0]}–${Ys[iL]}` : `Misure alternative concesse e revocate, ${Ys[0]}–${Ys[iL]}`, height: 230, yMin: 0,
      series: [
        { name: L("affidamenti concessi", "probation granted"), values: c.affidamento, color: "var(--fall)", width: 2.5, at: Ys[0], dy: -10 },
        { name: L("domiciliari concessi", "home detention granted"), values: c.domiciliare, color: "var(--ink-2)", at: Ys[0], dy: -10 },
        { name: L("revoche", "revoked"), values: totR, color: "var(--rise)", at: Ys[0], dy: 16, dyEnd: 16 },
      ],
      tip: (i) => `<b>${Ys[i]}</b><br>${EN ? `${nf0.format(totC[i])} granted: ${nf0.format(c.affidamento[i])} probation, ${nf0.format(c.domiciliare[i])} home detention, ${nf0.format(c.semiliberta[i])} semi-liberty<br>${nf0.format(totR[i])} revoked<br>${nf0.format(c.espulsione[i])} expulsions as an alternative sanction` : `${nf0.format(totC[i])} concesse: ${nf0.format(c.affidamento[i])} affidamenti, ${nf0.format(c.domiciliare[i])} domiciliari, ${nf0.format(c.semiliberta[i])} semilibertà<br>${nf0.format(totR[i])} revocate<br>${nf0.format(c.espulsione[i])} espulsioni come sanzione alternativa`}`,
    });
    $("#es-sorv-note").textContent = EN
      ? `In ${Ys[iL]} the supervision courts granted ${nf0.format(totC[iL])} alternatives to prison and revoked ${nf0.format(totR[iL])}, ${nf0.format((100 * totR[iL]) / totC[iL])} for every 100 granted: revocations concern measures granted in earlier years too, so they are not a failure rate. The supervision offices also ordered ${nf0.format(c.espulsione[iL])} expulsions of foreign nationals as an alternative to the last two years of a sentence. These are decisions, not people: the same person can receive more than one.`
      : `Nel ${Ys[iL]} i tribunali di sorveglianza hanno concesso ${nf0.format(totC[iL])} misure alternative e ne hanno revocate ${nf0.format(totR[iL])}, ${nf0.format((100 * totR[iL]) / totC[iL])} ogni 100 concesse: le revoche riguardano anche misure degli anni prima, quindi non sono una percentuale di fallimenti. Gli uffici di sorveglianza hanno disposto anche ${nf0.format(c.espulsione[iL])} espulsioni di persone straniere al posto degli ultimi due anni di pena. Sono provvedimenti, non persone: la stessa persona può riceverne più d’uno.`;
  }

  // ------------------------------------------------------------------ carcere per carcere (affollamento e morti negli istituti)

  async function loadIstituti() {
    try {
      const r = await fetch(ROOT + "data/istituti.json");
      if (!r.ok) throw new Error(r.status);
      IST = await r.json();
      addSources(IST.meta.sources, "istituti");
      if (has("ist-mode")) seg("#ist-mode", "imode", (v) => { state.istMode = v; renderIstMap(); });
      if (has("ist-sort")) seg("#ist-sort", "isort", (v) => { state.istSort = v; renderIstTable(); });
      if (has("ist-pick")) $("#ist-pick").addEventListener("change", (ev) => istSelect(ev.target.value));
      // un clic su una riga della classifica o sul nome nella tabella apre la scheda di quel carcere
      if (has("ist-rank")) $("#ist-rank").addEventListener("click", (ev) => { const li = ev.target.closest("li[data-id]"); if (li) istSelect(li.dataset.id, true); });
      if (has("ist-table")) $("#ist-table").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-id]"); if (b) istSelect(b.dataset.id, true); });
      if (has("ist-facts")) renderIstituti();
      renderDeepCards();
    } catch (e) {
      if (has("ist-facts")) $("#ist-facts").innerHTML = `<p class="note">${L("I dati sulle carceri non si sono caricati", "The data on prisons did not load")} (${esc(e.message)}).</p>`;
      console.error(e);
    }
  }

  // La capienza di un istituto nel mese di indice i: cambia di rado, e nel file c'è solo quando cambia ([indice, posti]).
  const istCap = (x, i) => { let c = null; for (const [j, v] of x.cap) { if (j > i) break; c = v; } return c; };
  // il tipo nel mese i: Arienzo e Sanremo l'hanno cambiato, e x.tipi dice da quando
  const istTipo = (x, i) => { if (!x.tipi) return x.tipo; let t = x.tipi[0][1]; for (const [j, v] of x.tipi) { if (j > i) break; t = v; } return t; };
  // date: «2026-09» è la fine di settembre; nei testi «30 settembre 2026» o «settembre 2026»
  const monthEnd = (k) => new Date(+k.slice(0, 4), +k.slice(5, 7), 0);
  const isoDate = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const dayLong = (d) => d.toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" });
  const monthLong = (k) => monthEnd(k).toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
  // «il 30 settembre», ma «l’8 agosto» e «l’11 luglio»
  const dayArt = (d) => (EN ? dayLong(d) : (/^(8|11)\b/.test(String(d.getDate())) ? "l’" : "il ") + dayLong(d));
  const TIPO_IT = { CC: "casa circondariale", CCF: "casa circondariale femminile", CR: "casa di reclusione", CRF: "casa di reclusione femminile", CL: "casa lavoro", IP: "casa circondariale e di reclusione", ICAM: "istituto a custodia attenuata per detenute madri" };
  const TIPO_EN = { CC: "remand prison (casa circondariale)", CCF: "women’s remand prison", CR: "prison for sentenced people (casa di reclusione)", CRF: "women’s prison for sentenced people", CL: "work house (casa lavoro)", IP: "remand and sentenced prison", ICAM: "low-security unit for mothers with children" };
  const tipoName = (t) => (EN ? TIPO_EN : TIPO_IT)[t] || t;
  // il confronto tra tipi: case circondariali (anche femminili) e case di reclusione; casa lavoro, Reggio Emilia e Lauro a parte
  const TIPO_GRP = { CC: "cc", CCF: "cc", CR: "cr", CRF: "cr" };

  // Persone ogni 100 posti: sui posti regolamentari dell'ultimo mese (Ministero) o sui posti disponibili del Garante,
  // con le persone contate dal Garante lo stesso giorno, così numeratore e denominatore sono della stessa rilevazione.
  function istRatio(x, mode) {
    const iL = IST.meta.months.length - 1;
    if (mode === "disp") return x.posti ? (100 * x.pres_g) / x.posti : null;
    const c = istCap(x, iL), p = x.pres[iL];
    return p && c ? (100 * p) / c : null;
  }
  // blu sotto i posti, grigio a 100, rosso sopra, pieno a 200 persone ogni 100 posti
  function crowdColor(v) {
    if (v == null) return css("--land");
    return v <= 100 ? d3.interpolateLab(css("--fall"), css("--mid"))(Math.max(0, (v - 40) / 60)) : d3.interpolateLab(css("--mid"), css("--rise"))(Math.min(1, (v - 100) / 100));
  }
  const istAlive = (x, i) => x.pres[i] != null && x.pres[i] > 0;

  // Una serie al mese (indici di IST.meta.months), con eventuali punti in date sparse (i rilievi del Garante).
  // o = { months, series: [{ name, values, color, width, dash, at, dy, dyEnd }], points: { name, color, list: [[data ISO, valore]] },
  //       gap, ref, yMin, yMax, fmt, yFmt, tip(i), label, height }
  function monthChart(el, o) {
    const M = o.months, n = M.length, fmt = o.fmt || ((v) => nf0.format(v));
    const w = Math.max(280, el.clientWidth), h = o.height || (w < 480 ? 220 : 270);
    const m = { t: 18, r: 18, b: 24, l: o.ml || 52 };
    const t = (k) => +k.slice(0, 4) + (+k.slice(5, 7) - 0.5) / 12;
    const td = (s) => +s.slice(0, 4) + (+s.slice(5, 7) - 1 + (+s.slice(8, 10) - 0.5) / 31) / 12;
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", o.label || "");
    svg.selectAll("*").remove();
    const x = d3.scaleLinear([t(M[0]) - 0.5 / 12, t(M[n - 1]) + 0.04], [m.l, w - m.r]);
    const pts = o.points ? o.points.list : [];
    const all = o.series.flatMap((s) => s.values).concat(pts.map((p) => p[1])).filter((v) => v != null);
    const y = d3.scaleLinear([o.yMin ?? d3.min(all) * 0.92, o.yMax ?? d3.max(all) * 1.05], [h - m.b, m.t]).nice(4);
    // la primavera del 2020: le uscite dal carcere per l'epidemia
    if (M.includes("2020-03")) {
      svg.append("rect").attr("x", x(2020.17)).attr("width", x(2020.5) - x(2020.17)).attr("y", m.t).attr("height", h - m.t - m.b).style("fill", "var(--covid)");
      svg.append("text").attr("class", "lbl").attr("x", x(2020.33)).attr("y", m.t + 10).attr("text-anchor", "middle").text("Covid");
    }
    const ya = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(-(w - m.l - m.r)).tickFormat((v) => (o.yFmt ? o.yFmt(v) : nf0.format(v))));
    ya.select(".domain").remove();
    ya.selectAll(".tick line").style("stroke", "var(--grid)");
    const years = d3.range(+M[0].slice(0, 4), +M[n - 1].slice(0, 4) + 1).filter((yy) => x(yy) >= m.l && (w > 480 || yy % 2 === 1 || yy === +M[n - 1].slice(0, 4)));
    const xa = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`)
      .call(d3.axisBottom(x).tickValues(years).tickFormat(d3.format("d")).tickSize(4));
    xa.select(".domain").style("stroke", "var(--rule)");
    if (o.ref != null) svg.append("line").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y(o.ref)).attr("y2", y(o.ref)).style("stroke", "var(--ink-2)").style("stroke-dasharray", "2 3");
    const line = d3.line().defined((v) => v != null).x((_, i) => x(t(M[i]))).y((v) => y(v));
    if (o.gap) {
      const [a, b] = o.series;
      svg.append("path").attr("class", "area rv-fade")
        .attr("d", d3.area().defined((_, i) => a.values[i] != null && b.values[i] != null && a.values[i] > b.values[i]).x((_, i) => x(t(M[i]))).y0((_, i) => y(b.values[i])).y1((_, i) => y(a.values[i]))(M))
        .style("fill", "var(--rise)").style("fill-opacity", 0.12);
    }
    o.series.forEach((s, k) => {
      svg.append("path").attr("class", s.dash ? "rv-fade" : "rv-draw").attr("pathLength", s.dash ? null : 1).style("--t0", `${k * 0.15}s`).attr("d", line(s.values))
        .style("fill", "none").style("stroke", s.color).style("stroke-width", s.width || 2).style("stroke-dasharray", s.dash || null)
        .style("stroke-linejoin", "round").style("stroke-linecap", "round");
    });
    if (pts.length) {
      svg.append("path").attr("class", "rv-fade").attr("d", d3.line().x((p) => x(td(p[0]))).y((p) => y(p[1]))(pts))
        .style("fill", "none").style("stroke", o.points.color).style("stroke-width", 1.25).style("stroke-dasharray", "3 3");
      svg.append("g").selectAll("circle").data(pts).join("circle").attr("class", "rv-pop").attr("cx", (p) => x(td(p[0]))).attr("cy", (p) => y(p[1])).attr("r", 2.8)
        .style("fill", "var(--surface)").style("stroke", o.points.color).style("stroke-width", 1.5);
    }
    // etichette dopo le linee, con l'alone che le stacca
    const label = (name, color, xi, yv, dy, anchor) => svg.append("text").attr("class", "lbl halo mark rv-fade").attr("x", xi).attr("y", y(yv) + dy).attr("text-anchor", anchor || "start").style("fill", color).text(name);
    o.series.forEach((s) => {
      const idx = s.values.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) return;
      const iL = idx[idx.length - 1], iA = s.at != null ? M.indexOf(s.at) : idx[0];
      svg.append("circle").attr("class", "mark rv-pop").attr("cx", x(t(M[iL]))).attr("cy", y(s.values[iL])).attr("r", 4).style("fill", s.color).style("stroke", "var(--surface)").style("stroke-width", 2);
      svg.append("text").attr("class", "lbl-strong halo mark rv-fade").attr("x", x(t(M[iL])) - 6).attr("y", y(s.values[iL]) + (s.dyEnd ?? -10)).attr("text-anchor", "end").text(fmt(s.values[iL]));
      if (s.name && iA >= 0 && s.values[iA] != null) label(s.name, s.color, x(t(M[iA])) + 4, s.values[iA], s.dy ?? -10);
    });
    if (pts.length && o.points.name) {
      const p = pts[o.points.at ?? 0];
      label(o.points.name, o.points.color, x(td(p[0])) + 4, p[1], o.points.dy ?? 16);
    }
    const guide = svg.append("line").attr("y1", m.t).attr("y2", h - m.b).style("stroke", "var(--rule)").style("display", "none");
    const dots = o.series.map((s) => svg.append("circle").attr("r", 4).style("fill", s.color).style("stroke", "var(--surface)").style("stroke-width", 2).style("display", "none"));
    const off = () => { guide.style("display", "none"); dots.forEach((d) => d.style("display", "none")); hideTip(); };
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", w - m.l - m.r).attr("height", h - m.t - m.b).style("fill", "transparent")
      .on("mousemove", (ev) => {
        const v0 = x.invert(d3.pointer(ev)[0]);
        const i = Math.max(0, Math.min(n - 1, Math.round((v0 - t(M[0])) * 12)));
        if (o.series.every((s) => s.values[i] == null)) { off(); return; }
        guide.style("display", null).attr("x1", x(t(M[i]))).attr("x2", x(t(M[i])));
        o.series.forEach((s, k) => { const v = s.values[i]; dots[k].style("display", v == null ? "none" : null).attr("cx", x(t(M[i]))).attr("cy", v == null ? 0 : y(v)); });
        showTip(o.tip(i), ev);
      })
      .on("mouseleave", off);
    reveal(el);
  }

  function renderIstituti() {
    const D = IST, M = D.meta.months, iL = M.length - 1, I = D.italia, last = M[iL];
    const end = monthEnd(last), pres = I.pres[iL], cap = I.cap[iL];
    const G = D.posti[D.posti.length - 1], gDay = isoDate(G[0]);
    const rReg = (100 * pres) / cap, rDisp = (100 * G[1]) / G[2];
    const live = D.istituti.filter((x) => istAlive(x, iL));
    const over = live.filter((x) => x.pres[iL] > istCap(x, iL)), over150 = live.filter((x) => x.pres[iL] >= 1.5 * istCap(x, iL));
    if (!state.istSel) state.istSel = live.slice().sort((a, b) => istRatio(b, "reg") - istRatio(a, "reg"))[0].id;

    $("#ist-lead").textContent = EN ? `${nf0.format(pres)} people for ${nf0.format(cap)} places` : `${nf0.format(pres)} persone per ${nf0.format(cap)} posti`;
    $("#ist-lead-sub").textContent = EN
      ? `On ${dayLong(end)}, Italy’s ${live.length} adult prisons in use held ${nf0.format(Math.round(rReg))} people for every 100 official places. On the places that can actually be used, counted by the National Guarantor: ${nf0.format(Math.round(rDisp))} for every 100 on ${dayLong(gDay)}.`
      : `${dayArt(end).charAt(0).toUpperCase() + dayArt(end).slice(1)} nelle ${live.length} carceri per adulti in funzione c’erano ${nf0.format(Math.round(rReg))} persone ogni 100 posti regolamentari. Sui posti davvero utilizzabili, contati dal Garante nazionale, ${nf0.format(Math.round(rDisp))} ogni 100 ${dayArt(gDay)}.`;

    // due barre sulla stessa scala: posti e persone, la parte oltre i posti in rosso
    const mx = Math.max(pres, G[1]);
    const bar = (lab, when, places, people) => `<div class="ist-bar">
        <div class="ist-bar-h"><b>${lab}</b><span>${when}</span></div>
        <div class="ist-track" role="img" aria-label="${esc(EN ? `${nf0.format(people)} people for ${nf0.format(places)} places` : `${nf0.format(people)} persone per ${nf0.format(places)} posti`)}"><i class="pl rv-grow" style="width:${(100 * places) / mx}%"></i><i class="ov rv-grow" style="left:${(100 * places) / mx}%;width:${(100 * (people - places)) / mx}%"></i></div>
        <div class="ist-bar-k"><span>${EN ? `${nf0.format(places)} places` : `${nf0.format(places)} posti`}</span><span class="ov">${EN ? `+${nf0.format(people - places)} people over` : `+${nf0.format(people - places)} persone in più`}</span></div>
      </div>`;
    $("#ist-bars").innerHTML = bar(L("Posti regolamentari", "Official places"), EN ? `Ministry of Justice, ${dayLong(end)}` : `Ministero della Giustizia, ${dayLong(end)}`, cap, pres)
      + bar(L("Posti davvero disponibili", "Places actually available"), EN ? `National Guarantor, ${dayLong(gDay)}` : `Garante nazionale, ${dayLong(gDay)}`, G[2], G[1]);
    reveal($("#ist-bars"), $("#ist-bars").querySelectorAll(".ist-bar"));

    const iMin = d3.minIndex(I.pres), dCap = cap - I.cap[iMin];
    const [, a25, , , t25] = D.morti_totale_testo, Gs = D.garante, yG = Gs.anni[Gs.anni.length - 1];
    const record = Gs.totale.slice(0, -1).every((v) => v < t25);
    const E = D.eventi, iE = E.anni.indexOf(yG), Ri = D.ristretti.anni.indexOf(yG), Ai = D.antigone.anni.indexOf(yG);
    // tre conteggi sulle carceri per adulti; Antigone conta anche REMS e istituti per minorenni, quindi a parte
    const counts = [E.suicidi[iE], Gs.suicidi[Gs.anni.length - 1], D.ristretti.suicidi[Ri]].filter((v) => v != null), ant = Ai >= 0 ? D.antigone.suicidi[Ai] : null;
    const lg = Gs.anni.length - 1;
    // il «record» va letto con due numeri accanto: le morti con la causa da accertare dell'anno prima, e il conteggio
    // del Ministero (suicidi più cause naturali) negli stessi due anni
    const accPrev = lg > 0 ? Gs.accertare[lg - 1] : null, mNow = iE >= 0 ? E.suicidi[iE] + E.naturali[iE] : null, mPrev = iE > 0 ? E.suicidi[iE - 1] + E.naturali[iE - 1] : null;
    $("#ist-facts").innerHTML = EN ? `
      <div class="fact"><div class="fv">${over.length}<small> of ${live.length}</small></div><div class="fl">prisons held more people than official places at the end of ${monthLong(last)}; in ${over150.length}, one and a half times as many or more.</div></div>
      <div class="fact"><div class="fv">+${nf0.format(pres - I.pres[iMin])}</div><div class="fl">more people in prison than in ${monthLong(M[iMin])}, the low point since ${M[0].slice(0, 4)}. Official places: ${dCap >= 0 ? "+" : "−"}${nf0.format(Math.abs(dCap))}.</div></div>
      <div class="fact"><div class="fv">${nf0.format(t25)}</div><div class="fl">deaths recorded by the prison administration in ${yG}${record ? `, the most since ${Gs.anni[0]}` : ""}. ${a25} of them still have no established cause${accPrev != null ? ` (${accPrev} in ${Gs.anni[lg - 1]})` : ""}${mNow != null && mPrev != null ? `, and in the Ministry’s series suicides and natural deaths went from ${mPrev} to ${mNow}` : ""}.</div></div>
      <div class="fact"><div class="fv">${d3.min(counts)}–${d3.max(counts)}</div><div class="fl">suicides in adult prisons in ${yG}, depending on who counts them (Ministry, Guarantor, Ristretti Orizzonti)${ant != null ? `. Antigone, which adds REMS and juvenile institutions, counts ${ant}` : ""}.</div></div>` : `
      <div class="fact"><div class="fv">${over.length}<small> su ${live.length}</small></div><div class="fl">carceri avevano più persone che posti regolamentari a fine ${monthLong(last)}; in ${over150.length}, una volta e mezzo o più.</div></div>
      <div class="fact"><div class="fv">+${nf0.format(pres - I.pres[iMin])}</div><div class="fl">persone detenute in più rispetto a ${monthLong(M[iMin])}, il minimo dal ${M[0].slice(0, 4)}. I posti regolamentari: ${dCap >= 0 ? "+" : "−"}${nf0.format(Math.abs(dCap))}.</div></div>
      <div class="fact"><div class="fv">${nf0.format(t25)}</div><div class="fl">morti registrate dall’amministrazione penitenziaria nel ${yG}${record ? `, il numero più alto dal ${Gs.anni[0]}` : ""}. Per ${a25} la causa è ancora da accertare${accPrev != null ? ` (${accPrev} nel ${Gs.anni[lg - 1]})` : ""}${mNow != null && mPrev != null ? `, e nella serie del Ministero suicidi e morti naturali sono passati da ${mPrev} a ${mNow}` : ""}.</div></div>
      <div class="fact"><div class="fv">${d3.min(counts)}–${d3.max(counts)}</div><div class="fl">suicidi nelle carceri per adulti nel ${yG}, a seconda di chi li conta (Ministero, Garante, Ristretti Orizzonti)${ant != null ? `. Antigone, che aggiunge REMS e istituti per minorenni, ne conta ${ant}` : ""}.</div></div>`;

    renderIstTime();
    renderIstMap();
    renderIstCard();
    renderIstTable();
    renderIstTypes();
    renderIstDeaths();
  }

  function renderIstTime() {
    const D = IST, M = D.meta.months, iL = M.length - 1, I = D.italia;
    const r = (i) => (100 * I.pres[i]) / I.cap[i];
    const pts = D.posti.filter((p) => p[0] >= M[0]);
    $("#ist-time-title").textContent = EN
      ? `From ${nf0.format(Math.round(r(0)))} to ${nf0.format(Math.round(r(iL)))} people for every 100 official places`
      : `Da ${nf0.format(Math.round(r(0)))} a ${nf0.format(Math.round(r(iL)))} persone ogni 100 posti regolamentari`;
    $("#ist-time-sub").textContent = EN
      ? `Adult prisons, last day of each month, ${monthLong(M[0])} to ${monthLong(M[iL])}. Circles: places actually available, counted by the National Guarantor on the dates of its reports.`
      : `Carceri per adulti, ultimo giorno di ogni mese, da ${monthLong(M[0])} a ${monthLong(M[iL])}. I cerchi: i posti davvero disponibili, contati dal Garante nazionale nei giorni dei suoi report.`;
    monthChart($("#ist-time"), {
      months: M, label: L("Persone detenute, posti regolamentari e posti disponibili, a fine mese", "People in prison, official places and available places, end of each month"),
      gap: true, yMin: 44000,
      series: [
        { name: L("persone detenute", "people in prison"), values: I.pres, color: "var(--rise)", width: 2.5, at: "2019-04", dy: -10 },
        { name: L("posti regolamentari", "official places"), values: I.cap, color: "var(--ink)", at: "2021-06", dy: -8, dyEnd: 16 },
      ],
      points: { name: L("posti disponibili", "available places"), color: "var(--fall)", list: pts.map((p) => [p[0], p[2]]), at: 4, dy: 16 },
      tip: (i) => {
        const p = pts.filter((q) => q[0].slice(0, 7) === M[i]).pop();
        return EN
          ? `<b>${monthLong(M[i])}</b><br>${nf0.format(I.pres[i])} people<br>${nf0.format(I.cap[i])} official places (${nf0.format(Math.round(r(i)))} people per 100)${p ? `<br>${nf0.format(p[2])} available places on ${dayLong(isoDate(p[0]))}` : ""}`
          : `<b>${monthLong(M[i])}</b><br>${nf0.format(I.pres[i])} persone<br>${nf0.format(I.cap[i])} posti regolamentari (${nf0.format(Math.round(r(i)))} persone ogni 100)${p ? `<br>${nf0.format(p[2])} posti disponibili al ${dayLong(isoDate(p[0]))}` : ""}`;
      },
    });
    const iFeb = M.indexOf("2020-02"), iMin = d3.minIndex(I.pres), i20 = d3.minIndex(I.pres, (v, i) => (M[i] >= "2020-03" && M[i] <= "2020-06" ? v : Infinity)), p0 = pts[0], pL = pts[pts.length - 1];
    $("#ist-time-note").textContent = EN
      ? `During the epidemic, in spring 2020, the number of people in prison fell from ${nf0.format(I.pres[iFeb])} at the end of February to ${nf0.format(I.pres[i20])} at the end of ${monthLong(M[i20]).replace(/ \d{4}$/, "")}, and stayed around that level until ${monthLong(M[iMin])} (${nf0.format(I.pres[iMin])}). Since then it has grown again, to ${nf0.format(I.pres[iL])}. Official places have stayed between ${nf0.format(d3.min(I.cap))} and ${nf0.format(d3.max(I.cap))}; the places that can actually be used, according to the Guarantor, were ${nf0.format(p0[2])} in ${monthLong(p0[0].slice(0, 7))} and ${nf0.format(pL[2])} in ${monthLong(pL[0].slice(0, 7))}. The gap is cells and wings closed for works or unfit for use.`
      : `Con l’epidemia, nella primavera del 2020, le persone detenute scesero da ${nf0.format(I.pres[iFeb])} a fine febbraio a ${nf0.format(I.pres[i20])} a fine ${monthLong(M[i20]).replace(/ \d{4}$/, "")}, e restarono intorno a quel livello fino a ${monthLong(M[iMin])} (${nf0.format(I.pres[iMin])}). Da allora sono tornate a crescere, fino a ${nf0.format(I.pres[iL])}. I posti regolamentari sono rimasti tra ${nf0.format(d3.min(I.cap))} e ${nf0.format(d3.max(I.cap))}; quelli davvero utilizzabili, secondo il Garante, erano ${nf0.format(p0[2])} a ${monthLong(p0[0].slice(0, 7))} e ${nf0.format(pL[2])} a ${monthLong(pL[0].slice(0, 7))}. La differenza sono celle e sezioni chiuse per lavori o inagibili.`;
  }

  function istTipText(x) {
    const iL = IST.meta.months.length - 1, c = istCap(x, iL), p = x.pres[iL], rr = istRatio(x, "reg"), rd = istRatio(x, "disp");
    const last = IST.meta.months[iL], gd = isoDate(IST.meta.garante);
    return EN
      ? `<b>${esc(x.nome)}</b><br><span class="small">${esc(tipoName(x.tipo))}, ${esc(x.reg)}</span><br>${nf0.format(p)} people for ${nf0.format(c)} official places${rr != null ? ` (${nf0.format(Math.round(rr))} per 100)` : ""}, end of ${monthLong(last)}${rd != null ? `<br>${nf0.format(Math.round(rd))} per 100 available places, ${dayLong(gd)}` : ""}`
      : `<b>${esc(x.nome)}</b><br><span class="small">${esc(tipoName(x.tipo))}, ${esc(x.reg)}</span><br>${nf0.format(p)} persone per ${nf0.format(c)} posti regolamentari${rr != null ? ` (${nf0.format(Math.round(rr))} ogni 100)` : ""}, fine ${monthLong(last)}${rd != null ? `<br>${nf0.format(Math.round(rd))} ogni 100 posti disponibili, ${dayLong(gd)}` : ""}`;
  }

  function renderIstMap() {
    const D = IST, M = D.meta.months, iL = M.length - 1, mode = state.istMode, last = M[iL], gd = isoDate(D.meta.garante);
    const I = D.italia, G = D.posti[D.posti.length - 1];
    const itv = mode === "disp" ? (100 * G[1]) / G[2] : (100 * I.pres[iL]) / I.cap[iL];
    $("#ist-map-title").textContent = mode === "disp"
      ? L(`Persone ogni 100 posti davvero disponibili, ${dayLong(gd)}`, `People per 100 places actually available, ${dayLong(gd)}`)
      : L(`Persone ogni 100 posti regolamentari, fine ${monthLong(last)}`, `People per 100 official places, end of ${monthLong(last)}`);
    $("#ist-map-sub").textContent = mode === "disp"
      ? L(`Posti e persone contati dal Garante nazionale sui dati dell’amministrazione penitenziaria. In Italia, ${nf0.format(Math.round(itv))}.`, `Places and people counted by the National Guarantor from prison administration data. Italy: ${nf0.format(Math.round(itv))}.`)
      : L(`Ministero della Giustizia. In Italia, ${nf0.format(Math.round(itv))}.`, `Ministry of Justice. Italy: ${nf0.format(Math.round(itv))}.`);
    const rows = D.istituti.filter((x) => istAlive(x, iL)).map((x) => ({ x, v: istRatio(x, mode), n: mode === "disp" && x.pres_g != null ? x.pres_g : x.pres[iL] }));

    // la carta: regioni sullo sfondo, un cerchio per carcere grande quanto le persone, colorato per affollamento
    const el = $("#ist-map"), w = Math.max(260, el.clientWidth), h = Math.round(w * 1.18);
    const { obj, land } = provShapes("reg");
    const proj = d3.geoConicConformal().parallels([38, 46]).rotate([-12.5, 0]).fitExtent([[6, 6], [w - 6, h - 6]], land);
    const path = d3.geoPath(proj);
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", $("#ist-map-title").textContent);
    svg.selectAll("*").remove();
    svg.append("path").attr("class", "ist-land").attr("d", path(land));
    svg.append("path").attr("class", "ist-regs").attr("d", path(topojson.mesh(TOPO, obj, (a, b) => a !== b && a.properties.reg_istat_code !== b.properties.reg_istat_code)));
    svg.append("path").attr("class", "coast").attr("d", path(topojson.mesh(TOPO, obj, (a, b) => a === b)));
    const rad = d3.scaleSqrt([0, d3.max(rows, (d) => d.n)], [0, Math.max(10, w / 30)]);
    // le carceri dello stesso comune (Roma, Napoli, Firenze…) in cerchio attorno al suo punto
    const byPt = d3.group(rows.filter((d) => d.x.pt), (d) => d.x.pt.join(","));
    const placed = [];
    byPt.forEach((g) => {
      const [px, py] = proj(g[0].x.pt), k = g.length, ring = k > 1 ? d3.max(g, (d) => rad(d.n)) * 0.9 + 1.5 : 0;
      g.forEach((d, j) => placed.push({ ...d, cx: px + ring * Math.cos((2 * Math.PI * j) / k - Math.PI / 2), cy: py + ring * Math.sin((2 * Math.PI * j) / k - Math.PI / 2) }));
    });
    placed.sort((a, b) => b.n - a.n);
    svg.append("g").selectAll("circle").data(placed).join("circle")
      .attr("class", (d) => `ist-dot rv-pop${d.x.id === state.istSel ? " sel" : ""}`).attr("data-id", (d) => d.x.id)
      .attr("cx", (d) => d.cx).attr("cy", (d) => d.cy).attr("r", (d) => Math.max(2, rad(d.n)))
      .style("fill", (d) => crowdColor(d.v))
      .on("mousemove", (ev, d) => showTip(istTipText(d.x), ev))
      .on("mouseleave", hideTip)
      .on("click", (ev, d) => istSelect(d.x.id));
    reveal(el);
    const stops = d3.range(50, 201, 10).map((v) => `${crowdColor(v)} ${(100 * (v - 50)) / 150}%`).join(", ");
    $("#ist-legend").innerHTML = `<div class="lg"><div class="lg-t">${L("Persone ogni 100 posti", "People per 100 places")}</div><div class="lg-bar" style="background:linear-gradient(to right, ${stops})"></div><div class="lg-ticks"><span>50</span><span>100</span><span>150</span><span>200+</span></div></div>`;

    // i più affollati, con un asterisco quelli piccoli
    const top = rows.filter((d) => d.v != null).sort((a, b) => b.v - a.v).slice(0, 12);
    // con i posti del Garante, † sulle carceri i cui posti sono ricavati dal tasso (nel report la colonna ripete le persone)
    const rebuilt = (x) => mode === "disp" && x.posti_dal_tasso;
    barList($("#ist-rank"), top.map((d) => ({ name: d.x.nome + (rebuilt(d.x) ? " †" : ""), v: d.v, few: d.n < 100, title: istTipText(d.x).replace(/<br>/g, " · ").replace(/<[^>]+>/g, "") })), { max: top[0].v * 1.02, ref: itv, fmt: (v) => nf0.format(v) });
    $("#ist-rank").querySelectorAll("li").forEach((li, j) => { li.dataset.id = top[j].x.id; });
    const empty = D.istituti.filter((x) => x.pres[iL] != null && !istAlive(x, iL)), abroad = D.istituti.filter((x) => istAlive(x, iL) && !x.pt);
    const noG = rows.filter((d) => d.v == null).map((d) => d.x.nome);
    const daggerNote = top.some((d) => rebuilt(d.x)) ? L(" † Posti ricavati dal tasso di sovraffollamento del Garante: nel suo report, per queste carceri, la colonna dei posti ripete il numero delle persone.", " † Places derived from the Guarantor’s crowding rate: in its report, for these prisons, the places column repeats the number of people.") : "";
    $("#ist-map-note").textContent = (EN
      ? `The ${top.length} most crowded prisons; the line is Italy. An asterisk marks prisons with fewer than 100 people, where a few arrivals change the figure a lot. The figure is for the whole prison: some wings can be far more crowded than others.`
      : `Le ${top.length} carceri più affollate; la linea è l’Italia. L’asterisco segna le carceri con meno di 100 persone, dove pochi ingressi cambiano molto il dato. Il dato è dell’intero istituto: alcune sezioni possono essere molto più piene di altre.`)
      + (empty.length ? (EN ? ` Not shown: ${empty.map((x) => x.nome).join(" and ")}, with nobody held at the end of ${monthLong(last)}.` : ` Mancano ${empty.map((x) => x.nome).join(" e ")}, dove a fine ${monthLong(last)} non c’era nessuno.`) : "")
      + (abroad.length ? L(` ${abroad.map((x) => x.nome).join(", ")} non è sulla carta.`, ` ${abroad.map((x) => x.nome).join(", ")} is not on the map.`) : "")
      + (mode === "disp" && noG.length ? L(` Senza i posti del Garante: ${noG.join(", ")}.`, ` No Guarantor figures for: ${noG.join(", ")}.`) : "") + daggerNote;

    // l'elenco per scegliere un carcere, per regione
    const pick = $("#ist-pick");
    if (!pick.options.length) {
      const all = D.istituti.filter((x) => x.pres[iL] != null);
      pick.innerHTML = Array.from(d3.group(all, (x) => x.reg)).sort((a, b) => a[0].localeCompare(b[0], LOCALE))
        .map(([reg, xs]) => `<optgroup label="${esc(reg)}">${xs.slice().sort((a, b) => a.nome.localeCompare(b.nome, LOCALE)).map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`).join("")}</optgroup>`).join("");
    }
    pick.value = state.istSel;
  }

  function istSelect(id, scroll) {
    state.istSel = id;
    d3.selectAll("#ist-map .ist-dot").classed("sel", function () { return this.dataset.id === id; });
    renderIstCard();
    if (scroll) $("#ist-card").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function renderIstCard() {
    const D = IST, M = D.meta.months, iL = M.length - 1, last = M[iL], x = D.istituti.find((d) => d.id === state.istSel);
    if (!x) return;
    if (has("ist-pick")) $("#ist-pick").value = x.id;
    const c = istCap(x, iL), p = x.pres[iL], rr = istRatio(x, "reg"), rd = istRatio(x, "disp"), gd = isoDate(D.meta.garante);
    const m = x.m25, dead = m ? d3.sum(m) : 0, y25 = D.garante.anni[D.garante.anni.length - 1];
    const parts = m ? [[m[0], L("suicidi", "suicides"), L("suicidio", "suicide")], [m[2], L("per cause naturali", "from natural causes"), L("per cause naturali", "from natural causes")],
      [m[1], L("con la causa da accertare", "with the cause to be established"), L("con la causa da accertare", "with the cause to be established")], [m[3], L("per incidente", "accidental"), L("per incidente", "accidental")]]
      .filter((q) => q[0]).map((q) => `${q[0]} ${q[0] === 1 ? q[2] : q[1]}`) : [];
    const deaths = !m
      ? L(`Nel ${y25} l’amministrazione penitenziaria non vi ha registrato morti.`, `In ${y25} the prison administration recorded no deaths here.`)
      : EN ? `In ${y25} the prison administration recorded ${dead === 1 ? "one death" : `${dead} deaths`} here: ${parts.join(", ")}.`
        : `Nel ${y25} l’amministrazione penitenziaria vi ha registrato la morte di ${dead === 1 ? "una persona" : `${dead} persone`}: ${parts.join(", ")}.`;
    const s24 = x.s24 ? L(` Nel 2024, fino al 20 dicembre, ${x.s24 === 1 ? "un suicidio" : `${x.s24} suicidi`}.`, ` In 2024, up to 20 December, ${x.s24 === 1 ? "one suicide" : `${x.s24} suicides`}.`) : "";
    const fact = (v, l) => `<div class="fact"><div class="fv">${v}</div><div class="fl">${l}</div></div>`;
    $("#ist-card").innerHTML = `
      <h3 class="ist-name">${esc(x.nome)}</h3>
      <p class="ist-meta">${esc(tipoName(x.tipo))} · ${x.comune ? esc(x.comune) + ", " : ""}${esc(x.reg)}</p>
      <div class="facts">${fact(nf0.format(p), EN ? `people, end of ${monthLong(last)}` : `persone, fine ${monthLong(last)}`)}${fact(rr != null ? nf0.format(Math.round(rr)) : "–", EN ? `per 100 official places (${nf0.format(c)})` : `ogni 100 posti regolamentari (${nf0.format(c)})`)}${fact(rd != null ? nf0.format(Math.round(rd)) : "–", EN ? `per 100 available places (${x.posti != null ? nf0.format(x.posti) : "n/a"}), ${dayLong(gd)}` : `ogni 100 posti disponibili (${x.posti != null ? nf0.format(x.posti) : "n.d."}), ${dayLong(gd)}`)}${fact(nf0.format(dead), EN ? `${dead === 1 ? "death" : "deaths"} recorded in ${y25}` : `${dead === 1 ? "morte registrata" : "morti registrate"} nel ${y25}`)}</div>
      <div class="ist-spark" aria-hidden="true"><svg></svg><span class="small">${EN ? `People (red) and official places (black), end of each month since ${monthLong(M[0])}` : `Persone (rosso) e posti regolamentari (nero), a fine mese da ${monthLong(M[0])}`}</span></div>
      <p class="ist-txt">${p ? (EN ? `At the end of ${monthLong(last)}: ${x.donne ? `${nf0.format(x.donne)} women, ` : ""}${nf0.format(x.str)} foreign nationals. ` : `A fine ${monthLong(last)}: ${x.donne ? `${nf0.format(x.donne)} donne, ` : ""}${nf0.format(x.str)} persone straniere. `) : ""}${deaths}${s24}</p>
      <p class="small">${L("Nome nelle tabelle del Ministero", "Name in the Ministry tables")}: ${esc(x.ufficiale)}</p>`;
    // la serie del carcere: persone e posti a fine mese
    const sv = $("#ist-card .ist-spark svg"), w = Math.max(200, sv.parentNode.clientWidth), h = 64, pad = { t: 6, r: 4, b: 4, l: 2 };
    const caps = M.map((_, i) => (x.pres[i] != null ? istCap(x, i) : null));
    const xs = d3.scaleLinear([0, M.length - 1], [pad.l, w - pad.r]), ys = d3.scaleLinear([0, d3.max(x.pres.concat(caps)) || 1], [h - pad.b, pad.t]);
    const s = d3.select(sv).attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h);
    s.selectAll("*").remove();
    s.append("line").attr("x1", pad.l).attr("x2", w - pad.r).attr("y1", ys(0)).attr("y2", ys(0)).style("stroke", "var(--rule)");
    s.append("path").attr("d", d3.line().defined((v) => v != null).curve(d3.curveStepAfter).x((_, i) => xs(i)).y((v) => ys(v))(caps)).style("fill", "none").style("stroke", "var(--ink)").style("stroke-width", 1.25);
    s.append("path").attr("d", d3.line().defined((v) => v != null).x((_, i) => xs(i)).y((v) => ys(v))(x.pres)).style("fill", "none").style("stroke", "var(--rise)").style("stroke-width", 1.75);
  }

  function renderIstTable() {
    const D = IST, M = D.meta.months, iL = M.length - 1, last = M[iL], gd = isoDate(D.meta.garante), y25 = D.garante.anni[D.garante.anni.length - 1];
    const rows = D.istituti.filter((x) => x.pres[iL] != null).map((x) => ({ x, rr: istRatio(x, "reg"), rd: istRatio(x, "disp"), c: istCap(x, iL), m: x.m25 }));
    const by = { ratio: (a, b) => (b.rr ?? -1) - (a.rr ?? -1), pres: (a, b) => b.x.pres[iL] - a.x.pres[iL], reg: (a, b) => a.x.reg.localeCompare(b.x.reg, LOCALE) || a.x.nome.localeCompare(b.x.nome, LOCALE) }[state.istSort];
    rows.sort(by);
    $("#ist-table-sub").textContent = EN
      ? `${rows.length} adult prisons. People and official places: Ministry of Justice, end of ${monthLong(last)}. Available places: National Guarantor, ${dayLong(gd)}. Deaths in ${y25}: recorded by the prison administration (National Guarantor), suicides in brackets.`
      : `${rows.length} carceri per adulti. Persone e posti regolamentari: Ministero della Giustizia, fine ${monthLong(last)}. Posti disponibili: Garante nazionale, ${dayLong(gd)}. Morti nel ${y25}: registrate dall’amministrazione penitenziaria (Garante nazionale), tra parentesi i suicidi.`;
    // le sigle della colonna «Tipo», scritte per esteso sotto il sottotitolo (prima solo nel tooltip)
    const codes = [...new Set(rows.map((r) => r.x.tipo).filter(Boolean))].sort();
    if (codes.length && has("ist-table-sub")) $("#ist-table-sub").textContent += " " + L("Tipo: ", "Type: ") + codes.map((k) => `${k} ${tipoName(k)}`).join("; ") + ".";
    const f = (v) => (v == null ? "–" : nf0.format(Math.round(v)));
    $("#ist-table").innerHTML = `<table class="ist-table"><thead><tr>
        <th scope="col">${L("Carcere", "Prison")}</th><th scope="col">${L("Regione", "Region")}</th><th scope="col">${L("Tipo", "Type")}</th>
        <th scope="col" class="num">${L("Persone", "People")}</th><th scope="col" class="num">${L("Posti reg.", "Official places")}</th><th scope="col" class="num">${L("Ogni 100", "Per 100")}</th>
        <th scope="col" class="num">${L("Posti disp.", "Available places")}</th><th scope="col" class="num">${L("Ogni 100", "Per 100")}</th><th scope="col" class="num">${L(`Morti ${y25}`, `Deaths ${y25}`)}</th></tr></thead><tbody>${rows.map((r) =>
      `<tr><th scope="row"><button type="button" data-id="${r.x.id}">${esc(r.x.nome)}</button></th><td>${esc(r.x.reg)}</td><td><abbr title="${esc(tipoName(r.x.tipo))}">${r.x.tipo}</abbr></td>
        <td class="num">${nf0.format(r.x.pres[iL])}</td><td class="num">${nf0.format(r.c)}</td><td class="num ist-r" style="--c:${crowdColor(r.rr)}">${f(r.rr)}</td>
        <td class="num">${r.x.posti != null ? nf0.format(r.x.posti) : "–"}</td><td class="num ist-r" style="--c:${crowdColor(r.rd)}">${f(r.rd)}</td>
        <td class="num">${r.m ? `${d3.sum(r.m)}${r.m[0] ? ` <span class="small">(${r.m[0]})</span>` : ""}` : "0"}</td></tr>`).join("")}</tbody></table>`;
  }

  function renderIstTypes() {
    const D = IST, M = D.meta.months, iL = M.length - 1;
    const grp = (g) => M.map((_, i) => {
      let p = 0, c = 0;
      D.istituti.forEach((x) => { if (x.pres[i] != null && TIPO_GRP[istTipo(x, i)] === g) { p += x.pres[i]; c += istCap(x, i); } });
      return { p, c, r: (100 * p) / c };
    });
    const cc = grp("cc"), cr = grp("cr");
    $("#ist-type-sub").textContent = EN ? `Remand prisons (case circondariali) and prisons for sentenced people (case di reclusione), official places, end of each month` : `Case circondariali e case di reclusione, posti regolamentari, a fine mese`;
    monthChart($("#ist-type"), {
      months: M, label: L("Persone ogni 100 posti nelle case circondariali e nelle case di reclusione", "People per 100 places in remand prisons and in prisons for sentenced people"),
      ref: 100, yMin: 80, yFmt: (v) => nf0.format(v), height: 240,
      series: [
        { name: L("case circondariali", "remand prisons"), values: cc.map((d) => d.r), color: "var(--rise)", width: 2.5, at: "2021-01", dy: -10 },
        { name: L("case di reclusione", "prisons for sentenced people"), values: cr.map((d) => d.r), color: "var(--ink)", at: "2021-01", dy: 18, dyEnd: 16 },
      ],
      tip: (i) => EN
        ? `<b>${monthLong(M[i])}</b><br>Remand prisons: ${nf0.format(cc[i].p)} people, ${nf0.format(cc[i].c)} places (${nf0.format(Math.round(cc[i].r))} per 100)<br>Sentenced: ${nf0.format(cr[i].p)} people, ${nf0.format(cr[i].c)} places (${nf0.format(Math.round(cr[i].r))} per 100)`
        : `<b>${monthLong(M[i])}</b><br>Case circondariali: ${nf0.format(cc[i].p)} persone, ${nf0.format(cc[i].c)} posti (${nf0.format(Math.round(cc[i].r))} ogni 100)<br>Case di reclusione: ${nf0.format(cr[i].p)} persone, ${nf0.format(cr[i].c)} posti (${nf0.format(Math.round(cr[i].r))} ogni 100)`,
    });
    const share = (100 * cc[iL].p) / D.italia.pres[iL];
    $("#ist-type-note").textContent = EN
      ? `At the end of ${monthLong(M[iL])}: ${nf0.format(Math.round(cc[iL].r))} people for every 100 places in remand prisons, ${nf0.format(Math.round(cr[iL].r))} in prisons for sentenced people. Remand prisons held ${nf1.format(share)}% of everyone in prison. Left out: the work house in Vasto, Reggio Emilia (which is both) and the unit for mothers in Lauro.`
      : `A fine ${monthLong(M[iL])}: ${nf0.format(Math.round(cc[iL].r))} persone ogni 100 posti nelle case circondariali, ${nf0.format(Math.round(cr[iL].r))} nelle case di reclusione. Nelle prime c’era ${pctA("il", share)} delle persone detenute. Fuori dal confronto la casa lavoro di Vasto, Reggio Emilia (circondariale e di reclusione insieme) e l’istituto per madri di Lauro.`;
    renderIstRegions();
  }

  // Fine 2025, una regione per cerchio: quota delle persone nelle case circondariali e quota senza condanna definitiva.
  function renderIstRegions() {
    const R = IST.regioni, rows = R.righe.map((d) => ({ d, x: (100 * d.cc) / d.all, y: (100 * d.disp) / d.all, s: (100 * d.str) / d.all }));
    const tot = (k) => d3.sum(R.righe, (d) => d[k]), it = { x: (100 * tot("cc")) / tot("all"), y: (100 * tot("disp")) / tot("all") };
    const el = $("#ist-reg"), w = Math.max(280, el.clientWidth), h = w < 480 ? 250 : 280, m = { t: 14, r: 16, b: 36, l: 44 };
    $("#ist-reg-sub").textContent = EN
      ? `End of ${R.anno}. Each circle is a region, sized by the number of people in prison; the cross is Italy. Correlation between the two shares across the 20 regions: ${nf2.format(R.r)}.`
      : `Fine ${R.anno}. Ogni cerchio è una regione, grande quanto le persone detenute; la croce è l’Italia. Correlazione tra le due quote nelle 20 regioni: ${nf2.format(R.r)}.`;
    const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
      .attr("role", "img").attr("aria-label", L("Regioni: quota di persone detenute nelle case circondariali e quota senza condanna definitiva", "Regions: share of people held in remand prisons and share without a final conviction"));
    svg.selectAll("*").remove();
    const x = d3.scaleLinear([Math.floor(d3.min(rows, (d) => d.x) / 10) * 10, 100], [m.l, w - m.r - 6]);
    const y = d3.scaleLinear([0, Math.ceil(d3.max(rows, (d) => d.y) / 10) * 10], [h - m.b, m.t]);
    const ya = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(w - m.l - m.r)).tickFormat((v) => v + "%"));
    ya.select(".domain").remove();
    ya.selectAll(".tick line").style("stroke", "var(--grid)");
    const xa = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(5).tickFormat((v) => v + "%").tickSize(4));
    xa.select(".domain").style("stroke", "var(--rule)");
    svg.append("text").attr("class", "lbl").attr("x", w - m.r).attr("y", h - 4).attr("text-anchor", "end").text(L("nelle case circondariali →", "in remand prisons →"));
    svg.append("text").attr("class", "lbl").attr("x", m.l + 4).attr("y", m.t + 2).text(L("↑ senza condanna definitiva", "↑ without a final conviction"));
    const r = d3.scaleSqrt([0, d3.max(rows, (d) => d.d.all)], [0, 15]);
    const fvg = (d) => /Friuli/.test(d.d.name);
    const ck = (d) => d.x > 99.9;
    svg.append("g").selectAll("circle").data(rows.slice().sort((a, b) => b.d.all - a.d.all)).join("circle").attr("class", "rv-pop")
      .attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.y)).attr("r", (d) => Math.max(3, r(d.d.all)))
      .style("fill", (d) => (fvg(d) ? "var(--rise)" : ck(d) ? "var(--ink-2)" : "var(--mid)")).style("fill-opacity", 0.85).style("stroke", "var(--surface)").style("stroke-width", 1)
      .on("mousemove", (ev, d) => showTip(EN
        ? `<b>${esc(d.d.name)}</b><br>${nf1.format(d.x)}% in remand prisons<br>${nf1.format(d.y)}% without a final conviction<br><span class="small">${nf0.format(d.d.all)} people in prison, end of ${R.anno}</span>`
        : `<b>${esc(d.d.name)}</b><br>${nf1.format(d.x)}% nelle case circondariali<br>${nf1.format(d.y)}% senza condanna definitiva<br><span class="small">${nf0.format(d.d.all)} persone detenute, fine ${R.anno}</span>`, ev))
      .on("mouseleave", hideTip);
    svg.append("path").attr("d", `M${x(it.x) - 5},${y(it.y)}h10M${x(it.x)},${y(it.y) - 5}v10`).style("stroke", "var(--ink)").style("stroke-width", 1.5);
    rows.filter(ck).forEach((d) => svg.append("text").attr("class", `lbl halo${fvg(d) ? " lbl-strong" : ""}`).attr("x", x(d.x) - Math.max(3, r(d.d.all)) - 4).attr("y", y(d.y) + 4)
      .attr("text-anchor", "end").style("fill", fvg(d) ? "var(--rise)" : null).text(d.d.name));
    reveal(el);

    // la prova per il Friuli-Venezia Giulia: solo case circondariali, ma anche altre regioni le hanno, con quote basse
    const F = rows.find(fvg);
    if (!F) return;
    const same = rows.filter((d) => ck(d) && !fvg(d)), yrs = R.anni, ser = F.d.disp_serie;
    let k = ser.length - 1;
    while (k > 0 && ser[k - 1] >= 40) k--;
    const lowOthers = d3.extent(same, (d) => d.y);
    const alike = rows.filter((d) => !fvg(d) && d.s >= F.s - 1 && d.y < 25).sort((a, b) => b.d.all - a.d.all).slice(0, 3);
    const names = (xs) => xs.map((d) => d.d.name).join(EN ? ", " : ", ").replace(/, ([^,]*)$/, EN ? " and $1" : " e $1");
    $("#ist-reg-note").innerHTML = EN
      ? `The page on <a href="custodia-cautelare.html#regioni">pre-trial detention</a> left a question open: why ${nf1.format(F.y)}% of the people held in Friuli-Venezia Giulia have no final conviction, the highest share in Italy. The type of prison explains it only in part. The region has only remand prisons, five of them, and across regions the share without a final conviction tends to rise with the weight of remand prisons (correlation ${nf2.format(R.r)}). But ${names(same)} also have only remand prisons, with shares from ${nf1.format(lowOthers[0])}% to ${nf1.format(lowOthers[1])}%. Foreign nationals, more often awaiting trial, do not explain it either: they are ${nf1.format(F.s)}% in Friuli-Venezia Giulia, and a similar or larger share in ${names(alike)}, where the share without a final conviction is below 25%.${k < ser.length - 3 ? ` Nor is it a one-year blip: above 40% every year since ${yrs[k]}.` : ""} Understanding it would take the legal status of people prison by prison, which the Ministry does not publish.`
      : `Nell’approfondimento sulla <a href="custodia-cautelare.html#regioni">custodia cautelare</a> restava una domanda: perché in Friuli-Venezia Giulia ${pctA("il", F.y)} delle persone detenute non ha una condanna definitiva, la quota più alta d’Italia. Il tipo di carcere lo spiega solo in parte. La regione ha solo case circondariali, cinque, e tra le regioni la quota senza condanna definitiva tende a crescere con il peso delle case circondariali (correlazione ${nf2.format(R.r)}). Ma anche ${names(same)} hanno solo case circondariali, con quote ${pctA("dal", lowOthers[0])} ${pctA("al", lowOthers[1])}. Non bastano nemmeno le persone straniere, più spesso in attesa di giudizio: in Friuli-Venezia Giulia sono ${pctA("il", F.s)}, e una parte simile o più grande in ${names(alike)}, dove la quota senza condanna definitiva è sotto il 25%.${k < ser.length - 3 ? ` E non è il dato di un anno: sopra il 40% ogni anno dal ${yrs[k]}.` : ""} Per capirla servirebbe la posizione giuridica delle persone carcere per carcere, che il Ministero non pubblica.`;
  }

  function renderIstDeaths() {
    const D = IST, E = D.eventi, G = D.garante, R = D.ristretti, A = D.antigone, M = D.meta.months;
    const yG = G.anni[G.anni.length - 1], [s25, a25, n25, x25, t25] = D.morti_totale_testo, g26 = G.anno_2026;
    const record = G.totale.slice(0, -1).every((v) => v < t25);
    $("#ist-death-title").textContent = EN ? `${nf0.format(t25)} people in prison died in ${yG}` : `Nel ${yG} sono morte ${nf0.format(t25)} persone detenute`;
    $("#ist-death-sub").textContent = EN
      ? `According to the National Guarantor, from prison administration records: ${s25} suicides, ${n25} deaths from natural causes, ${a25} with the cause still to be established, ${x25} accidental.${record ? ` The highest number since its series began in ${G.anni[0]}.` : ""}${g26 ? ` From 1 January to ${dayLong(isoDate(g26.fino_al))}: ${g26.totale} deaths, ${g26.suicidi} of them suicides.` : ""}`
      : `Secondo il Garante nazionale, sui dati dell’amministrazione penitenziaria: ${s25} suicidi, ${n25} morti per cause naturali, ${a25} con la causa ancora da accertare, ${x25} per incidente.${record ? ` È il numero più alto della sua serie, che comincia nel ${G.anni[0]}.` : ""}${g26 ? ` Dal 1° gennaio ${dayArt(isoDate(g26.fino_al)).replace(/^il /, "al ").replace(/^l’/, "all’")}: ${g26.totale} morti, ${g26.suicidi} suicidi.` : ""}`;

    // tassi del Ministero dal 1992, sulle persone presenti in media nell'anno
    const rs = E.suicidi.map((v, i) => (1e4 * v) / E.media[i]), rn = E.naturali.map((v, i) => (1e4 * v) / E.media[i]);
    const yE = E.anni, iE = yE.length - 1;
    $("#ist-rates-sub").textContent = EN ? `Ministry of Justice, per 10,000 people held on average during the year, ${yE[0]}–${yE[iE]}` : `Ministero della Giustizia, ogni 10.000 persone presenti in media nell’anno, ${yE[0]}–${yE[iE]}`;
    seriesChart($("#ist-rates"), {
      years: yE, label: L("Suicidi e morti per cause naturali ogni 10.000 persone detenute", "Suicides and deaths from natural causes per 10,000 people in prison"), height: 240, yMin: 0,
      fmt: (v) => nf1.format(v),
      series: [
        { name: L("cause naturali", "natural causes"), values: rn, color: "var(--ink)", at: 1996, dy: -10 },
        { name: L("suicidi", "suicides"), values: rs, color: "var(--rise)", width: 2.5, at: 1996, dy: 18, dyEnd: 16 },
      ],
      tip: (i) => EN
        ? `<b>${yE[i]}</b><br>${E.suicidi[i]} suicides (${nf1.format(rs[i])} per 10,000)<br>${E.naturali[i]} natural deaths (${nf1.format(rn[i])} per 10,000)<br><span class="small">${nf0.format(E.media[i])} people held on average</span>`
        : `<b>${yE[i]}</b><br>${E.suicidi[i]} suicidi (${nf1.format(rs[i])} ogni 10.000)<br>${E.naturali[i]} morti per cause naturali (${nf1.format(rn[i])} ogni 10.000)<br><span class="small">${nf0.format(E.media[i])} persone presenti in media</span>`,
    });
    // i quattro conteggi dei suicidi, dal primo anno del Garante
    const yC = G.anni, pick = (ys, vs) => yC.map((y) => { const j = ys.indexOf(y); return j >= 0 ? vs[j] : null; });
    const cM = pick(yE, E.suicidi), cG = G.suicidi, cR = pick(R.anni, R.suicidi), cA = pick(A.anni, A.suicidi);
    $("#ist-counters-sub").textContent = EN ? `Suicides in prison each year, ${yC[0]}–${yC[yC.length - 1]}` : `Suicidi in carcere ogni anno, ${yC[0]}–${yC[yC.length - 1]}`;
    seriesChart($("#ist-counters"), {
      years: yC, label: L("Suicidi in carcere secondo il Ministero, il Garante, Ristretti Orizzonti e Antigone", "Suicides in prison according to the Ministry, the Guarantor, Ristretti Orizzonti and Antigone"), height: 240, yMin: 30, yMax: 100, xTicks: yC.filter((y) => y % 2 === 1),
      series: [
        { name: "Ristretti", values: cR, color: "var(--rise)", width: 2.5, label: false },
        { name: L("Garante", "Guarantor"), values: cG, color: "var(--fall)", label: false },
        { name: L("Ministero", "Ministry"), values: cM, color: "var(--ink)", label: false },
        { name: "Antigone", values: cA, color: "var(--gold)", label: false },
      ],
      tip: (i) => `<b>${yC[i]}</b><br>${L("Ministero", "Ministry")}: ${cM[i] ?? "–"}<br>${L("Garante", "Guarantor")}: ${cG[i] ?? "–"}<br>Ristretti: ${cR[i] ?? "–"}${cA[i] != null ? `<br>Antigone: ${L("almeno", "at least")} ${cA[i]}` : ""}`,
    });
    // le quattro linee sono troppo vicine per scriverci sopra nomi e valori: una legenda sotto, i numeri nella tabella
    d3.select("#ist-counters").selectAll("text.lbl-strong").remove();
    $("#ist-counters").insertAdjacentHTML("beforeend", `<ul class="ist-key">${[["var(--rise)", "Ristretti Orizzonti"], ["var(--fall)", L("Garante nazionale", "National Guarantor")], ["var(--ink)", L("Ministero della Giustizia", "Ministry of Justice")], ["var(--gold)", L("Antigone (almeno)", "Antigone (at least)")]].map(([c, n]) => `<li><i style="background:${c}"></i>${n}</li>`).join("")}</ul>`);
    const iMax = d3.maxIndex(rs);
    $("#ist-rates-note").textContent = EN
      ? `In ${yE[iE]} the Ministry counted ${nf1.format(rs[iE])} suicides per 10,000 people held; the highest rate in the series was in ${yE[iMax]} (${nf1.format(rs[iMax])}). Deaths from natural causes were ${nf1.format(rn[iE])} per 10,000. People in prison are almost all adult men: these rates cannot be compared directly with the general population’s. On the right, the four counts of suicides: until ${yC[cR.findIndex((v, i) => v !== cG[i]) - 1]} Ristretti Orizzonti and the Guarantor give exactly the same numbers, year by year, more likely the same list of cases than two counts that confirm each other. Then they part ways.`
      : `Nel ${yE[iE]} il Ministero ha contato ${nf1.format(rs[iE])} suicidi ogni 10.000 persone detenute; il tasso più alto della serie è del ${yE[iMax]} (${nf1.format(rs[iMax])}). Le morti per cause naturali sono state ${nf1.format(rn[iE])} ogni 10.000. Le persone detenute sono quasi tutte uomini adulti: questi tassi non si confrontano direttamente con quelli della popolazione. A destra, i quattro conteggi dei suicidi: fino al ${yC[cR.findIndex((v, i) => v !== cG[i]) - 1]} Ristretti Orizzonti e il Garante danno gli stessi numeri anno per anno, più probabilmente lo stesso elenco di casi che due conteggi che si confermano. Poi si separano.`;

    // chi conta che cosa, negli ultimi tre anni
    const ys = yC.slice(-3), col = (vs) => ys.map((y) => { const v = vs[yC.indexOf(y)]; return `<td class="num">${v == null ? "–" : v}</td>`; }).join("");
    const rowsT = EN ? [
      ["Ministry of Justice", "Suicides in its series on critical events", cM],
      ["National Guarantor", "The same prison administration records, plus people in custody who died outside the institution (in hospital, in transfer, on leave)", cG],
      ["Ristretti Orizzonti", "A dossier kept since 1992 from news, alerts and official data; it also counts cases classified otherwise", cR],
      ["Antigone", "Cross-checks Ristretti and the Guarantor, and adds REMS and juvenile institutions (“at least”)", cA],
    ] : [
      ["Ministero della Giustizia", "Suicidi nella serie degli eventi critici", cM],
      ["Garante nazionale", "Gli stessi archivi dell’amministrazione penitenziaria, più le persone detenute morte fuori dall’istituto (in ospedale, in trasferimento, in permesso)", cG],
      ["Ristretti Orizzonti", "Un dossier tenuto dal 1992 su notizie, segnalazioni e dati ufficiali; conta anche casi classificati in altro modo", cR],
      ["Antigone", "Incrocia Ristretti e Garante, e aggiunge REMS e istituti per minorenni («almeno»)", cA],
    ];
    $("#ist-count-sub").textContent = EN ? "Suicides in prison, by source" : "Suicidi in carcere, per fonte";
    $("#ist-count-table").innerHTML = `<table><thead><tr><th scope="col">${L("Chi conta", "Who counts")}</th><th scope="col">${L("Che cosa conta", "What it counts")}</th>${ys.map((y) => `<th scope="col" class="num">${y}</th>`).join("")}</tr></thead><tbody>${rowsT.map(([who, what, vs]) => `<tr><th scope="row">${who}</th><td class="ist-what">${what}</td>${col(vs)}</tr>`).join("")}</tbody></table>`;

    // perché i numeri non coincidono
    const ext = G.esterno_suicidi, same = yC.filter((y, i) => ext[i] != null && cM[i] != null && cM[i] + ext[i] === cG[i]);
    const notSame = yC.filter((y, i) => ext[i] != null && cM[i] != null && cM[i] + ext[i] !== cG[i]);
    const iY = yC.length - 1, iY1 = iY - 1;
    const nE = E.naturali[yE.indexOf(yG)], nG = G.naturali[iY], nX = G.esterno_naturali[iY];
    const list = (xs) => xs.join(", ").replace(/, ([^,]*)$/, EN ? " and $1" : " e $1");
    const why = EN ? [
      `<b>Inside or outside.</b> The Ministry and the Guarantor read the same records, but the Ministry seems to count only those who die inside the institution: in ${list(same)} the gap is exactly the suicides the Guarantor records outside; in ${list(notSame)} it comes close but does not add up.`,
      `<b>Uncertain cases.</b> Ristretti Orizzonti also counts deaths not classified as suicide, when the intention is hard to establish, and people who died in hospital shortly afterwards: ${cR[iY] - cG[iY]} more cases than the Guarantor in ${yC[iY]}, ${cR[iY1] - cG[iY1]} in ${yC[iY1]}.`,
      `<b>Other places.</b> Antigone adds suicides in REMS, the health facilities for people found not criminally responsible. That is why it writes “at least”.`,
      `<b>Causes still to be established.</b> ${G.accertare[iY1]} in ${yC[iY1]}, ${G.accertare[iY]} in ${yC[iY]}, according to the Guarantor. Some may turn out to be suicides: the administration updates its figures years later.`,
      `<b>Natural causes too.</b> In ${yG} the Ministry counts ${nE} deaths from natural causes, the Guarantor ${nG}, ${nX} of them outside the institution.`,
    ] : [
      `<b>Dentro o fuori.</b> Ministero e Garante leggono gli stessi archivi, ma il Ministero sembra contare solo chi muore dentro l’istituto: nel ${list(same)} la differenza è esattamente il numero di suicidi che il Garante segna fuori; nel ${list(notSame)} ci va vicino ma non torna.`,
      `<b>I casi incerti.</b> Ristretti Orizzonti conta anche morti non classificate come suicidi, quando l’intenzione è difficile da stabilire, e persone morte in ospedale poco dopo: ${cR[iY] - cG[iY]} casi più del Garante nel ${yC[iY]}, ${cR[iY1] - cG[iY1]} nel ${yC[iY1]}.`,
      `<b>Gli altri luoghi.</b> Antigone aggiunge i suicidi nelle REMS, le strutture sanitarie per chi è stato giudicato non imputabile. Per questo scrive «almeno».`,
      `<b>Le cause da accertare.</b> ${G.accertare[iY1]} nel ${yC[iY1]}, ${G.accertare[iY]} nel ${yC[iY]}, secondo il Garante. Alcune potrebbero rivelarsi suicidi: l’amministrazione aggiorna i numeri anche anni dopo.`,
      `<b>Anche le morti per malattia.</b> Nel ${yG} il Ministero conta ${nE} morti per cause naturali, il Garante ${nG}, di cui ${nX} fuori dall’istituto.`,
    ];
    $("#ist-why").innerHTML = why.map((t) => `<li>${t}</li>`).join("");

    // dove: istituti con almeno una morte, suicidi per tipo di carcere e per affollamento, sulla presenza media del 2025
    const idx = M.map((k, i) => (k.startsWith(yG + "-") ? i : -1)).filter((i) => i >= 0);
    const inYear = D.istituti.filter((x) => idx.some((i) => istAlive(x, i)));
    const withDeath = D.istituti.filter((x) => x.m25);
    const agg = (f) => {
      const o = {};
      inYear.forEach((x) => {
        const ii = idx.filter((i) => x.pres[i] != null), p = d3.sum(ii, (i) => x.pres[i]) / idx.length, c = d3.sum(ii, (i) => istCap(x, i));
        const k = f(x, (100 * d3.sum(ii, (i) => x.pres[i])) / c);
        if (k == null) return;
        o[k] = o[k] || { p: 0, s: 0, n: 0 };
        o[k].p += p; o[k].s += x.m25 ? x.m25[0] : 0; o[k].n += 1;
      });
      return o;
    };
    const byT = agg((x) => TIPO_GRP[x.tipo] || null);
    const BANDS = [[0, 100], [100, 130], [130, 150], [150, Infinity]];
    const byB = agg((x, r) => BANDS.findIndex(([a, b]) => r > a && r <= b));
    const rate = (o) => (1e4 * o.s) / o.p;
    const bandRates = BANDS.map((_, j) => byB[j]).filter(Boolean).map(rate);
    const rising = bandRates.every((v, j) => j === 0 || v >= bandRates[j - 1]);
    const top = withDeath.slice().sort((a, b) => d3.sum(b.m25) - d3.sum(a.m25))[0], iL = M.length - 1;
    const sizeRank = D.istituti.filter((x) => istAlive(x, iL)).sort((a, b) => b.pres[iL] - a.pres[iL]).indexOf(top) + 1;
    $("#ist-where-facts").innerHTML = EN ? `
      <div class="fact"><div class="fv">${withDeath.length}<small> of ${inYear.length}</small></div><div class="fl">prisons with people held in ${yG} where the administration recorded at least one death.</div></div>
      <div class="fact"><div class="fv">${nf1.format(rate(byT.cc))}<small> vs ${nf1.format(rate(byT.cr))}</small></div><div class="fl">suicides per 10,000 people in ${yG} in remand prisons and in prisons for sentenced people (${byT.cc.s} and ${byT.cr.s} suicides counted by the Guarantor).</div></div>
      <div class="fact"><div class="fv">${d3.sum(top.m25)}</div><div class="fl">deaths recorded in ${esc(top.nome)} in ${yG}, ${top.m25[2]} of them from natural causes${sizeRank === 1 ? ". It is the largest prison in Italy" : ""}.</div></div>` : `
      <div class="fact"><div class="fv">${withDeath.length}<small> su ${inYear.length}</small></div><div class="fl">carceri con persone detenute nel ${yG} in cui l’amministrazione ha registrato almeno una morte.</div></div>
      <div class="fact"><div class="fv">${nf1.format(rate(byT.cc))}<small> vs ${nf1.format(rate(byT.cr))}</small></div><div class="fl">suicidi ogni 10.000 persone nel ${yG} nelle case circondariali e nelle case di reclusione (${byT.cc.s} e ${byT.cr.s} suicidi, contati dal Garante).</div></div>
      <div class="fact"><div class="fv">${d3.sum(top.m25)}</div><div class="fl">morti registrate a ${esc(top.nome)} nel ${yG}, ${top.m25[2]} per cause naturali${sizeRank === 1 ? ". È il carcere più grande d’Italia" : ""}.</div></div>`;
    const bandTxt = BANDS.map((b, j) => byB[j] && `${j === 0 ? L("fino a 100", "up to 100") : b[1] === Infinity ? L(`oltre ${b[0]}`, `over ${b[0]}`) : `${b[0]}–${b[1]}`}: ${nf1.format(rate(byB[j]))}`).filter(Boolean).join("; ");
    $("#ist-where-note").textContent = EN
      ? `Deaths prison by prison are in each profile and in the table above, as counts only: with numbers this small one or two cases change everything. Deaths from illness are concentrated in the largest prisons and, probably, in those with a health unit. In remand prisons, where people arrive straight after arrest, suicides in ${yG} were ${nf1.format(rate(byT.cc) / rate(byT.cr))} times as frequent as in prisons for sentenced people, but ${byT.cc.s} cases against ${byT.cr.s} are too few for one year to rule out chance. Between more and less crowded prisons ${rising ? "suicides rise with crowding" : "there is no steady difference"}: by people per 100 official places, suicides per 10,000 people were ${bandTxt}. Whether overcrowding increases suicides, these numbers do not say.`
      : `Le morti carcere per carcere sono nelle schede e nella tabella più sopra, solo come conteggi: con numeri così piccoli uno o due casi cambiano tutto. Le morti per malattia si concentrano nelle carceri più grandi e, probabilmente, in quelle con un reparto sanitario. Nelle case circondariali, dove si entra subito dopo l’arresto, nel ${yG} i suicidi sono stati ${nf1.format(rate(byT.cc) / rate(byT.cr))} volte quelli delle case di reclusione, ma ${byT.cc.s} casi contro ${byT.cr.s} sono troppo pochi perché un anno solo escluda il caso. Tra carceri più e meno affollate ${rising ? "i suicidi crescono con l’affollamento" : "non c’è una differenza regolare"}: per persone ogni 100 posti regolamentari, i suicidi ogni 10.000 persone sono stati ${bandTxt}. Se il sovraffollamento faccia aumentare i suicidi, questi numeri non lo dicono.`;

    // metodo: posti e morti, con i numeri dei file
    const P = D.posti, p0 = P[0], ir = D.interrogazione, fixed = D.istituti.filter((x) => x.posti_dal_tasso), fixedReg = [...new Set(fixed.map((x) => x.reg))];
    const fixedWhere = EN ? `${fixed.length} prisons${fixedReg.length === 1 ? ` in ${fixedReg[0]}` : ""}` : `${fixed.length} carceri${fixedReg.length === 1 ? ` (${fixedReg[0]})` : ""}`;
    if (has("ist-method-posti")) $("#ist-method-posti").textContent = EN
      ? `The Guarantor publishes the places that can actually be used, prison by prison, only in some reports; the most recent, used here, is from ${dayLong(isoDate(D.meta.garante))}. In that table, for ${fixedWhere}, the places column repeats the number of people: the places were recovered from the crowding rate (${fixed.map((x) => x.nome).join(", ")}), and their total matches the published national figure (${nf0.format(P[P.length - 1][2])}). The national series, from ${dayLong(isoDate(p0[0]))}, comes from the same reports. The Guarantor’s counts of people differ from the Ministry’s by a few units per prison, even on the same day, and the reports do not say why. A parliamentary question of 7 October 2025 (4/06085) put the effective places at about ${nf0.format(ir.posti)}, for more than ${nf0.format(ir.persone)} people, at ${dayLong(isoDate(ir.data))}.`
      : `Il Garante pubblica i posti davvero utilizzabili, carcere per carcere, solo in alcuni report; il più recente, usato qui, è ${dayArt(isoDate(D.meta.garante)).replace(/^il /, "del ").replace(/^l’/, "dell’")}. In quella tabella, per ${fixedWhere}, la colonna dei posti ripete le persone: i posti sono stati ricavati dal tasso di affollamento (${fixed.map((x) => x.nome).join(", ")}), e il loro totale torna con il dato nazionale pubblicato (${nf0.format(P[P.length - 1][2])}). La serie nazionale, dal ${dayLong(isoDate(p0[0]))}, viene dagli stessi report. Le persone contate dal Garante differiscono da quelle del Ministero di poche unità per carcere, anche nello stesso giorno, e i report non dicono perché. Un’interrogazione parlamentare del 7 ottobre 2025 (4/06085) parlava di circa ${nf0.format(ir.posti)} posti effettivi per oltre ${nf0.format(ir.persone)} persone al ${dayLong(isoDate(ir.data))}.`;
    if (has("ist-method-morti")) $("#ist-method-morti").textContent = EN
      ? `The Ministry series (critical events, ${yE[0]}–${yE[iE]}) gives suicides and deaths from natural causes, with rates on the average number of people present (the mean of the end-of-month counts). The Guarantor publishes deaths by cause and by prison, read from the prison administration’s systems: for ${yG}, the table by prison adds up to ${a25} deaths with the cause still to be established and ${n25} natural ones, as in the text of the report, while its total row prints ${a25 + 1} and ${n25 - 1}; for 2024 the causes in its summary table add up to 243 against a printed total of 246. Suicides by prison in 2024 come from the Guarantor’s focus updated to 20 December 2024. Ristretti Orizzonti’s dossier, updated to ${dayLong(isoDate(R.aggiornamento))}, links to the Guarantor’s reports and does not say where its figures since 2015 come from; its ${R.anni[R.anni.length - 1]} is partial.`
      : `La serie del Ministero (eventi critici, ${yE[0]}–${yE[iE]}) dà suicidi e morti per cause naturali, con i tassi sulle persone presenti in media (la media dei conteggi di fine mese). Il Garante pubblica le morti per causa e per istituto, lette negli applicativi dell’amministrazione penitenziaria: per il ${yG} la tabella per istituto somma ${a25} morti con la causa da accertare e ${n25} naturali, come il testo del report, mentre la sua riga del totale stampa ${a25 + 1} e ${n25 - 1}; per il 2024 le cause della tabella riassuntiva sommano 243, il totale stampato è 246. I suicidi per istituto del 2024 vengono dal focus del Garante aggiornato al 20 dicembre 2024. Il dossier di Ristretti Orizzonti, aggiornato ${dayArt(isoDate(R.aggiornamento)).replace(/^il /, "al ").replace(/^l’/, "all’")}, rimanda ai report del Garante e non dice da dove vengano i suoi numeri dal 2015; il suo ${R.anni[R.anni.length - 1]} è parziale.`;
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
    // gli anni dei pulsanti vengono dai dati: con il 2025 diventano 2025, 2024, 2023 senza toccare l'HTML
    const prevB = $('#base-seg [data-base]:not([data-base="2019"]):not([data-base="2014"])');
    if (prevB) { prevB.dataset.base = Y[LAST - 1]; prevB.textContent = Y[LAST - 1]; }
    document.querySelectorAll("#spike-year-seg [data-year]").forEach((b, k) => { b.dataset.year = Y[LAST - k]; b.textContent = Y[LAST - k]; });
    state.spikeYear = Y[LAST];
    seg("#base-seg", "base", (v) => setMap(null, +v));
    // «Cosa sale e cosa scende»: due periodi, solo per questa sezione
    $("#mix-base-seg").querySelectorAll("button").forEach((b) => { b.textContent = EN ? `Between ${b.dataset.mbase} and ${Y[LAST]}` : `Tra il ${b.dataset.mbase} e il ${Y[LAST]}`; });
    seg("#mix-base-seg", "mbase", (v) => { state.mixBase = +v; renderMix(); });
    seg("#spike-year-seg", "year", (v) => { state.spikeYear = +v; state.spikeShown = 8; renderSpikes(); });
    seg("#spike-sort-seg", "ssort", (v) => { state.spikeSort = v; state.spikeShown = 8; renderSpikes(); });
    seg("#sort-seg", "sort", (v) => { state.sort = v; renderGrid(); });
    seg("#scale-seg", "scale", (v) => { state.scale = v; renderGrid(); });
    // «Mostra altre»: il fuoco va sulla prima delle nuove, non resta sul tasto finito sotto le schede aggiunte
    const moreFocus = (host, from) => { const el = host && host.children[from]; const f = el && (el.matches("button, a[href]") ? el : el.querySelector("button, a[href]")); if (f) f.focus({ preventScroll: false }); };
    $("#spike-more").addEventListener("click", () => { const k = state.spikeShown; state.spikeShown += 8; renderSpikes(); moreFocus($("#spike-cards"), k); });
    $("#grid-more").addEventListener("click", () => { const k = state.gridShown; state.gridShown += 12; renderGrid(); moreFocus($("#sm"), k); });

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
      // Ctrl, Cmd, Shift o il tasto centrale su un link: lo apre il browser, in un'altra scheda o finestra
      if (el && el.closest("a[href]") && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button)) return;
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
    // con lo zoom il menu scorre di lato: la voce che prende il fuoco si porta in vista, non resta sfumata a metà
    // il link «Vai al contenuto» porta il fuoco dentro il contenuto, non solo la pagina
    const appMain = $("main#app");
    if (appMain && !appMain.hasAttribute("tabindex")) appMain.setAttribute("tabindex", "-1");
    const menuNav = $(".masthead .menu");
    if (menuNav) menuNav.addEventListener("focusin", (ev) => { if (ev.target.matches("a")) ev.target.scrollIntoView({ block: "nearest", inline: "nearest" }); });
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
      ? `Atlante della Sicurezza · ISTAT data up to ${Y[LAST]}, dataset built on ${new Date(META.built).toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" })}`
      : `Atlante della Sicurezza · dati ISTAT aggiornati al ${Y[LAST]}, dataset generato il ${new Date(META.built).toLocaleDateString(LOCALE)}`;
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
      if (has("caut-facts") || $('[data-dd="cautelari"]') || allSources) loads.push(loadCautelari());
      if (has("ist-facts") || $('[data-dd="istituti"]') || allSources) loads.push(loadIstituti());
      if (has("proc-facts") || $('[data-dd="processi"]') || allSources) loads.push(loadProcessi());
      if (has("es-facts") || $('[data-dd="esecuzione"]') || allSources) loads.push(loadEsecuzione());
      if (allSources) QINDEX.forEach((id) => loadQuart(id));
      // L'indirizzo dice quale scheda è aperta: si legge all'apertura e a ogni cambio (tasto indietro, link #roma, un
      // indirizzo scritto a mano). Le maiuscole non contano (#ROMA). Un indirizzo che non è una scheda chiude quella aperta.
      const route = (first) => {
        let h = location.hash.slice(1);
        try { h = decodeURIComponent(h); } catch (e) { /* ignorato */ }
        const hs = slug(h), c = hs ? CITIES.find((x) => slug(x.name) === hs) : null;
        if (c) { if (!dlg.open || state.city !== c) openCity(c); return; }
        if (/-[a-z]{2}$/.test(hs)) {
          // scheda di un comune non capoluogo: #nome-sigla
          loadPlaces().then(() => { const e = INDEX.find((x) => !x.city && placeSlug(x) === hs); if (e) { if (!dlg.open || state.place !== e) openProv(e); } else if (!first && dlg.open) dlg.close(); }).catch(() => {});
          return;
        }
        if (!first) { if (dlg.open) dlg.close(); return; }
        route0(h);
      };
      const route0 = (h) => {
        if (!h) return;
        if (document.getElementById(h)) {
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
      };
      route(true);
      addEventListener("hashchange", () => route(false));
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
    // un'etichetta che cambia, senza aria-pressed: «Fai ripartire il video, premuto» si contraddirebbe
    btn.setAttribute("aria-label", EN ? (h ? "Play the video" : "Pause the video") : h ? "Fai ripartire il video" : "Ferma il video");
    // con il film si fermano anche righe, grana, REC e orologio (vc.css, .vh-held)
    head.classList.toggle("vh-held", h);
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
    if (held) return;
    const d = new Date();
    clock.textContent = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);
})();
