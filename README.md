# GSC Dashboard Backend (Template)

Vercel serverless backend that exposes Google Search Console **Performance** data as JSON, for consumption by a Lovable dashboard embedded via iframe on `clearleaddigital.com`.

**Deployment model: one Vercel project per client.** This repo is the template — fork or clone it once, then deploy a fresh Vercel project per client with their own `GOOGLE_REFRESH_TOKEN`, `GSC_SITE_URL`, and `CLIENT_NAME`. The Google OAuth client app itself (Client ID + Secret) can be shared across all client deployments. See [Onboarding a new client](#onboarding-a-new-client) below.

## What's exposed

| Endpoint           | Dimension | Default `?days=` | Default `?limit=` |
| ------------------ | --------- | ---------------- | ----------------- |
| `/api/performance` | `date`    | 90               | n/a               |
| `/api/pages`       | `page`    | 90               | 500 (max 5000)    |
| `/api/queries`     | `query`   | 90               | 500 (max 5000)    |
| `/api/countries`   | `country` | 90               | 250 (max 1000)    |
| `/api/devices`     | `device`  | 90               | n/a               |
| `/api/health`      | —         | —                | —                 |

All endpoints accept `?days=N` (max 480, GSC retains ~16 months). Page/query/country endpoints accept `?limit=N`.

Response shape:
```json
{
  "meta": { "site": "...", "startDate": "...", "endDate": "...", "days": 90, "rowCount": 42, "generatedAt": "..." },
  "totals": { "clicks": 0, "impressions": 0, "ctr": 0, "position": 0 },  // only on /api/performance
  "data":  [ { ...row... } ]
}
```

Responses are cached at the Vercel edge for 1 hour (`s-maxage=3600`) with `stale-while-revalidate=86400`. GSC data has a 2-3 day lag, so this won't show stale info from the dashboard's perspective.

## What's NOT exposed

GSC's public API does **not** include Crawl Stats (Googlebot requests, redirect rates, response times, file-type breakdowns). That data is only available via the GSC UI's Settings → Crawl stats page. If you need it in the dashboard, options are:
1. Manual CSV export → drop into a `data/` folder and add a separate CSV-reading endpoint.
2. Headless-browser scrape (fragile, against GSC ToS — not recommended).

## First-time setup (do this once for your agency)

### 1. Create a shared Google Cloud OAuth app

You only do this **once across all clients**. The same Client ID + Secret will authorize every client's refresh token.

1. Create or pick a project at https://console.cloud.google.com.
2. **Enable** "Google Search Console API" under APIs & Services → Library.
3. Under APIs & Services → **OAuth consent screen**, configure as "External". Add the scope `https://www.googleapis.com/auth/webmasters.readonly`. **Publish** the app (or add each client's Google email as a test user — see the trade-offs in the [OAuth consent scope](#oauth-consent-scope) section below).
4. Under APIs & Services → **Credentials**, create an "OAuth 2.0 Client ID" of type **Web application**:
   - Authorized redirect URI: `http://localhost:8765/oauth/callback`
5. Save the Client ID and Client Secret somewhere you'll reuse for every client deployment (e.g. 1Password, agency secrets vault).

## Onboarding a new client

Repeat per client. Takes ~5 minutes once you've done it once.

### 1. Get the client's refresh token

The client must grant your OAuth app access to their GSC property:

```bash
npm install
export GOOGLE_CLIENT_ID="<shared client id from setup>"
export GOOGLE_CLIENT_SECRET="<shared client secret from setup>"
npm run get-token
```

Open the URL it prints in a browser the **client** is signed into (or have them screen-share / use a temporary session). They approve the consent screen. Your terminal prints their `GOOGLE_REFRESH_TOKEN`.

> **Already have a refresh token from a prior Lovable setup?** Skip this step — just paste the existing token into Vercel in step 3.

### 2. Create a fresh Vercel project for the client

From this repo's directory:
```bash
npx vercel link              # choose "Link to different project" → "Create new project"
# Name it something like: gsc-api-<clientslug>
```

### 3. Set the per-client env vars

```bash
npx vercel env add CLIENT_NAME production            # e.g. ironcladpm
npx vercel env add GOOGLE_CLIENT_ID production       # shared across all clients
npx vercel env add GOOGLE_CLIENT_SECRET production   # shared across all clients
npx vercel env add GOOGLE_REFRESH_TOKEN production   # the client's refresh token from step 1
npx vercel env add GSC_SITE_URL production           # e.g. sc-domain:ironcladpm.com
npx vercel env add ALLOWED_ORIGINS production        # https://clearleaddigital.com,https://www.clearleaddigital.com,<client's lovable URL>
```

### 4. Deploy and verify

```bash
npx vercel --prod
curl https://<the-deployment-url>/api/health
```

The `/api/health` response should show `"client": "<your client name>"` and all four `configured.*` flags as `true`.

### 5. Wire the client's Lovable dashboard

In their Lovable project, point fetches at the new deployment:

```js
const base = "https://gsc-api-<clientslug>.vercel.app";
const perf = await fetch(`${base}/api/performance?days=90`).then(r => r.json());
const pages = await fetch(`${base}/api/pages?days=90&limit=100`).then(r => r.json());
```

Done. The dashboard now auto-refreshes from GSC daily (with 1-hour edge cache).

## Local dev

```bash
cp .env.example .env
# fill in .env
npm install
npx vercel dev
# → http://localhost:3000/api/health
```

## OAuth consent scope

When you set up your OAuth app, you choose between two modes on the consent screen:

- **Testing mode**: free, but you must add each client's Google email as a "test user" in the Cloud Console before they can authorize. Refresh tokens expire after 7 days. **Not viable for production.**
- **Published mode (External, In production)**: any Google account can authorize. Refresh tokens don't expire (until revoked). Requires a verification flow from Google — for read-only scopes like `webmasters.readonly` this is a quick self-attestation, not a full security audit.

For a multi-client agency, **publish the app**. The verification screen for `webmasters.readonly` is one of Google's lighter-touch reviews.

## Notes on GSC site URL format

- **Domain property** (recommended): `sc-domain:ironcladpm.com` — captures every protocol/subdomain variant in one query. Best for the ironcladpm.com data which has both `http://www.` and `https://` versions of the homepage being indexed separately.
- **URL-prefix property**: `https://ironcladpm.com/` — exact match only. You'd need a separate property/query per variant.

## Adding more dimensions

GSC's `searchanalytics.query` supports combining dimensions (e.g. `["page", "query"]`). To add a "top queries per page" endpoint, copy `api/pages.js` and pass `dimensions: ["page", "query"]` plus appropriate row mapping. See `api/_utils/gsc.js` for the wrapper.
