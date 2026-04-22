# Deployment checklist

This app has three runtime pieces that must all run in production:

1. **SvelteKit app** — serves the UI + API routes (`npm run build && node build` or a platform adapter).
2. **BullMQ worker** — publishes scheduled posts (`node src/worker/scheduler-worker.js`).
3. **Redis** — queue backing store for BullMQ.

## 1. Environment variables

Copy `.env.example` → `.env` (or set in your host's dashboard). Every value below must be set in **production**:

| Var | Where it's used | Notes |
| --- | --- | --- |
| `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` | Browser (Supabase client) | Safe to ship to client. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Server (API routes + worker) | **Never expose.** Service key bypasses RLS. |
| `REDIS_URL` | Server + worker | e.g. Upstash / Railway / Redis Cloud. Must use `rediss://` (TLS) in prod. |
| `META_APP_ID` / `META_APP_SECRET` | `/api/auth/meta/*` | From Meta Developer dashboard. |
| `META_REDIRECT_URI` | `/api/auth/meta/*` | Must match exactly what is registered in the Meta app. In prod this is `https://<your-domain>/api/auth/meta/callback`. |
| `META_SCOPES` | Meta connect button | Keep as in `.env.example` unless you know what you're doing. |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` / `LINKEDIN_REDIRECT_URI` | LinkedIn OAuth | Registered in the LinkedIn Developer app. |
| `GMB_CLIENT_ID` / `GMB_CLIENT_SECRET` / `GMB_REDIRECT_URI` | Google Business Profile OAuth | Registered in Google Cloud Console → OAuth consent + Credentials. |

### Switching from local to production URLs

Every OAuth provider needs the **production redirect URI** added to its app settings:

- Meta: _App dashboard → Facebook Login for Business → Settings → Valid OAuth Redirect URIs_
- LinkedIn: _App → Auth → Authorized redirect URLs_
- Google: _Credentials → Web client → Authorized redirect URIs_

If you forget, the browser will redirect to the provider, the provider will reject, and the user bounces back with `meta_error=invalid_state` (or similar).

## 2. Supabase migrations

Run all migrations in `supabase/migrations/` in order. The most recent ones:

- `007_drafts.sql` — editor state persistence
- `008_social_connections_status.sql` — `needs_reauth` flag + `last_auth_error`

```
npx supabase db push
```

## 3. Running the worker in production

The worker is a separate long-running node process. On your host (Railway, Fly, Render, a VM, etc.) run:

```
node src/worker/scheduler-worker.js
```

…with `REDIS_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_KEY` injected. Auto-restart on crash (systemd, pm2, the platform's built-in restart, etc.).

## 4. Security notes — what changed for prod-readiness

- All OAuth state cookies use `secure: !dev` so they are only sent over HTTPS in prod.
- API routes `/api/publish/facebook`, `/api/scheduler/schedule`, `/api/scheduler/cancel` now require the browser to send `Authorization: Bearer <supabase-access-token>`. The server validates the JWT via `supabase.auth.getUser(jwt)` and uses **that** user id — the body-provided `userId` is ignored. Frontend uses `authFetch` to attach the header automatically.
- The worker detects Meta `OAuthException` / token-expired errors and sets `social_connections.needs_reauth = true`, so your UI can prompt the user to reconnect instead of retrying forever.
- Google (GMB) access tokens are refreshed in the worker using the stored refresh token when they are within 60s of expiry (`src/lib/server/google.ts`). If there is no refresh token, the job fails with a "user must reconnect" message.

## 5. Known gaps to watch

- Access tokens are still stored in plaintext in Supabase `social_connections.access_token`. Add column-level encryption (pgcrypto / Supabase Vault) if you handle non-test accounts.
- LinkedIn doesn't return refresh tokens by default on the basic plan; expired LinkedIn connections will need a full reconnect.
- The worker is single-process. For multi-region or multi-worker setups, add a lock (`SELECT … FOR UPDATE SKIP LOCKED`) around the claim step, or move claims into a Supabase RPC.

## 6. Quick smoke test after deploy

1. Sign in, go to **Settings → Integrations → Connect Meta**.
2. Verify callback redirects to `/dashboard/post-scheduler?meta_connected=1&ig_found=...`.
3. On the post-tests page, "Post now" a single photo → check your Facebook Page.
4. "Schedule" a photo ~1 minute out → verify it appears on the calendar and publishes on time.
5. Tail the worker logs to confirm `[worker] picked up job ... ✓ completed job ...`.
