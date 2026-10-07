# NYU VIP Inventory

Equipment inventory for VIP teams: who owns what, how many are on the shelf, and
who borrowed the rest.

Two kinds of visitor:

| | Students (no login) | Faculty & administrators (one shared password) |
| --- | --- | --- |
| Item names and photos | yes | yes |
| How many are in stock | yes | yes |
| Total quantity, VIP group, storage location, item IDs | **no** | yes |
| Who borrowed what (the Issued Log) | **no** | yes |
| Add, edit, delete, issue, record returns | **no** | yes |

Students just open the site. Faculty click **Faculty sign in** and enter the
shared password.

## Running it

```bash
npm install
cp .env.example .env.local     # then fill in SESSION_SECRET and FACULTY_PASSWORD
npm run dev                    # http://localhost:3000
```

With no Supabase keys set, the app stores everything in a local `.data/` folder —
handy for development, useless for a deployed app (serverless filesystems are
wiped between requests). Set the Supabase variables and it switches over
automatically.

## Deploying

1. **Create a Supabase project**, then open SQL Editor and run
   [`supabase/schema.sql`](supabase/schema.sql). It creates the three tables, turns
   on Row Level Security, and makes the private `item-photos` storage bucket.
2. **Deploy to Vercel** (import the repo; no build settings needed).
3. **Set four environment variables** in Vercel → Settings → Environment Variables:

   | Variable | Where it comes from |
   | --- | --- |
   | `SESSION_SECRET` | `openssl rand -base64 32` |
   | `FACULTY_PASSWORD` | whatever you want faculty to type |
   | `SUPABASE_URL` | Supabase → Settings → API → Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` key |

4. **Load the existing items** once:

   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
     node scripts/import-backup.mjs seed/starter-inventory.json
   ```

The `service_role` key bypasses database security rules. It belongs in server
environment variables only — never in the repo, never in a `NEXT_PUBLIC_` variable.

## How the two views are kept apart

The split is enforced on the server, not by hiding buttons:

- **`src/server/queries.ts`** builds a separate payload for signed-out visitors
  containing only name, photo handle and in-stock count. Issue records are read
  to work out availability and then discarded — no borrower, netID or phone ever
  reaches the page.
- **`/issued`** redirects to `/login` before it fetches anything, and
  `getFacultyData()` re-checks the session on its own.
- **Every server action** calls the session guard first. Server actions are
  reachable by direct POST, so a replayed request from a signed-out browser is
  refused even with a valid action id.
- **Photos** are served through `/api/photo`. Students get an opaque per-item
  token rather than the item id, because the id carries the VIP prefix.
- The session is a signed, httpOnly, 7-day cookie — JavaScript on the page cannot
  read it.

Worth knowing: one shared password cannot tell you *which* professor issued
something, and when somebody leaves you rotate it for everyone. Moving to
per-person accounts later is a change to `src/server/session.ts` and the login
form, not to the rest of the app.

## What an item has

| Field | Notes |
| --- | --- |
| Name | required |
| Unique ID | assigned automatically: three letters from the VIP name plus a 4-digit number, e.g. `DES0001`. Never changes once assigned |
| Total quantity | how many you own |
| In stock | **calculated**: total minus whatever is currently issued out |
| VIP | dropdown of VIP groups — ships with *Desire Path* and *Technology and Innovation catalyst*, and **+ Add new VIP** adds more |
| Photo | optional; resized to ~1000px and re-encoded as JPEG before it is stored |
| Location, Notes | optional |

The prefix is the first three alphanumeric characters of the VIP name uppercased
(`Desire Path` → `DES`, `Technology and Innovation catalyst` → `TEC`, no VIP →
`GEN`). The number counts up within that prefix and reuses the lowest free slot,
so deleting `DES0002` frees it for the next Desire Path item. Changing an item's
VIP later does **not** rewrite its ID — a label already on the box stays correct.

## Issuing and returning

**Issue** opens a form with Name, NetID, Phone, Quantity and Date (defaults to
today, capped at what is in stock). Issuing drops the in-stock count; the record
appears on the Issued Log, as a flat log or grouped **By person**.

**Return** takes a quantity, so partial returns work — 2 of 5 back leaves 3 still
out. Returned units go straight back into stock.

Guard rails: you cannot issue more than is in stock, and you cannot lower an
item's total below the number of units currently issued out.

## Backups

**Backup** on the inventory page downloads one JSON file with every item, issue
record and photo. `scripts/import-backup.mjs` loads such a file back into either
store. **Export CSV** gives a spreadsheet-friendly snapshot of either page.

## Layout

```
src/app/                 routes: public inventory, /issued, /login, /api/*
src/server/db/           storage port + file and Supabase drivers
src/server/session.ts    cookie signing, password check, photo tokens
src/server/dal.ts        the session guard every action calls
src/server/queries.ts    student vs faculty payloads
src/server/actions.ts    every mutation, each one guarded
src/components/          the UI
supabase/schema.sql      run once in the Supabase SQL editor
```
