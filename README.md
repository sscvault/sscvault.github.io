# Boomeriyah Lost & Found

Static HTML/CSS/JS website for **Shri Shivaji College of Arts, Commerce and Science**.

Pixel-art 8-bit UI · Supabase backend

---

## Quick Start

### 1. Create Supabase project
1. Go to https://supabase.com → New project
2. Open **SQL Editor** and run the schema below
3. Copy **Project URL** + **anon public key** from Project Settings → API

### 2. Schema (run once in SQL Editor)

```sql
create table items (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  category text not null,
  location text not null,
  item_date date not null,
  contact text not null,
  status text not null check (status in ('lost', 'found')),
  image_url text,
  created_at timestamptz default now()
);

alter table items enable row level security;

create policy "Public read" on items for select using (true);
create policy "Public insert" on items for insert with check (true);

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true);

create policy "Public upload" on storage.objects
  for insert with check (bucket_id = 'item-images');

create policy "Public read images" on storage.objects
  for select using (bucket_id = 'item-images');
```

### 3. Configure the site
Open `js/config.js` and replace:

```js
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
```

### 4. Run locally
Just open `index.html` in a browser  
(or use any static server: `npx serve .` / VS Code Live Server / Netlify Drop / GitHub Pages)

---

## Pages
| File | Purpose |
|------|---------|
| `index.html` | Home + stats + how it works |
| `report-lost.html` | Report a lost item |
| `report-found.html` | Report a found item |
| `browse.html` | Search & filter all items |
| `contact.html` | FAQ + contact |

---

## Features
- Pixel-art 8-bit UI (Press Start 2P font)
- Report Lost / Found with optional image upload
- Browse with filters: status, category, location, date range, text search
- Live counts on homepage
- Fully static frontend (Supabase handles storage + DB)

---

## Notes for submission
- Replace the placeholder email on the Contact page with a real one
- Keep the anon key public (it is designed for browser use)
- RLS is open for read + insert only (no update/delete for public users)
