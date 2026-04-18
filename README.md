# AI Price Tracker (Deal Drop)

AI Price Tracker is a Next.js app for tracking product prices from e-commerce URLs.
Users can sign in with Supabase Auth (Google or email/OTP), add product links, and store tracked prices in Supabase.

## Current Progress

### Completed

- Next.js App Router project scaffolded.
- Supabase SSR auth wiring (server client, browser client, proxy/middleware session refresh).
- Auth callback route with OTP and code exchange handling.
- Landing page and Add Product form UI.
- Server action to add or update products and append price history.
- Firecrawl integration utility prepared for extraction.

### In Progress / Missing

- Product list rendering on the home page.
- Price history visualization.
- Alerts/notifications when a tracked price drops.
- Background/scheduled re-check of product prices.
- Test coverage (unit/integration/e2e).

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Supabase (Auth + Postgres)
- Tailwind CSS v4 + shadcn/ui
- Firecrawl (planned runtime dependency for scraping)

## Local Setup

1. Install dependencies.

	npm install

2. Configure environment variables in .env.local.

	NEXT_PUBLIC_SUPABASE_URL=...
	NEXT_PUBLIC_SUPABASE_ANON_KEY=...
	FIRECRAWL_API_KEY=...

3. Run development server.

	npm run dev

4. Build for production check.

	npm run build

## Expected Database Tables

This app currently expects at least:

- products
  - id
  - user_id
  - url
  - name
  - current_price
  - currency
  - image_url
  - created_at
  - updated_at
  - unique constraint on (user_id, url)
- price_history
  - id
  - product_id
  - price
  - currency
  - checked_at

## Review Findings (High Priority)

The following issues were found during a full project review and should be addressed first.

1. Runtime breakpoints in server actions.
	- app/actions.js calls scrapeProduct and redirect but does not import them.
	- This can crash add-product and sign-out flows at runtime.

2. Data access control gaps in server actions.
	- getProducts currently fetches all products without scoping to the signed-in user.
	- deleteProduct deletes by id only and does not verify ownership.
	- This must be fixed in code even if RLS exists, so server logic enforces ownership.

3. Open redirect risk in auth callback.
	- app/auth/callback/route.js accepts next from query and redirects using URL(next, origin).
	- External URLs can potentially be used unless next is sanitized to internal paths.

4. Firecrawl dependency mismatch.
	- lib/firecrawl.js imports @mendable/firecrawl-js, but it is not listed in package dependencies.
	- Once scrapeProduct is imported into actions, this becomes a hard runtime/build failure.

5. Main product workflow is incomplete.
	- app/page.jsx hardcodes products as an empty array instead of fetching from storage.
	- Users can add products, but cannot view tracked items in the UI.

## Other Improvements

- Mount a global toaster component so toast messages are visible.
- Fix typo classes (text-grey-* should be text-gray-*).
- Remove unused font imports in app/layout.js or apply them properly.
- Validate incoming product URLs to allow only safe http/https targets.
- Add monitoring/logging around scraping failures and auth callback failures.

## Recommended Roadmap

### Phase 1: Stability and Security

- Fix missing imports in server actions.
- Scope all product queries/deletes by authenticated user.
- Sanitize callback next to internal relative paths only.
- Install and verify Firecrawl SDK dependency.

### Phase 2: Core Product Experience

- Fetch and render tracked products on the home page.
- Add delete and detail/history views.
- Show loading/empty/error states consistently.

### Phase 3: Automation and Alerts

- Add scheduled price refresh jobs.
- Trigger notifications for price-drop thresholds.
- Add dashboard metrics (last checked, best price, change percent).

### Phase 4: Quality

- Add unit tests for actions and auth logic.
- Add integration tests for add-product/auth callback paths.
- Add e2e smoke tests for sign-in and product tracking.

## Scripts

- npm run dev
- npm run lint
- npm run build
- npm run start
