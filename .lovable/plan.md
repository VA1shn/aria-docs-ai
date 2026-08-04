# ARIA — Cloud credentials + hydration fix

## What we just did
- Enabled Lovable Cloud for the project.
- Supabase URL and publishable key are now auto-injected into `.env`.

## What needs fixing
The preview shows a React hydration mismatch caused by two issues:

1. **Invalid HTML nesting in `src/routes/dashboard.tsx`** — a `<Skeleton>` (renders a `<div>`) is nested inside a `<p>` tag. React warns during hydration.
2. **Browser extension attributes on `<body>`** — Grammarly injects `data-new-gr-c-s-check-loaded` and `data-gr-ext-installed`, which differ between server and client. Adding `suppressHydrationWarning` to the `<body>` tag silences this.

## Steps
1. Replace the `<p>` wrapper around the dashboard stat skeleton with a `<div>`.
2. Add `suppressHydrationWarning` to `<body>` in `src/routes/__root.tsx`.
3. Run a build check to confirm the hydration warning is gone.
4. Verify Lovable Cloud credentials are present in `.env`.

## No other changes
This is a targeted fix for the runtime warning and credential setup. No UI redesign or feature work.