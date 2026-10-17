# Atlante della sicurezza

Strumento civico sui reati denunciati nei 108 comuni capoluogo italiani, 2006–2024, costruito con dati ufficiali ISTAT (più Eurostat per i rimpatri). Mostra dove si denuncia di più e di meno, cosa sale e cosa scende, e dove ci sono state impennate improvvise, accanto a quanto le persone si sentono a rischio. Una ricerca apre la scheda di qualsiasi comune italiano: per i capoluoghi i dati del comune, per gli altri quelli ufficiali della provincia.

## File

- `index.html`, `vc.css`, `vc.js`: la pagina (D3 da cdnjs, nessun build).
- `data/vc.json`: conteggi per comune, tipo di reato e anno; popolazione media annua; tassi nazionali; percezione.
- `data/comuni.json`: tutti i comuni dell'elenco ufficiale ISTAT, con la sigla, la provincia di cui l'ISTAT pubblica i delitti e, per i capoluoghi, il codice usato in `vc.json`; per la mappa di posizione nella scheda, il baricentro di ogni comune (confini ISTAT rielaborati da openpolis, lo stesso file di `build_data.py`). Serve alla ricerca.
- `data/province.json`: tassi ufficiali di delittuosità per provincia, tipo di reato e anno (2006–2024), percezione del rischio per provincia (2022–2024) e, se l'API li ha restituiti, i conteggi. Serve alle schede dei comuni che non sono capoluogo.
- `data/italia.topo.json`: confini provinciali (ISTAT, via openpolis/geojson-italy, CC BY 4.0).
- `data/carceri.json`: detenuti adulti presenti al 31 dicembre (2010–2025) per cittadinanza, regione, reato, età, posizione giuridica; capienza; stranieri residenti quando disponibili.
- `data/rimpatri.json`: cittadini di paesi non UE a cui l'Italia ha ordinato di lasciare il territorio e quelli rimpatriati, per cittadinanza (2008–2025), con il punto di ogni paese sulla carta.
- `data/mondo.topo.json`: confini dei paesi del mondo (GISCO, Commissione europea, scala 1:60 milioni), con il solo codice paese.
- `data/quartieri/`: la sezione «quartiere per quartiere» della scheda, per le città elencate in `index.json` (oggi solo Milano, `015146`). Per ogni città due file: `<id>.json` con i dati dei quartieri (residenti, stranieri, 65 e più, famiglie, superficie, pendolari in entrata, edifici degradati, municipio) e `<id>.topo.json` con i confini. Vedi «Quartiere per quartiere» più sotto.
- `scripts/build_data.py`: scarica e ricostruisce `data/` dall'API SDMX ISTAT. Solo libreria standard.
- `scripts/build_comuni.py`: costruisce `data/comuni.json` e `data/province.json` dall'elenco comuni ISTAT, dal codelist `CL_ITTER107` (che lega ogni comune alla sua provincia) e da `DCCV_DELITTIPS_9`. Usa la cache di `build_data.py`, quindi va lanciato dopo. Si ferma se un comune resta senza provincia o se un capoluogo di `vc.json` non si trova nell'elenco.
- `scripts/build_carceri.py`: costruisce `data/carceri.json` dai dataflow ISTAT `73_173_DF_DCCV_DETENUTI_*` (fonte DAP), con controllo di quadratura dell'albero per cittadinanza.
- `scripts/build_rimpatri.py`: costruisce `data/rimpatri.json` e `data/mondo.topo.json` dall'API Eurostat (`migr_eirtn`, `migr_eiord`) e da GISCO; i nomi italiani dei paesi vengono da `scripts/paesi_it.json`, copia della codelist ISTAT `CL_ISO`. Controlla che la somma per paese torni con il totale, a meno degli arrotondamenti a 5.
- `scripts/build_quartieri_milano.py`: costruisce `data/quartieri/015146.*` e `data/quartieri/index.json` dal portale open data del Comune di Milano (confini dei NIL, dati dei quartieri 2011-2024, municipi, edifici degradati, pendolari del censimento 2011) e da `data/vc.json`. Scrive il TopoJSON da sé, senza dipendenze. Va lanciato dopo `build_data.py`.
- `scripts/make_artifact.py`: crea la versione della pagina senza `<head>`, per la pubblicazione come artifact.
- `scripts/make_icons.py`: disegna le icone del sito dal marchio del meridiano: `favicon.ico`, `img/favicon.svg`, l'icona per la schermata iniziale e quelle elencate in `site.webmanifest`.

