# BDO Node Optimizer

Non-commercial MVP for comparing Black Desert Online worker nodes with one standardized benchmark worker.

## Current Status

- React/Vite/TypeScript frontend.
- Node/Express REST API.
- Local JSON datasets under `src/data`.
- Calculation engine with Vitest coverage.
- BDOLytics market provider enabled by default with Arsha fallback available.
- Workerman import for canonical production node IDs, workload, yields, distances, item IDs, and English names.

Workerman fills most static production-node fields. Community workbook import remains an override layer when run after Workerman import.

## Commands

```sh
npm install
npm run import:workbook
npm run import:workerman
npm run template:community
npm run import:community
npm run dev
npm test
npm run build
npm start
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3001`

## Market Provider

Default provider:

```txt
MARKET_PROVIDER=bdolytics-arsha
BDO_MARKET_REGION=ASIA
BDOLYTICS_BASE_URL=https://bdolytics.com
ARSHA_BASE_URL=https://api.arsha.io
```

`BdolyticsMarketProvider` uses `market.getMarket` for current price, stock, total trades, and 14-day volume. Average daily sales is the real 14-day volume divided by 14; total trades remains the all-time total and is not treated as a 14-day metric. It does not expose current buy-order counts, so demand and liquidity lean on volume plus stock. Default `MARKET_PROVIDER=bdolytics-arsha` tries BDOLytics first and Arsha second. No market call runs in the browser.

The header market-server selector reloads rankings for the selected BDOLytics region and remembers the choice locally. Market endpoints also accept `?region=ASIA`, with supported values including `NA`, `EU`, `ASIA`, `MENA`, `JP`, `KR`, `TW`, `SA`, and `RU`.

Arsha direct provider:

```txt
MARKET_PROVIDER=arsha
BDO_MARKET_REGION=asia
```

Fallback manual provider:

```txt
MARKET_PROVIDER=manual
BDO_MARKET_REGION=asia
```

Manual market data lives in `src/data/manual-market.json`:

```json
[
  {
    "itemId": 9213,
    "currentPrice": 3270,
    "buyOrders": 11922,
    "sellOrders": 20000,
    "transactionVolume": 3343557280,
    "updatedAt": "2026-08-16T00:00:00.000Z"
  }
]
```

## Benchmark Worker

All rankings use `src/data/worker-presets.json`:

```json
{
  "id": "artisan-goblin",
  "name": "Artisan Goblin",
  "workSpeed": 150,
  "movementSpeed": 7.5,
  "luck": 0,
  "endurance": 0
}
```

Do not change default global ranking to custom worker stats in MVP.

## Data Import

Workerman import:

```sh
npm run import:workerman
```

Outputs:

```txt
src/data/nodes.json
src/data/items.json
src/data/yields.json
src/data/distances.json
```

Workerman data is fetched at import time from `https://shrddr.github.io/workerman/data/`; copied snapshots are not committed by default. Imported nodes use resource percentage `0%` for global ranking, so `workload = baseWorkload * 2`. Lucky-cycle yields and giant-specific normal yields are preserved on products and in `yields.json`, but default ranking uses normal `unlucky` yield only because the benchmark worker has `luck: 0`.

Workbook import:

```sh
npm run import:workbook
```

Input:

```txt
bdo_complete_all_nodes_master_2026.xlsx
```

Outputs:

```txt
src/data/nodes.json
src/data/items.json
```

Item IDs are temporary negative IDs until matched against extracted client data or community-verified IDs. Negative item IDs are skipped by market fetches to avoid fake market joins.

## Community Data Entry

Generate the spreadsheet community can fill:

```sh
npm run template:community
```

Output:

```txt
bdo_node_optimizer_community_template_2026.xlsx
```

Sheets:

```txt
Nodes
Products
Items
Market_Manual
Worker_Presets
Data_Dictionary
Source_Notes
Validation_Lists
```

After community edits the workbook, import it:

```sh
npm run import:community
```

The import writes:

```txt
src/data/nodes.json
src/data/items.json
src/data/manual-market.json
src/data/worker-presets.json
```

The website also includes a `Data` page for browser-side editing and validation. It can export JSON, validate JSON, and save the JSON back to `src/data` through the local backend.

## Calculation Formula

Cycle formula is isolated in `src/calculations/cycle.ts`:

```ts
workMinutes = Math.ceil(totalWorkload / worker.workSpeed) * 10
travelMinutes = ((distance / worker.movementSpeed) * 2) / 60
cycleMinutes = workMinutes + travelMinutes
cyclesPerDay = 1440 / cycleMinutes
```

If workload or distance is missing, node is incomplete instead of estimated silently.

## API

```http
GET /api/nodes
GET /api/nodes/:id
GET /api/rankings
GET /api/rankings/:id
GET /api/items
GET /api/items/:id
GET /api/items/:id/market
GET /api/market/status
GET /api/data/export
GET /api/data/validate
POST /api/data/validate
POST /api/data/import
```

## Data Needed From Community

- Real BDO item IDs for products.
- Node workload.
- Worker travel distance from town to node.
- Verified yield ranges.
- Asia market snapshots or working Arsha endpoint details.

## Disclaimer

Unofficial, non-commercial fan tool. Not affiliated with or endorsed by Pearl Abyss. Market providers are unofficial and replaceable.
