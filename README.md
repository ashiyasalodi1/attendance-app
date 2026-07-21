# Meeting Attendance App (QR based)

3 pages:
- `/form` — attendee fills name/details, gets a QR pass
- `/scan` — owner opens on phone/laptop, scans each pass at the door
- `/dashboard` — owner sees who's present and check-in time

Cost: **₹0** at this scale (100 people, occasional use). No server to manage —
runs on Vercel (free) + Supabase (free database).

---

## Step 1 — Create the database (Supabase)

1. Go to https://supabase.com → Sign up (free) → "New Project"
2. Set a project name + password → wait ~2 min for it to spin up
3. Go to **SQL Editor** (left sidebar) → **New query**
4. Open `supabase-schema.sql` from this project, copy everything, paste it in,
   click **Run**
5. Go to **Project Settings → API** (left sidebar, gear icon)
   - Copy the **Project URL**
   - Copy the **anon public** key
   - Keep this tab open, you'll need both in Step 3

## Step 2 — Push this code to GitHub

1. Go to https://github.com/new → create a new repository (e.g. `attendance-app`)
2. Follow GitHub's "push an existing folder" instructions, or simply drag-and-drop
   all these files into the new repo via the GitHub website's upload option
   (Add file → Upload files)

## Step 3 — Deploy on Vercel (free)

1. Go to https://vercel.com → Sign up with your GitHub account
2. Click **Add New → Project** → select the `attendance-app` repo you just pushed
3. Before clicking Deploy, expand **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → paste the Project URL from Step 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → paste the anon public key from Step 1
4. Click **Deploy** → wait ~1 minute
5. You'll get a live link like `https://attendance-app-yourname.vercel.app`

## Step 4 — Use it on the day of the meeting

- Share `https://yourapp.vercel.app/form` with attendees (WhatsApp/email) —
  they fill it and get their QR pass
- At the door, open `https://yourapp.vercel.app/scan` on your phone browser,
  allow camera access, scan each pass
- Open `https://yourapp.vercel.app/dashboard` anytime to see who's checked in

Since usage is occasional (once a week/month), there's no ongoing cost —
Vercel and Supabase free tiers don't charge when idle.

## Notes

- The `/scan` page needs camera permission — works best over HTTPS (Vercel
  gives you HTTPS automatically).
- For a new event, you can either reuse the same list or add an `event_name`
  filter later if you want separate attendance sheets per meeting.
- If more than ~100–200 people per event, everything here still works fine —
  free tiers comfortably cover that.