## Aggiornare i dati

```bash
cd atlante-della-sicurezza && rm -rf scripts/.cache && python3 scripts/build_data.py && python3 scripts/build_comuni.py
```

`build_comuni.py` prova anche a scaricare i conteggi provinciali (`DCCV_DELITTIPS_1`). Se l'API non risponde li salta e le schede provinciali usano solo i tassi; quando arrivano, le stesse schede mostrano anche i test sulle variazioni e le impennate. Lo script scarta i CSV troncati: l'API ISTAT a volte interrompe le risposte molto grandi (il file `delittips_1.csv` in cache si ferma a 16 MB, dopo i capoluoghi e prima delle province del Sud).

I rimpatri si aggiornano a parte con `python3 scripts/build_rimpatri.py`, dopo aver svuotato `scripts/.cache`: l'ultimo anno pubblicato da Eurostat entra da solo. I quartieri di Milano con `python3 scripts/build_quartieri_milano.py`, dopo `build_data.py`.

Dopo ogni modifica a `vc.css` o `vc.js`, alzare il numero in `?v=N` nei due riferimenti di `index.html`, così i browser non usano la copia in cache.

Lo script verifica che i tassi calcolati riproducano quelli pubblicati da ISTAT per i grandi comuni (`DCCV_DELITTIPS_8`) e si ferma se lo scarto supera l'1%. Quando ISTAT pubblica il 2025, basta estendere `YEARS` in `build_data.py`.

## Fonti (ISTAT, esploradati.istat.it)

| Dataflow | Contenuto |
|---|---|
| `73_67_DF_DCCV_DELITTIPS_1` | Delitti denunciati dalle forze di polizia all'autorità giudiziaria, per tipo, comune capoluogo e anno |
| `73_67_DF_DCCV_DELITTIPS_9` | Tassi di delittuosità, Italia e province |
| `Elenco-comuni-italiani.csv` (istat.it) | Elenco ufficiale dei comuni, con i codici delle province storiche |
| `CL_ITTER107` | Codelist dei territori: ogni comune con la sua provincia |
| `73_67_DF_DCCV_DELITTIPS_8` | Tassi dei grandi comuni (solo per il controllo) |
| `164_164_DF_DCIS_RICPOPRES2011_24` | Popolazione residente ricostruita 2002–2019, tutti i comuni |
| `22_289` | Popolazione residente al 1° gennaio, 2019–2026 |
| `DF_DCSS_BEST_PPC_1_GC` | Famiglie per percezione del rischio di criminalità nella zona, grandi comuni |
| `33_291` | Problemi nella zona in cui si vive, EU-SILC (criminalità, violenza o vandalismo) |
| `73_173_DF_DCCV_DETENUTI_1…6` | Detenuti adulti presenti nelle carceri: reati, età, provenienza geografica, posizione giuridica, capienza |
| Eurostat `migr_eirtn`, `migr_eiord` | Cittadini di paesi terzi rimpatriati dopo un ordine di lasciare il territorio, e a cui l'ordine è stato dato, per cittadinanza (fonte Ministero dell'Interno) |
| GISCO `CNTR_RG_60M_2020`, `CNTR_LB_2020` | Confini e punti di riferimento dei paesi del mondo, per la carta dei rimpatri |
| `29_7`, `29_317` | Stranieri residenti al 1° gennaio, totale e per cittadinanza (confronto con i detenuti) |
| demo.istat.it, `STRASA_<anno>_it_Ripartizioni.zip` | Popolazione straniera residente al 1° gennaio per età e sesso (ISTAT, Demografia in cifre, dal 2019): usata al posto di `29_7` quando l'API SDMX non risponde; `residenti.fonte` in `carceri.json` dice quale delle due è stata usata |
| dati.comune.milano.it `ds964`, `ds379`, `ds205`, `ds503`, `ds392` | Comune di Milano (CC BY 4.0): confini dei NIL vigenti (PGT 2030) e dei municipi; caratteristiche demografiche e territoriali dei quartieri 2011-2024 (anagrafe); edifici degradati, abbandonati o dismessi 2014-2017; pendolari in entrata per sezione di censimento (ISTAT, censimento 2011) |

