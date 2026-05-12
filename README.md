# IKT varahaldussüsteemi MVP (ATK vaade)

Töötav prototüüp: **Node.js + Express + SQLite** (mootor: **sql.js**, WebAssembly) ja lihtne brauseri UI. Andmed hoitakse failis `data/varahaldus.sqlite` (sünkroonitud pärast kirjutavaid päringuid).

## Eeldused

- [Node.js](https://nodejs.org/) **18+** (kaasas `npm`)

## Käivitamine

### Windows (PowerShell) — soovitatud käsud

Ava PowerShell, mine projekti kausta (kohanda teed vastavalt sellele, kus repo sul on):

```powershell
cd "C:\Users\<sinu-kasutaja>\...\projektVarahaldussüsteem"
npm.cmd install
npm.cmd run dev
```

Kasuta **`npm.cmd`**, mitte ainult `npm`, et vältida *execution policy* viga (`npm.ps1 cannot be loaded`).

Sama efektiga on ka **`npm.cmd start`** (projektis on see samaväärne `run dev`-iga).

Peata server terminalis: **Ctrl+C**.

### Windows (cmd.exe) või Git Bash

Seal töötab tavaliselt ka lühike vorm:

```bash
cd projektVarahaldussüsteem
npm install
npm.cmd run dev
```

### Linux / macOS

```bash
cd projektVarahaldussüsteem
npm install
npm run dev
```

### Ebaõnnestunud installi puhul

Kui eelmine `npm install` jäi pooleli ja tekivad `EPERM` / katki `node_modules`, siis **sulge terminal ja IDE aknad**, mis projekti võisid lukustada, kustuta projektis kaust `node_modules` (vajadusel ka `package-lock.json`) ja käivita uuesti **`npm.cmd install`** (Windows PowerShell) või `npm install` (teised terminalid).

---

Server jookseb vaikeport **3000** peal. Ava brauseris: **http://localhost:3000**

Esimesel käivitamisel luuakse andmebaas faili `data/varahaldus.sqlite` ja lisatakse näidisandmed (seed), kui varasid pole.

## Põhivoogud

| Leht | URL | Kirjeldus |
|------|-----|-----------|
| Avaleht | `/` | Lingid + 10 viimast toimingut |
| Varad | `/assets.html` | Otsing, uus seade, juhend |
| Varakaart | `/asset.html?id=…` | Detailid, arvutused, mahakandmine |
| Toimingud | `/operations.html` | Kõik aktid |
| Toiming | `/operation.html?id=…` | Toimingu detail + seadmed |
| Uus toiming | `/new-operation.html` | Kasutusse andmine / tagastamine |

## API (REST)

| Meetod | Tee | Kirjeldus |
|--------|-----|-----------|
| `GET` | `/api/assets` | Filtrid: `id`, `name`, `subgroup`, `responsible`, `inStock`, `includeWrittenOff` |
| `GET` | `/api/assets/:assetId` | Varakaart + seotud toimingud |
| `POST` | `/api/assets` | Uus seade (`asset_id`, `name`, `subgroup`, `purchase_date`, `warranty_end_date`, …) |
| `DELETE` | `/api/assets/:assetId` | Mahakandmine (**soft-delete**: `WRITTEN_OFF`) |
| `GET` | `/api/operations?limit=10` | Viimased toimingud |
| `GET` | `/api/operations` | Kõik toimingud |
| `GET` | `/api/operations/:id` | Toimingu detail |
| `POST` | `/api/operations` | Body: `{ type, employeeName, assetIds, room?, ticket?, notes? }` |

`POST /api/operations`:

- `type: "ISSUE"` — ainult **laos** olevad varad; nõuab **ruumi** ja **pileti** numbrit.
- `type: "RETURN"` — ainult **töötaja nimel** (`ASSIGNED`) olevad valitud varad.

## Manuaalne kontroll (user story järgi)

1. **Arvele võtmine**: `Varad` → täida “Uus seade” → otsi ID järgi.
2. **Otsing**: filtrid (ID / nimetus / alagrupp / vastutaja / laos).
3. **Varakaart**: klõpsa ID-l; kontrolli vanus / järelejäänud kasutusiga / garantii olek.
4. **Mahakandmine**: varakaart → `Mahakanda` → vara kaob vaikimisi nimekirjast (`Peida mahakantud`).
5. **Kasutusse andmine**: `Uus toiming` → vali tüüp → täida töötaja, ID-d, ruum, pilet → kinnita → vara läheb `Kasutaja käes`.
6. **Tagastamine**: `Uus toiming` → tagastamine → laadi töötaja seadmed → vali → kinnita → `Laos`.

## Andmebaasi lähtestamine

Kustuta fail `data/varahaldus.sqlite` ja käivita server uuesti — luuakse uus tühi/seeditud baas.

## Tehniline märkus (Windows / Node 24+)

Projekt kasutab **`sql.js`** (puhas JS/WASM). **Ei ole vaja** Visual Studio C++ töökoormust ega `node-gyp` / `better-sqlite3` ehitust — see vältis olukorra, kus `better-sqlite3` ei leidnud ehitatud binaari ja `node-gyp` nurjus (`missing VC++ toolset`).
