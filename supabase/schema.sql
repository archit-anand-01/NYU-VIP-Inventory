-- NYU VIP Inventory — run once in the Supabase SQL editor.
-- Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists items (
  id             text primary key,
  name           text        not null,
  total_quantity integer     not null default 0 check (total_quantity >= 0),
  vip            text        not null default '',
  location       text        not null default '',
  notes          text        not null default '',
  has_image      boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists issues (
  id           text primary key,
  item_id      text        not null references items(id) on delete cascade,
  item_name    text        not null,
  person_name  text        not null,
  net_id       text        not null default '',
  phone        text        not null default '',
  quantity     integer     not null check (quantity > 0),
  date         date        not null,
  returned_qty integer     not null default 0 check (returned_qty >= 0),
  note         text        not null default '',
  created_at   timestamptz not null default now(),
  constraint returned_within_issued check (returned_qty <= quantity)
);

create index if not exists issues_item_id_idx on issues (item_id);
create index if not exists issues_date_idx on issues (date desc);

create table if not exists vips (
  name       text primary key,
  created_at timestamptz not null default now()
);

insert into vips (name) values
  ('Desire Path'),
  ('Technology and Innovation catalyst')
on conflict (name) do nothing;

-- Row Level Security on with NO policies means: nothing reaches these tables
-- through the anon or authenticated keys. The app talks to them only from
-- server code using the service_role key, which bypasses RLS — and that code
-- checks the faculty session first. Students never get a database connection.
alter table items  enable row level security;
alter table issues enable row level security;
alter table vips   enable row level security;

-- Private bucket for item photos. The app streams them through /api/photo,
-- so there is no public object URL for anyone to guess.
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', false)
on conflict (id) do nothing;