## Quartiere per quartiere (prototipo, Milano)

L'idea: le grandi città mostrano anche il dettaglio dei quartieri. La scheda di una città elencata in `data/quartieri/index.json` ha una sezione in più, con una mappa coropletica dei quartieri, le classifiche, la scheda del quartiere scelto e la tabella. Gli strati si scelgono con i bottoni: residenti, densità, stranieri, 65 e più, edifici degradati, tutti dati del Comune.

Il punto fermo: **nessuna fonte ufficiale pubblica i reati denunciati sotto il livello comunale.** ISTAT e Ministero dell'Interno si fermano al comune, il Comune di Milano pubblica i reati solo per l'intero territorio (`ds564`). La sezione è pronta per il giorno in cui arriveranno: basta aggiungere a ogni quartiere di `<id>.json` un blocco `n` con i conteggi per tipo di reato e anno (lo stesso schema di `vc.json`), e la pagina mostra da sola lo strato «Reati», con tassi ogni 100.000 residenti, variazioni testate, impennate e il grafico nel tempo, come per le città.

Per i quartieri con meno di 1.000 residenti (parchi, aree industriali) non si calcolano tassi: sulla carta sono tratteggiati e restano fuori dalle classifiche. I residenti sono quelli dell'anagrafe comunale, un po' più dei residenti ISTAT usati nel resto dell'atlante. Il municipio di ogni quartiere viene dal confine (baricentro dentro il municipio); per tre quartieri il censimento 2011 lo assegnava altrove, vale il confine.

Per aggiungere un'altra città serve un file per città con lo stesso schema: `<id>.json` (`meta.years`, `areas[]` con `id`, `name`, `short`, `mun`, `km2`, `pop[]`, …), `<id>.topo.json` (un oggetto con `properties.id`) e l'id in `index.json`. Roma (zone urbanistiche), Torino (circoscrizioni e quartieri), Bologna (aree statistiche) e Napoli (quartieri) pubblicano confini e residenti sui rispettivi portali open data; i reati per quartiere, a oggi, nessuna.

## Metodo in breve

- Tasso = delitti / popolazione media dell'anno (media tra 1° gennaio dell'anno e del successivo) × 100.000, come ISTAT.
- Variazioni: rapporto tra tassi con test z sul logaritmo; |z| < 2 è "non significativa" (grigio).
- Impennata: tasso dell'anno ≥ 1,25 volte la media dei tre anni precedenti esclusi 2020–2021, z ≥ 3, almeno 20 casi. Calo netto: la regola inversa. Ordinamento per estremo inferiore dell'intervallo al 95% oppure per casi in più.
- Rimpatri ogni 100 ordini: somma degli ultimi quattro anni, solo per i paesi con almeno 1.000 ordini nel periodo. Gli ordini di un anno e i rimpatri dello stesso anno non riguardano necessariamente le stesse persone.
- Reati rari (omicidi, violenze sessuali, rapine in casa e nei negozi, usura): classifiche sulla media 2022–2024.
- Comuni che non sono capoluogo: l'ISTAT non pubblica i delitti per comune, quindi la scheda mostra i tassi ufficiali della provincia e lo dice in apertura. Senza conteggi le variazioni sono rapporti tra tassi, segnate con un cerchio vuoto perché non hanno test statistico; per i reati rari si confrontano due medie triennali (2022–2024 su 2017–2019).
- Sardegna: l'ISTAT pubblica i delitti per le quattro province storiche (Sassari, Nuoro, Cagliari, Oristano). Ogni comune sardo va nella provincia del suo codice comunale 1995–2005 (colonna «Codice Comune numerico con 103 province» dell'elenco ISTAT), che il codelist `CL_ITTER107` collega direttamente a una delle quattro. Così Bosa, Isili e Budoni, passati ad altre province nel 2005, restano con Nuoro.
