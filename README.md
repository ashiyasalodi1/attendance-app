# Event Registration & QR Attendance

Flow: **Owner login → create event → share registration link → user receives QR pass → scan at venue → live attendance dashboard → download reports**.

## Setup

1. Create a Supabase project and run `supabase-schema.sql` in its SQL Editor.
2. Copy `.env.local.example` to `.env.local` and fill all five variables. The service-role key is server-only; never expose it in browser code or commit it.
3. Install and run locally:

   ```bash
   npm install
   npm run dev
   ```

4. Add the same environment variables in Vercel, then deploy. Use HTTPS in production so the venue scanner can access the camera.

## Owner workflow

1. Open `/owner-login` and sign in.
2. In `/dashboard`, create an event and copy its `/form/<event-slug>` registration link.
3. Share that link. Registrants provide name, employee code, WhatsApp, division and photo, then receive their QR pass.
4. Click **Event QR / Print** on the event card and display or print that QR at the venue. Attendees scan it on their own phones and verify with their employee code and WhatsApp number to self check in.
5. Monitor the dashboard live and download present/absent CSV reports for the selected event.

## Notes

- Registration, event lookup and owner operations are separated: only the event-link lookup and registration endpoint are public.
- The attendee photo bucket is public so the pass and owner dashboard can display photos. Do not put sensitive documents in it.
- The `attendee-photos` bucket is created by the SQL script.
