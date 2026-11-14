# Recipe Ninja

A personal recipe library for the browser and iPhone (install it from Safari with Share, then Add to Home Screen).

- Save recipes from a link, pasted text or a photo (up to 3 photos of a page or card), or type them in
- A picture on every recipe: upload your own photo (shrunk in the browser, stored in your Supabase `recipe-images` bucket), find one from Pexels or Unsplash (photographer credited), or paste a link and add a photo credit (e.g. CC BY)
- Ingredients and step-by-step instructions with a picture on every recipe
- Serving scaler: every recipe opens at 2 people
- Cook mode: full screen, one step at a time, screen kept awake
- Backup: download everything as one JSON file, or the recipes as a readable Markdown document (Back up your recipes, in the page footer)
- Mark as cooked: a cooked count and last-cooked date on every recipe, history you can edit, sorting by most cooked or not cooked in a while
- Meal plan: a week at a time, each meal for its own number of people; one tap adds the week's meals to the grocery list
- Grocery list: add a recipe's scaled ingredients; matching items combine (2 cups + 4 tbsp of milk becomes one line); tick items off
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
