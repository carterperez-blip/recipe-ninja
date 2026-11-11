# Recipe Ninja

A personal recipe library for the browser and iPhone (install it from Safari with Share, then Add to Home Screen).

- Save recipes from a link, pasted text or a photo (up to 3 photos of a page or card), or type them in
- Find a picture from Pexels or Unsplash, with the photographer credited
- Ingredients and step-by-step instructions with a picture on every recipe
- Serving scaler: every recipe opens at 2 people
- US units by default with a metric toggle
- Pastel look

Product requirements: see the Recipe Ninja PRD (Claude Docs).

## Stack

Next.js on Netlify, Supabase (Postgres, Google sign-in, image storage), Claude API for text and photo import. AI use is capped at $10 a month.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # scaling, parsing and unit-conversion tests
```

Without Supabase settings the app runs in local mode: no sign-in, recipes stored in this browser only (with two sample recipes). With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set, it shows a Google sign-in screen and stores recipes in your Supabase project.

## Set up the services

1. **Supabase:** create a project and run `supabase/schema.sql` in the SQL editor.
2. **Google:** in Google Cloud Console create an OAuth client (type Web application). Add Supabase's callback URL (shown on Supabase's Authentication > Providers > Google page) as an authorized redirect URI. Paste the client ID and secret into that Supabase page and enable Google.
   - In Supabase Authentication > URL Configuration, set the Site URL to your Netlify address and add it, plus `http://localhost:3000`, to the redirect URLs.
   - Sign in once with your own Google account, then turn off "Allow new users to sign up" (Authentication > Sign In / Providers) so nobody else can create an account.
3. **Netlify:** add a site from this GitHub repo and set the variables listed in `.env.example`.
4. **Anthropic:** create an API key and set `ANTHROPIC_API_KEY`.
5. **Pictures:** create a free Pexels API key (or an Unsplash developer app) and set `PEXELS_API_KEY` or `UNSPLASH_ACCESS_KEY`.
