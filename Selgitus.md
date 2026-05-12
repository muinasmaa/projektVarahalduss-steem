# Varahaldussüsteemi MVP — tehniline selgitus

Dokument kirjeldab rakenduse ehitust, failide rolli ja kuidas päringud andmebaasini liiguvad. Lugeja eeldab mõistmist veebiserverist (HTTP), JSON-ist ja relatsioonilisest mudelist.

## Üldine arhitektuur

Rakendus on **ühe protsessiga** Node.js server:

1. **Express** kuulab TCP porti (vaikimisi **3000**).
2. Kutsed teele `/api/...` lähevad **REST API** marsruutidele; need loevad ja kirjutavad **SQLite** andmebaasi.
3. Andmebaas ei ole eraldi protsess (nagu PostgreSQL), vaid **fail** kaustas `data/`. Töötamise ajal hoitakse seda mälus **sql.js** teegiga (SQLite loogika WebAssembly’na).
4. Kõik teised URL-id (nt `/`, `/assets.html`) serveeritakse kaustast `public/` kui **staatilised** HTML/CSS/JS failid.
5. Brauseris jooksva UI jaoks ei ole SPA-raamistikku: iga leht on oma HTML-fail, jagatud abifunktsioonid on `public/app.js`.

```
Brauser  →  HTTP GET/POST/DELETE  →  server/index.js (Express)
                                         ├── /api/* → routes/*.js → db.js → sql.js → varahaldus.sqlite
                                         └── /*     → public/* (failid otse ketaselt)
```

Andmete **jäädav salvestamine**: sql.js hoiab töö ajal andmeid mälus; `db.js` ekspordib pärast kirjutavaid toiminguid (ja transaktsiooni lõpus) baasi `Buffer`-ina tagasi faili `data/varahaldus.sqlite`.

## Projekti kaustad ja juurfailid

| Tee | Otstarve |
|-----|----------|
| `package.json` | Sõltuvused (`express`, `sql.js`) ja skriptid `npm run dev` / `start` — mõlemad käivitavad `node server/index.js`. |
| `package-lock.json` | Lukustatud sõltuvuste versioonid (genereeritud `npm install` poolt). |
| `README.md` | Kasutusjuhend (käivitamine, API kokkuvõte). |
| `.gitignore` | Ignoreerib `node_modules/`, lokaalse SQLite faili jms. |

| Kaust | Otstarve |
|-------|----------|
| `server/` | Backend: Expressi sisselülitus, andmebaasikiht, API marsruudid, SQL skeem. |
| `public/` | Frontend: HTML lehed, ühine CSS ja JS abifunktsioonid. |
| `data/` | Tekitatakse käivitamisel; seal hoitakse `varahaldus.sqlite` (binaarne SQLite dump sql.js ekspordina). |
| `node_modules/` | Paigaldatud teegid (ära käsitsi redigeeri). |

---

## Backend: `server/index.js`

- Laeb `db.initDb()` **asünkroonselt** (sql.js WASM laadimine nõuab `await`).
- Loob Expressi `app`, seab `express.json()` kehamaksimaaliga (JSON API jaoks).
- Ühendab marsruudid: `app.use('/api/assets', assetsRouter)`, `app.use('/api/operations', operationsRouter)`.
- `app.use(express.static('public'))` — statiline sisu.
- Veateated: keskne `app.use((err, ...))`, tagastab JSON-is `{ error: "..." }` ja HTTP staatuse `err.status` või 500.
- `app.listen(PORT)` käivitatakse **alles pärast** edukat `initDb()` lahendust.

---

## Andmebaasikiht: `server/db.js`

**sql.js** ei paku sama API-t mis `better-sqlite3`; siin on kirjutatud **väike ühilduv kiht**, et `routes/*.js` saaks edasi kasutada tuttavaid mustreid:

- `getDb().prepare(sql).all(arg)` — mitu rida (objektidena).
- `getDb().prepare(sql).get(...)` — üks rida või `undefined`.
- `getDb().prepare(sql).run(...)` — INSERT/UPDATE/DELETE; tagastab `{ lastInsertRowid, changes }` (nagu better-sqlite3).
- `getDb().transaction(fn)()` — `BEGIN IMMEDIATE` … `COMMIT` / `ROLLBACK`; väljaspool transaktsiooni salvestatakse fail üks kord.

**Nimelised parameetrid** API SQL-is kasutavad `@nimi` süntaksit; enne päringut teisendatakse need sql.js jaoks `$nimi` kujule.

**`initDb()`**:

1. Laadib WASM-i `require.resolve('sql.js')` kausta kaudu.
2. Kui `data/varahaldus.sqlite` on olemas, avab selle faili sisuga; muidu tühi mälubaas.
3. `PRAGMA foreign_keys = ON` (välisvõtmed).
4. Käivitab `schema.sql` (`exec`) — tabelid ja indeksid `IF NOT EXISTS` režiimis.
5. Kui `assets` on tühi, täidab **`seedIfEmpty()`** (kolm näidisvara + üks näidistoiming).

**Püsisalvestus**: `saveToFile()` kutsub `database.export()` ja kirjutab tulemuse `data/varahaldus.sqlite`. Kõrvaldamaks liigset ketta I/O-d ei salvestata igal `SELECT`-il, vaid peamiselt pärast **kirjutavaid** `run()`-e ja transaktsiooni lõppu (kui `transactionDepth === 0`).

