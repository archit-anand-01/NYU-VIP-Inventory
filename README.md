# Inventory

A small inventory manager for lending equipment out and knowing who has it.

Two pages:

- **Inventory** — every item, its total and in-stock counts, VIP group, photo, and an
  **Issue** button on each row.
- **Issued Log** — every issue record, as a flat log or grouped **By person**, with
  returns.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run build && npm start   # production
```

Deploys to Vercel as-is (`vercel` / import the repo) — both pages are static.

## What an item has

| Field | Notes |
| --- | --- |
| Name | required |
| Unique ID | assigned automatically: three letters from the VIP name plus a 4-digit number, e.g. `DES0001`. Never changes once assigned |
| Total quantity | how many you own |
| In stock | **calculated**: total minus whatever is currently issued out |
| VIP | dropdown of VIP groups — ships with *Desire Path* and *Technology and Innovation catalyst*, and **+ Add new VIP** adds more. The list is saved with the data and drives the ID prefix and the filter |
| Photo | optional; resized to ~1000px and re-encoded as JPEG before it is stored |
| Location, Notes | optional |

The prefix is the first three alphanumeric characters of the VIP name uppercased
(`Desire Path` → `DES`, `Technology and Innovation catalyst` → `TEC`, no VIP → `GEN`).
The number counts up within that prefix and reuses the lowest free slot, so deleting
`DES0002` frees it for the next Desire Path item. Changing an item's VIP later does
**not** rewrite its ID — a label already on the box stays correct.

## Issuing and returning

**Issue** opens a form with Name, NetID, Phone, Quantity and Date (defaults to today,
quantity capped at what is in stock). Issuing drops the in-stock count; the record
shows up on the Issued Log.

**Return** on the log takes a quantity, so partial returns work — 2 of 5 back leaves 3
still out. Returned units go straight back into stock.

Guard rails: you cannot issue more than is in stock, and you cannot lower an item's
total below the number of units currently issued out.

## Where the data lives

Everything is stored **in the browser** — records in `localStorage`, photos in
`IndexedDB`. Nothing is sent to a server, and two tabs of the app stay in sync.

That means the data is per-browser: it does not follow you to another laptop or phone,
and other people opening the site see their own empty copy. To move or safeguard it:

- **Backup** downloads one JSON file with all items, issue records and photos.
- **Restore** loads that file back (it replaces what is currently there).
- **Export CSV** on either page gives a spreadsheet-friendly snapshot.

If several people need to share one live inventory, the storage layer in
[`src/lib/store.ts`](src/lib/store.ts) is the only place that touches persistence —
swapping it for a hosted database (Supabase, Postgres, Firebase) is a contained change.

## Layout

```
src/app/page.tsx          Inventory page
src/app/issued/page.tsx   Issued Log page
src/lib/store.ts          data + persistence (the single source of truth)
src/lib/images.ts         photo resizing and IndexedDB storage
src/lib/id.ts             alphanumeric ID generation
src/components/           modals, nav, table/card pieces
```
