# Recipe Ninja

A personal recipe library for the browser and iPhone (install it from Safari with Share, then Add to Home Screen).

- Save recipes from a link, pasted text or a photo, or type them in
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

Until Supabase is connected, recipes are stored in the browser only.

## Set up the services

1. **Supabase:** create a project, run `supabase/schema.sql` in the SQL editor, then turn on the Google provider under Authentication.
2. **Google:** create an OAuth client and paste its ID and secret into Supabase's Google provider settings.
3. **Netlify:** add a site from this GitHub repo and set the variables listed in `.env.example`.
4. **Anthropic:** create an API key and set `ANTHROPIC_API_KEY`.