---

## SQL skeem: `server/schema.sql`

Määratleb SQLite objektid:

- **`assets`** — seade (vara): PK `asset_id`, `status` (`IN_STOCK` \| `ASSIGNED` \| `WRITTEN_OFF`), kuupäevad, kasutusiga kuudes, garantii lõpp, ostuarve, vastutaja ja ruum (praegune olek).
- **`operations`** — akt / toiming: tüüp `ISSUE` või `RETURN`, unikaalne `number`, ajatempel, koostaja, töötaja, ruum/pilet (kasutusse andmisel), märkused.
- **`operation_assets`** — N:M seos: millised varad kuulusid millisesse toimingusse; välisvõtmed operaatorile ja varale.

Indeksid kiirendavad filtreid oleku, alagrupi ja vastutaja järgi.

---

## API: `server/routes/assets.js`

| Meetod | Tee | Tegevus |
|--------|-----|---------|
| GET | `/api/assets` | Päringuparameetrid: `id`, `name`, `subgroup`, `responsible`, `inStock`, `includeWrittenOff`. Ehitab dünaamilise `WHERE`. Kui otsitakse **ainult** `id` järgi ja vastet pole → **404** sõnumiga „Sellise ID-ga vara…“. |
| GET | `/api/assets/:assetId` | Ühe vara read + seotud toimingute loend (JOIN `operation_assets` / `operations`). |
| POST | `/api/assets` | Uue vara lisamine (laosse). Unikaalsuse kontroll; konflikt → 409. |
| DELETE | `/api/assets/:assetId` | **Soft-delete**: `status = WRITTEN_OFF`, vastutaja/ruum nullitud. |

---

## API: `server/routes/operations.js`

| Meetod | Tee | Tegevus |
|--------|-----|---------|
| GET | `/api/operations` | Kui `?limit=N`, tagastab N viimast ajas kahanevalt; muidu kogu nimekiri (ülempiir 500). |
| GET | `/api/operations/:id` | Üks toiming + selles olevate varade praegused väljad (pärast viimast uuendust). |
| POST | `/api/operations` | Kinnitatud toiming. **ISSUE**: ainult `IN_STOCK` varad, nõutav `room` ja `ticket`, seejärel varad `ASSIGNED` ja vastutaja/ruum uuendatud. **RETURN**: ainult `ASSIGNED` varad, mille `current_responsible_name` ühtib `employeeName`-ga; seejärel `IN_STOCK` ja väljad nullitud. Unikaalne aktinumber genereeritakse `nextOperationNumber()` abil (`AKT-` + järjekorranumber `operation_id` põhjal). |

`nextOperationNumber()` loeb `MAX(operation_id)` ja ehitab järgmise stringi.

---

## Frontend: kaust `public/`

| Fail | Roll |
|------|------|
| `index.html` | Avaleht: lingid, viimased 10 toimingut (`GET /api/operations?limit=10`). |
| `assets.html` | Varade nimekiri filtritega; vorm uue vara lisamiseks; juhend (details/summary). |
| `asset.html` | `?id=` — varakaart, UI arvutab vanuse, järelejäänud kasutusaja ja garantii oleku (`app.js`); seotud toimingud; mahakandmine (`DELETE`). |
| `operations.html` | Kõik toimingud (`GET /api/operations`). |
| `operation.html` | `?id=` — ühe toimingu detail ja seotud varad. |
| `new-operation.html` | Uue toimingu vorm: ISSUE (ID-d tekstina, ruum, pilet) või RETURN (laadi töötaja varad, märgi checkboxid); `POST /api/operations`. |
| `styles.css` | Visuaalne stiil (tumedat tausta, kaardid, tabelid, nupud). |
| `app.js` | Jagatud: `apiJson` (fetch + veateated), kuupäeva/kuude arvutused, oleku ja toimingu tüübi tõlked eesti keelde, navigeerimise „aktiivne“ link. |

Igal HTML-lehel on väike **inline** `<script>`, mis kutsub `app.js` funktsioone ja API-d — eraldi bundlerit pole.

---

## Tüüpiline päringu voog (näide)

**Kasutaja lisab uue toimingu „kasutusse andmine“:**

1. `new-operation.html` koostab JSON-i `{ type: "ISSUE", employeeName, assetIds, room, ticket, notes }`.
2. `fetch('/api/operations', { method: 'POST', body: JSON.stringify(...) })`.
3. `operations.js` valideerib, käivitab transaktsiooni: `INSERT` `operations`, iga vara jaoks `UPDATE assets`, `INSERT` `operation_assets`.
4. `db.js` salvestab transaktsiooni järel `varahaldus.sqlite`.
5. Vastus 201 koos loodud toiminguga; brauser suunab `operation.html?id=...`.

---

## Olulised disainivalikud (lühidalt)

- **Soft-delete** varade puhul säilitab toimingute ajaloo (`WRITTEN_OFF` ei kustuta rida).
- **sql.js** vältis natiivse SQLite mooduli kompileerimist Windowsis.
- **Autentimist** MVP ei sisalda; eeldus on, et kasutaja on ATK rollis.
- **Ruum** on vabas vormis tekst, mitte eraldiseisev ruumitabel.

---

## Seosed väliste dokumentidega

- `ylesanne.md` — ärinõuded ja kasutuslood (projekti lähteülesanne).
- `README.md` — praktiline käivitus ja kiire API ülevaade.
