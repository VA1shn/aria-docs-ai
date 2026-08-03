# ARIA Backend (Supabase)

PostgreSQL schema, Auth, and Edge Functions for the ARIA MVP.

## Stack

- **Supabase** (Auth + Postgres + Edge Functions)
- **TypeScript** Deno edge functions
- **Gemini 2.5 Flash** via Google AI Studio (`generativelanguage.googleapis.com`)

## Layout

```
supabase/
  config.toml
  migrations/
    20260802000000_initial_schema.sql
  functions/
    _shared/
      types.ts
      gemini.ts              # Gemini client
      prompt-manager.ts      # Prompt templates
      json-validator.ts      # Structured JSON validation
      document-formatter.ts  # Markdown / DB row shaping
      ai-service.ts          # analyze / continue / generate wrappers
      handlers.ts            # REST domain logic + persistence
      cors.ts / http.ts / supabase.ts
    api/                     # REST router (projects, sessions, documents)
    analyze-brief/
    continue-conversation/
    generate-documents/
```

## Database

| Table | Purpose |
| --- | --- |
| `users` | Profile linked to `auth.users` |
| `projects` | Client / project metadata + brief |
| `sessions` | Intake state + **structured requirements** (JSONB) |
| `messages` | Chat transcript |
| `generated_documents` | BRD / SRS / stories / acceptance / summary (versioned) |

Structured requirements stay on `sessions.requirements`. Generated markdown lives only in `generated_documents`.

## REST API (`functions/v1/api`)

All routes require `Authorization: Bearer <access_token>` and `apikey: <anon_key>`.

Base: `{SUPABASE_URL}/functions/v1/api`

| Method | Path | Body / notes |
| --- | --- | --- |
| `POST` | `/projects` | `{ clientName, projectName, industry?, brief?, attachments? }` |
| `GET` | `/projects` | List current user's projects |
| `GET` | `/projects/:id` | Project + sessions |
| `POST` | `/sessions/start` | `{ projectId, brief? }` → runs **analyzeBrief**, creates session + first question |
| `POST` | `/sessions/message` | `{ sessionId, content }` → runs **continueConversation** |
| `POST` | `/sessions/complete` | `{ sessionId }` → mark intake complete |
| `GET` | `/sessions/:id` | Session + messages + latest documents |
| `POST` | `/documents/generate` | `{ sessionId }` → runs **generateDocuments**, persists 5 docs |
| `GET` | `/documents/:id` | Single document row |

Response envelope:

```json
{ "ok": true, "data": { ... } }
// or
{ "ok": false, "error": "..." }
```

## Standalone AI functions

Useful for testing prompts without full persistence:

| Function | What it does |
| --- | --- |
| `analyze-brief` | Extract requirements, missing categories, first question |
| `continue-conversation` | Update requirements, ambiguity, next question, progress |
| `generate-documents` | Return 5 markdown docs (does not write to DB) |

## Local setup

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Copy env:

```sh
cp .env.example .env.local
```

3. Start local stack / link remote:

```sh
supabase start
# or
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

4. Set Edge Function secrets:

```sh
supabase secrets set GEMINI_API_KEY=your_google_ai_studio_key
# optional:
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

5. Serve functions:

```sh
supabase functions serve --env-file .env.local
```

6. Deploy:

```sh
supabase functions deploy api
supabase functions deploy analyze-brief
supabase functions deploy continue-conversation
supabase functions deploy generate-documents
```

## Auth

- Use Supabase Auth (email/password or Google OAuth once enabled in `config.toml` / dashboard).
- A trigger creates a `public.users` row on signup.
- Edge handlers also upsert the profile on first authenticated request.

## What you need to provide

| Secret / config | Where |
| --- | --- |
| Supabase project URL | Dashboard → Settings → API |
| `anon` key | Dashboard → Settings → API |
| `service_role` key | Dashboard → Settings → API (server only; never ship to browser) |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| Google OAuth client (optional) | For Google sign-in |

Frontend should use only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
